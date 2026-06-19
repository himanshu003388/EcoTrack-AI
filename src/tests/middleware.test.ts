import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken, sessionFallbackSecret } from '../presentation/api/middleware/auth';
import { xssSanitizer } from '../presentation/api/middleware/sanitize';
import { validateSchema } from '../presentation/api/middleware/validate';
import { LogActivitySchema, ChatSchema } from '../presentation/api/middleware/schemas';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

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
  const mockReq = (headers: Record<string, string> = {}) =>
    ({
      headers,
    }) as unknown as Request;

  const mockNext: NextFunction = vi.fn();

  it('should set stub default user in req.user when AUTH_REQUIRED is not set (dev/demo mode)', () => {
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

  it('should return 401 when no token is provided and AUTH_REQUIRED is true', () => {
    const oldAuthRequired = process.env.AUTH_REQUIRED;
    process.env.AUTH_REQUIRED = 'true';
    const req = mockReq({});
    const res = mockRes();
    const mockNextFn = vi.fn();
    authenticateToken(req, res, mockNextFn);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required.' });
    expect(mockNextFn).not.toHaveBeenCalled();
    if (oldAuthRequired !== undefined) process.env.AUTH_REQUIRED = oldAuthRequired;
    else delete process.env.AUTH_REQUIRED;
  });

  it('should accept valid JWT even when AUTH_REQUIRED is true', () => {
    const oldAuthRequired = process.env.AUTH_REQUIRED;
    process.env.AUTH_REQUIRED = 'true';
    const secret = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long!!';
    const payload = { id: 7, email: 'secured@example.com', username: 'secured_user' };
    const token = jwt.sign(payload, secret);
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();
    const mockNextFn = vi.fn();
    authenticateToken(req, res, mockNextFn);
    expect((req as any).user).toEqual({ id: 7, email: 'secured@example.com', username: 'secured_user' });
    expect(mockNextFn).toHaveBeenCalled();
    if (oldAuthRequired !== undefined) process.env.AUTH_REQUIRED = oldAuthRequired;
    else delete process.env.AUTH_REQUIRED;
  });

  it('should reject with 403 when authorization is dummy-token (bypass removed)', () => {
    const req = mockReq({ authorization: 'Bearer dummy-token' });
    const res = mockRes();
    const mockNextFn = vi.fn();
    authenticateToken(req, res, mockNextFn);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired authentication token.' });
    expect(mockNextFn).not.toHaveBeenCalled();
  });

  it('should verify and set user from decoded JWT token', () => {
    const secret = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long!!';
    const payload = { id: 42, email: 'john@example.com', username: 'john_doe' };
    const token = jwt.sign(payload, secret);
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();
    const mockNextFn = vi.fn();
    authenticateToken(req, res, mockNextFn);
    expect((req as any).user).toEqual({
      id: 42,
      email: 'john@example.com',
      username: 'john_doe',
    });
    expect(mockNextFn).toHaveBeenCalled();
  });

  it('should return 403 status code when token is invalid', () => {
    const req = mockReq({ authorization: 'Bearer invalid-token-string' });
    const res = mockRes();
    const mockNextFn = vi.fn();
    authenticateToken(req, res, mockNextFn);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired authentication token.' });
    expect(mockNextFn).not.toHaveBeenCalled();
  });

  it('should verify and set user from decoded JWT token when JWT_SECRET is not set in env', () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    const fallbackSecret = sessionFallbackSecret || 'fallback-secret-at-least-32-chars-long!!';
    const payload = { id: 99, email: 'fallback@example.com', username: 'fallback_user' };
    const token = jwt.sign(payload, fallbackSecret);
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();
    const mockNextFn = vi.fn();

    authenticateToken(req, res, mockNextFn);

    expect((req as any).user).toEqual({
      id: 99,
      email: 'fallback@example.com',
      username: 'fallback_user',
    });
    expect(mockNextFn).toHaveBeenCalled();

    if (originalSecret) {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});

describe('Sanitize middleware', () => {
  const mockReq = (body: any = {}) =>
    ({
      body: JSON.parse(JSON.stringify(body)),
    }) as unknown as Request;

  const mockRes = () => ({}) as Response;
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
      query: {},
      params: {},
    } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject activity with invalid category', async () => {
    const req = {
      body: { category: 'teleport', subcategory: 'car_petrol', quantity: 10, unit: 'km' },
      query: {},
      params: {},
    } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should reject activity with negative quantity', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: -5, unit: 'km' },
      query: {},
      params: {},
    } as any;
    const res = mockRes();
    await validateSchema(activitySchema)(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should reject activity with zero quantity', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: 0, unit: 'km' },
      query: {},
      params: {},
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

  it('should forward non-ZodError via next(error)', async () => {
    const badSchema = {
      parseAsync: vi.fn().mockRejectedValue(new Error('Some other database error')),
    } as any;
    const req = { body: {}, query: {}, params: {} } as any;
    const res = mockRes();
    const mockNextFn = vi.fn();
    await validateSchema(badSchema)(req, res, mockNextFn);
    expect(mockNextFn).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Schema-specific constraint tests for newly added security limits
describe('LogActivitySchema quantity cap', () => {
  it('should reject quantity over 100,000', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: 200000, unit: 'km' },
      query: {},
      params: {},
    } as any;
    const res = mockRes();
    const mockNextFn: NextFunction = vi.fn();
    await validateSchema(LogActivitySchema)(req, res, mockNextFn);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should accept quantity at exactly 100,000', async () => {
    const req = {
      body: { category: 'transport', subcategory: 'car_petrol', quantity: 100000, unit: 'km' },
      query: {},
      params: {},
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
      query: {},
      params: {},
    } as any;
    const res = mockRes();
    const mockNextFn: NextFunction = vi.fn();
    await validateSchema(ChatSchema)(req, res, mockNextFn);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should accept message at exactly 500 characters', async () => {
    const req = {
      body: { message: 'a'.repeat(500) },
      query: {},
      params: {},
    } as any;
    const res = mockRes();
    const mockNextFn: NextFunction = vi.fn();
    await validateSchema(ChatSchema)(req, res, mockNextFn);
    expect(mockNextFn).toHaveBeenCalled();
  });
});

// Additional sanitizer security tests for hardened vectors
describe('Sanitize middleware — hardened vectors', () => {
  const mockReqBody = (body: any) =>
    ({
      body: JSON.parse(JSON.stringify(body)),
      query: {},
      params: {},
    }) as unknown as Request;
  const mockResponse = () => ({}) as Response;
  const mockNextFn: NextFunction = vi.fn();

  it('should strip SVG onload event handler', () => {
    const req = mockReqBody({ payload: '<svg onload=alert(1)>text</svg>' });
    xssSanitizer(req, mockResponse(), mockNextFn);
    expect(req.body.payload).not.toContain('onload');
    expect(req.body.payload).not.toContain('<svg');
  });

  it('should strip null bytes from string fields', () => {
    const req = mockReqBody({ filename: 'safe.txt\x00.exe' });
    xssSanitizer(req, mockResponse(), mockNextFn);
    expect(req.body.filename).not.toContain('\x00');
    expect(req.body.filename).toBe('safe.txt.exe');
  });

  it('should decode HTML entities and then sanitize encoded script tag', () => {
    const req = mockReqBody({ message: '&lt;script&gt;alert(1)&lt;/script&gt;' });
    xssSanitizer(req, mockResponse(), mockNextFn);
    expect(req.body.message).not.toContain('script');
    expect(req.body.message).not.toContain('alert');
  });

  it('should remove prototype pollution key __proto__', () => {
    const req = { body: Object.create(null), query: {}, params: {} } as unknown as Request;
    // Simulate object with __proto__ key (use defineProperty to avoid actual prototype pollution)
    Object.defineProperty(req.body, '__proto__', { value: { injected: true }, enumerable: true });
    req.body['safe'] = 'value';
    xssSanitizer(req, mockResponse(), mockNextFn);
    expect(req.body).not.toHaveProperty('injected');
    expect(req.body['safe']).toBe('value');
  });

  it('should remove constructor and prototype pollution keys from body', () => {
    const req = mockReqBody({ constructor: 'evil', prototype: 'bad', safe: 'ok' });
    xssSanitizer(req, mockResponse(), mockNextFn);
    expect(req.body).not.toHaveProperty('constructor');
    expect(req.body).not.toHaveProperty('prototype');
    expect(req.body.safe).toBe('ok');
  });
});
