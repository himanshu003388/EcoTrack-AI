import { IActivityRepository, ActivityFilters } from '../../domain/repositories/IActivityRepository';
import { Activity } from '../../domain/entities/Activity';

export interface GetActivitiesResult {
  activities: Activity[];
  total: number;
}

export class GetActivities {
  constructor(private activityRepository: IActivityRepository) {}

  /**
   * Retrieves a list of activities for a user based on specified filters.
   *
   * @param userId - The ID of the user.
   * @param filters - Optional query filters (category, search, limit, offset, date range).
   * @returns A Promise resolving to an object containing the list of activities and total count.
   */
  async execute(userId: number, filters?: ActivityFilters): Promise<GetActivitiesResult> {
    return await this.activityRepository.findByUserId(userId, filters);
  }
}
