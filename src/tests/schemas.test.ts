import { describe, it, expect } from 'vitest';
import { z } from 'zod';

function safeParse(schema: z.ZodSchema, data: any) {
  const result = schema.safeParse(data);
  return { success: result.success, error: !result.success ? result.error.format() : null };
}

const activitySchema = z.object({
  category: z.enum(['transport', 'energy', 'food', 'shopping_waste']),
  subcategory: z.string().min(1, 'Subcategory is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  isRecurring: z.boolean().optional().default(false),
  recurrencePeriod: z.enum(['daily', 'weekly', 'none']).optional().default('none'),
});



const goalSchema = z.object({
  targetCo2: z.number().positive('Target must be positive'),
});

const coachSchema = z.object({
  message: z.string().min(1, 'Message is required').max(500, 'Message too long'),
});

describe('Activity schema validation', () => {
  it('accepts valid transport activity', () => {
    const result = safeParse(activitySchema, {
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 10,
      unit: 'km',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid category', () => {
    const result = safeParse(activitySchema, {
      category: 'teleport',
      subcategory: 'car_petrol',
      quantity: 10,
      unit: 'km',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative quantity', () => {
    const result = safeParse(activitySchema, {
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: -5,
      unit: 'km',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero quantity', () => {
    const result = safeParse(activitySchema, {
      category: 'transport',
      subcategory: 'car_petrol',
      quantity: 0,
      unit: 'km',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing subcategory', () => {
    const result = safeParse(activitySchema, {
      category: 'transport',
      quantity: 10,
      unit: 'km',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', () => {
    for (const cat of ['transport', 'energy', 'food', 'shopping_waste']) {
      const result = safeParse(activitySchema, {
        category: cat, subcategory: 'test', quantity: 1, unit: 'unit',
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts recurring activity', () => {
    const result = safeParse(activitySchema, {
      category: 'energy',
      subcategory: 'electricity',
      quantity: 50,
      unit: 'kWh',
      isRecurring: true,
      recurrencePeriod: 'daily',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid recurrence period', () => {
    const result = safeParse(activitySchema, {
      category: 'energy',
      subcategory: 'electricity',
      quantity: 50,
      unit: 'kWh',
      isRecurring: true,
      recurrencePeriod: 'monthly',
    });
    expect(result.success).toBe(false);
  });
});



describe('Goal schema validation', () => {
  it('accepts valid goal target', () => {
    const result = safeParse(goalSchema, { targetCo2: 200 });
    expect(result.success).toBe(true);
  });

  it('rejects negative target', () => {
    const result = safeParse(goalSchema, { targetCo2: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects zero target', () => {
    const result = safeParse(goalSchema, { targetCo2: 0 });
    expect(result.success).toBe(false);
  });
});

describe('Coach chat schema validation', () => {
  it('accepts valid message', () => {
    const result = safeParse(coachSchema, { message: 'How can I reduce my footprint?' });
    expect(result.success).toBe(true);
  });

  it('rejects empty message', () => {
    const result = safeParse(coachSchema, { message: '' });
    expect(result.success).toBe(false);
  });

  it('rejects message over 500 chars', () => {
    const result = safeParse(coachSchema, { message: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});
