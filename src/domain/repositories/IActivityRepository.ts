import { Activity, ActivityCategory } from '../entities/Activity';

export interface ActivityFilters {
  category?: ActivityCategory;
  subcategory?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CategorySummary {
  category: ActivityCategory;
  totalEmissions: number;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  totalEmissions: number;
}

export interface IActivityRepository {
  create: (activity: Omit<Activity, 'id'>) => Promise<Activity>;
  findById: (id: number) => Promise<Activity | null>;
  findByUserId: (userId: number, filters?: ActivityFilters) => Promise<{ activities: Activity[]; total: number }>;
  delete: (id: number, userId: number) => Promise<boolean>;
  getCategorySummary: (userId: number, startDate: Date, endDate: Date) => Promise<CategorySummary[]>;
  getDailyEmissionsSummary: (userId: number, startDate: Date, endDate: Date) => Promise<DailySummary[]>;
  getStreakInfo: (userId: number) => Promise<{ lastLogDate: Date | null; currentStreak: number }>;
}
