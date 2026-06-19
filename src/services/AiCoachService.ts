import { Activity, ActivityCategory } from '../domain/entities/Activity';
import { User } from '../domain/entities/User';

export interface CoachResponse {
  reply: string;
  insights: string[];
  suggestions: string[];
}

export class AiCoachService {
  /**
   * Responds to user sustainability-related queries with dynamic advice, insights, and suggestions.
   *
   * @param query - The user's input text query.
   * @param user - The current user details.
   * @param activities - List of user logged activities for contextual calculations.
   * @returns A CoachResponse containing the reply text, related insights, and follow-up suggestions.
   */
  static chat(query: string, user: User, activities: Activity[]): CoachResponse {
    const text = query.toLowerCase();

    // 1. Calculate basic stats for contextualization (single pass)
    let totalEmissions = 0;
    const categoryTotals: Record<ActivityCategory, number> = {
      transport: 0,
      energy: 0,
      food: 0,
      shopping_waste: 0,
    };

    let highestCategory: ActivityCategory = 'transport';
    let highestVal = -1;

    for (const act of activities) {
      const emissions = act.co2Emissions;
      totalEmissions += emissions;

      const nextVal = categoryTotals[act.category] + emissions;
      categoryTotals[act.category] = nextVal;

      if (nextVal > highestVal) {
        highestVal = nextVal;
        highestCategory = act.category;
      }
    }

    const highestPct = totalEmissions > 0 ? Math.round((highestVal / totalEmissions) * 100) : 0;

    // 2. Draft dynamic replies based on user keywords
    let reply = '';
    const insights: string[] = [];
    const suggestions: string[] = [];

    // Guilt Mitigation / Tone alignment (prioritized)
    if (text.includes('feel bad') || text.includes('guilty') || text.includes('sorry') || text.includes('sad')) {
      reply = `Please don't feel discouraged, ${user.username}! Living sustainably is a journey of simple, positive adjustments. Swapping just one high-emission habit for a low-carbon eco alternative can have a massive cumulative impact. 🍃\n\nLet's focus on easy wins like introducing one plant-based day a week or walking/cycling for short trips. Which area feels most approachable to you?`;
      insights.push('Sustainable living is about progress, not perfection. Every small carbon offset counts!');
      suggestions.push('Give me a simple transport tip', 'What is my current carbon score?', 'Show me the challenges');
    }
    // Greeting / Intro
    else if (text.includes('hello') || text.includes('hi ') || text.includes('hey') || text.includes('coach')) {
      reply = `Hello, ${user.username}! I am your Eco Coach, here to support your journey. You are currently at the **${user.level}** level with **${user.points} points** and a **${user.streak}-day log streak**! 🌟\n\nHow can I help you understand or reduce your carbon footprint today? You can ask me about transport, diet, home energy, or check out your latest insights.`;
      insights.push(
        `Your current daily tracking streak is ${user.streak} days. Consistent tracking is key to building carbon awareness!`,
      );
      suggestions.push(
        'How can I reduce my transport emissions?',
        'What are my highest footprint categories?',
        'Tell me a tip about plant-based food.',
      );
    }
    // Transport (Regex to check word boundaries, avoiding substring conflicts like car/carbon)
    else if (
      /\b(transport|transportation|car|cars|drive|driving|flight|flights|fly|flying|bike|bikes|cycling|train|trains|bus|buses|commute)\b/.test(
        text,
      )
    ) {
      reply = `Transport is often one of the largest parts of an individual's carbon footprint. For you, transport accounts for **${Math.round(categoryTotals.transport)} kg CO2e** of your logs. 🚗\n\n**Actionable Tips:**\n- **Walk or Bike**: For trips under 5km, walking or biking emits exactly 0 kg of carbon!\n- **Public Transit**: Taking a train emits 0.04 kg CO2e/km, compared to 0.18 kg CO2e/km for a petrol car. That's a 77% reduction!\n- **Carpooling**: Even sharing a ride with one colleague cuts your transit emissions in half.`;
      insights.push(
        `Transport represents ${totalEmissions > 0 ? Math.round((categoryTotals.transport / totalEmissions) * 100) : 0}% of your recorded carbon footprint.`,
      );
      suggestions.push('Tell me about food emissions', 'How does the carbon simulator work?', 'Give me a challenge');
    }
    // Food / Diet
    else if (
      /\b(food|diet|eat|eating|meal|meals|meat|beef|chicken|pork|dairy|milk|cheese|vegetarian|vegan)\b/.test(text)
    ) {
      reply = `What we eat has a huge impact on land use and methane emissions. In your logs, food accounts for **${Math.round(categoryTotals.food)} kg CO2e**. 🥗\n\n**Simple Changes:**\n- **Reduce Meat**: Swapping a single beef meal for a vegetarian option saves about 4.6 kg CO2e (that's equivalent to driving a car 20 kilometers!).\n- **Try Dairy Alternatives**: swap out cow milk for oat milk (oat milk has a footprint 70% lower than dairy milk).\n- **Zero Food Waste**: Planning meals prevents unused food rotting in landfills, which releases harmful methane.`;
      insights.push(
        `Food accounts for ${totalEmissions > 0 ? Math.round((categoryTotals.food / totalEmissions) * 100) : 0}% of your logs.`,
      );
      suggestions.push('What challenges can I join?', 'Explain carbon offsets', 'How can I lower my energy bill?');
    }
    // Home Energy
    else if (
      /\b(energy|electricity|power|gas|lpg|heating|cooling|heater|ac|solar|bulb|bulbs|light|lights|led|thermostat)\b/.test(
        text,
      )
    ) {
      reply = `Home heating, cooling, and electricity use are major points of carbon emissions. For you, energy accounts for **${Math.round(categoryTotals.energy)} kg CO2e** of your footprint. 💡\n\n**Energy Efficiency Wins:**\n- **The 2°C Rule**: Adjusting your thermostat settings (turning down your heater by 2°C in winter or up by 2°C in summer) can cut heating/cooling carbon output by 15%.\n- **Phantom Load**: Electronics consume energy even when turned off but plugged in. Use smart power strips to unplug TV and computer setups at night.\n- **LED Upgrades**: Switching standard bulbs to LED uses 80% less energy and saves money on your utility bills.`;
      insights.push(
        `Home energy accounts for ${totalEmissions > 0 ? Math.round((categoryTotals.energy / totalEmissions) * 100) : 0}% of your logged footprint.`,
      );
      suggestions.push('How do I earn points?', 'What is my carbon forecast?', 'Give me a transport tip');
    }
    // Stats / Analysis
    else if (/\b(stats|statistics|highest|lowest|emissions|footprint|score|scorecard)\b/.test(text)) {
      if (totalEmissions === 0) {
        reply = `You haven't logged any activities yet! Swap over to the **Tracker** page to log your first car ride, meal, or electric bill, and I will analyze it here.`;
      } else {
        reply = `I have analyzed your footprint! Your total logged emissions are **${Math.round(totalEmissions)} kg CO2e**. Your largest source of emissions is **${highestCategory.replace('_', ' ')}**, representing **${highestPct}%** of your total footprint. 📊\n\nYour current Sustainability Score is calculated by evaluating how close you are to the sustainable daily ceiling of **5.5 kg CO2e**. Let's work together to complete challenges and reduce your footprint!`;
        insights.push(
          `Your highest emission source is ${highestCategory} (${Math.round(categoryTotals[highestCategory])} kg).`,
        );
        insights.push(`You have earned ${user.points} XP points, advancing you to a ${user.level} status.`);
      }
      suggestions.push(
        'How to reduce transport emissions?',
        'Give me an energy saving challenge',
        'What is the Climate Hero level?',
      );
    }
    // Challenges / Gamification
    else if (/\b(challenge|challenges|point|points|xp|level|badge|badges|achievement|achievements)\b/.test(text)) {
      reply = `EcoTrack AI rewards your dedication! You earn **10 XP** for every activity logged, **50 XP** for completing carbon challenges, and **100 XP** for hitting weekly goals. 🏆\n\n**Current Level:** ${user.level} (${user.points} total points).\n\n**Available Challenges:**\n- **Car-Free Week**: Try swapping car rides for walking/biking.\n- **Plant-Based Week**: Opt for plant-based nutrition for 7 days.\n- **Energy Saver Challenge**: Reduce plug-load and optimize thermostat.`;
      insights.push('Completing a challenge can reduce weekly emissions by up to 20kg!');
      suggestions.push('Tell me about Transport challenges', 'How to reach Climate Hero?', 'What is my streak?');
    }
    // Default fallback
    else {
      reply = `Thank you for sharing that, ${user.username}! Let's focus on simple, positive adjustments. Swapping just one high-emission habit for a low-carbon alternative can have a massive cumulative impact. 🍃\n\nFor example, swapping two short car rides for cycling this week saves about 8.5 kg of CO2e and $12 in gas. Swapping out a single beef meal saves 4.6 kg CO2e.\n\nWhich of these areas are you most comfortable starting with?`;
      insights.push(`Your primary carbon source is ${highestCategory.replace('_', ' ')}.`);
      suggestions.push('How to reduce transport emissions', 'How to reduce food emissions', 'Tell me my stats');
    }

    return {
      reply,
      insights,
      suggestions,
    };
  }

  /**
   * Generates a list of weekly summary insights based on the user's details and recent logs.
   *
   * @param user - The current user details.
   * @param activities - Recent user activities.
   * @returns Array of textual insights for the user's weekly summary card.
   */
  static getWeeklyInsights(user: User, activities: Activity[]): string[] {
    const insights: string[] = [];
    if (activities.length === 0) {
      return [
        'Welcome! Start logging your transportation, food, shopping, and home energy to unlock personalized insights.',
      ];
    }

    let transportEmissions = 0;
    let foodEmissions = 0;
    for (const a of activities) {
      if (a.category === 'transport') {
        transportEmissions += a.co2Emissions;
      } else if (a.category === 'food') {
        foodEmissions += a.co2Emissions;
      }
    }

    if (transportEmissions > foodEmissions && transportEmissions > 15) {
      insights.push(
        'Your transportation emissions are a key area. Replacing short drives with cycling could save up to 8.5 kg CO2e per trip!',
      );
    }
    if (foodEmissions > 20) {
      insights.push(
        'Food emissions are relatively high this week. Having a Meat-Free Monday could reduce your diet footprint by 15%.',
      );
    }
    if (user.streak >= 3) {
      insights.push(
        `Fantastic! You've maintained a ${user.streak}-day log streak. Consistency leads to sustainable habits.`,
      );
    } else {
      insights.push('Try logging daily to build habit awareness and see accurate forecasts of your footprint.');
    }

    // Add general positive encouragement
    insights.push(
      'Every small effort counts. Reducing your thermostat by just 1°C saves up to 8% of heating/cooling emissions.',
    );
    return insights;
  }
}
