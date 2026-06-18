import { Activity, ActivityCategory } from '../domain/entities/Activity';
import { Recommendation } from '../domain/entities/Recommendation';

// Static catalog of actionable reduction strategies
const RECOMMENDATION_CATALOG: Omit<Recommendation, 'relevanceScore'>[] = [
  {
    id: 'rec_replace_car_trips_bike',
    title: 'Replace short car trips with cycling',
    description: 'Replace at least two weekly car trips under 5km with cycling or walking. Great for health and emissions.',
    category: 'transport',
    co2Reduction: 8.5, // kg CO2e saved per week
    costSavings: 12.0, // USD saved per week
    difficulty: 'easy',
    timeRequired: 'immediate',
    impactScore: 6
  },
  {
    id: 'rec_regional_train',
    title: 'Take regional trains instead of short flights',
    description: 'For travel under 500km, opt for high-speed or passenger rail. It reduces transit emissions by over 70%.',
    category: 'transport',
    co2Reduction: 120.0,
    costSavings: 45.0,
    difficulty: 'medium',
    timeRequired: 'short-term',
    impactScore: 9
  },
  {
    id: 'rec_carpool_commute',
    title: 'Carpool or ride share to work',
    description: 'Coordinate with colleagues or use ride-sharing apps to split commutes. Halves transport footprint.',
    category: 'transport',
    co2Reduction: 15.0,
    costSavings: 20.0,
    difficulty: 'easy',
    timeRequired: 'immediate',
    impactScore: 5
  },
  {
    id: 'rec_ev_transition',
    title: 'Transition to an electric vehicle (EV)',
    description: 'When updating your vehicle, choose an EV. Even on standard grids, emissions are dramatically lower.',
    category: 'transport',
    co2Reduction: 40.0,
    costSavings: 50.0,
    difficulty: 'hard',
    timeRequired: 'long-term',
    impactScore: 10
  },
  {
    id: 'rec_led_lighting',
    title: 'Switch to LED lighting',
    description: 'Replace standard incandescent or CFL bulbs with LEDs. They consume up to 85% less energy.',
    category: 'energy',
    co2Reduction: 5.0,
    costSavings: 8.0,
    difficulty: 'easy',
    timeRequired: 'short-term',
    impactScore: 4
  },
  {
    id: 'rec_thermostat_adjust',
    title: 'Adjust thermostat by 2°C',
    description: 'Set your heater 2 degrees cooler in winter or AC 2 degrees warmer in summer. Reduces load significantly.',
    category: 'energy',
    co2Reduction: 12.0,
    costSavings: 18.0,
    difficulty: 'easy',
    timeRequired: 'immediate',
    impactScore: 6
  },
  {
    id: 'rec_solar_installation',
    title: 'Install solar PV panels',
    description: 'Generate clean energy locally. Payback periods are shrinking, and excess energy can feed the grid.',
    category: 'energy',
    co2Reduction: 60.0,
    costSavings: 40.0,
    difficulty: 'hard',
    timeRequired: 'long-term',
    impactScore: 10
  },
  {
    id: 'rec_line_dry_clothes',
    title: 'Hang-dry clothes instead of using dryer',
    description: 'Take advantage of natural breeze and sun. The tumble dryer is one of the most energy-intensive home appliances.',
    category: 'energy',
    co2Reduction: 4.5,
    costSavings: 6.0,
    difficulty: 'easy',
    timeRequired: 'immediate',
    impactScore: 3
  },
  {
    id: 'rec_meat_free_day',
    title: 'Introduce a Meat-Free Monday',
    description: 'Reduce meat consumption by one day per week. Cattle farming is a high driver of greenhouse gases.',
    category: 'food',
    co2Reduction: 5.8,
    costSavings: 15.0,
    difficulty: 'easy',
    timeRequired: 'immediate',
    impactScore: 5
  },
  {
    id: 'rec_vegan_diet',
    title: 'Adopt a plant-based (vegan) diet',
    description: 'Transition entirely to vegan meals. Minimizes personal diet footprint by up to 70%.',
    category: 'food',
    co2Reduction: 35.0,
    costSavings: 50.0,
    difficulty: 'hard',
    timeRequired: 'short-term',
    impactScore: 9
  },
  {
    id: 'rec_dairy_reduction',
    title: 'Eliminate dairy 3 days a week',
    description: 'Swap cheese and cow milk for oat, almond, or soy alternatives. Dairy has substantial land-use impact.',
    category: 'food',
    co2Reduction: 7.2,
    costSavings: 10.0,
    difficulty: 'medium',
    timeRequired: 'immediate',
    impactScore: 6
  },
  {
    id: 'rec_composting_waste',
    title: 'Compost organic kitchen waste',
    description: 'Keep food waste out of landfills where it decays into methane. Turns scraps into nutrient-rich soil.',
    category: 'food',
    co2Reduction: 3.0,
    costSavings: 2.0,
    difficulty: 'easy',
    timeRequired: 'immediate',
    impactScore: 3
  },
  {
    id: 'rec_decline_single_use_plastics',
    title: 'Decline single-use plastics',
    description: 'Bring reusable bags and containers. Avoid buying products wrapped in excess layers of plastic.',
    category: 'shopping_waste',
    co2Reduction: 2.0,
    costSavings: 1.0,
    difficulty: 'easy',
    timeRequired: 'immediate',
    impactScore: 2
  },
  {
    id: 'rec_consolidate_shipments',
    title: 'Consolidate online deliveries',
    description: 'Wait and order items together in a single shipment rather than multiple separate packages. Reduces logistics emissions.',
    category: 'shopping_waste',
    co2Reduction: 4.2,
    costSavings: 5.0,
    difficulty: 'easy',
    timeRequired: 'short-term',
    impactScore: 4
  },
  {
    id: 'rec_thrift_shopping',
    title: 'Buy clothing second-hand',
    description: 'Opt for vintage, thrift stores, or clothing swaps. The textile industry is highly resource-intensive.',
    category: 'shopping_waste',
    co2Reduction: 10.0,
    costSavings: 30.0,
    difficulty: 'medium',
    timeRequired: 'short-term',
    impactScore: 5
  }
];

/**
 * Service: Generate personalized carbon reduction recommendations.
 *
 * Scores each recommendation using a weighted formula:
 * `relevanceScore = impactScore × feasibility × preferenceModifier`
 *
 * - **Impact**: A 1–10 scale representing the CO2 reduction potential.
 * - **Feasibility**: `easy=3.0`, `medium=2.0`, `hard=1.0`.
 * - **Preference modifier**: 1.5× if the recommendation category is the user's
 *   highest-emission area; 0.5× if the user has zero logged emissions in that
 *   category (suggesting they already perform well there).
 */
export class RecommendationEngine {
  /**
   * Generate a ranked list of recommendations tailored to the user's emission profile.
   *
   * @param userActivities - Activities logged in the last 30 days.
   * @returns Array of Recommendation objects sorted by relevance score descending.
   */
  static generate(userActivities: Activity[]): Recommendation[] {
    // Compute per-category emission totals for the last 30 days
    const categoryTotals: Record<ActivityCategory, number> = {
      transport: 0,
      energy: 0,
      food: 0,
      shopping_waste: 0
    };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const act of userActivities) {
      if (new Date(act.timestamp) >= thirtyDaysAgo) {
        categoryTotals[act.category] = (categoryTotals[act.category] || 0) + act.co2Emissions;
      }
    }

    // Identify the category with highest emissions
    let highestCategory: ActivityCategory = 'transport';
    let highestVal = -1;
    (Object.keys(categoryTotals) as ActivityCategory[]).forEach(cat => {
      if (categoryTotals[cat] > highestVal) {
        highestVal = categoryTotals[cat];
        highestCategory = cat;
      }
    });

    // Feasibility weights
    const FEASIBILITY: Record<string, number> = { easy: 3.0, medium: 2.0, hard: 1.0 };

    return RECOMMENDATION_CATALOG.map(rec => {
      const feasibility = FEASIBILITY[rec.difficulty] ?? 2.0;

      let preferenceModifier = 1.0;
      if (rec.category === highestCategory) {
        preferenceModifier = 1.5; // Boost recommendations in user's highest-emission category
      } else if (categoryTotals[rec.category] === 0) {
        preferenceModifier = 0.5; // De-prioritize areas where user has no recorded footprint
      }

      const relevanceScore = Math.round(rec.impactScore * feasibility * preferenceModifier * 10) / 10;

      return { ...rec, relevanceScore };
    })
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  }
}
