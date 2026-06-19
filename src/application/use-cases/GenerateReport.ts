import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IGoalRepository } from '../../domain/repositories/IGoalRepository';
import { TTLCache } from '../../infrastructure/cache/TTLCache';
import { DatabaseConnection } from '../../infrastructure/database/DatabaseConnection';

export interface ReportSummary {
  period: string; // e.g. 'Last 30 Days'
  totalEmissions: number;
  averageDaily: number;
  carbonSaved: number; // compared to national average baseline
  moneySaved: number; // estimated financial savings
  streak: number;
  points: number;
  level: string;
  categoryBreakdown: { category: string; emissions: number }[];
  goals: { target: number; achieved: boolean; date: string }[];
  badgesCount: number;
}

const reportCache = new TTLCache<ReportSummary>(30_000);

export function clearReportCache(userId?: number): void {
  reportCache.invalidate(userId !== undefined ? `report_${userId}` : undefined);
}

export class GenerateReport {
  constructor(
    private activityRepository: IActivityRepository,
    private userRepository: IUserRepository,
    private goalRepository: IGoalRepository,
    private db: DatabaseConnection,
  ) {}

  /**
   * Compiles the sustainability report metrics card for a specific user over the last 30 days.
   *
   * @param userId - The ID of the user.
   * @returns A Promise resolving to the ReportSummary details.
   * @throws Error if the user is not found.
   */
  async execute(userId: number): Promise<ReportSummary> {
    const cacheKey = `report_${userId}`;
    const cached = reportCache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [user, actResult, goalsList, bRes] = await Promise.all([
      this.userRepository.findById(userId),
      this.activityRepository.findByUserId(userId, { startDate: thirtyDaysAgo, limit: 1000 }),
      this.goalRepository.listGoals(userId),
      this.db.query<{ count: string | number }>('SELECT COUNT(*) as count FROM user_badges WHERE user_id = $1', [
        userId,
      ]),
    ]);

    if (!user) throw new Error('User not found.');
    const activities = actResult.activities;

    let totalEmissions = 0;
    let moneySaved = 0;
    const logDaysSet = new Set<string>();
    const breakdownMap: Record<string, number> = { transport: 0, energy: 0, food: 0, shopping_waste: 0 };

    for (const act of activities) {
      totalEmissions += act.co2Emissions;
      logDaysSet.add(act.timestamp.toDateString());
      breakdownMap[act.category] = (breakdownMap[act.category] as number) + act.co2Emissions;

      // Money saved
      if (act.category === 'transport') {
        if (act.subcategory === 'bike' || act.subcategory === 'walking') {
          moneySaved += act.quantity * 0.2; // $0.20 per km
        } else if (act.subcategory === 'train' || act.subcategory === 'bus') {
          moneySaved += act.quantity * 0.1; // $0.10 savings per km compared to driving
        }
      } else if (act.category === 'energy' && act.subcategory === 'solar') {
        moneySaved += act.quantity * 0.15; // $0.15 per kWh
      } else if (act.category === 'food' && (act.subcategory === 'vegan' || act.subcategory === 'vegetarian')) {
        moneySaved += act.quantity * 3.0; // $3.00 saved per meal
      } else if (act.category === 'shopping_waste' && act.subcategory === 'recycling') {
        moneySaved += act.quantity * 0.5; // $0.50 saved per kg
      }
    }

    const logDays = logDaysSet.size;
    const activeDays = Math.max(1, logDays);
    const averageDaily = totalEmissions / activeDays;

    // 2. Carbon Saved
    const baselineDaily = 16.0;
    const carbonSaved = Math.max(0, Math.round((baselineDaily * activeDays - totalEmissions) * 10) / 10);

    // 4. Category breakdown
    const categories = ['transport', 'energy', 'food', 'shopping_waste'];
    const categoryBreakdown = categories.map((cat) => ({
      category: cat,
      emissions: Math.round((breakdownMap[cat] as number) * 10) / 10,
    }));

    // 5. Goals tracking
    const goals = goalsList.map((g) => ({
      target: g.targetCo2,
      achieved: g.achieved,
      date: g.endDate.toISOString().split('T')[0] as string,
    }));

    // 6. Badges count
    const firstRow = bRes[0];
    const badgesCount = firstRow ? parseInt(String(firstRow.count), 10) : 0;

    const result = {
      period: 'Last 30 Days',
      totalEmissions: Math.round(totalEmissions * 10) / 10,
      averageDaily: Math.round(averageDaily * 10) / 10,
      carbonSaved,
      moneySaved: Math.round(moneySaved * 10) / 10,
      streak: user.streak,
      points: user.points,
      level: user.level,
      categoryBreakdown,
      goals,
      badgesCount,
    };
    reportCache.set(cacheKey, result);
    return result;
  }
}
