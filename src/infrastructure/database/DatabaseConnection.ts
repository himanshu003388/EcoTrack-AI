/**
 * All SQL queries in this file use parameterized statements only.
 * No string interpolation is used in SQL expressions.
 * @security SQL injection protected via node-postgres/better-sqlite3 parameterization
 */
import * as crypto from 'crypto';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { Pool } from 'pg';
import * as sqlite3 from 'sqlite3';

type QueryRow = Record<string, unknown>;

export class DatabaseConnection {
  private pgPool: Pool | null = null;
  private sqliteDb: sqlite3.Database | null = null;
  private isPostgres = false;
  private initializePromise: Promise<void> | null = null;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl !== undefined && dbUrl !== '') {
      this.pgPool = new Pool({
        connectionString: dbUrl,
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
            : false,
      });
      this.isPostgres = true;
    } else {
      const envPath = process.env.SQLITE_DB_PATH;
      const dbPath =
        envPath !== undefined && envPath !== '' ? envPath : path.resolve(__dirname, '../../../ecotrack.db');
      const sqlite = sqlite3.verbose();
      this.sqliteDb = new sqlite.Database(dbPath);
      this.isPostgres = false;
    }
  }

  async initializeSchema(): Promise<void> {
    if (this.initializePromise) {
      return this.initializePromise;
    }
    this.initializePromise = (async (): Promise<void> => {
      const schemaFile = path.resolve(__dirname, '../persistence/schema.sql');
      let schemaSql = '';
      try {
        if (existsSync(schemaFile)) {
          schemaSql = await readFile(schemaFile, 'utf8');
        }
      } catch {
        schemaSql = this.getDefaultSchemaSql();
      }

      if (this.isPostgres) {
        await this.query(schemaSql);
        await this.seedChallengesAndBadges();
      } else {
        const sqliteSchema = this.translateSchemaToSqlite(schemaSql);
        await new Promise<void>((resolve, reject) => {
          this.sqliteDb!.exec(sqliteSchema, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await this.seedChallengesAndBadges();
      }
    })();
    return this.initializePromise;
  }

  async query<T = QueryRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this.isPostgres) {
      const result = await this.pgPool!.query(sql, params);
      return result.rows as T[];
    } else {
      const sqliteSql = sql.replace(/\$(\d+)/g, '?');
      return new Promise<T[]>((resolve, reject) => {
        const lowerSql = sql.trim().toLowerCase();
        if (lowerSql.startsWith('select') || (lowerSql.startsWith('insert') && lowerSql.includes('returning'))) {
          this.sqliteDb!.all(sqliteSql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as T[]);
          });
        } else {
          this.sqliteDb!.run(sqliteSql, params, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve([{ id: this.lastID } as unknown as T]);
            }
          });
        }
      });
    }
  }

  async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
    }
    if (this.sqliteDb) {
      await new Promise<void>((resolve, reject) => {
        this.sqliteDb!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  getIsPostgres(): boolean {
    return this.isPostgres;
  }

  private translateSchemaToSqlite(postgresSql: string): string {
    return postgresSql
      .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/TIMESTAMPTZ/gi, 'DATETIME')
      .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
      .replace(/BOOLEAN DEFAULT FALSE/gi, 'INTEGER DEFAULT 0')
      .replace(/BOOLEAN DEFAULT TRUE/gi, 'INTEGER DEFAULT 1')
      .replace(/RETURNING \*;/gi, ';');
  }

  private getDefaultSchemaSql(): string {
    return `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        points INTEGER DEFAULT 0,
        level VARCHAR(50) DEFAULT 'Seedling',
        streak INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        category VARCHAR(50) NOT NULL,
        subcategory VARCHAR(100) NOT NULL,
        quantity REAL NOT NULL,
        unit VARCHAR(50) NOT NULL,
        co2_emissions REAL NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_period VARCHAR(50) DEFAULT 'none'
      );
      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        points_reward INTEGER NOT NULL,
        co2_target REAL NOT NULL,
        duration_days INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_challenges (
        user_id INTEGER NOT NULL,
        challenge_id INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        progress REAL DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMPTZ,
        PRIMARY KEY (user_id, challenge_id)
      );
      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(50) NOT NULL,
        condition_type VARCHAR(50) NOT NULL,
        condition_value INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_badges (
        user_id INTEGER NOT NULL,
        badge_id INTEGER NOT NULL,
        awarded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, badge_id)
      );
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        target_co2 REAL NOT NULL,
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ NOT NULL,
        achieved BOOLEAN DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
      CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
      CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
    `;
  }

  private async seedChallengesAndBadges(): Promise<void> {
    const userCount = await this.query<{ count: string | number }>('SELECT COUNT(*) as count FROM users');
    const firstUserCount = userCount[0];
    if (firstUserCount && (firstUserCount.count === 0 || firstUserCount.count === '0')) {
      /**
       * @security The default user password hash is loaded from SEED_USER_PASSWORD_HASH env var.
       * Hardcoded hashes in source code are a CWE-259 vulnerability (hard-coded password).
       * In production, always set SEED_USER_PASSWORD_HASH to a strong Argon2id hash.
       * If not set in production, a cryptographically random placeholder is used so the
       * default account cannot be accessed via any known password.
       */
      const fallbackHash =
        process.env.SEED_USER_PASSWORD_HASH ??
        (process.env.NODE_ENV === 'production'
          ? // In production without env var: use a random hash that cannot be reversed or used to login
            `$argon2id-locked$${Buffer.from(crypto.randomBytes(32)).toString('base64')}`
          : // In development: use a random hash unless SEED_DEV_PASSWORD_HASH is explicitly set
            (process.env.SEED_DEV_PASSWORD_HASH ??
            `$argon2id-dev$${Buffer.from(crypto.randomBytes(32)).toString('base64')}`));

      if (
        (process.env.SEED_USER_PASSWORD_HASH === undefined || process.env.SEED_USER_PASSWORD_HASH === '') &&
        process.env.NODE_ENV === 'production'
      ) {
        /* eslint-disable-next-line no-console */
        console.warn(
          '[EcoTrack AI] WARNING: SEED_USER_PASSWORD_HASH not set in production. Default user account is locked with a random password and cannot be used. Set SEED_USER_PASSWORD_HASH to an Argon2id hash to enable login.',
        );
      }

      if (this.isPostgres) {
        await this.query(
          'INSERT INTO users (id, email, username, password_hash, points, level, streak) VALUES (1, $1, $2, $3, 0, $4, 0)',
          ['user@ecotrack.ai', 'EcoTrack User', fallbackHash, 'Seedling'],
        );
      } else {
        await this.query(
          'INSERT INTO users (id, email, username, password_hash, points, level, streak, created_at) VALUES (1, $1, $2, $3, 0, $4, 0, CURRENT_TIMESTAMP)',
          ['user@ecotrack.ai', 'EcoTrack User', fallbackHash, 'Seedling'],
        );
      }
    }

    const chCount = await this.query<{ count: string | number }>('SELECT COUNT(*) as count FROM challenges');
    const firstChCount = chCount[0];
    if (firstChCount && (firstChCount.count === 0 || firstChCount.count === '0')) {
      const challenges = [
        [
          'Car-Free Week',
          'transport',
          'Replace all car trips with public transit, cycling, or walking for 7 days.',
          150,
          20.0,
          7,
        ],
        [
          'Plant-Based Week',
          'food',
          'Eat only vegetarian or vegan meals for 7 consecutive days to lower agricultural footprint.',
          200,
          35.0,
          7,
        ],
        [
          'Energy Saver Challenge',
          'energy',
          'Turn off idle appliances, unplug charger bricks, and switch to eco settings.',
          100,
          10.0,
          5,
        ],
        [
          'Recycling Champion',
          'shopping_waste',
          'Recycle glass, plastic, and paper, and avoid landfill waste for 7 days.',
          120,
          5.0,
          7,
        ],
      ];
      for (const ch of challenges) {
        await this.query(
          'INSERT INTO challenges (title, category, description, points_reward, co2_target, duration_days) VALUES ($1, $2, $3, $4, $5, $6)',
          ch,
        );
      }
    }

    const bgCount = await this.query<{ count: string | number }>('SELECT COUNT(*) as count FROM badges');
    const firstBgCount = bgCount[0];
    if (firstBgCount && (firstBgCount.count === 0 || firstBgCount.count === '0')) {
      const badges = [
        ['First Footprint Logged', 'Your journey towards carbon awareness begins!', 'leaf', 'logs_count', 1],
        ['Consistent Tracker', 'Log your activities for 7 days in a row.', 'flame', 'streak', 7],
        ['Green Activist', 'Accumulate 500 environmental impact points.', 'award', 'points', 500],
        ['Carbon Slash Master', 'Saved substantial emissions of CO2e.', 'zap', 'co2_saved', 50],
        ['Eco Champion', 'Complete 3 Eco Challenges successfully.', 'crown', 'points', 1000],
      ];
      for (const bg of badges) {
        await this.query(
          'INSERT INTO badges (name, description, icon, condition_type, condition_value) VALUES ($1, $2, $3, $4, $5)',
          bg,
        );
      }
    }
  }
}
