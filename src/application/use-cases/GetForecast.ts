import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { IGoalRepository } from '../../domain/repositories/IGoalRepository';
import { ForecastService, ForecastReport } from '../../services/ForecastService';

export class GetForecast {
  constructor(
    private activityRepository: IActivityRepository,
    private goalRepository: IGoalRepository
  ) {}

  async execute(userId: number): Promise<ForecastReport> {
    const actResult = await this.activityRepository.findByUserId(userId, { limit: 1000 });
    const currentGoal = await this.goalRepository.findCurrentGoal(userId);
    return ForecastService.generate(actResult.activities, currentGoal);
  }
}
