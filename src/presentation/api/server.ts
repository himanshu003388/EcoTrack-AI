import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import * as dotenv from 'dotenv';
import compression from 'compression';
import { IncomingMessage } from 'http';

interface NonceRequest extends IncomingMessage {
  nonce?: string;
}

declare global {
  /* eslint-disable-next-line @typescript-eslint/no-namespace */
  namespace Express {
    interface Request {
      requestId: string;
      nonce: string;
    }
  }
}

import { DatabaseConnection } from '../../infrastructure/database/DatabaseConnection';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { ActivityRepository } from '../../infrastructure/database/ActivityRepository';
import { ChallengeRepository } from '../../infrastructure/database/ChallengeRepository';
import { GoalRepository } from '../../infrastructure/database/GoalRepository';
import { LogActivity } from '../../application/use-cases/LogActivity';
import { GetActivities } from '../../application/use-cases/GetActivities';
import { GetDashboardData, clearDashboardCache } from '../../application/use-cases/GetDashboardData';
import { GetRecommendations, clearRecommendationsCache } from '../../application/use-cases/GetRecommendations';
import { GetForecast, clearForecastCache } from '../../application/use-cases/GetForecast';
import { ManageChallenges } from '../../application/use-cases/ManageChallenges';
import { GenerateReport, clearReportCache } from '../../application/use-cases/GenerateReport';
import { AiCoachService } from '../../services/AiCoachService';
import { SimpleActionService } from '../../services/SimpleActionService';
import { xssSanitizer } from './middleware/sanitize';
import { authenticateToken, AuthenticatedRequest } from './middleware/auth';
import { validateSchema } from './middleware/validate';
import { LogActivitySchema, GoalSchema, ChatSchema } from './middleware/schemas';
import { logger } from '../../infrastructure/logger';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());
const PORT = process.env.PORT ?? 5000;

app.use((req: Request, res: Response, next: NextFunction): void => {
  const requestId = crypto.randomUUID();
  req.nonce = crypto.randomBytes(16).toString('base64url');
  res.setHeader('X-Request-ID', requestId);
  req.requestId = requestId;
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req: IncomingMessage): string => `'nonce-${(req as NonceRequest).nonce ?? ''}'`],
        styleSrc: [
          "'self'",
          (req: IncomingMessage): string => `'nonce-${(req as NonceRequest).nonce ?? ''}'`,
          'https://fonts.googleapis.com',
        ],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    permittedCrossDomainPolicies: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    originAgentCluster: true,
  }),
);

app.use((_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), fullscreen=(self)',
  );
  next();
});

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));

// Body parsing with strict size limit
app.use(express.json({ limit: '10kb' }));

// HPP protection — prevents HTTP parameter pollution attacks
app.use(hpp());

// XSS sanitizer runs after body parsing
app.use(xssSanitizer);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please try again later.' },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many write requests.' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Chat rate limit reached.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many authentication requests.' },
});

const db = new DatabaseConnection();
const userRepo = new UserRepository(db);
const activityRepo = new ActivityRepository(db);
const challengeRepo = new ChallengeRepository(db);
const goalRepo = new GoalRepository(db);

const logActivityUseCase = new LogActivity(activityRepo, userRepo, challengeRepo);
const getActivitiesUseCase = new GetActivities(activityRepo);
const getDashboardUseCase = new GetDashboardData(activityRepo, userRepo, goalRepo);
const getRecommendationsUseCase = new GetRecommendations(activityRepo);
const getForecastUseCase = new GetForecast(activityRepo, goalRepo);
const manageChallengesUseCase = new ManageChallenges(challengeRepo, userRepo);
const generateReportUseCase = new GenerateReport(activityRepo, userRepo, goalRepo, db);

// CSRF — constant-time comparison prevents timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to prevent short-circuit timing leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const getCsrfTokenFromCookie = (req: Request): string | null => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader === undefined || cookieHeader === '') return null;
  const cookies = cookieHeader.split(';').reduce<string>((acc, cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    const value = parts.join('=').trim();
    if (key === '__Host-csrfToken' || key === 'csrfToken') acc = value;
    return acc;
  }, '');
  return cookies || null;
};

const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }
  const cookieToken = getCsrfTokenFromCookie(req);
  const headerToken = req.headers['x-csrf-token'];
  const headerStr = typeof headerToken === 'string' ? headerToken : undefined;
  if (cookieToken === null || headerStr === undefined || headerStr === '' || !timingSafeEqual(cookieToken, headerStr)) {
    logger.warn('CSRF validation failed', {
      ip: req.ip,
      method: req.method,
      path: req.path,
    });
    res.status(403).json({ error: 'CSRF token validation failed.' });
    return;
  }
  next();
};

app.get('/api/csrf-token', apiLimiter, (_req: Request, res: Response) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('__Host-csrfToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 7200 * 1000,
  });
  res.json({ csrfToken: token });
});

app.use(apiLimiter);

app.use('/api', authenticateToken);
app.use('/api', csrfProtection);
app.post('/api/activities', writeLimiter);
app.post('/api/goals', writeLimiter);
app.post('/api/coach/chat', chatLimiter);
app.delete('/api/activities/:id', writeLimiter);

app.get('/api/auth/me', authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await userRepo.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }
    res.status(200).json({
      id: user.id,
      email: user.email,
      username: user.username,
      points: user.points,
      level: user.level,
      streak: user.streak,
      createdAt: user.createdAt,
    });
  } catch (err) {
    logger.error('Failed to retrieve profile.', err);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

app.get('/api/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = await getDashboardUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=30');
    res.status(200).json(data);
  } catch (err) {
    logger.error('Failed to retrieve dashboard details.', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard details.' });
  }
});

app.post('/api/activities', validateSchema(LogActivitySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body as {
      category: string;
      subcategory: string;
      quantity: number;
      unit: string;
      timestamp?: string;
      isRecurring?: boolean;
      recurrencePeriod?: string;
    };
    const { category, subcategory, quantity, unit, timestamp, isRecurring, recurrencePeriod } = body;

    const activity = await logActivityUseCase.execute({
      userId,
      category: category as 'transport' | 'energy' | 'food' | 'shopping_waste',
      subcategory,
      quantity,
      unit,
      timestamp: timestamp !== undefined && timestamp !== '' ? new Date(timestamp) : new Date(),
      isRecurring: isRecurring === true,
      recurrencePeriod:
        recurrencePeriod === 'daily' || recurrencePeriod === 'weekly' || recurrencePeriod === 'none'
          ? recurrencePeriod
          : 'none',
    });

    res.status(201).json({ message: 'Activity logged successfully!', activity });
  } catch (err) {
    logger.error('Failed to log activity.', err);
    res.status(400).json({ error: 'Failed to log activity.' });
  }
});

app.get('/api/activities', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = req.query as Record<string, unknown>;
    const category = typeof query.category === 'string' ? query.category : undefined;
    const search = typeof query.search === 'string' ? query.search : undefined;
    const limit = typeof query.limit === 'string' ? query.limit : undefined;
    const offset = typeof query.offset === 'string' ? query.offset : undefined;
    const startDate = typeof query.startDate === 'string' ? query.startDate : undefined;
    const endDate = typeof query.endDate === 'string' ? query.endDate : undefined;

    const filters: Record<string, unknown> = {};
    if (category !== undefined && category !== '') filters.category = category;
    if (search !== undefined && search !== '') filters.search = search.slice(0, 200);
    if (limit !== undefined && limit !== '') {
      const parsedLimit = parseInt(limit, 10);
      if (!Number.isNaN(parsedLimit) && parsedLimit > 0) filters.limit = Math.min(parsedLimit, 500);
    }
    if (offset !== undefined && offset !== '') {
      const parsedOffset = parseInt(offset, 10);
      if (!Number.isNaN(parsedOffset) && parsedOffset >= 0) filters.offset = parsedOffset;
    }
    if (startDate !== undefined && startDate !== '') {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) filters.startDate = d;
      else {
        res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601.' });
        return;
      }
    }
    if (endDate !== undefined && endDate !== '') {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) filters.endDate = d;
      else {
        res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601.' });
        return;
      }
    }

    const result = await getActivitiesUseCase.execute(userId, filters);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to query activities.', err);
    res.status(500).json({ error: 'Failed to query activities.' });
  }
});

app.delete('/api/activities/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const activityId = parseInt(String(req.params.id), 10);

    if (Number.isNaN(activityId) || activityId <= 0) {
      res.status(400).json({ error: 'Invalid activity ID. Must be a positive integer.' });
      return;
    }

    const deleted = await activityRepo.delete(activityId, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Activity not found or does not belong to user.' });
      return;
    }
    clearDashboardCache(userId);
    clearForecastCache(userId);
    clearRecommendationsCache(userId);
    clearReportCache(userId);
    res.status(200).json({ message: 'Activity deleted successfully.' });
  } catch (err) {
    logger.error('Failed to delete activity.', err);
    res.status(500).json({ error: 'Failed to delete activity.' });
  }
});

app.get('/api/recommendations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const recommendations = await getRecommendationsUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=60');
    res.status(200).json(recommendations);
  } catch (err) {
    logger.error('Failed to load recommendations.', err);
    res.status(500).json({ error: 'Failed to load recommendations.' });
  }
});

app.get('/api/forecast', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const forecast = await getForecastUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=60');
    res.status(200).json(forecast);
  } catch (err) {
    logger.error('Failed to load carbon emissions forecast.', err);
    res.status(500).json({ error: 'Failed to load carbon emissions forecast.' });
  }
});

app.post('/api/goals', validateSchema(GoalSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body as { targetCo2: number };
    const { targetCo2 } = body;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    const goal = await goalRepo.create({
      userId,
      targetCo2,
      startDate,
      endDate,
      achieved: false,
    });

    clearDashboardCache(userId);
    clearForecastCache(userId);
    clearReportCache(userId);

    res.status(201).json({ message: 'Goal target set successfully!', goal });
  } catch (err) {
    logger.error('Failed to set target goal.', err);
    res.status(400).json({ error: 'Failed to set target goal.' });
  }
});

app.post('/api/coach/chat', validateSchema(ChatSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body as { message: string };
    const { message } = body;

    const [user, actResult] = await Promise.all([
      userRepo.findById(userId),
      activityRepo.findByUserId(userId, { limit: 100 }),
    ]);

    if (!user) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const response = AiCoachService.chat(message, user, actResult.activities);
    res.status(200).json(response);
  } catch (err) {
    logger.error('Sustainability Coach service failed.', err);
    res.status(500).json({ error: 'Sustainability Coach service failed.' });
  }
});

app.get('/api/challenges', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await manageChallengesUseCase.listAll(userId);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to load challenges.', err);
    res.status(500).json({ error: 'Failed to load challenges.' });
  }
});

app.post('/api/challenges/:id/join', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const challengeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(challengeId) || challengeId <= 0) {
      res.status(400).json({ error: 'Invalid challenge ID. Must be a positive integer.' });
      return;
    }
    const joined = await manageChallengesUseCase.join(userId, challengeId);
    challengeRepo.invalidateCache();
    res.status(200).json({ message: 'Enrolled in challenge successfully!', joined });
  } catch (err) {
    logger.error('Failed to join challenge.', err);
    res.status(400).json({ error: 'Failed to join challenge.' });
  }
});

app.post('/api/challenges/:id/complete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const challengeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(challengeId) || challengeId <= 0) {
      res.status(400).json({ error: 'Invalid challenge ID. Must be a positive integer.' });
      return;
    }
    const completed = await manageChallengesUseCase.complete(userId, challengeId);
    challengeRepo.invalidateCache();
    res.status(200).json({ message: 'Congratulations! Challenge completed and points awarded.', completed });
  } catch (err) {
    logger.error('Failed to complete challenge.', err);
    res.status(400).json({ error: 'Failed to complete challenge.' });
  }
});

app.get('/api/actions/daily', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [user, actResult] = await Promise.all([
      userRepo.findById(userId),
      activityRepo.findByUserId(userId, { limit: 200 }),
    ]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const dailyAction = SimpleActionService.getDailyAction(actResult.activities);
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).json(dailyAction);
  } catch (err) {
    logger.error('Failed to load daily action.', err);
    res.status(500).json({ error: 'Failed to load daily action.' });
  }
});

app.get('/api/actions', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const actions = SimpleActionService.getAllActions();
    res.status(200).json(actions);
  } catch (err) {
    logger.error('Failed to load actions.', err);
    res.status(500).json({ error: 'Failed to load actions.' });
  }
});

app.get('/api/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const report = await generateReportUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=30');
    res.status(200).json(report);
  } catch (err) {
    logger.error('Failed to compile report summaries.', err);
    res.status(500).json({ error: 'Failed to compile report summaries.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`[${_req.requestId || 'unknown'}] ${err.message}`, { path: _req.path, method: _req.method });

  if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: 'Invalid JSON payload.' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
});

app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

const serverInstance = db
  .initializeSchema()
  .then(() => {
    logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
    logger.info(
      `Database: ${process.env.DATABASE_URL !== undefined && process.env.DATABASE_URL !== '' ? 'PostgreSQL' : 'SQLite (local)'}`,
    );
    logger.info(
      `Auth mode: ${process.env.AUTH_REQUIRED === 'true' ? 'STRICT (JWT required)' : 'PERMISSIVE (stub user fallback active — set AUTH_REQUIRED=true for production)'}`,
    );

    if (
      process.env.NODE_ENV === 'production' &&
      (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '')
    ) {
      logger.warn('Production mode running with SQLite. Set DATABASE_URL for PostgreSQL.');
    }
    if (process.env.NODE_ENV === 'production' && process.env.AUTH_REQUIRED !== 'true') {
      logger.warn(
        'AUTH_REQUIRED is not set to true in production. All API routes are accessible without authentication. Set AUTH_REQUIRED=true to enforce JWT authentication.',
      );
    }
    return app.listen(PORT, () => {
      logger.info(`Service running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('[Database Schema] Setup crash:', err);
    process.exit(1);
  });

export { app, db, serverInstance };
