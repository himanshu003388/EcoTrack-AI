import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { Recommendation } from '../../domain/entities/Recommendation';
import { TTLCache } from '../../infrastructure/cache/TTLCache';
import { RecommendationEngine } from '../../services/RecommendationEngine';

const recommendationsCache = new TTLCache<Recommendation[]>(30_000);

export function clearRecommendationsCache(userId?: number): void {
  recommendationsCache.invalidate(userId !== undefined ? `recommendations_${userId}` : undefined);
}

export class GetRecommendations {
  constructor(private activityRepository: IActivityRepository) {}

  /**
   * Retrieves or computes a list of recommended carbon-reduction strategies for a user.
   *
   * @param userId - The ID of the user.
   * @returns A Promise resolving to an array of ranked Recommendations.
   */
  async execute(userId: number): Promise<Recommendation[]> {
    const cacheKey = `recommendations_${userId}`;
    const cached = recommendationsCache.get(cacheKey);
    if (cached) return cached;

    // Retrieve past 30 days of activities to determine behavior profile
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const result = await this.activityRepository.findByUserId(userId, { startDate });
    const res = RecommendationEngine.generate(result.activities);
    recommendationsCache.set(cacheKey, res);
    return res;
  }
}
