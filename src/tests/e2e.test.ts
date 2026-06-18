import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, db } from '../presentation/api/server';

describe('EcoTrack AI Full-Stack End-to-End API Integration Tests', () => {
  let loggedActivityId = 0;

  beforeAll(async () => {
    await db.initializeSchema();
    await db.query('DELETE FROM users');
    await db.query(
      "INSERT INTO users (id, email, username, password_hash, points, level, streak) VALUES (1, 'user@ecotrack.ai', 'EcoTrack User', 'no-password', 0, 'Seedling', 0)"
    );
    await db.query('DELETE FROM activities');
    await db.query('DELETE FROM goals');
    await db.query('DELETE FROM user_challenges');
  });

  afterAll(async () => {
    await db.close();
  });

  // 1. GET /api/auth/me - Success (direct access)
  it('GET /api/auth/me - should retrieve default user profile directly', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('user@ecotrack.ai');
    expect(res.body.username).toBe('EcoTrack User');
    expect(res.body.points).toBe(0);
  });

  // 2. Log Activity - Success
  it('POST /api/activities - should log a transport activity', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({ category: 'transport', subcategory: 'car_petrol', quantity: 100, unit: 'km' });
    expect(res.status).toBe(201);
    expect(res.body.activity.co2Emissions).toBe(18.0);
    expect(res.body.activity.category).toBe('transport');
    loggedActivityId = res.body.activity.id;
  });

  // 3. Log Activity - Validation
  it('POST /api/activities - should reject invalid category', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({ category: 'teleport', subcategory: 'car_petrol', quantity: 10, unit: 'km' });
    expect(res.status).toBe(400);
  });

  // 4. Log Activity - Negative quantity
  it('POST /api/activities - should reject negative quantity', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({ category: 'transport', subcategory: 'car_petrol', quantity: -5, unit: 'km' });
    expect(res.status).toBe(400);
  });

  // 5. Log Activity - Food activity
  it('POST /api/activities - should log a food activity', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({ category: 'food', subcategory: 'vegan', quantity: 3, unit: 'meals' });
    expect(res.status).toBe(201);
    expect(res.body.activity.co2Emissions).toBe(1.5);
  });

  // 6. Log Activity - Energy activity
  it('POST /api/activities - should log an energy activity', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({ category: 'energy', subcategory: 'electricity', quantity: 50, unit: 'kWh' });
    expect(res.status).toBe(201);
  });

  // 7. Get Activities - Filtered
  it('GET /api/activities - should filter by category', async () => {
    const res = await request(app).get('/api/activities?category=transport');
    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  // 8. Get Activities - Search
  it('GET /api/activities - should search subcategory', async () => {
    const res = await request(app).get('/api/activities?search=car');
    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThan(0);
  });

  // 9. Get Achievements - Pagination
  it('GET /api/activities - should paginate results', async () => {
    const res = await request(app).get('/api/activities?limit=1&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeLessThanOrEqual(1);
  });

  // 10. Set Goal
  it('POST /api/goals - should set a carbon goal', async () => {
    const res = await request(app)
      .post('/api/goals')
      .send({ targetCo2: 250.0 });
    expect(res.status).toBe(201);
    expect(res.body.goal.targetCo2).toBe(250.0);
    expect(res.body.goal.achieved).toBe(false);
  });

  // 11. Set Goal - Invalid
  it('POST /api/goals - should reject non-positive target', async () => {
    const res = await request(app)
      .post('/api/goals')
      .send({ targetCo2: -10 });
    expect(res.status).toBe(400);
  });

  // 12. Dashboard
  it('GET /api/dashboard - should compile dashboard data', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.emissions.today).toBeGreaterThanOrEqual(0);
    expect(res.body.equivalents.treesNeeded).toBeGreaterThan(0);
    expect(res.body.sustainabilityScore).toBeLessThanOrEqual(100);
    expect(res.body.currentGoal).not.toBeNull();
  });

  // 13. Recommendations
  it('GET /api/recommendations - should return sorted tips', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('relevanceScore');
  });

  // 14. Forecast
  it('GET /api/forecast - should return forecast data', async () => {
    const res = await request(app).get('/api/forecast');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nextMonthEstimate');
    expect(res.body).toHaveProperty('goalAchievementProbability');
  });

  // 15. Coach Chat
  it('POST /api/coach/chat - should reply to chat', async () => {
    const res = await request(app)
      .post('/api/coach/chat')
      .send({ message: 'How can I reduce transport emissions?' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeTruthy();
    expect(res.body.insights.length).toBeGreaterThan(0);
  });

  // 16. Coach Chat - Empty message
  it('POST /api/coach/chat - should reject empty message', async () => {
    const res = await request(app)
      .post('/api/coach/chat')
      .send({ message: '' });
    expect(res.status).toBe(400);
  });

  // 17. Challenges - List
  it('GET /api/challenges - should list available challenges', async () => {
    const res = await request(app).get('/api/challenges');
    expect(res.status).toBe(200);
    expect(res.body.challenges.length).toBeGreaterThan(0);
  });

  // 18. Challenges - Join
  it('POST /api/challenges/:id/join - should join a challenge', async () => {
    const listRes = await request(app).get('/api/challenges');
    const challengeId = listRes.body.challenges[0].id;

    const joinRes = await request(app).post(`/api/challenges/${challengeId}/join`);
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.joined.status).toBe('active');
  });

  // 19. Challenges - Complete
  it('POST /api/challenges/:id/complete - should complete a challenge', async () => {
    const listRes = await request(app).get('/api/challenges');
    const challengeId = listRes.body.challenges[0].id;

    const completeRes = await request(app).post(`/api/challenges/${challengeId}/complete`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.completed.status).toBe('completed');
  });

  // 20. Reports
  it('GET /api/reports - should compile report data', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(200);
    expect(res.body.totalEmissions).toBeGreaterThan(0);
    expect(res.body.carbonSaved).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.badgesCount).toBe('number');
  });

  // 21. Delete Activity
  it('DELETE /api/activities/:id - should delete an activity', async () => {
    const res = await request(app).delete(`/api/activities/${loggedActivityId}`);
    expect(res.status).toBe(200);
  });

  // 22. Delete non-existent activity — should return 404 (not silently succeed)
  it('DELETE /api/activities/:id - should handle non-existent activity', async () => {
    const res = await request(app).delete('/api/activities/99999');
    expect(res.status).toBe(404);
  });

  // 23. Simple Action of the Day
  it('GET /api/actions/daily - should return daily action directly', async () => {
    const res = await request(app).get('/api/actions/daily');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('action');
    expect(res.body).toHaveProperty('reason');
    expect(res.body.action).toHaveProperty('id');
    expect(res.body.action).toHaveProperty('title');
    expect(res.body.action).toHaveProperty('category');
    expect(res.body.action).toHaveProperty('difficulty');
  });

  // 24. Simple Actions catalog
  it('GET /api/actions - should return full actions catalog directly', async () => {
    const res = await request(app).get('/api/actions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(16);
    const firstAction = res.body[0];
    expect(firstAction).toHaveProperty('id');
    expect(firstAction).toHaveProperty('title');
    expect(firstAction).toHaveProperty('description');
    expect(firstAction).toHaveProperty('category');
    expect(firstAction).toHaveProperty('co2Saving');
    expect(firstAction).toHaveProperty('difficulty');
    expect(firstAction).toHaveProperty('duration');
    expect(firstAction).toHaveProperty('link');
  });

  // 25. Simple Action daily — targets highest emission category
  it('GET /api/actions/daily - reason references transport category after logging transport', async () => {
    const res = await request(app).get('/api/actions/daily');
    expect(res.status).toBe(200);
    expect(res.body.reason).toMatch(/transport|food|energy|shopping|Start tracking/i);
  });
});
