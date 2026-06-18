import { describe, it, expect } from 'vitest';
import { IUserRepository } from '../domain/repositories/IUserRepository';
import { IActivityRepository } from '../domain/repositories/IActivityRepository';
import { IGoalRepository } from '../domain/repositories/IGoalRepository';
import { IChallengeRepository } from '../domain/repositories/IChallengeRepository';


describe('Repository interface contracts', () => {
  it('IUserRepository defines required methods', () => {
    const repo: IUserRepository = {
      findByEmail: async () => null,
      findById: async () => null,
      create: async () => ({} as any),
      updatePointsAndLevel: async () => {},
      updateStreak: async () => {},
    };
    expect(repo.findByEmail).toBeDefined();
    expect(repo.findById).toBeDefined();
    expect(repo.create).toBeDefined();
    expect(repo.updatePointsAndLevel).toBeDefined();
    expect(repo.updateStreak).toBeDefined();
  });

  it('IActivityRepository defines required methods', () => {
    const repo: IActivityRepository = {
      create: async () => ({} as any),
      findByUserId: async () => ({ activities: [], total: 0 }),
      findById: async () => null,
      delete: async () => true,
      getCategorySummary: async () => [],
      getDailyEmissionsSummary: async () => [],
      getStreakInfo: async () => ({ lastLogDate: null, currentStreak: 0 }),
    };
    expect(repo.create).toBeDefined();
    expect(repo.findByUserId).toBeDefined();
    expect(repo.findById).toBeDefined();
    expect(repo.delete).toBeDefined();
    expect(repo.getCategorySummary).toBeDefined();
    expect(repo.getDailyEmissionsSummary).toBeDefined();
    expect(repo.getStreakInfo).toBeDefined();
  });

  it('IGoalRepository defines required methods', () => {
    const repo: IGoalRepository = {
      create: async () => ({} as any),
      findCurrentGoal: async () => null,
      listGoals: async () => [],
      updateGoalAchievement: async () => {},
    };
    expect(repo.create).toBeDefined();
    expect(repo.findCurrentGoal).toBeDefined();
    expect(repo.listGoals).toBeDefined();
    expect(repo.updateGoalAchievement).toBeDefined();
  });

  it('IChallengeRepository defines required methods', () => {
    const repo: IChallengeRepository = {
      listAll: async () => [],
      findById: async () => null,
      getUserChallenges: async () => [],
      getUserChallenge: async () => null,
      joinChallenge: async () => ({} as any),
      updateChallengeProgress: async () => ({} as any),
    };
    expect(repo.listAll).toBeDefined();
    expect(repo.findById).toBeDefined();
    expect(repo.getUserChallenges).toBeDefined();
    expect(repo.getUserChallenge).toBeDefined();
    expect(repo.joinChallenge).toBeDefined();
    expect(repo.updateChallengeProgress).toBeDefined();
  });


});
