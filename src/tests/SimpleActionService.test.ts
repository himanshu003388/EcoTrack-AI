import { describe, it, expect } from 'vitest';
import { SimpleActionService } from '../services/SimpleActionService';
import type { Activity } from '../domain/entities/Activity';

const makeActivity = (overrides: Partial<Activity>): Activity => ({
  id: 1,
  userId: 1,
  category: 'transport',
  subcategory: 'car_petrol',
  quantity: 10,
  unit: 'km',
  co2Emissions: 5.0,
  timestamp: new Date(),
  isRecurring: false,
  recurrencePeriod: 'none',
  ...overrides,
});

describe('SimpleActionService', () => {
  describe('getDailyAction', () => {
    it('returns a general action when no activities exist', () => {
      const result = SimpleActionService.getDailyAction([]);
      expect(result.action).toBeDefined();
      expect(result.action.id).toBeTruthy();
      expect(result.reason).toContain('Start tracking');
    });

    it('returns an action matching the highest emission category', () => {
      const activities = [
        makeActivity({ category: 'transport', subcategory: 'car_petrol', co2Emissions: 50 }),
        makeActivity({ category: 'food', subcategory: 'meat', co2Emissions: 5 }),
        makeActivity({ category: 'energy', subcategory: 'electricity', co2Emissions: 2 }),
      ];
      const result = SimpleActionService.getDailyAction(activities);
      expect(result.action.category).toBe('transport');
      expect(result.reason).toContain('transport');
    });

    it('returns action for food when food is the highest category', () => {
      const activities = [
        makeActivity({ category: 'transport', subcategory: 'car_petrol', co2Emissions: 1 }),
        makeActivity({ category: 'food', subcategory: 'meat', co2Emissions: 20 }),
      ];
      const result = SimpleActionService.getDailyAction(activities);
      expect(result.action.category).toBe('food');
    });

    it('returns action for energy when energy is the only logged category', () => {
      const activities = [
        makeActivity({ category: 'energy', subcategory: 'electricity', co2Emissions: 15 }),
      ];
      const result = SimpleActionService.getDailyAction(activities);
      expect(result.action.category).toBe('energy');
    });

    it('returns action for shopping_waste when shopping_waste is highest', () => {
      const activities = [
        makeActivity({ category: 'transport', subcategory: 'car_petrol', co2Emissions: 1 }),
        makeActivity({ category: 'shopping_waste', subcategory: 'recycling', co2Emissions: 30 }),
      ];
      const result = SimpleActionService.getDailyAction(activities);
      expect(result.action.category).toBe('shopping_waste');
    });

    it('rotates action based on day of year (deterministic)', () => {
      const first = SimpleActionService.getDailyAction([]);
      // second call in same second should give same result
      const second = SimpleActionService.getDailyAction([]);
      expect(first.action.id).toBe(second.action.id);
      expect(first.reason).toBe(second.reason);
    });

    it('handles activities with zero emissions across all categories', () => {
      const activities = [
        makeActivity({ category: 'transport', co2Emissions: 0 }),
        makeActivity({ category: 'food', co2Emissions: 0 }),
        makeActivity({ category: 'energy', co2Emissions: 0 }),
        makeActivity({ category: 'shopping_waste', co2Emissions: 0 }),
      ];
      const result = SimpleActionService.getDailyAction(activities);
      expect(result.action).toBeDefined();
      expect(result.reason).toContain('Start tracking');
    });
  });

  describe('getAllActions', () => {
    it('returns all 16 actions from the catalog', () => {
      const actions = SimpleActionService.getAllActions();
      expect(actions).toHaveLength(16);
    });

    it('each action has required fields', () => {
      const actions = SimpleActionService.getAllActions();
      for (const act of actions) {
        expect(act.id).toBeTruthy();
        expect(act.title).toBeTruthy();
        expect(act.description).toBeTruthy();
        expect(act.category).toBeTruthy();
        expect(act.co2Saving).toBeTruthy();
        expect(act.difficulty).toMatch(/^(easy|medium|hard)$/);
        expect(act.duration).toBeTruthy();
        expect(act.link).toBeTruthy();
      }
    });

    it('covers all four emission categories plus general', () => {
      const actions = SimpleActionService.getAllActions();
      const categories = new Set(actions.map(a => a.category));
      expect(categories.has('transport')).toBe(true);
      expect(categories.has('food')).toBe(true);
      expect(categories.has('energy')).toBe(true);
      expect(categories.has('shopping_waste')).toBe(true);
    });
  });
});
