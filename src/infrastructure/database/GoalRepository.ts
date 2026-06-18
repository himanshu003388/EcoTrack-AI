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
      achieved: !!row.achieved,
    };
  }

  async findCurrentGoal(userId: number): Promise<Goal | null> {
    const sql = `
      SELECT * FROM goals 
      WHERE user_id = $1
      ORDER BY end_date DESC LIMIT 1
    `;
    const rows = await this.db.query<GoalRow>(sql, [userId]);
    if (rows.length === 0) return null;
    return this.mapRowToGoal(rows[0]);
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
      return this.mapRowToGoal(rows[0]);
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
        achievedInt
      ];
      const res = await this.db.query<GoalRow>(sql, params);
      const insertedId = res[0].id;
      const created = await this.db.query<GoalRow>('SELECT * FROM goals WHERE id = $1', [insertedId]);
      if (created.length === 0) throw new Error('[GoalRepository] Created goal could not be retrieved.');
      return this.mapRowToGoal(created[0]);
    }
  }

  async listGoals(userId: number): Promise<Goal[]> {
    const sql = 'SELECT * FROM goals WHERE user_id = $1 ORDER BY end_date DESC';
    const rows = await this.db.query<GoalRow>(sql, [userId]);
    return rows.map((r) => this.mapRowToGoal(r));
  }

  async updateGoalAchievement(id: number, achieved: boolean): Promise<void> {
    const achievedVal = this.db.getIsPostgres() ? achieved : (achieved ? 1 : 0);
    await this.db.query('UPDATE goals SET achieved = $1 WHERE id = $2', [achievedVal, id]);
  }
}
