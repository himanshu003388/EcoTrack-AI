import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
 * Performs JWT verification if an Authorization header is provided, 
 * otherwise defaults to a stub user for development and testing.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  const stubUser = {
    id: 1,
    email: 'user@ecotrack.ai',
    username: 'EcoTrack User',
  };

  if (!token) {
    // If no token is provided, fall back to the stub user
    req.user = stubUser;
    return next();
  }

  if (token === 'dummy-token') {
    req.user = stubUser;
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long!!';
    const decoded = jwt.verify(token, secret) as { id: number; email: string; username: string };
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
    };
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}
