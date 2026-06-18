export interface Goal {
  id: number;
  userId: number;
  targetCo2: number; // monthly target in kg CO2e
  startDate: Date;
  endDate: Date;
  achieved: boolean;
}
