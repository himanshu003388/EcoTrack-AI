import { ActivityCategory } from './Activity';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  co2Reduction: number; // kg saved per week/unit action
  costSavings: number; // USD saved per week/unit action
  difficulty: 'easy' | 'medium' | 'hard';
  timeRequired: 'immediate' | 'short-term' | 'long-term';
  impactScore: number; // 1-10
  relevanceScore?: number; // Calculated dynamically
}
