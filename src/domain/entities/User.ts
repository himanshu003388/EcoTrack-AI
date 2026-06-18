export interface User {
  id: number;
  email: string;
  username: string;
  passwordHash: string;
  points: number;
  level: 'Seedling' | 'Sapling' | 'Tree' | 'Forest Guardian' | 'Climate Hero';
  streak: number;
  createdAt: Date;
}
