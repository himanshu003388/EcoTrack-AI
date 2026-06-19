import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { IGoalRepository } from '../../domain/repositories/IGoalRepository';
import { ForecastService, ForecastReport } from '../../services/ForecastService';

const forecastCache = new Map<string, { data: ForecastReport; expiresAt: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Clears the cached carbon emission forecast data.
 *
 * @param userId - Optional specific user ID to clear cache for. If omitted, clears all cache.
 */
export function clearForecastCache(userId?: number): void {
  if (userId !== undefined) {
    forecastCache.delete(`forecast_${userId}`);
  } else {
    forecastCache.clear();
  }
}

export class GetForecast {
  constructor(
    private activityRepository: IActivityRepository,
    private goalRepository: IGoalRepository
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
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const [actResult, currentGoal] = await Promise.all([
      this.activityRepository.findByUserId(userId, { limit: 1000 }),
      this.goalRepository.findCurrentGoal(userId)
    ]);
    const result = ForecastService.generate(actResult.activities, currentGoal);
    forecastCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }
}
