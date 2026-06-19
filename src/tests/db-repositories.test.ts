import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabaseConnection } from '../infrastructure/database/DatabaseConnection';
import { UserRepository } from '../infrastructure/database/UserRepository';
import { ActivityRepository } from '../infrastructure/database/ActivityRepository';
import { ChallengeRepository } from '../infrastructure/database/ChallengeRepository';
import { GoalRepository } from '../infrastructure/database/GoalRepository';


describe('DatabaseConnection', () => {
  it('should initialize with default SQLite path', () => {
    const db = new DatabaseConnection();
    expect(db).toBeDefined();
  });

  it('should have query method', () => {
    const db = new DatabaseConnection();
    expect(typeof db.query).toBe('function');
  });

  it('should have close method', () => {
    const db = new DatabaseConnection();
    expect(typeof db.close).toBe('function');
  });

  it('should have initializeSchema method', () => {
    const db = new DatabaseConnection();
    expect(typeof db.initializeSchema).toBe('function');
  });

  it('should initialize schema and seed challenges and badges if empty', async () => {
    const db = new DatabaseConnection();
    await db.initializeSchema();
    await db.query('DELETE FROM challenges');
    await db.query('DELETE FROM badges');
    await db.query('DELETE FROM users');

    const newDb = new DatabaseConnection();
    await newDb.initializeSchema();

    const chCount = await newDb.query('SELECT COUNT(*) as count FROM challenges');
    const bgCount = await newDb.query('SELECT COUNT(*) as count FROM badges');
    const userCount = await newDb.query('SELECT COUNT(*) as count FROM users');

    expect(Number(chCount[0].count)).toBe(4);
    expect(Number(bgCount[0].count)).toBe(5);
    expect(Number(userCount[0].count)).toBe(1);

    await newDb.close();
  });

  it('should reject on query errors', async () => {
    const db = new DatabaseConnection();
    await expect(db.query('SELECT * FROM nonexistent_table')).rejects.toThrow();
    await expect(db.query('INSERT INTO nonexistent_table VALUES (1)')).rejects.toThrow();
    await db.close();
  });
});

describe('Schema SQL', () => {
  it('should define all required tables', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(__dirname, '../infrastructure/persistence/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS activities');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS challenges');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS user_challenges');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS badges');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS goals');
  });

  it('should define users table with required columns', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(__dirname, '../infrastructure/persistence/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('id SERIAL PRIMARY KEY');
    expect(schema).toContain('email VARCHAR(255) UNIQUE NOT NULL');
    expect(schema).toContain('username VARCHAR(100) NOT NULL');
    expect(schema).toContain('password_hash VARCHAR(255) NOT NULL');
    expect(schema).toContain('points INTEGER DEFAULT 0');
    expect(schema).toContain('level VARCHAR(50)');
    expect(schema).toContain('streak INTEGER DEFAULT 0');
  });

  it('should define activities table with required columns', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(__dirname, '../infrastructure/persistence/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('user_id INTEGER NOT NULL REFERENCES users(id)');
    expect(schema).toContain('category VARCHAR(50) NOT NULL');
    expect(schema).toContain('subcategory VARCHAR(100) NOT NULL');
    expect(schema).toContain('quantity REAL NOT NULL');
    expect(schema).toContain('co2_emissions REAL NOT NULL');
  });

  it('should define indexes for performance', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(__dirname, '../infrastructure/persistence/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_activities_user_id');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_activities_timestamp');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_activities_category');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_user_badges_user_id');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_goals_user_id');
  });

  it('should define goals table with all constraints', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(__dirname, '../infrastructure/persistence/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('target_co2 REAL NOT NULL');
    expect(schema).toContain('start_date TIMESTAMPTZ NOT NULL');
    expect(schema).toContain('end_date TIMESTAMPTZ NOT NULL');
    expect(schema).toContain('achieved BOOLEAN DEFAULT FALSE');
  });

  it('should fallback to default schema SQL when schema file read fails', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.resolve(__dirname, '../infrastructure/persistence/schema.sql');
    const backupPath = schemaPath + '.bak';

    let hasBackup = false;
    if (fs.existsSync(schemaPath)) {
      fs.renameSync(schemaPath, backupPath);
      hasBackup = true;
    }

    try {
      const dbFallback = new DatabaseConnection();
      await dbFallback.initializeSchema();
      await dbFallback.close();
    } finally {
      if (hasBackup) {
        fs.renameSync(backupPath, schemaPath);
      }
    }
  });

  it('should seed user in Postgres mode if database is empty', async () => {
    const dbMockPG = new DatabaseConnection();
    (dbMockPG as any).isPostgres = true;

    const querySpy = vi.spyOn(dbMockPG, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT COUNT(*)')) {
        return [{ count: 0 }];
      }
      return [];
    });

    await (dbMockPG as any).seedChallengesAndBadges();

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users")
    );

    querySpy.mockRestore();
    await dbMockPG.close();
  });
});

describe('Repositories Integration & Postgres Paths', () => {
  let db: DatabaseConnection;

  beforeAll(async () => {
    db = new DatabaseConnection();
    await db.initializeSchema();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('UserRepository', () => {
    it('findByEmail returns null when not found', async () => {
      const repo = new UserRepository(db);
      const user = await repo.findByEmail('nonexistent-email-xyz@test.com');
      expect(user).toBeNull();
    });

    it('findById returns null when not found', async () => {
      const repo = new UserRepository(db);
      const user = await repo.findById(999999);
      expect(user).toBeNull();
    });

    it('create and retrieve in SQLite mode, throws if not found', async () => {
      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockImplementation(async (sql) => {
          if (sql.trim().toLowerCase().startsWith('insert')) {
            return [{ id: 999999 }];
          }
          return [];
        }),
      } as any;
      const repo = new UserRepository(mockDbConnection);
      await expect(repo.create('fail@test.com', 'fail', 'hash')).rejects.toThrow(
        '[UserRepository] Created user could not be retrieved.'
      );
    });

    it('create in Postgres mode', async () => {
      const mockUserRow = {
        id: 10,
        email: 'postgres@test.com',
        username: 'pg_user',
        password_hash: 'hash',
        points: 50,
        level: 'Sapling',
        streak: 2,
        created_at: new Date().toISOString(),
      };
      const mockDbConnection = {
        getIsPostgres: () => true,
        query: vi.fn().mockResolvedValue([mockUserRow]),
      } as any;

      const repo = new UserRepository(mockDbConnection);
      const user = await repo.create('postgres@test.com', 'pg_user', 'hash');
      expect(user.id).toBe(10);
      expect(user.email).toBe('postgres@test.com');
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        ['postgres@test.com', 'pg_user', 'hash']
      );
    });

    it('findByEmail returns user when found', async () => {
      const repo = new UserRepository(db);
      await db.query("INSERT OR IGNORE INTO users (id, email, username, password_hash) VALUES (1, 'user@ecotrack.ai', 'EcoTrack User', 'no-password')");
      const user = await repo.findByEmail('user@ecotrack.ai');
      expect(user).not.toBeNull();
      expect(user!.email).toBe('user@ecotrack.ai');
    });

    it('create in SQLite mode succeeds', async () => {
      const repo = new UserRepository(db);
      await db.query("DELETE FROM users WHERE email = 'new-sqlite@test.com'");
      const user = await repo.create('new-sqlite@test.com', 'sqlite_user', 'hash');
      expect(user.email).toBe('new-sqlite@test.com');
    });
  });

  describe('ActivityRepository', () => {
    it('findById returns null when not found', async () => {
      const repo = new ActivityRepository(db);
      const act = await repo.findById(999999);
      expect(act).toBeNull();
    });

    it('create in Postgres mode', async () => {
      const mockActRow = {
        id: 42,
        user_id: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 15,
        unit: 'km',
        co2_emissions: 2.7,
        timestamp: new Date().toISOString(),
        is_recurring: 0,
        recurrence_period: 'none',
      };
      const mockDbConnection = {
        getIsPostgres: () => true,
        query: vi.fn().mockResolvedValue([mockActRow]),
      } as any;

      const repo = new ActivityRepository(mockDbConnection);
      const act = await repo.create({
        userId: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 15,
        unit: 'km',
        co2Emissions: 2.7,
        timestamp: new Date(),
        isRecurring: false,
        recurrencePeriod: 'none',
      });
      expect(act.id).toBe(42);
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('create throws in SQLite if created activity cannot be retrieved', async () => {
      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockImplementation(async (sql) => {
          if (sql.trim().toLowerCase().startsWith('insert')) {
            return [{ id: 999999 }];
          }
          return [];
        }),
      } as any;
      const repo = new ActivityRepository(mockDbConnection);
      await expect(repo.create({
        userId: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 15,
        unit: 'km',
        co2Emissions: 2.7,
        timestamp: new Date(),
        isRecurring: false,
        recurrencePeriod: 'none',
      })).rejects.toThrow('[ActivityRepository] Created activity could not be retrieved.');
    });

    it('findByUserId works with various filters to cover branches', async () => {
      await db.query("INSERT OR IGNORE INTO users (id, email, username, password_hash) VALUES (1, 'user@ecotrack.ai', 'EcoTrack User', 'no-password')");

      const repo = new ActivityRepository(db);
      await repo.create({
        userId: 1,
        category: 'energy',
        subcategory: 'solar_power',
        quantity: 10,
        unit: 'kWh',
        co2Emissions: 0.1,
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        isRecurring: true,
        recurrencePeriod: 'weekly',
      });

      const res = await repo.findByUserId(1, {
        category: 'energy',
        subcategory: 'solar_power',
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        search: 'solar',
        limit: 5,
        offset: 0,
      });

      expect(res.total).toBeGreaterThanOrEqual(1);
      expect(res.activities[0].category).toBe('energy');
      expect(res.activities[0].subcategory).toBe('solar_power');
    });

    it('delete in Postgres mode', async () => {
      const mockDbConnection = {
        getIsPostgres: () => true,
        query: vi.fn().mockResolvedValue([{ id: 5 }]),
      } as any;
      const repo = new ActivityRepository(mockDbConnection);
      const deleted = await repo.delete(5, 1);
      expect(deleted).toBe(true);
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING id'),
        [5, 1]
      );
    });

    it('delete returns false if not found in SQLite mode', async () => {
      const repo = new ActivityRepository(db);
      const deleted = await repo.delete(999999, 1);
      expect(deleted).toBe(false);
    });

    it('getStreakInfo returns 0 if user has no activities', async () => {
      const repo = new ActivityRepository(db);
      const info = await repo.getStreakInfo(99999);
      expect(info.currentStreak).toBe(0);
      expect(info.lastLogDate).toBeNull();
    });

    it('getStreakInfo returns correct values with duplicate logs on same day', async () => {
      const repo = new ActivityRepository(db);
      await db.query('DELETE FROM activities WHERE user_id = 99');

      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      await repo.create({ userId: 99, category: 'food', subcategory: 'vegan', quantity: 1, unit: 'meals', co2Emissions: 0.5, timestamp: today, isRecurring: false, recurrencePeriod: 'none' });
      await repo.create({ userId: 99, category: 'food', subcategory: 'vegan', quantity: 1, unit: 'meals', co2Emissions: 0.5, timestamp: today, isRecurring: false, recurrencePeriod: 'none' });
      await repo.create({ userId: 99, category: 'food', subcategory: 'vegan', quantity: 1, unit: 'meals', co2Emissions: 0.5, timestamp: yesterday, isRecurring: false, recurrencePeriod: 'none' });

      const info = await repo.getStreakInfo(99);
      expect(info.currentStreak).toBe(2);
      expect(info.lastLogDate).not.toBeNull();
    });

    it('getStreakInfo returns streak = 0 if last log was older than yesterday', async () => {
      const repo = new ActivityRepository(db);
      await db.query('DELETE FROM activities WHERE user_id = 99');

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await repo.create({ userId: 99, category: 'food', subcategory: 'vegan', quantity: 1, unit: 'meals', co2Emissions: 0.5, timestamp: threeDaysAgo, isRecurring: false, recurrencePeriod: 'none' });

      const info = await repo.getStreakInfo(99);
      expect(info.currentStreak).toBe(0);
      expect(info.lastLogDate).not.toBeNull();
    });

    it('getStreakInfo returns streak = 1 when logged today and 2 days ago, but not yesterday', async () => {
      const repo = new ActivityRepository(db);
      await db.query('DELETE FROM activities WHERE user_id = 99');

      const today = new Date();
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      await repo.create({ userId: 99, category: 'food', subcategory: 'vegan', quantity: 1, unit: 'meals', co2Emissions: 0.5, timestamp: today, isRecurring: false, recurrencePeriod: 'none' });
      await repo.create({ userId: 99, category: 'food', subcategory: 'vegan', quantity: 1, unit: 'meals', co2Emissions: 0.5, timestamp: twoDaysAgo, isRecurring: false, recurrencePeriod: 'none' });

      const info = await repo.getStreakInfo(99);
      expect(info.currentStreak).toBe(1);
    });
  });

  describe('ChallengeRepository', () => {
    it('findById returns null if not found in db and not in cache', async () => {
      const repo = new ChallengeRepository(db);
      const ch = await repo.findById(999999);
      expect(ch).toBeNull();
    });

    it('updateChallengeProgress completed path uses correct timestamps for PG vs SQLite', async () => {
      const mockDbConnectionPG = {
        getIsPostgres: () => true,
        query: vi.fn().mockResolvedValue([{ user_id: 1, challenge_id: 1, status: 'completed', progress: 5, started_at: new Date().toISOString() }]),
        getUserChallenge: vi.fn(),
      } as any;
      const repoPG = new ChallengeRepository(mockDbConnectionPG);
      await repoPG.updateChallengeProgress(1, 1, 5, 'completed');
      expect(mockDbConnectionPG.query).toHaveBeenCalledWith(
        expect.stringContaining('CURRENT_TIMESTAMP'),
        [5, 'completed', 1, 1]
      );

      const mockDbConnectionLite = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([{ user_id: 1, challenge_id: 1, status: 'active', progress: 3, started_at: new Date().toISOString() }]),
      } as any;
      const repoLite = new ChallengeRepository(mockDbConnectionLite);
      await repoLite.updateChallengeProgress(1, 1, 3, 'active');
      expect(mockDbConnectionLite.query).toHaveBeenCalledWith(
        expect.stringContaining('NULL'),
        [3, 'active', 1, 1]
      );
    });

    it('joinChallenge returns existing challenge if already joined', async () => {
      const repo = new ChallengeRepository(db);
      await db.query('DELETE FROM user_challenges WHERE user_id = 1 AND challenge_id = 1');
      await repo.joinChallenge(1, 1);

      const result = await repo.joinChallenge(1, 1);
      expect(result.challengeId).toBe(1);
    });

    it('joinChallenge throws if retrieval fails', async () => {
      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([]),
      } as any;
      const repo = new ChallengeRepository(mockDbConnection);
      vi.spyOn(repo, 'getUserChallenge').mockResolvedValue(null);
      await expect(repo.joinChallenge(1, 1)).rejects.toThrow('[ChallengeRepository] Failed to join challenge.');
    });

    it('updateChallengeProgress throws if retrieval fails', async () => {
      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([]),
      } as any;
      const repo = new ChallengeRepository(mockDbConnection);
      vi.spyOn(repo, 'getUserChallenge').mockResolvedValue(null);
      await expect(repo.updateChallengeProgress(1, 1, 5, 'active')).rejects.toThrow('[ChallengeRepository] Failed to update challenge progress.');
    });

    it('findById resolves from DB if not in cache', async () => {
      const repo = new ChallengeRepository(db);
      const allChallenges = await db.query<{ id: number }>('SELECT id FROM challenges LIMIT 1');
      expect(allChallenges.length).toBeGreaterThan(0);
      const validId = allChallenges[0].id;

      (repo as any).challengesCache = null;
      const ch = await repo.findById(validId);
      expect(ch).not.toBeNull();
      expect(ch!.id).toBe(validId);
    });
  });

  describe('GoalRepository', () => {
    it('create in Postgres mode', async () => {
      const mockGoalRow = {
        id: 3,
        user_id: 1,
        target_co2: 150.0,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        achieved: 0,
      };
      const mockDbConnection = {
        getIsPostgres: () => true,
        query: vi.fn().mockResolvedValue([mockGoalRow]),
      } as any;
      const repo = new GoalRepository(mockDbConnection);
      const goal = await repo.create({
        userId: 1,
        targetCo2: 150.0,
        startDate: new Date(),
        endDate: new Date(),
        achieved: false,
      });
      expect(goal.id).toBe(3);
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('RETURNING *'),
        expect.any(Array)
      );
    });

    it('create in SQLite mode throws if not found', async () => {
      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockImplementation(async (sql) => {
          if (sql.trim().toLowerCase().startsWith('insert')) {
            return [{ id: 999999 }];
          }
          return [];
        }),
      } as any;
      const repo = new GoalRepository(mockDbConnection);
      await expect(repo.create({
        userId: 1,
        targetCo2: 150.0,
        startDate: new Date(),
        endDate: new Date(),
        achieved: false,
      })).rejects.toThrow('[GoalRepository] Created goal could not be retrieved.');
    });

    it('updateGoalAchievement in Postgres vs SQLite modes', async () => {
      const mockDbConnectionPG = {
        getIsPostgres: () => true,
        query: vi.fn().mockResolvedValue([]),
      } as any;
      const repoPG = new GoalRepository(mockDbConnectionPG);
      await repoPG.updateGoalAchievement(1, true);
      expect(mockDbConnectionPG.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE goals'),
        [true, 1]
      );

      const mockDbConnectionLite = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([]),
      } as any;
      const repoLite = new GoalRepository(mockDbConnectionLite);
      await repoLite.updateGoalAchievement(1, true);
      expect(mockDbConnectionLite.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE goals'),
        [1, 1]
      );
    });

    it('findCurrentGoal returns null when no goals', async () => {
      const repo = new GoalRepository(db);
      await db.query('DELETE FROM goals WHERE user_id = 99');
      const goal = await repo.findCurrentGoal(99);
      expect(goal).toBeNull();
    });

    it('create in SQLite mode with achieved=true and string target_co2 parser coverage', async () => {
      const mockGoalRow = {
        id: 4,
        user_id: 1,
        target_co2: '120.5',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        achieved: 1,
      };
      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockImplementation(async (sql) => {
          if (sql.trim().toLowerCase().startsWith('insert')) {
            return [{ id: 4 }];
          }
          return [mockGoalRow];
        }),
      } as any;
      const repo = new GoalRepository(mockDbConnection);
      const goal = await repo.create({
        userId: 1,
        targetCo2: 120.5,
        startDate: new Date(),
        endDate: new Date(),
        achieved: true,
      });
      expect(goal.targetCo2).toBe(120.5);
      expect(goal.achieved).toBe(true);
    });

    it('updateGoalAchievement achieved=false SQLite', async () => {
      const mockDbConnectionLite = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([]),
      } as any;
      const repoLite = new GoalRepository(mockDbConnectionLite);
      await repoLite.updateGoalAchievement(1, false);
      expect(mockDbConnectionLite.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE goals'),
        [0, 1]
      );
    });
  });

  describe('Extra DatabaseConnection & Repositories Edge Cases', () => {
    it('DatabaseConnection - should fully cover Postgres connection, queries, and close paths', async () => {
      const oldDbUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgres://mock';

      const dbPG = new DatabaseConnection();
      const mockPgPool = {
        query: vi.fn().mockResolvedValue({ rows: [{ count: 1 }] }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      (dbPG as any).pgPool = mockPgPool;

      await dbPG.initializeSchema();
      expect(mockPgPool.query).toHaveBeenCalled();

      await dbPG.close();
      expect(mockPgPool.end).toHaveBeenCalled();

      if (oldDbUrl) {
        process.env.DATABASE_URL = oldDbUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    });

    it('UserRepository - mapRowToUser handles missing level fallback', async () => {
      const mockUserRow = {
        id: 1,
        email: 'fallback@test.com',
        username: 'user',
        password_hash: 'hash',
        points: 0,
        level: null as any,
        streak: 0,
        created_at: new Date().toISOString(),
      };
      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([mockUserRow]),
      } as any;
      const repo = new UserRepository(mockDbConnection);
      const user = await repo.findById(1);
      expect(user!.level).toBe('Seedling');
    });

    it('ActivityRepository - getDailyEmissionsSummary in Postgres mode uses TO_CHAR', async () => {
      const mockDbConnection = {
        getIsPostgres: () => true,
        query: vi.fn().mockResolvedValue([]),
      } as any;
      const repo = new ActivityRepository(mockDbConnection);
      await repo.getDailyEmissionsSummary(1, new Date(), new Date());
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("TO_CHAR(timestamp, 'YYYY-MM-DD')"),
        expect.any(Array)
      );
    });

    it('ChallengeRepository - getUserChallenges and getUserChallenge with various types coverage', async () => {
      const mockJoinedRowStr = {
        user_id: 1,
        challenge_id: 1,
        status: 'active',
        progress: '3.5',
        started_at: new Date().toISOString(),
        completed_at: null,
        title: 'Test',
        category: 'transport',
        description: 'Desc',
        points_reward: '100',
        co2_target: '15.0',
        duration_days: '7',
      };

      const mockDbConnectionStr = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([mockJoinedRowStr]),
      } as any;

      const repoStr = new ChallengeRepository(mockDbConnectionStr);
      const joinedStr = await repoStr.getUserChallenges(1);
      expect(joinedStr[0].progress).toBe(3.5);
      expect(joinedStr[0].pointsReward).toBe(100);
      expect(joinedStr[0].co2Target).toBe(15);
      expect(joinedStr[0].durationDays).toBe(7);

      const mockJoinedRowNum = {
        user_id: 1,
        challenge_id: 1,
        status: 'active',
        progress: null,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        title: 'Test',
        category: 'transport',
        description: 'Desc',
        points_reward: 100,
        co2_target: 15.0,
        duration_days: 7,
      };

      const mockDbConnectionNum = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([mockJoinedRowNum]),
      } as any;

      const repoNum = new ChallengeRepository(mockDbConnectionNum);
      const joinedNum = await repoNum.getUserChallenges(1);
      expect(joinedNum[0].progress).toBe(0);
      expect(joinedNum[0].completedAt).toBeDefined();

      const userChNum = await repoNum.getUserChallenge(1, 1);
      expect(userChNum!.progress).toBe(0);
      expect(userChNum!.completedAt).toBeDefined();
    });

    it('DatabaseConnection - should cover production NODE_ENV and SQLite error paths', async () => {
      const oldEnv = process.env.NODE_ENV;
      const oldDbUrl = process.env.DATABASE_URL;

      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://mock';

      const dbPG = new DatabaseConnection();
      expect(dbPG).toBeDefined();

      process.env.NODE_ENV = oldEnv;
      if (oldDbUrl) {
        process.env.DATABASE_URL = oldDbUrl;
      } else {
        delete process.env.DATABASE_URL;
      }

      // SQLite error paths
      const dbLite = new DatabaseConnection();
      const mockSqliteDb = {
        exec: vi.fn((_, cb) => cb(new Error('Exec error'))),
        close: vi.fn((cb) => cb(new Error('Close error'))),
      };
      (dbLite as any).sqliteDb = mockSqliteDb;

      await expect(dbLite.initializeSchema()).rejects.toThrow('Exec error');
      await expect(dbLite.close()).rejects.toThrow('Close error');
    });

    it('ActivityRepository - maps string quantity and emissions, handles missing recurrence period and empty summaries', async () => {
      const mockActivityRowStr = {
        id: 1,
        user_id: 1,
        category: 'transport',
        subcategory: 'car',
        quantity: '10.5',
        unit: 'km',
        co2_emissions: '2.5',
        timestamp: new Date().toISOString(),
        is_recurring: 1,
        recurrence_period: null,
      };

      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([mockActivityRowStr]),
      } as any;

      const repo = new ActivityRepository(mockDbConnection);
      
      const activity = await repo.findById(1);
      expect(activity).toBeDefined();
      expect(activity!.quantity).toBe(10.5);
      expect(activity!.co2Emissions).toBe(2.5);
      expect(activity!.recurrencePeriod).toBe('none');

      mockDbConnection.query = vi.fn().mockResolvedValue([{ category: 'transport', total_emissions: null }]);
      const summary = await repo.getCategorySummary(1, new Date(), new Date());
      expect(summary[0].totalEmissions).toBe(0);

      mockDbConnection.query = vi.fn().mockResolvedValue([{ log_date: '2026-06-19', total_emissions: null }]);
      const daily = await repo.getDailyEmissionsSummary(1, new Date(), new Date());
      expect(daily[0].totalEmissions).toBe(0);
    });

    it('ChallengeRepository - covers mapRowToChallenge and mapRowToUserChallenge string values', async () => {
      const mockChallengeRowStr = {
        id: 1,
        title: 'Test',
        category: 'transport',
        description: 'Desc',
        points_reward: '100',
        co2_target: '15.0',
        duration_days: '7',
      };

      const mockDbConnection = {
        getIsPostgres: () => false,
        query: vi.fn().mockResolvedValue([mockChallengeRowStr]),
      } as any;

      const repo = new ChallengeRepository(mockDbConnection);
      const challenge = await repo.findById(1);
      expect(challenge).toBeDefined();
      expect(challenge!.pointsReward).toBe(100);
      expect(challenge!.co2Target).toBe(15);
      expect(challenge!.durationDays).toBe(7);

      const mockUserChallengeStr = {
        user_id: 1,
        challenge_id: 1,
        status: 'active',
        progress: '4.5',
        started_at: new Date().toISOString(),
      };
      mockDbConnection.query = vi.fn().mockResolvedValue([mockUserChallengeStr]);
      const userChallenge = await repo.getUserChallenge(1, 1);
      expect(userChallenge).toBeDefined();
      expect(userChallenge!.progress).toBe(4.5);
    });
  });
});

