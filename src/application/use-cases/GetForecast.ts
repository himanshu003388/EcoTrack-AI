import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { IGoalRepository } from '../../domain/repositories/IGoalRepository';
import { TTLCache } from '../../infrastructure/cache/TTLCache';
import { ForecastService, ForecastReport } from '../../services/ForecastService';

const forecastCache = new TTLCache<ForecastReport>(30_000);

export function clearForecastCache(userId?: number): void {
  forecastCache.invalidate(userId !== undefined ? `forecast_${userId}` : undefined);
}

export class GetForecast {
  constructor(
    private activityRepository: IActivityRepository,
    private goalRepository: IGoalRepository,
  ) {}

  /**
   * Retrieves or computes the carbon emissions forecast report for a user.
   *
   * @param userId - The ID of the user.
   * @returns A Promise resolving to the generated ForecastReport.
   */
  async execute(userId: number): Promise<ForecastReport> {
    const cacheKey = `forecast_${userId}`;
    const cached = forecastCache.get(cacheKey);
    if (cached) return cached;

    const [actResult, currentGoal] = await Promise.all([
      this.activityRepository.findByUserId(userId, { limit: 1000 }),
      this.goalRepository.findCurrentGoal(userId),
    ]);
    const result = ForecastService.generate(actResult.activities, currentGoal);
    forecastCache.set(cacheKey, result);
    return result;
  }
}
