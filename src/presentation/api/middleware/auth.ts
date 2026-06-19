import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export let sessionFallbackSecret: string | undefined;

if (process.env.NODE_ENV === 'production' && process.env.AUTH_REQUIRED !== 'false') {
  if ((process.env.JWT_SECRET ?? '') === '') {
    throw new Error('JWT_SECRET must be set in production');
  }
} else {
  const envSecret = process.env.JWT_SECRET;
  sessionFallbackSecret = (envSecret ?? '') !== '' ? envSecret : crypto.randomBytes(32).toString('hex');
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if ((secret ?? '') !== '') return secret!;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  sessionFallbackSecret ??= crypto.randomBytes(32).toString('hex');
  return sessionFallbackSecret;
}

/** Augmented Express Request that carries the authenticated user's identity. */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
  };
}

/**
 * Authentication middleware for the EcoTrack AI API.
 *
 * SECURITY NOTE:
 * 1. In production, JWT_SECRET must be set.
 * 2. If AUTH_REQUIRED is 'true', unauthorized requests are rejected (401).
 * 3. Fallback stub user is ONLY for local development. Never use in production.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (token === undefined || token === '') {
    if (
      process.env.AUTH_REQUIRED === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.AUTH_REQUIRED !== 'false')
    ) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    req.user = {
      id: 1,
      email: 'user@ecotrack.ai',
      username: 'EcoTrack User',
    };
    return next();
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as { id: number; email: string; username: string };
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
    };
    next();
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'JWT_SECRET must be set in production') {
      res.status(500).json({ error: 'Authentication service is not properly configured.' });
    } else {
      res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }
  }
}
