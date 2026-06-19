/* eslint-disable no-console */
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import * as dotenv from 'dotenv';
import compression from 'compression';

// Import configurations and adapters
import { DatabaseConnection } from '../../infrastructure/database/DatabaseConnection';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { ActivityRepository } from '../../infrastructure/database/ActivityRepository';
import { ChallengeRepository } from '../../infrastructure/database/ChallengeRepository';
import { GoalRepository } from '../../infrastructure/database/GoalRepository';
// Import Use Cases
import { LogActivity } from '../../application/use-cases/LogActivity';
import { GetActivities } from '../../application/use-cases/GetActivities';
import { GetDashboardData, clearDashboardCache } from '../../application/use-cases/GetDashboardData';
import { GetRecommendations, clearRecommendationsCache } from '../../application/use-cases/GetRecommendations';
import { GetForecast, clearForecastCache } from '../../application/use-cases/GetForecast';
import { ManageChallenges } from '../../application/use-cases/ManageChallenges';
import { GenerateReport, clearReportCache } from '../../application/use-cases/GenerateReport';

// Import Services
import { AiCoachService } from '../../services/AiCoachService';
import { SimpleActionService } from '../../services/SimpleActionService';

// Import Middleware
import { xssSanitizer } from './middleware/sanitize';
import { authenticateToken, AuthenticatedRequest } from './middleware/auth';
import { validateSchema } from './middleware/validate';
import {
  LogActivitySchema,
  GoalSchema,
  ChatSchema
} from './middleware/schemas';

// Load environmental variables
dotenv.config();

const app = express();
app.use(compression()); // gzip all responses
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline styles
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],    // Clickjacking protection
      upgradeInsecureRequests: [],
    }
  },
  hsts: {
    maxAge: 31536000,               // 1 year HSTS
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  crossOriginEmbedderPolicy: false, // needed for some resources
}));

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400  // preflight cache for 24 hours
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '100kb' }));
app.use(xssSanitizer);

// Rate Limiters
// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please try again later.' }
});

// Strict limiter for write operations
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 20,               // 20 writes per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many write requests.' }
});

// Chat limiter (AI calls are expensive)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Chat rate limit reached.' }
});


// Initialize Clean Architecture Components
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



// CSRF Token Helpers & Middleware
const getCsrfTokenFromCookie = (req: Request): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    const value = parts.join('=').trim();
    if (key === 'csrfToken') acc = value;
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
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ error: 'CSRF token validation failed.' });
    return;
  }
  next();
};

// CSRF token generation endpoint (Must be placed before general authenticateToken)
app.get('/api/csrf-token', apiLimiter, (_req: Request, res: Response) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrfToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ csrfToken: token });
});

// Apply rate limiter globally to all routes
app.use(apiLimiter);

// ----------------------------------------------------
// Protected Routes (JWT required)
// ----------------------------------------------------
app.use('/api', authenticateToken);
app.use('/api', csrfProtection);
app.post('/api/activities', writeLimiter);
app.post('/api/goals', writeLimiter);
app.post('/api/coach/chat', chatLimiter);

// User Profile info
app.get('/api/auth/me', async (req: AuthenticatedRequest, res: Response) => {
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
      createdAt: user.createdAt
    });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});



// Carbon Intelligence Dashboard
app.get('/api/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = await getDashboardUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=30');
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve dashboard details.' });
  }
});

// Activities Logger Endpoints
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
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      isRecurring: !!isRecurring,
      recurrencePeriod: recurrencePeriod ? (recurrencePeriod as 'daily' | 'weekly' | 'none') : 'none'
    });

    res.status(201).json({ message: 'Activity logged successfully!', activity });
  } catch {
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
    if (category) filters.category = category;
    if (search) filters.search = search.slice(0, 200); // cap search string length
    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!Number.isNaN(parsedLimit) && parsedLimit > 0) filters.limit = Math.min(parsedLimit, 500);
    }
    if (offset) {
      const parsedOffset = parseInt(offset, 10);
      if (!Number.isNaN(parsedOffset) && parsedOffset >= 0) filters.offset = parsedOffset;
    }
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) filters.startDate = d;
      else {
        res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601.' });
        return;
      }
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) filters.endDate = d;
      else {
        res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601.' });
        return;
      }
    }

    const result = await getActivitiesUseCase.execute(userId, filters);
    res.status(200).json(result);
  } catch {
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
  } catch {
    res.status(500).json({ error: 'Failed to delete activity.' });
  }
});

// Recommendations Engine
app.get('/api/recommendations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const recommendations = await getRecommendationsUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=60');
    res.status(200).json(recommendations);
  } catch {
    res.status(500).json({ error: 'Failed to load recommendations.' });
  }
});

// Forecast predictions
app.get('/api/forecast', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const forecast = await getForecastUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=60');
    res.status(200).json(forecast);
  } catch {
    res.status(500).json({ error: 'Failed to load carbon emissions forecast.' });
  }
});

// Set carbon target goal
app.post('/api/goals', validateSchema(GoalSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body as { targetCo2: number };
    const { targetCo2 } = body;
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30); // 30 day target

    const goal = await goalRepo.create({
      userId,
      targetCo2,
      startDate,
      endDate,
      achieved: false
    });

    clearDashboardCache(userId);
    clearForecastCache(userId);
    clearReportCache(userId);

    res.status(201).json({ message: 'Goal target set successfully!', goal });
  } catch {
    res.status(400).json({ error: 'Failed to set target goal.' });
  }
});

// Eco Coach chatbot endpoint
app.post('/api/coach/chat', validateSchema(ChatSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body as { message: string };
    const { message } = body;
    
    const [user, actResult] = await Promise.all([
      userRepo.findById(userId),
      activityRepo.findByUserId(userId, { limit: 100 })
    ]);

    if (!user) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const response = AiCoachService.chat(message, user, actResult.activities);
    res.status(200).json(response);
  } catch {
    res.status(500).json({ error: 'Sustainability Coach service failed.' });
  }
});

// Challenges list, join, complete
app.get('/api/challenges', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await manageChallengesUseCase.listAll(userId);
    res.status(200).json(result);
  } catch {
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
    res.status(200).json({ message: 'Enrolled in challenge successfully!', joined });
  } catch {
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
    res.status(200).json({ message: 'Congratulations! Challenge completed and points awarded.', completed });
  } catch {
    res.status(400).json({ error: 'Failed to complete challenge.' });
  }
});

// Simple Action of the Day
app.get('/api/actions/daily', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [user, actResult] = await Promise.all([
      userRepo.findById(userId),
      activityRepo.findByUserId(userId, { limit: 200 })
    ]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const dailyAction = SimpleActionService.getDailyAction(actResult.activities);
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).json(dailyAction);
  } catch {
    res.status(500).json({ error: 'Failed to load daily action.' });
  }
});

// Simple Actions catalog
app.get('/api/actions', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const actions = SimpleActionService.getAllActions();
    res.status(200).json(actions);
  } catch {
    res.status(500).json({ error: 'Failed to load actions.' });
  }
});

// Reports metrics card
app.get('/api/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const report = await generateReportUseCase.execute(userId);
    res.set('Cache-Control', 'private, max-age=30');
    res.status(200).json(report);
  } catch {
    res.status(500).json({ error: 'Failed to compile report summaries.' });
  }
});

// ----------------------------------------------------
// Frontend Static Assets serving in production
// ----------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
  });
}

// Global error handling middleware (must have 4 args for Express to recognize it)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[EcoTrack Error]', err.message);

  if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: 'Invalid JSON payload.' });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { details: err.message, stack: err.stack })
  });
});

// 404 handler (must come after all defined routes)
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Database initialization & Start Server
const serverInstance = db.initializeSchema()
  .then(() => {
    // Log key configuration on startup for transparency
    console.info(`[EcoTrack AI] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.info(`[EcoTrack AI] Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite (local)'}`);
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
      console.warn('[EcoTrack AI] WARNING: Production mode running with SQLite. Set DATABASE_URL for PostgreSQL.');
    }
    return app.listen(PORT, () => {
      console.info(`[EcoTrack AI Server] Service running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Database Schema] Setup crash:', err);
    process.exit(1);
  });

export { app, db, serverInstance };
