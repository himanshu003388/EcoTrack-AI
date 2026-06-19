import { z } from 'zod';

const SAFE_TEXT_RE = /^[a-zA-Z0-9\s_\-.()]+$/;

/**
 * Schema for logging a new carbon activity.
 * Quantity is capped at 100,000 to prevent unrealistic or abusive inputs.
 * String fields are restricted to safe characters only.
 */
export const LogActivitySchema = z.object({
  body: z.object({
    category: z.enum(['transport', 'energy', 'food', 'shopping_waste'], {
      required_error: 'Category is required and must be transport, energy, food, or shopping_waste.',
    }),
    subcategory: z
      .string()
      .min(1, 'Subcategory is required.')
      .max(100, 'Subcategory too long.')
      .regex(SAFE_TEXT_RE, 'Subcategory contains invalid characters.'),
    quantity: z
      .number()
      .positive('Quantity must be a positive number.')
      .max(100000, 'Quantity value is unrealistically large (max 100,000).'),
    unit: z
      .string()
      .min(1, 'Unit descriptor is required.')
      .max(50, 'Unit descriptor too long.')
      .regex(SAFE_TEXT_RE, 'Unit contains invalid characters.'),
    timestamp: z.string().datetime({ message: 'Invalid ISO 8601 date format.' }).optional(),
    isRecurring: z.boolean().optional(),
    recurrencePeriod: z.enum(['daily', 'weekly', 'none']).optional(),
  }),
});

/**
 * Schema for setting a monthly CO2 reduction goal.
 * Target is capped at 10,000 kg — a realistic upper bound for monthly tracking.
 */
export const GoalSchema = z.object({
  body: z.object({
    targetCo2: z
      .number()
      .positive('Monthly Target CO2 must be a positive number (kg).')
      .max(10000, 'Monthly CO2 target is unrealistically large (max 10,000 kg).'),
  }),
});

/**
 * Schema for the Eco Coach chat endpoint.
 * Message is limited to 500 characters to prevent excessively large payloads.
 * Script-like patterns are rejected to prevent XSS.
 */
export const ChatSchema = z.object({
  body: z.object({
    message: z
      .string()
      .min(1, 'Message cannot be empty.')
      .max(500, 'Message is too long. Please keep messages under 500 characters.')
      .refine((val) => !/<script|<\/script|onerror=|onclick=|javascript:/i.test(val), {
        message: 'Message contains disallowed patterns.',
      }),
  }),
});
