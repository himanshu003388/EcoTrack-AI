export type BadgeConditionType = 'streak' | 'points' | 'logs_count' | 'co2_saved';

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string; // Emoji or Lucide icon key
  conditionType: BadgeConditionType;
  conditionValue: number;
}

export interface UserBadge {
  userId: number;
  badgeId: number;
  awardedAt: Date;
}
