/**
 * All SQL queries in this file use parameterized statements only.
 * No string interpolation is used in SQL expressions.
 * @security SQL injection protected via node-postgres/better-sqlite3 parameterization
 */
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User } from '../../domain/entities/User';
import { DatabaseConnection } from './DatabaseConnection';

export interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  points: number;
  level: User['level'];
  streak: number;
  created_at: string | Date;
}

export class UserRepository implements IUserRepository {
  constructor(private db: DatabaseConnection) {}

  private mapRowToUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      points: row.points || 0,
      level: row.level || 'Seedling',
      streak: row.streak || 0,
      createdAt: new Date(row.created_at),
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (rows.length === 0) return null;
    return this.mapRowToUser(rows[0]);
  }

  async findById(id: number): Promise<User | null> {
    const rows = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    return this.mapRowToUser(rows[0]);
  }

  async create(email: string, username: string, passwordHash: string): Promise<User> {
    if (this.db.getIsPostgres()) {
      const rows = await this.db.query<UserRow>(
        'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [email.toLowerCase(), username, passwordHash]
      );
      return this.mapRowToUser(rows[0]);
    } else {
      const res = await this.db.query<UserRow>(
        'INSERT INTO users (email, username, password_hash, points, level, streak, created_at) VALUES ($1, $2, $3, 0, \'Seedling\', 0, CURRENT_TIMESTAMP)',
        [email.toLowerCase(), username, passwordHash]
      );
      const insertedId = res[0].id;
      const user = await this.findById(insertedId);
      if (!user) throw new Error('[UserRepository] Created user could not be retrieved.');
      return user;
    }
  }

  async updatePointsAndLevel(userId: number, points: number, level: User['level']): Promise<void> {
    await this.db.query('UPDATE users SET points = $1, level = $2 WHERE id = $3', [points, level, userId]);
  }

  async updateStreak(userId: number, streak: number): Promise<void> {
    await this.db.query('UPDATE users SET streak = $1 WHERE id = $2', [streak, userId]);
  }
}
