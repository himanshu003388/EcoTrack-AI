/**
 * All SQL queries in this file use parameterized statements only.
 * No string interpolation is used in SQL expressions.
 * @security SQL injection protected via node-postgres/better-sqlite3 parameterization
 */
import { IActivityRepository, ActivityFilters, CategorySummary, DailySummary } from '../../domain/repositories/IActivityRepository';
import { Activity, ActivityCategory } from '../../domain/entities/Activity';
import { DatabaseConnection } from './DatabaseConnection';

export interface ActivityRow {
  id: number;
  user_id: number;
  category: string;
  subcategory: string;
  quantity: number | string;
  unit: string;
  co2_emissions: number | string;
  timestamp: string | Date;
  is_recurring: number | boolean;
  recurrence_period: string;
}

export class ActivityRepository implements IActivityRepository {
  constructor(private db: DatabaseConnection) {}

  private mapRowToActivity(row: ActivityRow): Activity {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category as ActivityCategory,
      subcategory: row.subcategory,
      quantity: typeof row.quantity === 'string' ? parseFloat(row.quantity) : row.quantity,
      unit: row.unit,
      co2Emissions: typeof row.co2_emissions === 'string' ? parseFloat(row.co2_emissions) : row.co2_emissions,
      timestamp: new Date(row.timestamp),
      isRecurring: !!row.is_recurring,
      recurrencePeriod: (row.recurrence_period as 'daily' | 'weekly' | 'none') || 'none'
    };
  }

  async findById(id: number): Promise<Activity | null> {
    const rows = await this.db.query<ActivityRow>('SELECT * FROM activities WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    return this.mapRowToActivity(rows[0]);
  }

  async create(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const isRecurring = activity.isRecurring ? 1 : 0;
    
    if (this.db.getIsPostgres()) {
      const sql = `
        INSERT INTO activities (user_id, category, subcategory, quantity, unit, co2_emissions, timestamp, is_recurring, recurrence_period)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const params = [
        activity.userId,
        activity.category,
        activity.subcategory,
        activity.quantity,
        activity.unit,
        activity.co2Emissions,
        activity.timestamp,
        activity.isRecurring,
        activity.recurrencePeriod
      ];
      const rows = await this.db.query<ActivityRow>(sql, params);
      return this.mapRowToActivity(rows[0]);
    } else {
      const sql = `
        INSERT INTO activities (user_id, category, subcategory, quantity, unit, co2_emissions, timestamp, is_recurring, recurrence_period)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      const params = [
        activity.userId,
        activity.category,
        activity.subcategory,
        activity.quantity,
        activity.unit,
        activity.co2Emissions,
        activity.timestamp.toISOString(),
        isRecurring,
        activity.recurrencePeriod
      ];
      const res = await this.db.query<ActivityRow>(sql, params);
      const insertedId = res[0].id;
      const created = await this.findById(insertedId);
      if (!created) throw new Error('[ActivityRepository] Created activity could not be retrieved.');
      return created;
    }
  }

  async findByUserId(userId: number, filters?: ActivityFilters): Promise<{ activities: Activity[]; total: number }> {
    let sql = 'SELECT * FROM activities WHERE user_id = $1';
    let countSql = 'SELECT COUNT(*) as count FROM activities WHERE user_id = $1';
    const params: (string | number | Date)[] = [userId];
    let paramIndex = 2;

    if (filters) {
      if (filters.category) {
        sql += ` AND category = $${paramIndex}`;
        countSql += ` AND category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
      }
      if (filters.subcategory) {
        sql += ` AND subcategory = $${paramIndex}`;
        countSql += ` AND subcategory = $${paramIndex}`;
        params.push(filters.subcategory);
        paramIndex++;
      }
      if (filters.startDate) {
        sql += ` AND timestamp >= $${paramIndex}`;
        countSql += ` AND timestamp >= $${paramIndex}`;
        params.push(filters.startDate.toISOString());
        paramIndex++;
      }
      if (filters.endDate) {
        sql += ` AND timestamp <= $${paramIndex}`;
        countSql += ` AND timestamp <= $${paramIndex}`;
        params.push(filters.endDate.toISOString());
        paramIndex++;
      }
      if (filters.search) {
        sql += ` AND LOWER(subcategory) LIKE $${paramIndex}`;
        countSql += ` AND LOWER(subcategory) LIKE $${paramIndex}`;
        params.push(`%${filters.search.toLowerCase()}%`);
        paramIndex++;
      }
    }

    // Run count first
    const countResult = await this.db.query<{ count: string | number }>(countSql, params);
    const total = parseInt(String(countResult[0].count), 10);

    // Apply sorting and pagination to list query
    sql += ' ORDER BY timestamp DESC';
    if (filters) {
      if (filters.limit !== undefined) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }
      if (filters.offset !== undefined) {
        sql += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
        paramIndex++;
      }
    }

    const rows = await this.db.query<ActivityRow>(sql, params);
    return {
      activities: rows.map(r => this.mapRowToActivity(r)),
      total
    };
  }

  /**
   * Deletes an activity belonging to the specified user.
   * @returns `true` if a row was deleted, `false` if no matching row existed.
   */
  async delete(id: number, userId: number): Promise<boolean> {
    const isPostgres = this.db.getIsPostgres();
    if (isPostgres) {
      const rows = await this.db.query<{ id: number }>(
        'DELETE FROM activities WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );
      return rows.length > 0;
    } else {
      // For SQLite, check existence first since RETURNING is not supported for DELETE
      const existing = await this.db.query<ActivityRow>(
        'SELECT id FROM activities WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (existing.length === 0) return false;
      await this.db.query('DELETE FROM activities WHERE id = $1 AND user_id = $2', [id, userId]);
      return true;
    }
  }

  async getCategorySummary(userId: number, startDate: Date, endDate: Date): Promise<CategorySummary[]> {
    const sql = `
      SELECT category, SUM(co2_emissions) as total_emissions
      FROM activities
      WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
      GROUP BY category
    `;
    const rows = await this.db.query<{ category: string; total_emissions: string | number }>(sql, [userId, startDate.toISOString(), endDate.toISOString()]);
    return rows.map(r => ({
      category: r.category as ActivityCategory,
      totalEmissions: parseFloat(String(r.total_emissions || 0))
    }));
  }

  async getDailyEmissionsSummary(userId: number, startDate: Date, endDate: Date): Promise<DailySummary[]> {
    // For grouping by date:
    // SQLite: strftime('%Y-%m-%d', timestamp)
    // Postgres: DATE(timestamp)
    const isPostgres = this.db.getIsPostgres();
    const dateSelect = isPostgres 
      ? "TO_CHAR(timestamp, 'YYYY-MM-DD')" 
      : "strftime('%Y-%m-%d', timestamp)";

    const sql = `
      SELECT ${dateSelect} as log_date, SUM(co2_emissions) as total_emissions
      FROM activities
      WHERE user_id = $1 AND timestamp >= $2 AND timestamp <= $3
      GROUP BY log_date
      ORDER BY log_date ASC
    `;
    const rows = await this.db.query<{ log_date: string; total_emissions: string | number }>(sql, [userId, startDate.toISOString(), endDate.toISOString()]);
    return rows.map(r => ({
      date: r.log_date,
      totalEmissions: parseFloat(String(r.total_emissions || 0))
    }));
  }

  async getStreakInfo(userId: number): Promise<{ lastLogDate: Date | null; currentStreak: number }> {
    // Determine user's current consecutive active days log streak
    const sql = 'SELECT timestamp FROM activities WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50';
    const rows = await this.db.query<{ timestamp: string | Date }>(sql, [userId]);
    if (rows.length === 0) {
      return { lastLogDate: null, currentStreak: 0 };
    }

    const logDates = rows.map(r => {
      const d = new Date(r.timestamp);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    });

    // Remove duplicates
    const uniqueDates = Array.from(new Set(logDates));

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const yesterdayMidnight = todayMidnight - 24 * 60 * 60 * 1000;

    const lastLogDate = new Date(rows[0].timestamp);
    const lastLogMidnight = uniqueDates[0];

    // If last log is older than yesterday, streak is broken
    if (lastLogMidnight < yesterdayMidnight) {
      return { lastLogDate, currentStreak: 0 };
    }

    let streak = 0;
    let expectedMidnight = lastLogMidnight;

    for (const d of uniqueDates) {
      if (d === expectedMidnight) {
        streak++;
        expectedMidnight -= 24 * 60 * 60 * 1000; // Check previous day
      } else {
        break;
      }
    }

    return { lastLogDate, currentStreak: streak };
  }
}
