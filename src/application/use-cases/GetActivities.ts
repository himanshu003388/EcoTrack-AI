import { IActivityRepository, ActivityFilters } from '../../domain/repositories/IActivityRepository';
import { Activity } from '../../domain/entities/Activity';

export interface GetActivitiesResult {
  activities: Activity[];
  total: number;
}

export class GetActivities {
  constructor(private activityRepository: IActivityRepository) {}

  async execute(userId: number, filters?: ActivityFilters): Promise<GetActivitiesResult> {
    return await this.activityRepository.findByUserId(userId, filters);
  }
}
