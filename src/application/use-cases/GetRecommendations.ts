import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { Recommendation } from '../../domain/entities/Recommendation';
import { RecommendationEngine } from '../../services/RecommendationEngine';

export class GetRecommendations {
  constructor(private activityRepository: IActivityRepository) {}

  async execute(userId: number): Promise<Recommendation[]> {
    // Retrieve past 30 days of activities to determine behavior profile
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const result = await this.activityRepository.findByUserId(userId, { startDate });
    return RecommendationEngine.generate(result.activities);
  }
}
