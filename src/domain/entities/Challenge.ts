import { ActivityCategory } from './Activity';

export interface Challenge {
  id: number;
  title: string;
  category: ActivityCategory;
  description: string;
  pointsReward: number;
  co2Target: number; // target reduction or ceiling in kg
  durationDays: number;
}

export interface UserChallenge {
  userId: number;
  challengeId: number;
  status: 'active' | 'completed' | 'failed';
  progress: number; // e.g. how many days successfully logged or % completed
  startedAt: Date;
  completedAt?: Date;
}
