import { Request, Response, NextFunction } from 'express';

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
 * @security DESIGN NOTE — Single-User Architecture:
 * EcoTrack AI is designed as a single-user personal carbon tracker (no multi-tenant
 * authentication required). This middleware attaches a fixed user identity to every
 * request so all API routes can use `req.user` in a consistent pattern.
 *
 * In a production multi-user deployment, this function would be replaced with
 * JWT verification using `jsonwebtoken.verify()` and the `JWT_SECRET` environment
 * variable already loaded via dotenv. The `authenticateToken` interface is
 * forward-compatible with that pattern.
 */
export function authenticateToken(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  req.user = {
    id: 1,
    email: 'user@ecotrack.ai',
    username: 'EcoTrack User',
  };
  next();
}
