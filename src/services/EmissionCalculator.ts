import factorsRaw from '../config/emissionFactors.json';

/** Emission factor entry for a specific activity subcategory. */
export interface EmissionFactor {
  value: number;
  unit: string;
  source: string;
  updatedDate: string;
}

/** Emission factors keyed by subcategory name. */
export interface EmissionCategoryFactors {
  [key: string]: EmissionFactor;
}

/** Complete emission factors schema covering all four activity categories. */
export interface EmissionFactorsSchema {
  transport: EmissionCategoryFactors;
  energy: EmissionCategoryFactors;
  food: EmissionCategoryFactors;
  shopping_waste: EmissionCategoryFactors;
}

const factors = factorsRaw as EmissionFactorsSchema;

/** kg CO2e emitted to charge a smartphone once (~8.3g). */
const PHONE_CHARGE_FACTOR = 0.0083;

/**
 * Service: Calculate CO2 emissions for user-logged activities.
 *
 * Uses IPCC-aligned emission factors stored in `config/emissionFactors.json`.
 * All calculation methods are pure functions with no side effects.
 */
export class EmissionCalculator {
  /**
   * Calculate CO2 emissions for a given activity.
   *
   * @param category - The activity category (e.g., 'transport', 'energy').
   * @param subcategory - The specific sub-type (e.g., 'car_petrol', 'electricity').
   * @param quantity - The amount of activity (e.g., km driven, kWh used).
   * @returns Emissions in kg CO2e, rounded to 4 decimal places. Returns 0 for unknown factors.
   */
  static calculate(category: keyof EmissionFactorsSchema, subcategory: string, quantity: number): number {
    const categoryFactors = factors[category] as EmissionCategoryFactors | undefined;
    if (categoryFactors === undefined) return 0;
    const factor = categoryFactors[subcategory];
    if (factor === undefined) return 0;
    const emissions = quantity * factor.value;
    return Math.round(emissions * 10000) / 10000;
  }

  /**
   * Retrieve the emission factor details for a specific activity subcategory.
   *
   * @param category - The activity category.
   * @param subcategory - The specific sub-type.
   * @returns The EmissionFactor object, or `null` if the subcategory is unknown.
   */
  static getFactorInfo(category: keyof EmissionFactorsSchema, subcategory: string): EmissionFactor | null {
    const categoryFactors = factors[category] as EmissionCategoryFactors | undefined;
    if (categoryFactors === undefined) return null;
    return categoryFactors[subcategory] ?? null;
  }

  /**
   * Retrieve all emission factors for a given category.
   *
   * @param category - The activity category.
   * @returns An object mapping subcategory names to their EmissionFactor. Empty object if category is unknown.
   */
  static getCategoryFactors(category: keyof EmissionFactorsSchema): EmissionCategoryFactors {
    const categoryFactors = factors[category] as EmissionCategoryFactors | undefined;
    return categoryFactors ?? {};
  }

  /**
   * Convert kg CO2e into the number of mature trees needed to absorb it annually.
   * (Assumes one mature tree absorbs ~22 kg CO2/year.)
   *
   * @param co2Kg - Amount of CO2e in kilograms.
   * @returns Equivalent number of trees (rounded to 1 decimal).
   */
  static getTreeEquivalent(co2Kg: number): number {
    return Math.round((co2Kg / 22) * 10) / 10;
  }

  /**
   * Convert kg CO2e into equivalent km driven by a petrol car.
   *
   * @param co2Kg - Amount of CO2e in kilograms.
   * @returns Equivalent car km (rounded to 1 decimal).
   */
  static getCarKmEquivalent(co2Kg: number): number {
    const carFactor = factors.transport.car_petrol?.value ?? 0.18;
    return Math.round((co2Kg / carFactor) * 10) / 10;
  }

  /**
   * Convert kg CO2e into equivalent hours of average electricity consumption.
   *
   * @param co2Kg - Amount of CO2e in kilograms.
   * @returns Equivalent electricity hours (rounded to 1 decimal).
   */
  static getElectricityHoursEquivalent(co2Kg: number): number {
    const electricityFactor = factors.energy.electricity?.value ?? 0.38;
    return Math.round((co2Kg / electricityFactor) * 10) / 10;
  }

  /**
   * Convert kg CO2e into equivalent number of smartphone charges.
   * (One full phone charge ≈ 8.3g CO2e.)
   *
   * @param co2Kg - Amount of CO2e in kilograms.
   * @returns Equivalent number of phone charges (rounded to nearest integer).
   */
  static getPhoneChargesEquivalent(co2Kg: number): number {
    return Math.round(co2Kg / PHONE_CHARGE_FACTOR);
  }
}
