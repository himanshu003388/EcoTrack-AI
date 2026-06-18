import { Activity, ActivityCategory } from '../domain/entities/Activity';

interface SimpleAction {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory | 'general';
  co2Saving: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: string;
  link: string;
}

const ACTIONS_CATALOG: SimpleAction[] = [
  { id: 'act_walk_short_trip', title: 'Walk instead of drive', description: 'Replace one car trip under 3 km with a walk. Zero emissions and great for your health.', category: 'transport', co2Saving: '~0.5 kg', difficulty: 'easy', duration: '15 min', link: '/tracker' },
  { id: 'act_bike_commute', title: 'Cycle to work today', description: 'Swap your car commute for a bike ride. Save fuel money and eliminate tailpipe emissions.', category: 'transport', co2Saving: '~2.5 kg', difficulty: 'medium', duration: '30 min', link: '/tracker' },
  { id: 'act_public_transit', title: 'Take public transit', description: 'Choose the bus or train over driving. Transit emits up to 60% less CO₂ per km than cars.', category: 'transport', co2Saving: '~1.8 kg', difficulty: 'easy', duration: 'varies', link: '/tracker' },
  { id: 'act_carpool', title: 'Carpool with a colleague', description: 'Share your ride to work. Halves your transport emissions for that trip instantly.', category: 'transport', co2Saving: '~2.0 kg', difficulty: 'easy', duration: 'commute', link: '/tracker' },
  { id: 'act_meat_free_meal', title: 'Skip meat for one meal', description: 'Have a plant-based lunch or dinner. Beef has the highest carbon footprint of any food.', category: 'food', co2Saving: '~4.6 kg', difficulty: 'easy', duration: '1 meal', link: '/tracker' },
  { id: 'act_vegan_day', title: 'Try a fully plant-based day', description: 'Go vegan for just one day. Plant-based diets have 70% lower footprint than meat-heavy diets.', category: 'food', co2Saving: '~5.8 kg', difficulty: 'medium', duration: '1 day', link: '/tracker' },
  { id: 'act_dairy_swap', title: 'Swap dairy for oat milk', description: 'Replace cow milk with oat or almond milk today. Oat milk has 70% lower emissions.', category: 'food', co2Saving: '~1.2 kg', difficulty: 'easy', duration: 'instant', link: '/tracker' },
  { id: 'act_led_bulbs', title: 'Switch to LED bulbs', description: 'Replace one old bulb with an LED equivalent. LED uses 85% less energy for the same light.', category: 'energy', co2Saving: '~2.0 kg/month', difficulty: 'easy', duration: '10 min', link: '/simulator' },
  { id: 'act_unplug_standby', title: 'Unplug standby devices', description: 'TVs, chargers, and game consoles draw power even when off. Unplug them when not in use.', category: 'energy', co2Saving: '~1.5 kg/month', difficulty: 'easy', duration: '5 min', link: '/simulator' },
  { id: 'act_thermostat_2c', title: 'Adjust thermostat by 2°C', description: 'Turn heating down or AC up by just 2 degrees. Saves significant energy without sacrificing comfort.', category: 'energy', co2Saving: '~3.0 kg/week', difficulty: 'easy', duration: 'instant', link: '/simulator' },
  { id: 'act_recycle', title: 'Sort your recycling today', description: 'Separate plastics, glass, paper, and organics. Recycling cuts landfill methane and saves raw materials.', category: 'shopping_waste', co2Saving: '~0.5 kg', difficulty: 'easy', duration: '10 min', link: '/tracker' },
  { id: 'act_second_hand', title: 'Buy second-hand instead of new', description: 'Choose a pre-owned item over a new purchase. Extending product life saves manufacturing emissions.', category: 'shopping_waste', co2Saving: '~8.0 kg', difficulty: 'medium', duration: 'shopping trip', link: '/tracker' },
  { id: 'act_consolidate_deliveries', title: 'Consolidate your deliveries', description: 'Wait and order items together in one shipment instead of multiple parcels throughout the week.', category: 'shopping_waste', co2Saving: '~1.4 kg', difficulty: 'easy', duration: 'planning', link: '/tracker' },
  { id: 'act_compost', title: 'Start composting food scraps', description: 'Keep organic waste out of landfills. Composting prevents methane and creates nutrient-rich soil.', category: 'shopping_waste', co2Saving: '~2.0 kg/week', difficulty: 'medium', duration: '20 min', link: '/tracker' },
  { id: 'act_meat_free_monday', title: 'Join Meat-Free Monday', description: 'Commit to no meat every Monday. A simple weekly habit with massive cumulative impact.', category: 'food', co2Saving: '~4.6 kg', difficulty: 'easy', duration: 'every Monday', link: '/challenges' },
  { id: 'act_line_dry', title: 'Hang-dry your laundry', description: 'Skip the tumble dryer and hang clothes to dry. Dryers are among the most energy-intensive appliances.', category: 'energy', co2Saving: '~1.5 kg/load', difficulty: 'easy', duration: '10 min', link: '/tracker' },
];

export class SimpleActionService {
  static getDailyAction(userActivities: Activity[]): { action: SimpleAction; reason: string } {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);

    const categoryTotals: Record<ActivityCategory, number> = {
      transport: 0, energy: 0, food: 0, shopping_waste: 0
    };
    for (const act of userActivities) {
      categoryTotals[act.category] = (categoryTotals[act.category] || 0) + act.co2Emissions;
    }

    let highestCategory: string = 'general';
    let highestVal = 0;
    (Object.keys(categoryTotals) as ActivityCategory[]).forEach(cat => {
      if (categoryTotals[cat] > highestVal) {
        highestVal = categoryTotals[cat];
        highestCategory = cat;
      }
    });

    const relevantActions = ACTIONS_CATALOG.filter(a => a.category === highestCategory || highestCategory === 'general');
    const fallbackActions = ACTIONS_CATALOG;
    const pool = relevantActions.length > 0 ? relevantActions : fallbackActions;

    const index = dayOfYear % pool.length;
    const action = pool[index];

    const catDisplay = highestCategory === 'general' ? null : highestCategory.replace('_', ' ');
    const reason = catDisplay
      ? `Based on your logs, ${catDisplay} is your largest emission source. This simple action targets it directly.`
      : 'Start tracking your activities to get fully personalized daily actions!';

    return { action, reason };
  }

  static getAllActions(): SimpleAction[] {
    return ACTIONS_CATALOG;
  }
}
