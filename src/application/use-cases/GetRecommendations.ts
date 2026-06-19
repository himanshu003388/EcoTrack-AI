import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { Recommendation } from '../../domain/entities/Recommendation';
import { RecommendationEngine } from '../../services/RecommendationEngine';

const recommendationsCache = new Map<string, { data: Recommendation[]; expiresAt: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Clears the cached recommendations data.
 *
 * @param userId - Optional specific user ID to clear cache for. If omitted, clears all cache.
 */
export function clearRecommendationsCache(userId?: number): void {
  if (userId !== undefined) {
    recommendationsCache.delete(`recommendations_${userId}`);
  } else {
    recommendationsCache.clear();
  }
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
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Retrieve past 30 days of activities to determine behavior profile
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const result = await this.activityRepository.findByUserId(userId, { startDate });
    const res = RecommendationEngine.generate(result.activities);
    recommendationsCache.set(cacheKey, { data: res, expiresAt: Date.now() + CACHE_TTL_MS });
    return res;
  }
}
