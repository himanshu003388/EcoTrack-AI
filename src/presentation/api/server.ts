import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Import configurations and adapters
import { DatabaseConnection } from '../../infrastructure/database/DatabaseConnection';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { ActivityRepository } from '../../infrastructure/database/ActivityRepository';
import { ChallengeRepository } from '../../infrastructure/database/ChallengeRepository';
import { GoalRepository } from '../../infrastructure/database/GoalRepository';
// Import Use Cases
import { LogActivity } from '../../application/use-cases/LogActivity';
import { GetActivities } from '../../application/use-cases/GetActivities';
import { GetDashboardData } from '../../application/use-cases/GetDashboardData';
import { GetRecommendations } from '../../application/use-cases/GetRecommendations';
import { GetForecast } from '../../application/use-cases/GetForecast';
import { ManageChallenges } from '../../application/use-cases/ManageChallenges';
import { GenerateReport } from '../../application/use-cases/GenerateReport';

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
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*"],
      connectSrc: ["'self'", "http://localhost:5000"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));
app.use(xssSanitizer);

// Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // Limit IP to 100 requests per window
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' }
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



// ----------------------------------------------------
// Protected Routes (JWT required)
// ----------------------------------------------------
app.use('/api', generalLimiter, authenticateToken);

// User Profile info
app.get('/api/auth/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await userRepo.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
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
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve dashboard details.' });
  }
});

// Activities Logger Endpoints
app.post('/api/activities', validateSchema(LogActivitySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { category, subcategory, quantity, unit, timestamp, isRecurring, recurrencePeriod } = req.body;
    
    const activity = await logActivityUseCase.execute({
      userId,
      category,
      subcategory,
      quantity,
      unit,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      isRecurring,
      recurrencePeriod
    });

    res.status(201).json({ message: 'Activity logged successfully!', activity });
  } catch {
    res.status(400).json({ error: 'Failed to log activity.' });
  }
});

app.get('/api/activities', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { category, search, limit, offset, startDate, endDate } = req.query;

    const filters: Record<string, unknown> = {};
    if (category) filters.category = category;
    if (search) filters.search = String(search).slice(0, 200); // cap search string length
    if (limit) {
      const parsedLimit = parseInt(String(limit), 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) filters.limit = Math.min(parsedLimit, 500);
    }
    if (offset) {
      const parsedOffset = parseInt(String(offset), 10);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) filters.offset = parsedOffset;
    }
    if (startDate) {
      const d = new Date(String(startDate));
      if (!isNaN(d.getTime())) filters.startDate = d;
      else return res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601.' });
    }
    if (endDate) {
      const d = new Date(String(endDate));
      if (!isNaN(d.getTime())) filters.endDate = d;
      else return res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601.' });
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

    if (isNaN(activityId) || activityId <= 0) {
      return res.status(400).json({ error: 'Invalid activity ID. Must be a positive integer.' });
    }

    const deleted = await activityRepo.delete(activityId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Activity not found or does not belong to user.' });
    }
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
    res.status(200).json(forecast);
  } catch {
    res.status(500).json({ error: 'Failed to load carbon emissions forecast.' });
  }
});

// Set carbon target goal
app.post('/api/goals', validateSchema(GoalSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetCo2 } = req.body;
    
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

    res.status(201).json({ message: 'Goal target set successfully!', goal });
  } catch {
    res.status(400).json({ error: 'Failed to set target goal.' });
  }
});

// Eco Coach chatbot endpoint
app.post('/api/coach/chat', validateSchema(ChatSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { message } = req.body;
    
    const user = await userRepo.findById(userId);
    const actResult = await activityRepo.findByUserId(userId, { limit: 100 });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
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
    if (isNaN(challengeId) || challengeId <= 0) {
      return res.status(400).json({ error: 'Invalid challenge ID. Must be a positive integer.' });
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
    if (isNaN(challengeId) || challengeId <= 0) {
      return res.status(400).json({ error: 'Invalid challenge ID. Must be a positive integer.' });
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
    const user = await userRepo.findById(userId);
    const actResult = await activityRepo.findByUserId(userId, { limit: 200 });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const dailyAction = SimpleActionService.getDailyAction(actResult.activities);
    res.status(200).json(dailyAction);
  } catch {
    res.status(500).json({ error: 'Failed to load daily action.' });
  }
});

// Simple Actions catalog
app.get('/api/actions', async (_req: AuthenticatedRequest, res: Response) => {
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

// Global error handler middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]:', err);
  res.status(500).json({ error: 'An internal server error occurred.' });
});

// Database initialization & Start Server
const serverInstance = db.initializeSchema()
  .then(() => {
    // Log key configuration on startup for transparency
    console.log(`[EcoTrack AI] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[EcoTrack AI] Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite (local)'}`);
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
      console.warn('[EcoTrack AI] WARNING: Production mode running with SQLite. Set DATABASE_URL for PostgreSQL.');
    }
    return app.listen(PORT, () => {
      console.log(`[EcoTrack AI Server] Service running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Database Schema] Setup crash:', err);
    process.exit(1);
  });

export { app, db, serverInstance };
