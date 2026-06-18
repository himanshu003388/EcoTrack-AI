export type Level = 'Seedling' | 'Sapling' | 'Tree' | 'Forest Guardian' | 'Climate Hero';

export function calculateLevel(points: number): Level {
  if (points >= 1000) return 'Climate Hero';
  if (points >= 600) return 'Forest Guardian';
  if (points >= 300) return 'Tree';
  if (points >= 100) return 'Sapling';
  return 'Seedling';
}
