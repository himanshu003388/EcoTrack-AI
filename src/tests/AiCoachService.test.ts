import { describe, it, expect } from 'vitest';
import { AiCoachService } from '../services/AiCoachService';
import { User } from '../domain/entities/User';
import { Activity } from '../domain/entities/Activity';

describe('AiCoachService Unit Tests', () => {
  const mockUser: User = {
    id: 1,
    email: 'eco@ecotrack.ai',
    username: 'GreenWarrior',
    passwordHash: 'dummy',
    points: 120,
    level: 'Sapling',
    streak: 5,
    createdAt: new Date()
  };

  const mockActivities: Activity[] = [
    {
      id: 1,
      userId: 1,
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 100,
      unit: 'km',
      co2Emissions: 18.0,
      timestamp: new Date(),
      isRecurring: false,
      recurrencePeriod: 'none'
    },
    {
      id: 2,
      userId: 1,
      category: 'food',
      subcategory: 'meat',
      quantity: 1,
      unit: 'meals',
      co2Emissions: 5.8,
      timestamp: new Date(),
      isRecurring: false,
      recurrencePeriod: 'none'
    }
  ];

  it('should respond to greetings with personalized user stats', () => {
    const response = AiCoachService.chat('Hello Coach', mockUser, mockActivities);
    expect(response.reply).toContain('GreenWarrior');
    expect(response.reply).toContain('Sapling');
    expect(response.reply).toContain('5-day log streak');
    expect(response.suggestions.length).toBeGreaterThan(0);
  });

  it('should trigger transport tips when query contains transport keywords', () => {
    const response = AiCoachService.chat('how can I reduce my car travel footprint?', mockUser, mockActivities);
    expect(response.reply).toContain('Transport');
    expect(response.reply).toContain('Walk or Bike');
    expect(response.reply).toContain('Public Transit');
    expect(response.insights.length).toBeGreaterThan(0);
  });

  it('should trigger diet tips when query contains food or meat keywords', () => {
    const response = AiCoachService.chat('what is the carbon footprint of my food?', mockUser, mockActivities);
    expect(response.reply).toContain('Food');
    expect(response.reply).toContain('Reduce Meat');
    expect(response.reply).toContain('dairy');
  });

  it('should trigger energy tips when query contains electricity or heating keywords', () => {
    const response = AiCoachService.chat('how to lower electricity emissions?', mockUser, mockActivities);
    expect(response.reply).toContain('electricity');
    expect(response.reply).toContain('LED');
    expect(response.reply).toContain('thermostat');
  });

  it('should maintain a guilt-free, positive and encouraging tone', () => {
    const response = AiCoachService.chat('I logged a petrol car drive, I feel bad', mockUser, mockActivities);
    // Tone check: Ensure no guilt words are used
    const guiltWords = ['guilty', 'shame', 'bad job', 'disappointing', 'failed'];
    guiltWords.forEach(word => {
      expect(response.reply.toLowerCase()).not.toContain(word);
    });
    // Check that positive encouragement is used
    expect(response.reply.toLowerCase()).toContain('simple');
    expect(response.reply.toLowerCase()).toContain('eco');
  });

  it('should aggregate weekly insights correctly', () => {
    const insights = AiCoachService.getWeeklyInsights(mockUser, mockActivities);
    expect(insights.length).toBeGreaterThan(0);
    // User has streak >= 3
    expect(insights.some(i => i.includes('streak'))).toBe(true);
  });

  it('should provide tracking encouragement for zero-streak user', () => {
    const zeroStreakUser: User = { ...mockUser, streak: 0 };
    const insights = AiCoachService.getWeeklyInsights(zeroStreakUser, mockActivities);
    expect(insights.some(i => i.includes('daily') || i.includes('Log') || i.includes('habit'))).toBe(true);
  });

  it('should return a default reply for unrecognized queries', () => {
    const response = AiCoachService.chat('What is the meaning of life?', mockUser, mockActivities);
    // The default/fallback branch should always return a reply with suggestions
    expect(response.reply).toBeTruthy();
    expect(response.suggestions.length).toBeGreaterThan(0);
  });

  it('should return welcome insight when activities list is empty', () => {
    const insights = AiCoachService.getWeeklyInsights(mockUser, []);
    expect(insights).toEqual(['Welcome! Start logging your transportation, food, shopping, and home energy to unlock personalized insights.']);
  });

  it('should flag high food emissions when foodEmissions > 20', () => {
    const highFoodActivities: Activity[] = [
      {
        id: 3,
        userId: 1,
        category: 'food',
        subcategory: 'meat',
        quantity: 5,
        unit: 'meals',
        co2Emissions: 25.0,
        timestamp: new Date(),
        isRecurring: false,
        recurrencePeriod: 'none'
      }
    ];
    const insights = AiCoachService.getWeeklyInsights(mockUser, highFoodActivities);
    expect(insights.some(i => i.includes('Food emissions are relatively high'))).toBe(true);
  });

  it('should respond to stats queries with empty activities list', () => {
    const response = AiCoachService.chat('show my emissions footprint stats', mockUser, []);
    expect(response.reply).toContain("You haven't logged any activities yet!");
    expect(response.suggestions.length).toBeGreaterThan(0);
  });

  it('should respond to stats queries with positive emissions', () => {
    const response = AiCoachService.chat('show my footprint scorecard and statistics', mockUser, mockActivities);
    expect(response.reply).toContain('I have analyzed your footprint!');
    expect(response.insights.some(i => i.includes('Sapling'))).toBe(true);
    expect(response.insights.length).toBeGreaterThan(0);
  });

  it('should respond to challenges and points queries', () => {
    const response = AiCoachService.chat('what points or badge achievements can I earn?', mockUser, mockActivities);
    expect(response.reply).toContain('rewards your dedication!');
    expect(response.reply).toContain('10 XP');
    expect(response.insights.length).toBeGreaterThan(0);
  });

  it('should cover zero emission branches for transport, food, and energy queries', () => {
    const responseTrans = AiCoachService.chat('transport', mockUser, []);
    expect(responseTrans.insights.some(i => i.includes('0%'))).toBe(true);

    const responseFood = AiCoachService.chat('food', mockUser, []);
    expect(responseFood.insights.some(i => i.includes('0%'))).toBe(true);

    const responseEnergy = AiCoachService.chat('energy', mockUser, []);
    expect(responseEnergy.insights.some(i => i.includes('0%'))).toBe(true);
  });
});

export default {};

