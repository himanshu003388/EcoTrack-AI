import { User } from '../entities/User';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  create(email: string, username: string, passwordHash: string): Promise<User>;
  updatePointsAndLevel(userId: number, points: number, level: User['level']): Promise<void>;
  updateStreak(userId: number, streak: number): Promise<void>;
}
