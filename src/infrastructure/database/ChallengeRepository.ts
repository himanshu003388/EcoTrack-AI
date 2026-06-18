import { IChallengeRepository, JoinedUserChallenge } from '../../domain/repositories/IChallengeRepository';
import { Challenge, UserChallenge } from '../../domain/entities/Challenge';
import { DatabaseConnection } from './DatabaseConnection';
import { ActivityCategory } from '../../domain/entities/Activity';

export interface ChallengeRow {
  id: number;
  title: string;
  category: string;
  description: string;
  points_reward: string | number;
  co2_target: string | number;
  duration_days: string | number;
}

export interface UserChallengeRow {
  user_id: number;
  challenge_id: number;
  status: string;
  progress: string | number | null;
  started_at: string | Date;
  completed_at?: string | Date | null;
}

interface JoinedChallengeRow extends ChallengeRow, UserChallengeRow {
  title: string;
  category: string;
  description: string;
  points_reward: string | number;
  co2_target: string | number;
  duration_days: string | number;
}

export class ChallengeRepository implements IChallengeRepository {
  constructor(private db: DatabaseConnection) {}

  private mapRowToChallenge(row: ChallengeRow): Challenge {
    return {
      id: row.id,
      title: row.title,
      category: row.category as ActivityCategory,
      description: row.description,
      pointsReward: typeof row.points_reward === 'string' ? parseInt(row.points_reward, 10) : row.points_reward,
      co2Target: typeof row.co2_target === 'string' ? parseFloat(row.co2_target) : row.co2_target,
      durationDays: typeof row.duration_days === 'string' ? parseInt(row.duration_days, 10) : row.duration_days,
    };
  }

  private mapRowToUserChallenge(row: UserChallengeRow): UserChallenge {
    return {
      userId: row.user_id,
      challengeId: row.challenge_id,
      status: row.status as UserChallenge['status'],
      progress: row.progress !== null ? (typeof row.progress === 'string' ? parseFloat(row.progress) : row.progress) : 0,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }

  async listAll(): Promise<Challenge[]> {
    const rows = await this.db.query<ChallengeRow>('SELECT * FROM challenges');
    return rows.map((r) => this.mapRowToChallenge(r));
  }

  async findById(id: number): Promise<Challenge | null> {
    const rows = await this.db.query<ChallengeRow>('SELECT * FROM challenges WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    return this.mapRowToChallenge(rows[0]);
  }

  async getUserChallenges(userId: number): Promise<JoinedUserChallenge[]> {
    const sql = `
      SELECT uc.*, c.title, c.category, c.description, c.points_reward, c.co2_target, c.duration_days
      FROM user_challenges uc
      JOIN challenges c ON uc.challenge_id = c.id
      WHERE uc.user_id = $1
    `;
    const rows = await this.db.query<JoinedChallengeRow>(sql, [userId]);
    return rows.map((row) => ({
      userId: row.user_id,
      challengeId: row.challenge_id,
      status: row.status as UserChallenge['status'],
      progress: typeof row.progress === 'string' ? parseFloat(row.progress) : (row.progress as number),
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      title: row.title,
      category: row.category,
      description: row.description,
      pointsReward: typeof row.points_reward === 'string' ? parseInt(row.points_reward, 10) : row.points_reward,
      co2Target: typeof row.co2_target === 'string' ? parseFloat(row.co2_target) : row.co2_target,
      durationDays: typeof row.duration_days === 'string' ? parseInt(row.duration_days, 10) : row.duration_days,
    }));
  }

  async getUserChallenge(userId: number, challengeId: number): Promise<UserChallenge | null> {
    const rows = await this.db.query<UserChallengeRow>('SELECT * FROM user_challenges WHERE user_id = $1 AND challenge_id = $2', [
      userId,
      challengeId,
    ]);
    if (rows.length === 0) return null;
    return this.mapRowToUserChallenge(rows[0]);
  }

  async joinChallenge(userId: number, challengeId: number): Promise<UserChallenge> {
    const check = await this.getUserChallenge(userId, challengeId);
    if (check) return check;

    const sql = `
      INSERT INTO user_challenges (user_id, challenge_id, status, progress, started_at)
      VALUES ($1, $2, 'active', 0, CURRENT_TIMESTAMP)
    `;
    await this.db.query(sql, [userId, challengeId]);
    const row = await this.getUserChallenge(userId, challengeId);
    if (!row) throw new Error('[ChallengeRepository] Failed to join challenge.');
    return row;
  }

  async updateChallengeProgress(
    userId: number,
    challengeId: number,
    progress: number,
    status: UserChallenge['status']
  ): Promise<UserChallenge> {
    const isPostgres = this.db.getIsPostgres();
    const completedAtSql = status === 'completed' 
      ? (isPostgres ? 'CURRENT_TIMESTAMP' : "strftime('%Y-%m-%d %H:%M:%S', 'now')") 
      : 'NULL';

    const sql = `
      UPDATE user_challenges
      SET progress = $1, status = $2, completed_at = ${completedAtSql}
      WHERE user_id = $3 AND challenge_id = $4
    `;
    await this.db.query(sql, [progress, status, userId, challengeId]);
    const row = await this.getUserChallenge(userId, challengeId);
    if (!row) throw new Error('[ChallengeRepository] Failed to update challenge progress.');
    return row;
  }
}
