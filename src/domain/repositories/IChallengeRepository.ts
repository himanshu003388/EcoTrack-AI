import { Challenge, UserChallenge } from '../entities/Challenge';

export interface JoinedUserChallenge extends UserChallenge {
  title: string;
  category: string;
  description: string;
  pointsReward: number;
  co2Target: number;
  durationDays: number;
}

export interface IChallengeRepository {
  listAll: () => Promise<Challenge[]>;
  findById: (id: number) => Promise<Challenge | null>;
  getUserChallenges: (userId: number) => Promise<JoinedUserChallenge[]>;
  getUserChallenge: (userId: number, challengeId: number) => Promise<UserChallenge | null>;
  joinChallenge: (userId: number, challengeId: number) => Promise<UserChallenge>;
  updateChallengeProgress: (
    userId: number,
    challengeId: number,
    progress: number,
    status: UserChallenge['status'],
  ) => Promise<UserChallenge>;
}
