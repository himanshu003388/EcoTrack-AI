import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../presentation/api/middleware/auth';
import { xssSanitizer } from '../presentation/api/middleware/sanitize';
import { validateSchema } from '../presentation/api/middleware/validate';
import { LogActivitySchema, ChatSchema } from '../presentation/api/middleware/schemas';
import { z } from 'zod';

const authSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

const activitySchema = z.object({
  body: z.object({
    category: z.enum(['transport', 'energy', 'food', 'shopping_waste']),
    subcategory: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
  }),
});

/** Shared mock response factory — accessible across all describe blocks. */
const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

describe('Auth middleware', () => {
  const mockReq = (headers: Record<string, string> = {}) => ({
    headers,
  }) as unknown as Request;

  const mockNext: NextFunction = vi.fn();

  it('should always pass and set default user in req.user', () => {
    const req = mockReq({});
    const res = mockRes();
    authenticateToken(req, res, mockNext);
    expect((req as any).user).toEqual({
      id: 1,
      email: 'user@ecotrack.ai',
      username: 'EcoTrack User',
    });
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Sanitize middleware', () => {
  const mockReq = (body: any = {}) => ({
    body: JSON.parse(JSON.stringify(body)),
  }) as unknown as Request;

  const mockRes = () => ({} as Response);
  const mockNext: NextFunction = vi.fn();

  it('should strip script tags from string fields', () => {
    const req = mockReq({
      username: '<script>alert("xss")</script>TestUser',
      email: 'test@test.com',
    });
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body.username).toBe('TestUser');
    expect(req.body.email).toBe('test@test.com');
  });

  it('should strip onerror handlers', () => {
    const req = mockReq({
      message: 'Hello <img src=x onerror=alert(1)> world',
    });
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body.message).toBe('Hello  world');
  });

  it('should handle null or non-string values', () => {
    const req = mockReq({
      username: null,
      age: 25,
      active: true,
    });
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body.username).toBeNull();
    expect(req.body.age).toBe(25);
    expect(req.body.active).toBe(true);
  });

  it('should strip javascript: from URLs in string fields', () => {
    const req = mockReq({
      website: 'javascript:alert("xss")',
      bio: 'Check out javascript:void(0) here',
    });
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body.website).toBe('blocked:');
    expect(req.body.bio).toBe('Check out blocked:void(0) here');
  });

  it('should block data: URIs in string fields', () => {
    const req = mockReq({
      src: 'data:text/html,<script>alert("xss")</script>',
    });
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body.src).toContain('blocked:');
  });

  it('should handle deeply nested objects', () => {
    const req = mockReq({
      profile: {
        name: '<script>alert("xss")</script>John',
        meta: {
          bio: 'Normal text <img src=x onerror=alert(1)>',
        },
      },
    });
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body.profile.name).toBe('John');
    expect(req.body.profile.meta.bio).toBe('Normal text ');
  });

  it('should handle arrays in body', () => {
    const req = mockReq({
      tags: ['<script>alert(1)</script>Normal', 'Clean'],
    });
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body.tags[0]).toBe('Normal');
    expect(req.body.tags[1]).toBe('Clean');
  });

  it('should handle empty body', () => {
    const req = mockReq({});
    xssSanitizer(req, mockRes(), mockNext);
    expect(req.body).toEqual({});
  });
});

describe('Validate middleware', () => {
  const mockRes = () => {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response;
  };

  const mockNext: NextFunction = vi.fn();

  it('should pass valid auth data', async () => {
    const req = { body: { email: 'test@test.com', password: 'password123' }, query: {}, params: {} } as any;
    const res = mockRes();
    await validateSchema(authSchema)(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject invalid email', async () => {
    const req = { body: { email: 'notanemail', password: 'password123' }, query: {}, params: {} } as any;
    const res = mockRes();
    await validateSchema(authSchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should reject short password', async () => {
    const req = { body: { email: 'test@test.com', password: '12' }, query: {}, params: {} } as any;
    const res = mockRes();
    await validateSchema(authSchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should reject missing email', async () => {
    const req = { body: { password: 'password123' }, query: {}, params: {} } as any;
    const res = mockRes();
    await validateSchema(authSchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should pass valid activity data', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: 10, unit: 'km' },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject activity with invalid category', async () => {
    const req = {
      body: { category: 'teleport', subcategory: 'car_petrol', quantity: 10, unit: 'km' },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should reject activity with negative quantity', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: -5, unit: 'km' },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should reject activity with zero quantity', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: 0, unit: 'km' },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should handle empty body', async () => {
    const req = { body: {}, query: {}, params: {} } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// Schema-specific constraint tests for newly added security limits
describe('LogActivitySchema quantity cap', () => {
  it('should reject quantity over 100,000', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: 200000, unit: 'km' },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    const mockNextFn: NextFunction = vi.fn();
    await validateSchema(LogActivitySchema)(req, res, mockNextFn);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should accept quantity at exactly 100,000', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: 100000, unit: 'km' },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    const mockNextFn: NextFunction = vi.fn();
    await validateSchema(LogActivitySchema)(req, res, mockNextFn);
    expect(mockNextFn).toHaveBeenCalled();
  });
});

describe('ChatSchema message length cap', () => {
  it('should reject message over 500 characters', async () => {
    const req = {
      body: { message: 'a'.repeat(501) },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    const mockNextFn: NextFunction = vi.fn();
    await validateSchema(ChatSchema)(req, res, mockNextFn);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should accept message at exactly 500 characters', async () => {
    const req = {
      body: { message: 'a'.repeat(500) },
      query: {}, params: {},
    } as any;
    const res = mockRes();
    const mockNextFn: NextFunction = vi.fn();
    await validateSchema(ChatSchema)(req, res, mockNextFn);
    expect(mockNextFn).toHaveBeenCalled();
  });
});
