import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IChallengeRepository } from '../../domain/repositories/IChallengeRepository';
import { Activity, ActivityCategory } from '../../domain/entities/Activity';
import { User } from '../../domain/entities/User';
import { EmissionCalculator } from '../../services/EmissionCalculator';
import { calculateLevel } from '../../domain/level';
import { clearDashboardCache } from './GetDashboardData';
import { clearForecastCache } from './GetForecast';
import { clearRecommendationsCache } from './GetRecommendations';
import { clearReportCache } from './GenerateReport';

/** Input data required to log a new carbon activity. */
export interface LogActivityInput {
  userId: number;
  category: ActivityCategory;
  subcategory: string;
  quantity: number;
  unit: string;
  /** Optional timestamp; defaults to current UTC time if not provided. Must not be in the future. */
  timestamp?: Date;
  isRecurring?: boolean;
  recurrencePeriod?: 'daily' | 'weekly' | 'none';
}

/** Points awarded per activity log. */
const POINTS_PER_LOG = 10;
/** Additional bonus points for extending a daily consecutive logging streak. */
const STREAK_BONUS_POINTS = 5;

/**
 * Use case: Log a carbon-emitting (or carbon-saving) activity for a user.
 *
 * Validates the input, calculates CO2 emissions using emission factors,
 * persists the activity, and updates the user's points, level, and streak.
 */
export class LogActivity {
  constructor(
    private activityRepository: IActivityRepository,
    private userRepository: IUserRepository,
    private challengeRepository: IChallengeRepository
  ) {}

  /**
   * Execute the log activity use case.
   *
   * @param input - The activity data to log.
   * @returns The created Activity record.
   * @throws Error if the category, subcategory, or timestamp is invalid.
   */
  async execute(input: LogActivityInput): Promise<Activity> {
    const VALID_CATEGORIES: ActivityCategory[] = ['transport', 'energy', 'food', 'shopping_waste'];
    if (!VALID_CATEGORIES.includes(input.category)) {
      throw new Error(`Invalid category: "${input.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}.`);
    }

    const factorInfo = EmissionCalculator.getFactorInfo(
      input.category,
      input.subcategory
    );
    if (!factorInfo) {
      throw new Error(`Invalid subcategory: "${input.subcategory}" for category "${input.category}".`);
    }

    const timestamp = input.timestamp || new Date();

    // Business rule: activities cannot be timestamped in the future
    const now = new Date();
    if (timestamp > now) {
      throw new Error('Activity timestamp cannot be in the future.');
    }

    const co2Emissions = EmissionCalculator.calculate(
      input.category,
      input.subcategory,
      input.quantity
    );

    const activity = await this.activityRepository.create({
      userId: input.userId,
      category: input.category,
      subcategory: input.subcategory,
      quantity: input.quantity,
      unit: input.unit,
      co2Emissions,
      timestamp,
      isRecurring: !!input.isRecurring,
      recurrencePeriod: input.recurrencePeriod || 'none',
    });

    // Fetch user once and reuse across sub-operations (avoids duplicate DB calls)
    const user = await this.userRepository.findById(input.userId);
    if (user) {
      await this.updateUserPointsAndStreak(user.id, user.points, user.streak);
      await this.progressActiveChallenges(user, input.category);
    }

    clearDashboardCache(input.userId);
    clearForecastCache(input.userId);
    clearRecommendationsCache(input.userId);
    clearReportCache(input.userId);

    return activity;
  }

  /**
   * Updates the user's total points, level, and streak after logging an activity.
   * Awards streak bonus points if the user extends their consecutive logging streak.
   *
   * @param userId - ID of the user.
   * @param currentPoints - Current point total before this log.
   * @param currentStreak - Current streak count before this log.
   * @returns The number of points earned this log event.
   */
  private async updateUserPointsAndStreak(
    userId: number,
    currentPoints: number,
    currentStreak: number
  ): Promise<number> {
    let pointsEarned = POINTS_PER_LOG;
    const streakInfo = await this.activityRepository.getStreakInfo(userId);
    let newStreak = currentStreak;

    if (streakInfo.currentStreak > currentStreak) {
      newStreak = streakInfo.currentStreak;
      pointsEarned += STREAK_BONUS_POINTS;
    } else if (streakInfo.currentStreak === 0 && currentStreak > 0) {
      newStreak = 0;
    }

    const totalPoints = currentPoints + pointsEarned;
    const newLevel = calculateLevel(totalPoints);

    await this.userRepository.updatePointsAndLevel(userId, totalPoints, newLevel);
    await this.userRepository.updateStreak(userId, newStreak);

    return pointsEarned;
  }

  /**
   * Updates the progress of any active challenges matching the logged activity category.
   * Automatically completes challenges that have reached their duration target and awards reward points.
   *
   * @param user - The user entity (passed in to avoid a duplicate DB fetch).
   * @param category - The category of the activity just logged.
   */
  private async progressActiveChallenges(
    user: User,
    category: ActivityCategory
  ): Promise<void> {
    const activeChallenges = await this.challengeRepository.getUserChallenges(user.id);
    const categoryChallenges = activeChallenges.filter(
      (c) => c.status === 'active' && c.category === category
    );

    if (categoryChallenges.length === 0) return;

    for (const joinedCh of categoryChallenges) {
      const newProgress = Math.min(joinedCh.durationDays, joinedCh.progress + 1);
      let newStatus: typeof joinedCh.status = 'active';

      if (newProgress >= joinedCh.durationDays) {
        newStatus = 'completed';
        // Re-fetch to get latest points (may have been updated by updateUserPointsAndStreak above)
        const freshUser = await this.userRepository.findById(user.id);
        if (freshUser) {
          const newPoints = freshUser.points + joinedCh.pointsReward;
          const newLvl = calculateLevel(newPoints);
          await this.userRepository.updatePointsAndLevel(freshUser.id, newPoints, newLvl);
        }
      }

      await this.challengeRepository.updateChallengeProgress(
        user.id,
        joinedCh.challengeId,
        newProgress,
        newStatus
      );
    }
  }
}
