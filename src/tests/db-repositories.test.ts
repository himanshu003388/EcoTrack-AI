import { describe, it, expect } from 'vitest';
import { DatabaseConnection } from '../infrastructure/database/DatabaseConnection';

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
});
