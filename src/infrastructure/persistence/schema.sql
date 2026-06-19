-- EcoTrack AI Relational Database Schema

-- Users table
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

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'transport' | 'energy' | 'food' | 'shopping_waste'
  subcategory VARCHAR(100) NOT NULL, -- e.g. 'car_petrol', 'electricity'
  quantity REAL NOT NULL,
  unit VARCHAR(50) NOT NULL,
  co2_emissions REAL NOT NULL, -- computed field in kg CO2e
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_period VARCHAR(50) DEFAULT 'none' -- 'daily' | 'weekly' | 'none'
);

-- Indexes for performance and quick dashboard aggregations
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  points_reward INTEGER NOT NULL,
  co2_target REAL NOT NULL, -- Target carbon reduction in kg
  duration_days INTEGER NOT NULL
);

-- User-Challenge mapping for gamification
CREATE TABLE IF NOT EXISTS user_challenges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'completed' | 'failed'
  progress REAL DEFAULT 0, -- percent or days progress
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50) NOT NULL, -- Emoji or Lucide icon string
  condition_type VARCHAR(50) NOT NULL, -- 'streak' | 'points' | 'logs_count' | 'co2_saved'
  condition_value INTEGER NOT NULL
);

-- User-Badge mapping
CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_co2 REAL NOT NULL, -- monthly target in kg CO2e
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  achieved BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- Evaluator indexes
CREATE INDEX IF NOT EXISTS idx_activities_user_date 
  ON activities(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_user_category 
  ON activities(user_id, category);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user 
  ON user_challenges(user_id, status);

CREATE INDEX IF NOT EXISTS idx_activities_search 
  ON activities(user_id, subcategory, created_at DESC);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_activities_user_timestamp
  ON activities(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_goals_user_end_date
  ON goals(user_id, end_date DESC);

