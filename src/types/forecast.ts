export interface ForecastData {
  nextMonthEstimate: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  goalAchievementProbability: number;
  riskAreas: {
    category: string;
    percentageIncrease: number;
    message: string;
  }[];
  improvementOpportunities: string[];
}

export interface ChartPeriod {
  period: string;
  value: number;
}
