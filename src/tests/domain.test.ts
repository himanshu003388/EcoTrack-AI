import { describe, it, expect } from 'vitest';
import { calculateLevel } from '../domain/level';
import { User } from '../domain/entities/User';
import { Activity, ActivityCategory } from '../domain/entities/Activity';
import { Badge } from '../domain/entities/Badge';
import { Challenge } from '../domain/entities/Challenge';
import { Goal } from '../domain/entities/Goal';
import { Recommendation } from '../domain/entities/Recommendation';

describe('Domain level progression', () => {
  it('should return Seedling for 0 points', () => {
    expect(calculateLevel(0)).toBe('Seedling');
  });

  it('should return Sapling for 100 points', () => {
    expect(calculateLevel(100)).toBe('Sapling');
  });

  it('should return Tree for 300 points', () => {
    expect(calculateLevel(300)).toBe('Tree');
  });

  it('should return Forest Guardian for 600 points', () => {
    expect(calculateLevel(600)).toBe('Forest Guardian');
  });

  it('should return Climate Hero for 1000 points', () => {
    expect(calculateLevel(1000)).toBe('Climate Hero');
  });

  it('should return Climate Hero for points above threshold', () => {
    expect(calculateLevel(2000)).toBe('Climate Hero');
  });

  it('should handle negative points', () => {
    expect(calculateLevel(-5)).toBe('Seedling');
  });

  // --- Boundary tests at exact threshold edges ---
  it('should return Seedling just below Sapling threshold (99 pts)', () => {
    expect(calculateLevel(99)).toBe('Seedling');
  });

  it('should return Sapling just above Seedling threshold (101 pts)', () => {
    expect(calculateLevel(101)).toBe('Sapling');
  });

  it('should return Sapling just below Tree threshold (299 pts)', () => {
    expect(calculateLevel(299)).toBe('Sapling');
  });

  it('should return Tree just above Sapling threshold (301 pts)', () => {
    expect(calculateLevel(301)).toBe('Tree');
  });

  it('should return Tree just below Forest Guardian threshold (599 pts)', () => {
    expect(calculateLevel(599)).toBe('Tree');
  });

  it('should return Forest Guardian just above Tree threshold (601 pts)', () => {
    expect(calculateLevel(601)).toBe('Forest Guardian');
  });

  it('should return Forest Guardian just below Climate Hero threshold (999 pts)', () => {
    expect(calculateLevel(999)).toBe('Forest Guardian');
  });

  it('should return Climate Hero just above Forest Guardian threshold (1001 pts)', () => {
    expect(calculateLevel(1001)).toBe('Climate Hero');
  });
});

describe('Activity entity', () => {
  it('should create a valid transport activity', () => {
    const activity: Activity = {
      id: 1,
      userId: 1,
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 100,
      unit: 'km',
      co2Emissions: 18.0,
      timestamp: new Date(),
      isRecurring: false,
      recurrencePeriod: 'none',
    };
    expect(activity.category).toBe('transport');
    expect(activity.co2Emissions).toBe(18.0);
    expect(activity.isRecurring).toBe(false);
  });

  it('should support all valid categories', () => {
    const categories: ActivityCategory[] = ['transport', 'energy', 'food', 'shopping_waste'];
    for (const cat of categories) {
      const activity: Activity = {
        id: 1, userId: 1, category: cat, subcategory: 'test',
        quantity: 1, unit: 'unit', co2Emissions: 0,
        timestamp: new Date(), isRecurring: false, recurrencePeriod: 'none',
      };
      expect(activity.category).toBe(cat);
    }
  });

  it('should support recurring activities', () => {
    const activity: Activity = {
      id: 1, userId: 1, category: 'transport', subcategory: 'bus',
      quantity: 10, unit: 'km', co2Emissions: 1.0,
      timestamp: new Date(), isRecurring: true, recurrencePeriod: 'daily',
    };
    expect(activity.isRecurring).toBe(true);
    expect(activity.recurrencePeriod).toBe('daily');
  });
});

describe('Goal entity', () => {
  it('should create a goal with target', () => {
    const goal: Goal = {
      id: 1, userId: 1, targetCo2: 200,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
      achieved: false,
    };
    expect(goal.targetCo2).toBe(200);
    expect(goal.achieved).toBe(false);
  });

  it('should support achieved goals', () => {
    const goal: Goal = {
      id: 1, userId: 1, targetCo2: 150,
      startDate: new Date(), endDate: new Date(),
      achieved: true,
    };
    expect(goal.achieved).toBe(true);
  });
});

describe('Badge entity', () => {
  it('should define badge properties', () => {
    const badge: Badge = {
      id: 1, name: 'First Footprint',
      description: 'Log your first activity',
      icon: 'leaf',
      conditionType: 'points',
      conditionValue: 10,
    };
    expect(badge.name).toBe('First Footprint');
    expect(badge.conditionValue).toBe(10);
  });
});

describe('Challenge entity', () => {
  it('should define challenge properties', () => {
    const challenge: Challenge = {
      id: 1, title: 'Reduce Emissions', category: 'transport',
      description: 'Cut transport emissions', co2Target: 50,
      pointsReward: 100, durationDays: 7,
    };
    expect(challenge.title).toBe('Reduce Emissions');
    expect(challenge.durationDays).toBe(7);
  });
});

describe('Recommendation entity', () => {
  it('should define recommendation with relevance score', () => {
    const rec: Recommendation = {
      id: '1', title: 'Use Public Transit', category: 'transport',
      description: 'Take the bus instead of driving',
      co2Reduction: 2, costSavings: 5,
      difficulty: 'easy', timeRequired: 'immediate',
      impactScore: 8, relevanceScore: 0.9,
    };
    expect(rec.category).toBe('transport');
    expect(rec.relevanceScore).toBe(0.9);
    expect(rec.impactScore).toBe(8);
  });
});

describe('User entity', () => {
  it('should create a user with required fields', () => {
    const user: User = {
      id: 1,
      email: 'test@test.com',
      username: 'TestUser',
      passwordHash: 'hashed_password',
      points: 50,
      level: 'Seedling',
      streak: 2,
      createdAt: new Date('2025-01-01'),
    };
    expect(user.email).toBe('test@test.com');
    expect(user.points).toBe(50);
    expect(user.level).toBe('Seedling');
  });

  it('should support zero points at creation', () => {
    const user: User = {
      id: 2, email: 'new@test.com', username: 'NewUser',
      passwordHash: 'hash', points: 0, level: 'Seedling',
      streak: 0, createdAt: new Date(),
    };
    expect(user.points).toBe(0);
    expect(user.streak).toBe(0);
  });
});
