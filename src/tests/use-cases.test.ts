import { describe, it, expect, vi } from 'vitest';

import { LogActivity } from '../application/use-cases/LogActivity';
import { GetActivities } from '../application/use-cases/GetActivities';
import { GetDashboardData } from '../application/use-cases/GetDashboardData';
import { GetForecast } from '../application/use-cases/GetForecast';
import { GetRecommendations } from '../application/use-cases/GetRecommendations';
import { ManageChallenges } from '../application/use-cases/ManageChallenges';
import { GenerateReport } from '../application/use-cases/GenerateReport';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import type { IActivityRepository } from '../domain/repositories/IActivityRepository';
import type { IGoalRepository } from '../domain/repositories/IGoalRepository';
import type { IChallengeRepository } from '../domain/repositories/IChallengeRepository';

import type { User } from '../domain/entities/User';
import type { Activity, ActivityCategory } from '../domain/entities/Activity';
import type { DatabaseConnection } from '../infrastructure/database/DatabaseConnection';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1, email: 'test@test.com', username: 'TestUser',
  passwordHash: 'hash', points: 100, level: 'Sapling',
  streak: 3, createdAt: new Date(), ...overrides,
});

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 1, userId: 1, category: 'transport' as ActivityCategory,
  subcategory: 'car_petrol', quantity: 10, unit: 'km',
  co2Emissions: 1.8, timestamp: new Date(),
  isRecurring: false, recurrencePeriod: 'none', ...overrides,
});



describe('LogActivity use case', () => {
  const mockActivityRepo: IActivityRepository = {
    create: vi.fn().mockResolvedValue(makeActivity()),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    getCategorySummary: vi.fn(),
    getDailyEmissionsSummary: vi.fn(),
    getStreakInfo: vi.fn().mockResolvedValue({ lastLogDate: new Date(), currentStreak: 1 }),
  };
  const mockUserRepo: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeUser()),
    create: vi.fn(),
    updatePointsAndLevel: vi.fn(),
    updateStreak: vi.fn(),
  };
  const mockChallengeRepo: IChallengeRepository = {
    listAll: vi.fn(),
    findById: vi.fn(),
    getUserChallenges: vi.fn().mockResolvedValue([]),
    getUserChallenge: vi.fn(),
    joinChallenge: vi.fn(),
    updateChallengeProgress: vi.fn(),
  };

  it('should log an activity and update points', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    const result = await logActivity.execute({
      userId: 1, category: 'transport' as ActivityCategory,
      subcategory: 'car_petrol', quantity: 10, unit: 'km',
    });
    expect(result.category).toBe('transport');
    expect(mockUserRepo.updatePointsAndLevel).toHaveBeenCalled();
  });

  it('should throw for invalid category', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    await expect(logActivity.execute({
      userId: 1, category: 'invalid' as ActivityCategory,
      subcategory: 'car_petrol', quantity: 10, unit: 'km',
    })).rejects.toThrow();
  });

  it('should throw for invalid subcategory', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    await expect(logActivity.execute({
      userId: 1, category: 'transport' as ActivityCategory,
      subcategory: 'invalid_sub', quantity: 10, unit: 'km',
    })).rejects.toThrow('Invalid subcategory: "invalid_sub" for category "transport".');
  });

  it('should reject a future timestamp', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    await expect(logActivity.execute({
      userId: 1, category: 'transport' as ActivityCategory,
      subcategory: 'car_petrol', quantity: 10, unit: 'km',
      timestamp: futureDate,
    })).rejects.toThrow('Activity timestamp cannot be in the future.');
  });

  it('should log a recurring activity with recurrencePeriod', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    const result = await logActivity.execute({
      userId: 1, category: 'energy' as ActivityCategory,
      subcategory: 'electricity', quantity: 50, unit: 'kWh',
      isRecurring: true, recurrencePeriod: 'daily',
    });
    expect(result.category).toBe('transport'); // mock returns transport activity
    expect(mockActivityRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isRecurring: true, recurrencePeriod: 'daily' })
    );
  });
});

describe('GetActivities use case', () => {
  const mockActivityRepo: IActivityRepository = {
    create: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue({ activities: [makeActivity()], total: 1 }),
    findById: vi.fn(),
    delete: vi.fn(),
    getCategorySummary: vi.fn(),
    getDailyEmissionsSummary: vi.fn(),
    getStreakInfo: vi.fn(),
  };

  it('should return activities for user', async () => {
    const getActivities = new GetActivities(mockActivityRepo);
    const result = await getActivities.execute(1);
    expect(result.activities.length).toBe(1);
    expect(result.activities[0].category).toBe('transport');
  });

  it('should pass filters to repository', async () => {
    const getActivities = new GetActivities(mockActivityRepo);
    const result = await getActivities.execute(1, { category: 'transport', limit: 10, offset: 0 });
    expect(result.activities.length).toBe(1);
    expect(mockActivityRepo.findByUserId).toHaveBeenCalledWith(1, { category: 'transport', limit: 10, offset: 0 });
  });

  it('should return empty result when no activities', async () => {
    const emptyRepo = {
      ...mockActivityRepo,
      findByUserId: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    };
    const getActivities = new GetActivities(emptyRepo);
    const result = await getActivities.execute(1);
    expect(result.activities).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('GetDashboardData use case', () => {
  const mockActivityRepo: IActivityRepository = {
    create: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    findById: vi.fn(),
    delete: vi.fn(),
    getCategorySummary: vi.fn().mockResolvedValue([]),
    getDailyEmissionsSummary: vi.fn().mockResolvedValue([]),
    getStreakInfo: vi.fn(),
  };
  const mockUserRepo: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeUser()),
    create: vi.fn(),
    updatePointsAndLevel: vi.fn(),
    updateStreak: vi.fn(),
  };
  const mockGoalRepo: IGoalRepository = {
    create: vi.fn(),
    findCurrentGoal: vi.fn().mockResolvedValue(null),
    listGoals: vi.fn(),
    updateGoalAchievement: vi.fn(),
  };

  it('should compile dashboard data', async () => {
    const getDashboard = new GetDashboardData(mockActivityRepo, mockUserRepo, mockGoalRepo);
    const result = await getDashboard.execute(1);
    expect(result).toHaveProperty('sustainabilityScore');
    expect(result).toHaveProperty('emissions');
    expect(result).toHaveProperty('equivalents');
    expect(result).toHaveProperty('categoryBreakdown');
    expect(result).toHaveProperty('trends');
    expect(result).toHaveProperty('averages');
  });

  it('should handle zero activities gracefully', async () => {
    const getDashboard = new GetDashboardData(mockActivityRepo, mockUserRepo, mockGoalRepo);
    const result = await getDashboard.execute(1);
    expect(result.emissions.today).toBe(0);
    expect(result.emissions.monthly).toBe(0);
  });
});

describe('GetForecast use case', () => {
  const mockActivityRepo: IActivityRepository = {
    create: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    findById: vi.fn(),
    delete: vi.fn(),
    getCategorySummary: vi.fn(),
    getDailyEmissionsSummary: vi.fn(),
    getStreakInfo: vi.fn(),
  };
  const mockGoalRepo: IGoalRepository = {
    create: vi.fn(),
    findCurrentGoal: vi.fn().mockResolvedValue(null),
    listGoals: vi.fn(),
    updateGoalAchievement: vi.fn(),
  };

  it('should generate forecast', async () => {
    const getForecast = new GetForecast(mockActivityRepo, mockGoalRepo);
    const result = await getForecast.execute(1);
    expect(result).toHaveProperty('nextMonthEstimate');
    expect(result).toHaveProperty('trendDirection');
    expect(result).toHaveProperty('goalAchievementProbability');
  });
});

describe('GetRecommendations use case', () => {
  const mockActivityRepo: IActivityRepository = {
    create: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue({ activities: [makeActivity({ co2Emissions: 50 })], total: 1 }),
    findById: vi.fn(),
    delete: vi.fn(),
    getCategorySummary: vi.fn(),
    getDailyEmissionsSummary: vi.fn(),
    getStreakInfo: vi.fn(),
  };

  it('should return sorted recommendations', async () => {
    const getRecs = new GetRecommendations(mockActivityRepo);
    const result = await getRecs.execute(1);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('relevanceScore');
  });
});

describe('ManageChallenges use case', () => {
  const mockChallengeRepo: IChallengeRepository = {
    listAll: vi.fn().mockResolvedValue([
      { id: 1, title: 'Test Challenge', category: 'transport', description: 'Desc', pointsReward: 50, co2Target: 20, durationDays: 7 },
    ]),
    findById: vi.fn().mockResolvedValue({ id: 1, title: 'Test', category: 'transport', description: 'Desc', pointsReward: 50, co2Target: 20, durationDays: 7 }),
    getUserChallenges: vi.fn().mockResolvedValue([]),
    getUserChallenge: vi.fn().mockResolvedValue(null),
    joinChallenge: vi.fn().mockResolvedValue({ userId: 1, challengeId: 1, status: 'active' as const, progress: 0, startedAt: new Date() }),
    updateChallengeProgress: vi.fn().mockResolvedValue({ userId: 1, challengeId: 1, status: 'completed' as const, progress: 7, startedAt: new Date() }),
  };
  const mockUserRepo: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeUser()),
    create: vi.fn(),
    updatePointsAndLevel: vi.fn(),
    updateStreak: vi.fn(),
  };

  it('should list challenges', async () => {
    const manage = new ManageChallenges(mockChallengeRepo, mockUserRepo);
    const result = await manage.listAll(1);
    expect(result.challenges.length).toBe(1);
    expect(result.joined).toEqual([]);
  });

  it('should join a challenge', async () => {
    const manage = new ManageChallenges(mockChallengeRepo, mockUserRepo);
    const result = await manage.join(1, 1);
    expect(result.status).toBe('active');
  });

  it('should complete a challenge', async () => {
    const repoWithJoined = {
      ...mockChallengeRepo,
      getUserChallenge: vi.fn().mockResolvedValue({ userId: 1, challengeId: 1, status: 'active' as const, progress: 3, startedAt: new Date() }),
    };
    const manage = new ManageChallenges(repoWithJoined, mockUserRepo);
    const result = await manage.complete(1, 1);
    expect(result.status).toBe('completed');
  });
});

describe('GenerateReport use case', () => {
  const mockActivityRepo: IActivityRepository = {
    create: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    findById: vi.fn(),
    delete: vi.fn(),
    getCategorySummary: vi.fn(),
    getDailyEmissionsSummary: vi.fn(),
    getStreakInfo: vi.fn(),
  };
  const mockUserRepo: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeUser()),
    create: vi.fn(),
    updatePointsAndLevel: vi.fn(),
    updateStreak: vi.fn(),
  };
  const mockGoalRepo: IGoalRepository = {
    create: vi.fn(),
    findCurrentGoal: vi.fn().mockResolvedValue(null),
    listGoals: vi.fn().mockResolvedValue([]),
    updateGoalAchievement: vi.fn(),
  };
  const mockDb = {
    query: vi.fn().mockResolvedValue([{ count: '3' }]),
    initializeSchema: vi.fn(),
    close: vi.fn(),
  } as unknown as DatabaseConnection;

  it('should generate report summary', async () => {
    const generate = new GenerateReport(mockActivityRepo, mockUserRepo, mockGoalRepo, mockDb);
    const result = await generate.execute(1);
    expect(result).toHaveProperty('totalEmissions');
    expect(result).toHaveProperty('averageDaily');
    expect(result).toHaveProperty('carbonSaved');
    expect(result).toHaveProperty('moneySaved');
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('categoryBreakdown');
  });
});
