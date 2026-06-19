import { Goal } from '../entities/Goal';

export interface IGoalRepository {
  create: (goal: Omit<Goal, 'id'>) => Promise<Goal>;
  findCurrentGoal: (userId: number) => Promise<Goal | null>;
  listGoals: (userId: number) => Promise<Goal[]>;
  updateGoalAchievement: (id: number, achieved: boolean) => Promise<void>;
}
