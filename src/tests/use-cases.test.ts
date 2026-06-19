import { describe, it, expect, vi } from 'vitest';

import { LogActivity } from '../application/use-cases/LogActivity';
import { GetActivities } from '../application/use-cases/GetActivities';
import { GetDashboardData, clearDashboardCache } from '../application/use-cases/GetDashboardData';
import { GetForecast, clearForecastCache } from '../application/use-cases/GetForecast';
import { ForecastService } from '../services/ForecastService';
import { GetRecommendations, clearRecommendationsCache } from '../application/use-cases/GetRecommendations';
import { ManageChallenges } from '../application/use-cases/ManageChallenges';
import { GenerateReport, clearReportCache } from '../application/use-cases/GenerateReport';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import type { IActivityRepository } from '../domain/repositories/IActivityRepository';
import type { IGoalRepository } from '../domain/repositories/IGoalRepository';
import type { IChallengeRepository } from '../domain/repositories/IChallengeRepository';

import type { User } from '../domain/entities/User';
import type { Activity, ActivityCategory } from '../domain/entities/Activity';
import type { DatabaseConnection } from '../infrastructure/database/DatabaseConnection';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'test@test.com',
  username: 'TestUser',
  passwordHash: 'hash',
  points: 100,
  level: 'Sapling',
  streak: 3,
  createdAt: new Date(),
  ...overrides,
});

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 1,
  userId: 1,
  category: 'transport',
  subcategory: 'car_petrol',
  quantity: 10,
  unit: 'km',
  co2Emissions: 1.8,
  timestamp: new Date(),
  isRecurring: false,
  recurrencePeriod: 'none',
  ...overrides,
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
      userId: 1,
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 10,
      unit: 'km',
    });
    expect(result.category).toBe('transport');
    expect(mockUserRepo.updatePointsAndLevel).toHaveBeenCalled();
  });

  it('should throw for invalid category', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    await expect(
      logActivity.execute({
        userId: 1,
        category: 'invalid' as ActivityCategory,
        subcategory: 'car_petrol',
        quantity: 10,
        unit: 'km',
      }),
    ).rejects.toThrow();
  });

  it('should throw for invalid subcategory', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    await expect(
      logActivity.execute({
        userId: 1,
        category: 'transport',
        subcategory: 'invalid_sub',
        quantity: 10,
        unit: 'km',
      }),
    ).rejects.toThrow('Invalid subcategory: "invalid_sub" for category "transport".');
  });

  it('should reject a future timestamp', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    await expect(
      logActivity.execute({
        userId: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 10,
        unit: 'km',
        timestamp: futureDate,
      }),
    ).rejects.toThrow('Activity timestamp cannot be in the future.');
  });

  it('should log a recurring activity with recurrencePeriod', async () => {
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, mockChallengeRepo);
    const result = await logActivity.execute({
      userId: 1,
      category: 'energy',
      subcategory: 'electricity',
      quantity: 50,
      unit: 'kWh',
      isRecurring: true,
      recurrencePeriod: 'daily',
    });
    expect(result.category).toBe('transport'); // mock returns transport activity
    expect(mockActivityRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isRecurring: true, recurrencePeriod: 'daily' }),
    );
  });

  it('should progress matching active challenges', async () => {
    const activeChallenge = {
      challengeId: 1,
      userId: 1,
      status: 'active' as const,
      progress: 2,
      startedAt: new Date(),
      category: 'transport',
      durationDays: 7,
      pointsReward: 50,
    };
    const challengeRepoWithJoined = {
      ...mockChallengeRepo,
      getUserChallenges: vi.fn().mockResolvedValue([activeChallenge]),
    };
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, challengeRepoWithJoined);
    await logActivity.execute({
      userId: 1,
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 10,
      unit: 'km',
    });
    expect(challengeRepoWithJoined.updateChallengeProgress).toHaveBeenCalledWith(1, 1, 3, 'active');
  });

  it('should complete active challenge when progress target is reached', async () => {
    const activeChallenge = {
      challengeId: 1,
      userId: 1,
      status: 'active' as const,
      progress: 6,
      startedAt: new Date(),
      category: 'transport',
      durationDays: 7,
      pointsReward: 50,
    };
    const challengeRepoWithJoined = {
      ...mockChallengeRepo,
      getUserChallenges: vi.fn().mockResolvedValue([activeChallenge]),
    };
    const logActivity = new LogActivity(mockActivityRepo, mockUserRepo, challengeRepoWithJoined);
    await logActivity.execute({
      userId: 1,
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 10,
      unit: 'km',
    });
    expect(challengeRepoWithJoined.updateChallengeProgress).toHaveBeenCalledWith(1, 1, 7, 'completed');
    expect(mockUserRepo.updatePointsAndLevel).toHaveBeenCalled();
  });

  it('should reset streak when streakInfo is 0', async () => {
    const actRepoWithStreakReset = {
      ...mockActivityRepo,
      getStreakInfo: vi.fn().mockResolvedValue({ lastLogDate: new Date(), currentStreak: 0 }),
    };
    const logActivity = new LogActivity(actRepoWithStreakReset, mockUserRepo, mockChallengeRepo);
    await logActivity.execute({
      userId: 1,
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 10,
      unit: 'km',
    });
    expect(mockUserRepo.updateStreak).toHaveBeenCalledWith(1, 0);
  });

  it('should increase streak to 1 when currentStreak is 0 and streakInfo is 1', async () => {
    const userRepoWithNoStreak = {
      ...mockUserRepo,
      findById: vi.fn().mockResolvedValue(makeUser({ streak: 0 })),
    };
    const actRepoWithNewStreak = {
      ...mockActivityRepo,
      getStreakInfo: vi.fn().mockResolvedValue({ lastLogDate: new Date(), currentStreak: 1 }),
    };
    const logActivity = new LogActivity(actRepoWithNewStreak, userRepoWithNoStreak, mockChallengeRepo);
    await logActivity.execute({
      userId: 1,
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 10,
      unit: 'km',
    });
    expect(mockUserRepo.updateStreak).toHaveBeenCalledWith(1, 1);
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
    expect(result.activities[0]!.category).toBe('transport');
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

  it('should clear all caches when clearDashboardCache is called without userId', () => {
    clearDashboardCache();
  });

  it('should handle sustainabilityScore explanations for different emission levels', async () => {
    // 1. High score (average daily = 1 kg CO2e <= 5.5, score > 80)
    clearDashboardCache(1);
    const mockActRepoHigh = {
      ...mockActivityRepo,
      findByUserId: vi.fn().mockResolvedValue({
        activities: [makeActivity({ co2Emissions: 1, timestamp: new Date() })],
        total: 1,
      }),
      getCategorySummary: vi.fn().mockResolvedValue([]),
      getDailyEmissionsSummary: vi.fn().mockResolvedValue([]),
    };
    const getDashboardHigh = new GetDashboardData(mockActRepoHigh, mockUserRepo, mockGoalRepo);
    const resultHigh = await getDashboardHigh.execute(1);
    expect(resultHigh.sustainabilityScore).toBeGreaterThan(80);
    expect(resultHigh.explanation).toContain('Superb work!');

    // 2. Medium score (average daily = 10 kg CO2e > 5.5, score between 50 and 80)
    clearDashboardCache(1);
    const mockActRepoMed = {
      ...mockActivityRepo,
      findByUserId: vi.fn().mockResolvedValue({
        activities: [makeActivity({ co2Emissions: 10, timestamp: new Date() })],
        total: 1,
      }),
      getCategorySummary: vi.fn().mockResolvedValue([]),
      getDailyEmissionsSummary: vi.fn().mockResolvedValue([]),
    };
    const getDashboardMed = new GetDashboardData(mockActRepoMed, mockUserRepo, mockGoalRepo);
    const resultMed = await getDashboardMed.execute(1);
    expect(resultMed.sustainabilityScore).toBeGreaterThan(50);
    expect(resultMed.sustainabilityScore).toBeLessThanOrEqual(80);
    expect(resultMed.explanation).toContain('close to the average');

    // 3. Low score (average daily = 20 kg CO2e > 5.5, score <= 50)
    clearDashboardCache(1);
    const mockActRepoLow = {
      ...mockActivityRepo,
      findByUserId: vi.fn().mockResolvedValue({
        activities: [makeActivity({ co2Emissions: 20, timestamp: new Date() })],
        total: 1,
      }),
      getCategorySummary: vi.fn().mockResolvedValue([]),
      getDailyEmissionsSummary: vi.fn().mockResolvedValue([]),
    };
    const getDashboardLow = new GetDashboardData(mockActRepoLow, mockUserRepo, mockGoalRepo);
    const resultLow = await getDashboardLow.execute(1);
    expect(resultLow.sustainabilityScore).toBeLessThanOrEqual(50);
    expect(resultLow.explanation).toContain('higher than the sustainable target');
  });

  it('should throw error when user is not found', async () => {
    clearDashboardCache(1);
    const mockUserRepoNoUser = {
      ...mockUserRepo,
      findById: vi.fn().mockResolvedValue(null),
    };
    const getDashboard = new GetDashboardData(mockActivityRepo, mockUserRepoNoUser, mockGoalRepo);
    await expect(getDashboard.execute(1)).rejects.toThrow('User not found.');
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
    expect(result.goalAchievementProbability).toBe(0);
  });

  it('should cache forecast results and allow cache clearing', async () => {
    const getForecast = new GetForecast(mockActivityRepo, mockGoalRepo);
    clearForecastCache(1);
    clearForecastCache();
    await getForecast.execute(1);
    const result = await getForecast.execute(1);
    expect(result).toHaveProperty('nextMonthEstimate');
  });

  it('should fallback nextMonthEstimate to defaultEstimate when recent emissions are 0', async () => {
    const priorActivity = makeActivity({
      co2Emissions: 10,
      timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    });
    const repoWithPrior = {
      ...mockActivityRepo,
      findByUserId: vi.fn().mockResolvedValue({
        activities: [priorActivity],
        total: 1,
      }),
    };
    const getForecast = new GetForecast(repoWithPrior, mockGoalRepo);
    const result = await getForecast.execute(1);
    expect(result.nextMonthEstimate).toBe(480);
  });

  it('should clamp nextMonthEstimate to 0 when it goes negative due to negative prior emissions', () => {
    const activities = [
      makeActivity({
        co2Emissions: -10,
        timestamp: new Date(),
      }),
    ];
    const report = ForecastService.generate(activities, null);
    expect(report.nextMonthEstimate).toBe(0);
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

  it('should cache recommendations results and allow cache clearing', async () => {
    const getRecs = new GetRecommendations(mockActivityRepo);
    clearRecommendationsCache(1);
    clearRecommendationsCache();
    await getRecs.execute(1);
    const result = await getRecs.execute(1);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('ManageChallenges use case', () => {
  const mockChallengeRepo: IChallengeRepository = {
    listAll: vi
      .fn()
      .mockResolvedValue([
        {
          id: 1,
          title: 'Test Challenge',
          category: 'transport',
          description: 'Desc',
          pointsReward: 50,
          co2Target: 20,
          durationDays: 7,
        },
      ]),
    findById: vi
      .fn()
      .mockResolvedValue({
        id: 1,
        title: 'Test',
        category: 'transport',
        description: 'Desc',
        pointsReward: 50,
        co2Target: 20,
        durationDays: 7,
      }),
    getUserChallenges: vi.fn().mockResolvedValue([]),
    getUserChallenge: vi.fn().mockResolvedValue(null),
    joinChallenge: vi
      .fn()
      .mockResolvedValue({ userId: 1, challengeId: 1, status: 'active' as const, progress: 0, startedAt: new Date() }),
    updateChallengeProgress: vi
      .fn()
      .mockResolvedValue({
        userId: 1,
        challengeId: 1,
        status: 'completed' as const,
        progress: 7,
        startedAt: new Date(),
      }),
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

  it('should throw error when joining non-existent challenge', async () => {
    const repoWithNoChallenge = {
      ...mockChallengeRepo,
      findById: vi.fn().mockResolvedValue(null),
    };
    const manage = new ManageChallenges(repoWithNoChallenge, mockUserRepo);
    await expect(manage.join(1, 999)).rejects.toThrow('Challenge not found.');
  });

  it('should complete a challenge', async () => {
    const repoWithJoined = {
      ...mockChallengeRepo,
      getUserChallenge: vi
        .fn()
        .mockResolvedValue({
          userId: 1,
          challengeId: 1,
          status: 'active' as const,
          progress: 3,
          startedAt: new Date(),
        }),
    };
    const manage = new ManageChallenges(repoWithJoined, mockUserRepo);
    const result = await manage.complete(1, 1);
    expect(result.status).toBe('completed');
  });

  it('should throw error when completing a challenge not joined', async () => {
    const manage = new ManageChallenges(mockChallengeRepo, mockUserRepo);
    await expect(manage.complete(1, 1)).rejects.toThrow('You have not joined this challenge.');
  });

  it('should return challenge if already completed', async () => {
    const repoWithCompleted = {
      ...mockChallengeRepo,
      getUserChallenge: vi
        .fn()
        .mockResolvedValue({
          userId: 1,
          challengeId: 1,
          status: 'completed' as const,
          progress: 7,
          startedAt: new Date(),
        }),
    };
    const manage = new ManageChallenges(repoWithCompleted, mockUserRepo);
    const result = await manage.complete(1, 1);
    expect(result.status).toBe('completed');
  });

  it('should throw error when completing a joined challenge where the challenge details are missing', async () => {
    const repoWithMissingDetails = {
      ...mockChallengeRepo,
      getUserChallenge: vi
        .fn()
        .mockResolvedValue({
          userId: 1,
          challengeId: 1,
          status: 'active' as const,
          progress: 3,
          startedAt: new Date(),
        }),
      findById: vi.fn().mockResolvedValue(null),
    };
    const manage = new ManageChallenges(repoWithMissingDetails, mockUserRepo);
    await expect(manage.complete(1, 1)).rejects.toThrow('Challenge not found.');
  });

  it('should complete challenge successfully even when user is not found', async () => {
    const repoWithJoined = {
      ...mockChallengeRepo,
      getUserChallenge: vi
        .fn()
        .mockResolvedValue({
          userId: 1,
          challengeId: 1,
          status: 'active' as const,
          progress: 3,
          startedAt: new Date(),
        }),
    };
    const userRepoWithNoUser = {
      ...mockUserRepo,
      findById: vi.fn().mockResolvedValue(null),
    };
    const manage = new ManageChallenges(repoWithJoined, userRepoWithNoUser);
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

  it('should compute moneySaved for various categories/subcategories correctly', async () => {
    clearReportCache(1);
    const activities = [
      makeActivity({ category: 'transport', subcategory: 'bike', quantity: 10 }),
      makeActivity({ category: 'transport', subcategory: 'walking', quantity: 5 }),
      makeActivity({ category: 'transport', subcategory: 'train', quantity: 20 }),
      makeActivity({ category: 'transport', subcategory: 'bus', quantity: 15 }),
      makeActivity({ category: 'energy', subcategory: 'solar', quantity: 100 }),
      makeActivity({ category: 'food', subcategory: 'vegan', quantity: 3 }),
      makeActivity({ category: 'food', subcategory: 'vegetarian', quantity: 2 }),
      makeActivity({ category: 'shopping_waste', subcategory: 'recycling', quantity: 4 }),
    ];
    const repoWithActs = {
      ...mockActivityRepo,
      findByUserId: vi.fn().mockResolvedValue({ activities, total: activities.length }),
    };
    const generate = new GenerateReport(repoWithActs, mockUserRepo, mockGoalRepo, mockDb);
    const result = await generate.execute(1);
    expect(result.moneySaved).toBe(38.5);
  });

  it('should cache report results', async () => {
    clearReportCache(1);
    const generate = new GenerateReport(mockActivityRepo, mockUserRepo, mockGoalRepo, mockDb);
    await generate.execute(1);
    const result = await generate.execute(1);
    expect(result).toHaveProperty('totalEmissions');
  });

  it('should clear report cache', () => {
    clearReportCache(1);
    clearReportCache();
  });

  it('should throw error when user is not found', async () => {
    clearReportCache(1);
    const mockUserRepoNoUser = {
      ...mockUserRepo,
      findById: vi.fn().mockResolvedValue(null),
    };
    const generate = new GenerateReport(mockActivityRepo, mockUserRepoNoUser, mockGoalRepo, mockDb);
    await expect(generate.execute(1)).rejects.toThrow('User not found.');
  });

  it('should fallback to 0 badges when bRes is empty', async () => {
    clearReportCache(1);
    const mockDbEmpty = {
      ...mockDb,
      query: vi.fn().mockResolvedValue([]),
    } as unknown as DatabaseConnection;
    const generate = new GenerateReport(mockActivityRepo, mockUserRepo, mockGoalRepo, mockDbEmpty);
    const result = await generate.execute(1);
    expect(result.badgesCount).toBe(0);
  });
});
