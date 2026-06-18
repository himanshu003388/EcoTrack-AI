export interface CategoryBreakdownItem {
  category: string;
  emissions: number;
  percentage: number;
}

export interface DashboardData {
  sustainabilityScore: number;
  emissions: {
    today: number;
    weekly: number;
    monthly: number;
    annualProjection: number;
  };
  averages: {
    nationalDaily: number;
    globalDaily: number;
    sustainableDaily: number;
  };
  highestSource: {
    category: string;
    percentage: number;
    emissions: number;
  };
  lowestSource: {
    category: string;
    emissions: number;
  };
  categoryBreakdown: CategoryBreakdownItem[];
  equivalents: {
    treesNeeded: number;
    carKm: number;
    electricityHours: number;
    phoneCharges: number;
  };
  trends: { date: string; emissions: number }[];
  explanation: string;
  userStats: {
    username: string;
    points: number;
    level: string;
    streak: number;
  };
  currentGoal: {
    targetCo2: number;
    achieved: boolean;
    endDate: string;
  } | null;
}

export interface DailyAction {
  action: {
    id: string;
    title: string;
    description: string;
    category: string;
    co2Saving: string;
    difficulty: string;
    duration: string;
    link: string;
  };
  reason: string;
}

export interface PieChartItem {
  name: string;
  value: number;
}

export interface ComparisonBarItem {
  name: string;
  value: number;
  fill: string;
}
