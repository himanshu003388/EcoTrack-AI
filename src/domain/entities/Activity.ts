export type ActivityCategory = 'transport' | 'energy' | 'food' | 'shopping_waste';

export interface Activity {
  id: number;
  userId: number;
  category: ActivityCategory;
  subcategory: string;
  quantity: number;
  unit: string;
  co2Emissions: number; // in kg CO2e
  timestamp: Date;
  isRecurring: boolean;
  recurrencePeriod: 'daily' | 'weekly' | 'none';
}
