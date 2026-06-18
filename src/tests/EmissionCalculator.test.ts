import { describe, it, expect } from 'vitest';
import { EmissionCalculator } from '../services/EmissionCalculator';

describe('EmissionCalculator Service Unit Tests', () => {
  it('should calculate transport emissions correctly', () => {
    const carEmissions = EmissionCalculator.calculate('transport', 'car_petrol', 100);
    expect(carEmissions).toBe(18.0);
    const evEmissions = EmissionCalculator.calculate('transport', 'car_ev', 100);
    expect(evEmissions).toBe(5.0);
    const bikeEmissions = EmissionCalculator.calculate('transport', 'bike', 50);
    expect(bikeEmissions).toBe(0.0);
  });

  it('should calculate food emissions correctly', () => {
    const meatEmissions = EmissionCalculator.calculate('food', 'meat', 3);
    expect(meatEmissions).toBe(17.4);
    const veganEmissions = EmissionCalculator.calculate('food', 'vegan', 10);
    expect(veganEmissions).toBe(5.0);
  });

  it('should calculate shopping and recycling factors', () => {
    const shopEmissions = EmissionCalculator.calculate('shopping_waste', 'shopping', 5);
    expect(shopEmissions).toBe(40.0);
    const recycleOffset = EmissionCalculator.calculate('shopping_waste', 'recycling', 10);
    expect(recycleOffset).toBe(-2.5);
  });

  it('should calculate real-world equivalents correctly', () => {
    expect(EmissionCalculator.getTreeEquivalent(22)).toBe(1.0);
    expect(EmissionCalculator.getCarKmEquivalent(18)).toBe(100.0);
    expect(EmissionCalculator.getElectricityHoursEquivalent(3.8)).toBe(10.0);
    expect(EmissionCalculator.getPhoneChargesEquivalent(0.83)).toBe(100);
  });

  it('should return 0 for unknown category', () => {
    expect(EmissionCalculator.calculate('transport' as any, 'unknown_sub', 10)).toBe(0);
  });

  it('should return 0 for negative quantity', () => {
    const res = EmissionCalculator.calculate('transport', 'car_petrol', -10);
    expect(res).toBeLessThan(0);
  });

  it('should return factor info for known subcategory', () => {
    const info = EmissionCalculator.getFactorInfo('transport', 'car_petrol');
    expect(info).not.toBeNull();
    expect(info!.value).toBe(0.18);
  });

  it('should return null for unknown factor', () => {
    const info = EmissionCalculator.getFactorInfo('transport', 'flying_carpet');
    expect(info).toBeNull();
  });

  it('should get all category factors', () => {
    const factors = EmissionCalculator.getCategoryFactors('energy');
    expect(Object.keys(factors).length).toBeGreaterThan(0);
    expect(factors.electricity).toBeDefined();
  });

  it('should return empty object for unknown category', () => {
    const factors = EmissionCalculator.getCategoryFactors('unknown' as any);
    expect(factors).toEqual({});
  });

  it('should handle zero quantity', () => {
    expect(EmissionCalculator.calculate('transport', 'car_petrol', 0)).toBe(0);
  });

  it('should handle decimal quantity', () => {
    const res = EmissionCalculator.calculate('food', 'vegan', 0.5);
    expect(res).toBe(0.25);
  });
});
