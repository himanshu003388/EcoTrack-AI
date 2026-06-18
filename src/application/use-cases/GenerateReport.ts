import { IActivityRepository } from '../../domain/repositories/IActivityRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IGoalRepository } from '../../domain/repositories/IGoalRepository';
import { DatabaseConnection } from '../../infrastructure/database/DatabaseConnection';

export interface ReportSummary {
  period: string; // e.g. 'Last 30 Days'
  totalEmissions: number;
  averageDaily: number;
  carbonSaved: number; // compared to national average baseline
  moneySaved: number; // estimated financial savings
  streak: number;
  points: number;
  level: string;
  categoryBreakdown: { category: string; emissions: number }[];
  goals: { target: number; achieved: boolean; date: string }[];
  badgesCount: number;
}

export class GenerateReport {
  constructor(
    private activityRepository: IActivityRepository,
    private userRepository: IUserRepository,
    private goalRepository: IGoalRepository,
    private db: DatabaseConnection
  ) {}

  async execute(userId: number): Promise<ReportSummary> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found.');

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // 1. Fetch activities
    const actResult = await this.activityRepository.findByUserId(userId, { startDate: thirtyDaysAgo, limit: 1000 });
    const activities = actResult.activities;

    const totalEmissions = activities.reduce((acc, act) => acc + act.co2Emissions, 0);
    
    // Calculate days logged (unique days)
    const logDays = new Set(activities.map(a => new Date(a.timestamp).toDateString())).size;
    const activeDays = Math.max(1, logDays);
    const averageDaily = totalEmissions / activeDays;

    // 2. Carbon Saved
    // National average is 16 kg/day. For each day logged, carbon saved = (16 - averageDailyEmission) * logDays
    const baselineDaily = 16.0;
    const carbonSaved = Math.max(0, Math.round((baselineDaily * activeDays - totalEmissions) * 10) / 10);

    // 3. Money Saved
    // Estimate money saved based on activities:
    // - Transport (bike/walk): $0.20 per km saved in fuel/depreciation
    // - Energy (solar): $0.15 per kWh generated
    // - Food (vegan/vegetarian meals): $3.00 average savings over premium meat meals
    // - Shopping (recycling): $0.50 per kg
    let moneySaved = 0;
    activities.forEach(act => {
      if (act.category === 'transport') {
        if (act.subcategory === 'bike' || act.subcategory === 'walking') {
          moneySaved += act.quantity * 0.20; // $0.20 per km
        } else if (act.subcategory === 'train' || act.subcategory === 'bus') {
          moneySaved += act.quantity * 0.10; // $0.10 savings per km compared to driving
        }
      } else if (act.category === 'energy' && act.subcategory === 'solar') {
        moneySaved += act.quantity * 0.15; // $0.15 per kWh
      } else if (act.category === 'food' && (act.subcategory === 'vegan' || act.subcategory === 'vegetarian')) {
        moneySaved += act.quantity * 3.00; // $3.00 saved per meal
      } else if (act.category === 'shopping_waste' && act.subcategory === 'recycling') {
        moneySaved += act.quantity * 0.50; // $0.50 saved per kg
      }
    });

    // 4. Category breakdown
    const categories = ['transport', 'energy', 'food', 'shopping_waste'];
    const breakdownMap: Record<string, number> = { transport: 0, energy: 0, food: 0, shopping_waste: 0 };
    activities.forEach(act => {
      breakdownMap[act.category] += act.co2Emissions;
    });

    const categoryBreakdown = categories.map(cat => ({
      category: cat,
      emissions: Math.round(breakdownMap[cat] * 10) / 10
    }));

    // 5. Goals tracking
    const goalsList = await this.goalRepository.listGoals(userId);
    const goals = goalsList.map(g => ({
      target: g.targetCo2,
      achieved: g.achieved,
      date: g.endDate.toISOString().split('T')[0]
    }));

    // 6. Badges count
    const bRes = await this.db.query<{ count: string | number }>('SELECT COUNT(*) as count FROM user_badges WHERE user_id = $1', [userId]);
    const badgesCount = bRes[0] ? parseInt(String(bRes[0].count), 10) : 0;

    return {
      period: 'Last 30 Days',
      totalEmissions: Math.round(totalEmissions * 10) / 10,
      averageDaily: Math.round(averageDaily * 10) / 10,
      carbonSaved,
      moneySaved: Math.round(moneySaved * 10) / 10,
      streak: user.streak,
      points: user.points,
      level: user.level,
      categoryBreakdown,
      goals,
      badgesCount
    };
  }
}
