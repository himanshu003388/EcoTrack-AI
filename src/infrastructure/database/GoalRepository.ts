/**
 * All SQL queries in this file use parameterized statements only.
 * No string interpolation is used in SQL expressions.
 * @security SQL injection protected via node-postgres/better-sqlite3 parameterization
 */
import { IGoalRepository } from '../../domain/repositories/IGoalRepository';
import { Goal } from '../../domain/entities/Goal';
import { DatabaseConnection } from './DatabaseConnection';

export interface GoalRow {
  id: number;
  user_id: number;
  target_co2: string | number;
  start_date: string | Date;
  end_date: string | Date;
  achieved: number | boolean;
}

export class GoalRepository implements IGoalRepository {
  constructor(private db: DatabaseConnection) {}

  private mapRowToGoal(row: GoalRow): Goal {
    return {
      id: row.id,
      userId: row.user_id,
      targetCo2: typeof row.target_co2 === 'string' ? parseFloat(row.target_co2) : row.target_co2,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      achieved: row.achieved === true || row.achieved === 1,
    };
  }

  async findCurrentGoal(userId: number): Promise<Goal | null> {
    const sql = `
      SELECT * FROM goals 
      WHERE user_id = $1
      ORDER BY end_date DESC LIMIT 1
    `;
    const rows = await this.db.query<GoalRow>(sql, [userId]);
    const firstRow = rows[0];
    if (!firstRow) return null;
    return this.mapRowToGoal(firstRow);
  }

  async create(goal: Omit<Goal, 'id'>): Promise<Goal> {
    if (this.db.getIsPostgres()) {
      const sql = `
        INSERT INTO goals (user_id, target_co2, start_date, end_date, achieved)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const params = [goal.userId, goal.targetCo2, goal.startDate, goal.endDate, goal.achieved];
      const rows = await this.db.query<GoalRow>(sql, params);
      const firstRow = rows[0];
      if (!firstRow) throw new Error('[GoalRepository] Insert failed.');
      return this.mapRowToGoal(firstRow);
    } else {
      const sql = `
        INSERT INTO goals (user_id, target_co2, start_date, end_date, achieved)
        VALUES ($1, $2, $3, $4, $5)
      `;
      const achievedInt = goal.achieved ? 1 : 0;
      const params = [
        goal.userId,
        goal.targetCo2,
        goal.startDate.toISOString(),
        goal.endDate.toISOString(),
        achievedInt,
      ];
      const res = await this.db.query<GoalRow>(sql, params);
      const firstResRow = res[0];
      if (!firstResRow) throw new Error('[GoalRepository] Insert failed.');
      const insertedId = firstResRow.id;
      const created = await this.db.query<GoalRow>('SELECT * FROM goals WHERE id = $1', [insertedId]);
      const firstCreatedRow = created[0];
      if (!firstCreatedRow) throw new Error('[GoalRepository] Created goal could not be retrieved.');
      return this.mapRowToGoal(firstCreatedRow);
    }
  }

  async listGoals(userId: number): Promise<Goal[]> {
    const sql = 'SELECT * FROM goals WHERE user_id = $1 ORDER BY end_date DESC';
    const rows = await this.db.query<GoalRow>(sql, [userId]);
    return rows.map((r) => this.mapRowToGoal(r));
  }

  async updateGoalAchievement(id: number, achieved: boolean): Promise<void> {
    const achievedVal = this.db.getIsPostgres() ? achieved : achieved ? 1 : 0;
    await this.db.query('UPDATE goals SET achieved = $1 WHERE id = $2', [achievedVal, id]);
  }
}
