import { describe, it, expect } from 'vitest';
import { RecommendationEngine } from '../services/RecommendationEngine';
import { Activity } from '../domain/entities/Activity';

describe('RecommendationEngine Service Unit Tests', () => {
  it('should rank recommendations based on user history profile', () => {
    // Scenario 1: User has high transport emissions
    const mockActivities: Activity[] = [
      {
        id: 1,
        userId: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 300,
        unit: 'km',
        co2Emissions: 54.0, // 300 * 0.18
        timestamp: new Date(),
        isRecurring: false,
        recurrencePeriod: 'none'
      },
      {
        id: 2,
        userId: 1,
        category: 'food',
        subcategory: 'vegan',
        quantity: 2,
        unit: 'meals',
        co2Emissions: 1.0,
        timestamp: new Date(),
        isRecurring: false,
        recurrencePeriod: 'none'
      }
    ];

    const recommendations = RecommendationEngine.generate(mockActivities);
    
    // The top recommendation should ideally be in the transport category because it is the highest emission source
    expect(recommendations.length).toBeGreaterThan(0);
    
    // Check that relevance scores are sorted descending
    for (let i = 0; i < recommendations.length - 1; i++) {
      expect(recommendations[i].relevanceScore).toBeGreaterThanOrEqual(recommendations[i + 1].relevanceScore || 0);
    }

    // Since transport emissions were highest, a transport recommendation should have a boosted score
    const topRec = recommendations[0];
    expect(topRec.category).toBe('transport');
  });

  it('should de-prioritize categories where the user has zero emissions', () => {
    // Scenario 2: User has logged food but zero transport and energy emissions
    const mockActivities: Activity[] = [
      {
        id: 1,
        userId: 1,
        category: 'food',
        subcategory: 'meat',
        quantity: 5,
        unit: 'meals',
        co2Emissions: 29.0,
        timestamp: new Date(),
        isRecurring: false,
        recurrencePeriod: 'none'
      }
    ];

    const recommendations = RecommendationEngine.generate(mockActivities);

    // Verify that food recommendations are boosted and transport/energy is de-prioritized (relevance score multiplier = 0.5)
    const foodRecs = recommendations.filter(r => r.category === 'food');
    const transportRecs = recommendations.filter(r => r.category === 'transport');

    // The top food recommendation should have a higher score than the lowest transport recommendation
    expect(foodRecs[0].relevanceScore).toBeGreaterThanOrEqual(transportRecs[transportRecs.length - 1].relevanceScore || 0);
  });
});
export default {};
