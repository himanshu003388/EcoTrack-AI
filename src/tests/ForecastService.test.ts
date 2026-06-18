import { describe, it, expect } from 'vitest';
import { ForecastService } from '../services/ForecastService';
import { Activity } from '../domain/entities/Activity';
import { Goal } from '../domain/entities/Goal';

describe('ForecastService Unit Tests', () => {
  const mockGoal: Goal = {
    id: 1,
    userId: 1,
    targetCo2: 200, // 200 kg monthly limit
    startDate: new Date(),
    endDate: new Date(),
    achieved: false
  };

  it('should return baseline defaults when user has zero activities logged', () => {
    const report = ForecastService.generate([], mockGoal);
    expect(report.nextMonthEstimate).toBe(480);
    expect(report.trendDirection).toBe('stable');
    expect(report.goalAchievementProbability).toBe(50); // boundary check
    expect(report.riskAreas.length).toBe(0);
    expect(report.improvementOpportunities.length).toBeGreaterThan(0);
  });

  it('should calculate an increasing trend when recent emissions are higher than prior emissions', () => {
    const now = new Date();
    
    // Create activities:
    // Recent 15 days: 90 kg CO2e
    // Prior 15 days (days 16-30): 45 kg CO2e
    const activities: Activity[] = [
      {
        id: 1,
        userId: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 500, // 500 * 0.18 = 90 kg CO2e
        unit: 'km',
        co2Emissions: 90.0,
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        isRecurring: false,
        recurrencePeriod: 'none'
      },
      {
        id: 2,
        userId: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 250, // 45 kg CO2e
        unit: 'km',
        co2Emissions: 45.0,
        timestamp: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        isRecurring: false,
        recurrencePeriod: 'none'
      }
    ];

    const report = ForecastService.generate(activities, mockGoal);
    
    // Trend should be increasing because recent (90) > prior (45)
    expect(report.trendDirection).toBe('increasing');
    expect(report.trendPercentage).toBe(100); // 100% increase
    // Next month estimate is scaled and adjusted by trend:
    // scaled recent = 90 * 2 = 180 kg. Adjusted by 100% trend = 180 * (1 + 1.0) = 360 kg
    expect(report.nextMonthEstimate).toBe(360.0);
    // Over target goal (360 > 200), probability should be low
    expect(report.goalAchievementProbability).toBeLessThan(50);
    // Transport should be flagged as a risk area
    expect(report.riskAreas.length).toBeGreaterThan(0);
    expect(report.riskAreas[0].category).toBe('transport');
  });

  it('should calculate a decreasing trend when recent emissions are lower than prior emissions', () => {
    const now = new Date();
    
    // Recent 15 days: 30 kg CO2e
    // Prior 15 days: 60 kg CO2e
    const activities: Activity[] = [
      {
        id: 1,
        userId: 1,
        category: 'food',
        subcategory: 'meat',
        quantity: 5, // 5 * 5.8 = 29 kg
        unit: 'meals',
        co2Emissions: 30.0,
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        isRecurring: false,
        recurrencePeriod: 'none'
      },
      {
        id: 2,
        userId: 1,
        category: 'food',
        subcategory: 'meat',
        quantity: 10.3, // 60 kg
        unit: 'meals',
        co2Emissions: 60.0,
        timestamp: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000), // 22 days ago
        isRecurring: false,
        recurrencePeriod: 'none'
      }
    ];

    const report = ForecastService.generate(activities, mockGoal);

    // Trend should be decreasing because recent (30) < prior (60)
    expect(report.trendDirection).toBe('decreasing');
    expect(report.trendPercentage).toBe(-50); // 50% decrease
    // Scaled recent = 30 * 2 = 60 kg. Adjusted by -50% trend = 60 * (1 - 0.5) = 30 kg
    expect(report.nextMonthEstimate).toBe(30.0);
    // Well under goal (30 < 200), probability should be high
    expect(report.goalAchievementProbability).toBeGreaterThan(70);
  });

  it('should trigger category-specific improvement suggestions when a category exceeds the scaled threshold', () => {
    const now = new Date();
    // transport = 90kg, other = 10kg, total recent = 100kg
    // Transport represents 90%, which is > 40% of total emissions.
    const activities: Activity[] = [
      {
        id: 1,
        userId: 1,
        category: 'transport',
        subcategory: 'car_petrol',
        quantity: 500, // 90 kg
        unit: 'km',
        co2Emissions: 90.0,
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        isRecurring: false,
        recurrencePeriod: 'none'
      },
      {
        id: 2,
        userId: 1,
        category: 'food',
        subcategory: 'vegan',
        quantity: 20, // 10 kg
        unit: 'meals',
        co2Emissions: 10.0,
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        isRecurring: false,
        recurrencePeriod: 'none'
      }
    ];

    const report = ForecastService.generate(activities, mockGoal);
    expect(report.improvementOpportunities).toContain(
      'Transport accounts for a high proportion of your footprint. Try combining errands or carpooling.'
    );
  });
});
export default {};
