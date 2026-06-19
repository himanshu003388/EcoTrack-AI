import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IGoalRepository } from '../../domain/repositories/IGoalRepository';
import { TTLCache } from '../../infrastructure/cache/TTLCache';
import { EmissionCalculator } from '../../services/EmissionCalculator';
import { Activity, ActivityCategory } from '../../domain/entities/Activity';

/** Shape of the dashboard data returned to the API consumer. */
export interface DashboardData {
  sustainabilityScore: number;
  emissions: {
    today: number;
    weekly: number;
    monthly: number;
    annualProjection: number;
  };
  averages: {
    nationalDaily: number;
    globalDaily: number;
    sustainableDaily: number;
  };
  highestSource: {
    category: ActivityCategory | 'None';
    percentage: number;
    emissions: number;
  };
  lowestSource: {
    category: ActivityCategory | 'None';
    emissions: number;
  };
  categoryBreakdown: {
    category: ActivityCategory;
    emissions: number;
    percentage: number;
  }[];
  equivalents: {
    treesNeeded: number;
    carKm: number;
    electricityHours: number;
    phoneCharges: number;
  };
  trends: { date: string; emissions: number }[];
  explanation: string;
  userStats: {
    username: string;
    points: number;
    level: string;
    streak: number;
  };
  currentGoal: {
    targetCo2: number;
    achieved: boolean;
    endDate: Date;
  } | null;
}

const dashboardCache = new TTLCache<DashboardData>(30_000);

export function clearDashboardCache(userId?: number): void {
  dashboardCache.invalidate(userId !== undefined ? `dashboard_${userId}` : undefined);
}

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const TREND_DAYS = 15;
const DAYS_IN_YEAR = 365;
const SUSTAINABLE_DAILY_TARGET_KG = 5.5;
const BASELINE_SCORE = 70;
const SCORE_MAX = 100;
const SCORE_MIN = 10;
const SCORE_REDUCTION_RATE = 10;
const SCORE_EXCEED_SCALE = 15;
const SCORE_EXCEED_RATE = 80;
const SCORE_BASE = 90;

/**
 * Use case: Compile all Carbon Intelligence Dashboard data for a user.
 *
 * Fetches activities once (last 30 days) and computes all time-based aggregates
 * in memory to minimize database round trips. Independent repository calls
 * (trend data, category summaries, current goal) are parallelized via Promise.all.
 */
export class GetDashboardData {
  constructor(
    private activityRepository: IActivityRepository,
    private userRepository: IUserRepository,
    private goalRepository: IGoalRepository,
  ) {}

  /**
   * Execute the dashboard data compilation.
   *
   * @param userId - The ID of the user to compile data for.
   * @returns Fully assembled DashboardData object.
   * @throws Error if the user is not found.
   */
  async execute(userId: number): Promise<DashboardData> {
    const cacheKey = `dashboard_${userId}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found.');

    const now = new Date();

    // Date boundaries
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - DAYS_IN_WEEK * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - DAYS_IN_MONTH * 24 * 60 * 60 * 1000);
    const startOfTrend = new Date(now.getTime() - TREND_DAYS * 24 * 60 * 60 * 1000);

    // 1. Parallel fetch: one broad activity load + category summary + trend data + current goal
    //    Activities are fetched for the last 30 days in a single query; sub-ranges are computed in memory.
    const [monthlyResult, categorySummary, rawTrends, currentGoalData] = await Promise.all([
      this.activityRepository.findByUserId(userId, { startDate: startOfMonth }),
      this.activityRepository.getCategorySummary(userId, startOfMonth, now),
      this.activityRepository.getDailyEmissionsSummary(userId, startOfTrend, now),
      this.goalRepository.findCurrentGoal(userId),
    ]);

    const allActivities: Activity[] = monthlyResult.activities;

    // 2. Compute time-based aggregates in memory (avoids 2 extra DB queries)
    let todayEmissions = 0;
    let weeklyEmissions = 0;
    let monthlyEmissions = 0;

    for (const a of allActivities) {
      // Repository mapping already converts timestamp to a Date.
      const t = a.timestamp;
      monthlyEmissions += a.co2Emissions;
      if (t >= startOfWeek) weeklyEmissions += a.co2Emissions;
      if (t >= startOfToday) todayEmissions += a.co2Emissions;
    }

    // 3. Annual projection — proportional to actual tracked days (not always 30)
    //    Use min(30, days since account creation) as the denominator so new users
    //    don't get an inflated projection.
    const trackedDays = Math.min(
      DAYS_IN_MONTH,
      Math.max(1, Math.round((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))),
    );
    const dailyAverage = monthlyEmissions / trackedDays;
    const annualProjection = dailyAverage * DAYS_IN_YEAR;

    // 4. Category breakdown
    const categories: ActivityCategory[] = ['transport', 'energy', 'food', 'shopping_waste'];
    const breakdownMap: Record<ActivityCategory, number> = {
      transport: 0,
      energy: 0,
      food: 0,
      shopping_waste: 0,
    };
    categorySummary.forEach((c) => {
      breakdownMap[c.category] = c.totalEmissions;
    });

    let highestSourceCat: ActivityCategory | 'None' = 'None';
    let highestSourceVal = -1;
    let lowestSourceCat: ActivityCategory | 'None' = 'None';
    let lowestSourceVal = Infinity;

    const categoryBreakdown = categories.map((cat) => {
      const emissions = breakdownMap[cat];
      const roundedEmissions = Math.round(emissions * 10) / 10;
      const percentage = monthlyEmissions > 0 ? Math.round((emissions / monthlyEmissions) * 100) : 0;

      if (roundedEmissions > highestSourceVal && roundedEmissions > 0) {
        highestSourceVal = roundedEmissions;
        highestSourceCat = cat;
      }
      if (roundedEmissions < lowestSourceVal && roundedEmissions > 0) {
        lowestSourceVal = roundedEmissions;
        lowestSourceCat = cat;
      }

      return {
        category: cat,
        emissions: roundedEmissions,
        percentage,
      };
    });

    if (highestSourceVal === -1) highestSourceVal = 0;
    if (lowestSourceVal === Infinity) {
      lowestSourceVal = 0;
      lowestSourceCat = 'None';
    }

    const highestPct = monthlyEmissions > 0 ? Math.round((highestSourceVal / monthlyEmissions) * 100) : 0;

    // 6. Dynamic sustainability score
    //    Sustainable target is 5.5 kg/day. Score ∈ [10, 100].
    let sustainabilityScore = BASELINE_SCORE;
    if (monthlyEmissions > 0) {
      const targetDaily = SUSTAINABLE_DAILY_TARGET_KG;
      const averageDailyEmission = dailyAverage;
      if (averageDailyEmission <= targetDaily) {
        sustainabilityScore = Math.round(SCORE_MAX - (averageDailyEmission / targetDaily) * SCORE_REDUCTION_RATE);
      } else {
        sustainabilityScore = Math.max(
          SCORE_MIN,
          Math.round(SCORE_BASE - ((averageDailyEmission - targetDaily) / SCORE_EXCEED_SCALE) * SCORE_EXCEED_RATE),
        );
      }
    }

    // 7. Real-world equivalents (using monthly emissions)
    const treesNeeded = EmissionCalculator.getTreeEquivalent(monthlyEmissions);
    const carKm = EmissionCalculator.getCarKmEquivalent(monthlyEmissions);
    const electricityHours = EmissionCalculator.getElectricityHoursEquivalent(monthlyEmissions);
    const phoneCharges = EmissionCalculator.getPhoneChargesEquivalent(monthlyEmissions);

    // 8. Daily trend chart (last 15 days) — fill gaps with 0 for a smooth timeline
    const trendMap = new Map<string, number>();
    rawTrends.forEach((t) => trendMap.set(t.date, t.totalEmissions));

    const trends: { date: string; emissions: number }[] = [];
    for (let i = 15; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0]!;
      trends.push({
        date: dateStr,
        emissions: Math.round((trendMap.get(dateStr) ?? 0) * 10) / 10,
      });
    }

    // 9. Current goal
    const currentGoal = currentGoalData
      ? {
          targetCo2: currentGoalData.targetCo2,
          achieved: currentGoalData.achieved,
          endDate: currentGoalData.endDate,
        }
      : null;

    // 10. Human-readable explanation
    let explanation =
      "Great! You don't have any emissions recorded in the last month. Keep tracking your habits to evaluate your score.";
    if (monthlyEmissions > 0) {
      const sourceName = highestSourceCat.replace('_', ' ');
      explanation = `${sourceName.charAt(0).toUpperCase() + sourceName.slice(1)} contributes ${highestPct}% of your emissions and is your largest emission source.`;
      if (sustainabilityScore > 80) {
        explanation += ' Your footprint is well within the sustainable target range. Superb work!';
      } else if (sustainabilityScore > 50) {
        explanation +=
          ' Your footprint is close to the average. Look for quick reduction wins in transportation and energy.';
      } else {
        explanation +=
          ' Your footprint is higher than the sustainable target. Swapping some car trips for public transit or walking can make a big impact.';
      }
    }

    const result = {
      sustainabilityScore,
      emissions: {
        today: Math.round(todayEmissions * 10) / 10,
        weekly: Math.round(weeklyEmissions * 10) / 10,
        monthly: Math.round(monthlyEmissions * 10) / 10,
        annualProjection: Math.round(annualProjection * 10) / 10,
      },
      averages: {
        nationalDaily: 16.0, // US national average kg CO2e/day
        globalDaily: 11.5,
        sustainableDaily: SUSTAINABLE_DAILY_TARGET_KG,
      },
      highestSource: {
        category: highestSourceCat,
        percentage: highestPct,
        emissions: Math.round(highestSourceVal * 10) / 10,
      },
      lowestSource: {
        category: lowestSourceCat,
        emissions: Math.round(lowestSourceVal * 10) / 10,
      },
      categoryBreakdown,
      equivalents: {
        treesNeeded,
        carKm,
        electricityHours,
        phoneCharges,
      },
      trends,
      explanation,
      userStats: {
        username: user.username,
        points: user.points,
        level: user.level,
        streak: user.streak,
      },
      currentGoal,
    };

    dashboardCache.set(cacheKey, result);
    return result;
  }
}
