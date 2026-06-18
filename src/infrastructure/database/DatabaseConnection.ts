import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as sqlite3 from 'sqlite3';

type QueryRow = Record<string, unknown>;

export class DatabaseConnection {
  private pgPool: Pool | null = null;
  private sqliteDb: sqlite3.Database | null = null;
  private isPostgres = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.pgPool = new Pool({
        connectionString: dbUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
      this.isPostgres = true;
    } else {
      const dbPath = path.resolve(process.cwd(), 'ecotrack.db');
      const sqlite = sqlite3.verbose();
      this.sqliteDb = new sqlite.Database(dbPath);
      this.isPostgres = false;
    }
  }

  async initializeSchema(): Promise<void> {
    const schemaFile = path.resolve(__dirname, '../persistence/schema.sql');
    let schemaSql = '';
    try {
      schemaSql = fs.readFileSync(schemaFile, 'utf8');
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
    `;
  }

  private async seedChallengesAndBadges(): Promise<void> {
    const userCount = await this.query('SELECT COUNT(*) as count FROM users');
    if (userCount[0].count === 0 || userCount[0].count === '0') {
      if (this.isPostgres) {
        await this.query(
          "INSERT INTO users (id, email, username, password_hash, points, level, streak) VALUES (1, 'user@ecotrack.ai', 'EcoTrack User', 'no-password', 0, 'Seedling', 0)"
        );
      } else {
        await this.query(
          "INSERT INTO users (id, email, username, password_hash, points, level, streak, created_at) VALUES (1, 'user@ecotrack.ai', 'EcoTrack User', 'no-password', 0, 'Seedling', 0, CURRENT_TIMESTAMP)"
        );
      }
    }

    const chCount = await this.query('SELECT COUNT(*) as count FROM challenges');
    if (chCount[0].count === 0 || chCount[0].count === '0') {
      const challenges = [
        ['Car-Free Week', 'transport', 'Replace all car trips with public transit, cycling, or walking for 7 days.', 150, 20.0, 7],
        ['Plant-Based Week', 'food', 'Eat only vegetarian or vegan meals for 7 consecutive days to lower agricultural footprint.', 200, 35.0, 7],
        ['Energy Saver Challenge', 'energy', 'Turn off idle appliances, unplug charger bricks, and switch to eco settings.', 100, 10.0, 5],
        ['Recycling Champion', 'shopping_waste', 'Recycle glass, plastic, and paper, and avoid landfill waste for 7 days.', 120, 5.0, 7]
      ];
      for (const ch of challenges) {
        await this.query(
          'INSERT INTO challenges (title, category, description, points_reward, co2_target, duration_days) VALUES ($1, $2, $3, $4, $5, $6)',
          ch
        );
      }
    }

    const bgCount = await this.query('SELECT COUNT(*) as count FROM badges');
    if (bgCount[0].count === 0 || bgCount[0].count === '0') {
      const badges = [
        ['First Footprint Logged', 'Your journey towards carbon awareness begins!', 'leaf', 'logs_count', 1],
        ['Consistent Tracker', 'Log your activities for 7 days in a row.', 'flame', 'streak', 7],
        ['Green Activist', 'Accumulate 500 environmental impact points.', 'award', 'points', 500],
        ['Carbon Slash Master', 'Saved substantial emissions of CO2e.', 'zap', 'co2_saved', 50],
        ['Eco Champion', 'Complete 3 Eco Challenges successfully.', 'crown', 'points', 1000]
      ];
      for (const bg of badges) {
        await this.query(
          'INSERT INTO badges (name, description, icon, condition_type, condition_value) VALUES ($1, $2, $3, $4, $5)',
          bg
        );
      }
    }
  }
}
