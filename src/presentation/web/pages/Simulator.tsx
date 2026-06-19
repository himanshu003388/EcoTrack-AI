import React, { useState, memo, useMemo, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { useTheme } from '../main';
import { usePageTitle } from '../components/Hooks';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Sliders, Leaf, DollarSign, Target, Award, RefreshCw, Save, Lightbulb, CheckCircle } from 'lucide-react';

interface SavedScenario {
  car: number;
  transit: number;
  meat: number;
  energy: number;
  footprint: number;
  carbonSaved: number;
  moneySaved: number;
  date: string;
}

export const Simulator: React.FC = memo(() => {
  const { toast } = useToast();
  const { theme } = useTheme();

  usePageTitle('Carbon Reduction Simulator');
  const baseCar = 200;
  const baseTransit = 50;
  const baseMeat = 5;
  const baseEnergy = 80;

  const [car, setCar] = useState<number>(120);
  const [transit, setTransit] = useState<number>(100);
  const [meat, setMeat] = useState<number>(2);
  const [energy, setEnergy] = useState<number>(60);

  const carFactor = 0.18;
  const transitFactor = 0.08;
  const meatMealFactor = 5.8;
  const vegMealFactor = 1.2;
  const electricityFactor = 0.38;

  const carCostPerKm = 0.2;
  const transitCostPerKm = 0.08;
  const meatMealCost = 8.5;
  const vegMealCost = 5.0;
  const electricityCostPerKwh = 0.15;

  const baseFootprints = useMemo(() => {
    const bCar = baseCar * carFactor;
    const bTransit = baseTransit * transitFactor;
    const bMeat = baseMeat * meatMealFactor + (7 - baseMeat) * vegMealFactor;
    const bEnergy = baseEnergy * electricityFactor;
    return { total: bCar + bTransit + bMeat + bEnergy };
  }, []);

  const baseCosts = useMemo(() => {
    const cCar = baseCar * carCostPerKm;
    const cTransit = baseTransit * transitCostPerKm;
    const cMeat = baseMeat * meatMealCost + (7 - baseMeat) * vegMealCost;
    const cEnergy = baseEnergy * electricityCostPerKwh;
    return { total: cCar + cTransit + cMeat + cEnergy };
  }, []);

  const simData = useMemo(() => {
    const sCar = car * carFactor;
    const sTransit = transit * transitFactor;
    const sMeat = meat * meatMealFactor + (7 - meat) * vegMealFactor;
    const sEnergy = energy * electricityFactor;
    const total = sCar + sTransit + sMeat + sEnergy;

    const sCarCost = car * carCostPerKm;
    const sTransitCost = transit * transitCostPerKm;
    const sMeatCost = meat * meatMealCost + (7 - meat) * vegMealCost;
    const sEnergyCost = energy * electricityCostPerKwh;
    const totalCost = sCarCost + sTransitCost + sMeatCost + sEnergyCost;

    const carbonSaved = Math.max(0, baseFootprints.total - total);
    const moneySaved = Math.max(0, baseCosts.total - totalCost);

    return { totalFootprint: total, totalCost, carbonSaved, moneySaved };
  }, [car, transit, meat, energy, baseFootprints.total, baseCosts.total]);

  const carbonReductionPct = Math.round((simData.carbonSaved / baseFootprints.total) * 100);

  const sustainableTargetWeekly = 38.5;
  const goalAchievementProgress = Math.min(100, Math.round((sustainableTargetWeekly / simData.totalFootprint) * 100));

  const chartData = useMemo(
    () => [
      {
        name: 'Baseline weekly footprint',
        value: Math.round(baseFootprints.total),
        fill: theme === 'dark' ? '#475569' : '#5a6e84',
      },
      {
        name: 'Simulated weekly footprint',
        value: Math.round(simData.totalFootprint),
        fill: theme === 'dark' ? '#34d399' : '#1E3F20',
      },
    ],
    [baseFootprints.total, simData.totalFootprint, theme],
  );

  const handleReset = useCallback(() => {
    setCar(120);
    setTransit(100);
    setMeat(2);
    setEnergy(60);
    toast('info', 'Simulation reset to default values.');
  }, [toast]);

  const handleSave = useCallback(() => {
    const scenario: SavedScenario = {
      car,
      transit,
      meat,
      energy,
      footprint: Math.round(simData.totalFootprint),
      carbonSaved: Math.round(simData.carbonSaved),
      moneySaved: Math.round(simData.moneySaved),
      date: new Date().toISOString(),
    };
    let existing: SavedScenario[] = [];
    try {
      existing = JSON.parse(localStorage.getItem('ecotrack_scenarios') ?? '[]') as SavedScenario[];
    } catch {
      existing = [];
    }
    existing.push(scenario);
    localStorage.setItem('ecotrack_scenarios', JSON.stringify(existing));
    toast('success', `Scenario saved! (${Math.round(simData.carbonSaved)} kg CO₂e saved)`);
  }, [car, transit, meat, energy, simData, toast]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Carbon Reduction Simulator
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Slide variables to model your weekly footprint, cost savings, and climate goals.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="btn-press flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-forest-700 bg-white dark:bg-forest-900 hover:bg-slate-50 dark:hover:bg-forest-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
            aria-label="Save current simulation scenario"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save
          </button>
          <button
            onClick={handleReset}
            className="btn-press flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-forest-700 bg-white dark:bg-forest-900 hover:bg-slate-50 dark:hover:bg-forest-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
            aria-label="Reset all sliders to default values"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6" role="region" aria-label="Adjustable habit sliders">
          <div className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-8 rounded-[32px] shadow-sm space-y-6 transition-colors duration-200">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="h-5 w-5 text-forest-500" aria-hidden="true" />
              Adjust Habit Sliders
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                <label htmlFor="car-slider">Weekly Car Commute</label>
                <span className="text-forest-600 dark:text-forest-400 font-mono">{car} km / week</span>
              </div>
              <input
                id="car-slider"
                type="range"
                min="0"
                max="400"
                value={car}
                onChange={(e) => setCar(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-100 dark:bg-forest-800 rounded-lg appearance-none cursor-pointer accent-forest-500"
                aria-label="Weekly Car Commute slider"
                aria-valuetext={`${car} kilometers per week`}
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span>0 km (Zero drive)</span>
                <span>Baseline: 200 km</span>
                <span>400 km</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                <label htmlFor="transit-slider">Weekly Public Transit</label>
                <span className="text-forest-600 dark:text-forest-400 font-mono">{transit} km / week</span>
              </div>
              <input
                id="transit-slider"
                type="range"
                min="0"
                max="400"
                value={transit}
                onChange={(e) => setTransit(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-100 dark:bg-forest-800 rounded-lg appearance-none cursor-pointer accent-forest-500"
                aria-label="Weekly Public Transit slider"
                aria-valuetext={`${transit} kilometers per week`}
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span>0 km (No transit)</span>
                <span>Baseline: 50 km</span>
                <span>400 km</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                <label htmlFor="meat-slider">Meat consumption frequency</label>
                <span className="text-forest-600 dark:text-forest-400 font-mono">{meat} days / week</span>
              </div>
              <input
                id="meat-slider"
                type="range"
                min="0"
                max="7"
                value={meat}
                onChange={(e) => setMeat(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-100 dark:bg-forest-800 rounded-lg appearance-none cursor-pointer accent-forest-500"
                aria-label="Meat consumption frequency slider"
                aria-valuetext={`${meat} days per week`}
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span>0 days (Vegan Swap)</span>
                <span>Baseline: 5 days</span>
                <span>7 days</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                <label htmlFor="energy-slider">Weekly Energy Load</label>
                <span className="text-forest-600 dark:text-forest-400 font-mono">{energy} kWh / week</span>
              </div>
              <input
                id="energy-slider"
                type="range"
                min="0"
                max="200"
                value={energy}
                onChange={(e) => setEnergy(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-100 dark:bg-forest-800 rounded-lg appearance-none cursor-pointer accent-forest-500"
                aria-label="Weekly Energy Load slider"
                aria-valuetext={`${energy} kilowatt-hours per week`}
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span>0 kWh (Net-Zero/Solar)</span>
                <span>Baseline: 80 kWh</span>
                <span>200 kWh</span>
              </div>
            </div>
          </div>

          <div
            className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm min-h-[250px] flex flex-col justify-between transition-colors duration-200"
            role="region"
            aria-label="Weekly footprint comparison chart"
          >
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Weekly Footprint Comparison (kg CO₂e)
            </h3>
            <div
              className="h-44 mt-4"
              role="img"
              aria-label={`Bar chart comparing baseline footprint ${Math.round(baseFootprints.total)} kg versus simulated footprint ${Math.round(simData.totalFootprint)} kg`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={25}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6" role="region" aria-label="Simulation results">
          <div className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm space-y-4 transition-colors duration-200">
            <h3 className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Simulated Weekly Footprint
            </h3>
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl font-extrabold text-slate-900 dark:text-white font-display"
                aria-label={`${Math.round(simData.totalFootprint)} kilograms CO2 per week`}
              >
                {Math.round(simData.totalFootprint)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">kg CO₂e / week</span>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span>Sustainable Target Goal</span>
                <span
                  className={
                    simData.totalFootprint <= sustainableTargetWeekly
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                >
                  {Math.round(simData.totalFootprint)} / 38.5 kg
                </span>
              </div>
              <div
                className="w-full bg-slate-100 dark:bg-forest-800 h-2.5 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.min(100, (simData.totalFootprint / 150) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress towards sustainable target"
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    simData.totalFootprint <= sustainableTargetWeekly ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, (simData.totalFootprint / 150) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                * Sustainable daily limit is 5.5 kg CO₂e. Hitting this weekly target helps slow atmospheric warming.
              </p>
            </div>
          </div>

          <div className="p-6 bg-forest-500 text-white rounded-[32px] shadow-md space-y-6 relative overflow-hidden">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10" aria-hidden="true">
              <Leaf className="h-32 w-32 fill-white" />
            </div>

            <div className="space-y-1">
              <span className="text-forest-100 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-emerald-300 fill-emerald-300" aria-hidden="true" />
                Carbon Reduction
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-extrabold font-display"
                  aria-label={`${Math.round(simData.carbonSaved)} kilograms CO2 saved per week`}
                >
                  {Math.round(simData.carbonSaved)}
                </span>
                <span className="text-xs text-forest-100 font-semibold">
                  kg CO₂e / week saved ({carbonReductionPct}%)
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-forest-100 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Financial Savings
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-extrabold font-display"
                  aria-label={`$${Math.round(simData.moneySaved)} USD saved per week`}
                >
                  ${Math.round(simData.moneySaved)}
                </span>
                <span className="text-xs text-forest-100 font-semibold">USD / week saved</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-forest-400/50">
              <span className="text-forest-100 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Sustainable Target Alignment
              </span>
              <div className="flex justify-between text-xs font-semibold text-forest-100">
                <span>Alignment Percentage</span>
                <span>{goalAchievementProgress}%</span>
              </div>
              <div
                className="w-full bg-forest-700/60 h-2 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={goalAchievementProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Goal alignment progress"
              >
                <div
                  className="bg-emerald-300 h-full rounded-full transition-all duration-300"
                  style={{ width: `${goalAchievementProgress}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div
            className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors duration-200"
            role="region"
            aria-label="Dynamic simulation insights"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="h-4 w-4 text-forest-500" aria-hidden="true" />
              Dynamic Simulation Wins
            </h4>
            <div className="space-y-2.5 leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
              {car < 150 && (
                <p className="flex gap-2">
                  <span className="sr-only">Positive impact:</span>
                  <span className="text-emerald-500 shrink-0" aria-hidden="true">
                    ✔
                  </span>
                  Reducing your weekly driving to {car} km prevents approximately{' '}
                  {Math.round((baseCar - car) * carFactor)} kg of tailpipe carbon.
                </p>
              )}
              {meat < 3 && (
                <p className="flex gap-2">
                  <span className="sr-only">Positive impact:</span>
                  <span className="text-emerald-500 shrink-0" aria-hidden="true">
                    ✔
                  </span>
                  Limiting meat intake to {meat} days saves $
                  {Math.round((baseMeat - meat) * (meatMealCost - vegMealCost))} in meal shopping expenses weekly.
                </p>
              )}
              {energy < 70 && (
                <p className="flex gap-2">
                  <span className="sr-only">Positive impact:</span>
                  <span className="text-emerald-500 shrink-0" aria-hidden="true">
                    ✔
                  </span>
                  Lowering house electricity to {energy} kWh reduces power grid demand, preventing{' '}
                  {Math.round((baseEnergy - energy) * electricityFactor)} kg CO₂.
                </p>
              )}
              {car >= 200 && meat >= 5 && energy >= 80 && (
                <p className="text-slate-400 italic dark:text-slate-500">
                  Slide any control to the left to model carbon reductions and cost savings!
                </p>
              )}
            </div>
          </div>

          <div
            className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm space-y-4 transition-colors duration-200"
            role="region"
            aria-label="Your personalized reduction action plan"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Your Action Plan
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Personalized recommendations to reduce your weekly footprint:
            </p>
            <ol className="space-y-2.5 list-none">
              {car > 120 && (
                <li
                  className="flex gap-2.5 items-start p-2.5 bg-slate-50 dark:bg-forest-800/40 rounded-xl"
                  role="listitem"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-500 text-white text-[10px] font-bold shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    1
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Reduce driving to 120 km/week
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Saves ~{Math.round((car - 120) * carFactor)} kg CO₂ and ${Math.round((car - 120) * carCostPerKm)}{' '}
                      weekly. Try carpooling or remote work.
                    </p>
                  </div>
                </li>
              )}
              {transit < 150 && (
                <li
                  className="flex gap-2.5 items-start p-2.5 bg-slate-50 dark:bg-forest-800/40 rounded-xl"
                  role="listitem"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-500 text-white text-[10px] font-bold shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    {car > 120 ? '2' : '1'}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Increase public transit to 150 km/week
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Transit emits ~60% less CO₂ per km than cars. Cheaper than fuel too!
                    </p>
                  </div>
                </li>
              )}
              {meat > 2 && (
                <li
                  className="flex gap-2.5 items-start p-2.5 bg-slate-50 dark:bg-forest-800/40 rounded-xl"
                  role="listitem"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-500 text-white text-[10px] font-bold shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    {(car > 120 ? 1 : 0) + (transit < 150 ? 1 : 0) + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {meat > 3 ? 'Cut meat to 2 days/week' : 'Cut meat to 1 day/week'}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Each meat-free day saves ~4.6 kg CO₂e. Try a{' '}
                      <a href="/tracker" className="text-forest-600 dark:text-forest-400 underline">
                        vegetarian meal today
                      </a>
                      .
                    </p>
                  </div>
                </li>
              )}
              {energy > 50 && (
                <li
                  className="flex gap-2.5 items-start p-2.5 bg-slate-50 dark:bg-forest-800/40 rounded-xl"
                  role="listitem"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-500 text-white text-[10px] font-bold shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    {(car > 120 ? 1 : 0) + (transit < 150 ? 1 : 0) + (meat > 2 ? 1 : 0) + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Lower energy use to 50 kWh/week
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Saves ~{Math.round((energy - 50) * electricityFactor)} kg CO₂ weekly. Switch to LED bulbs and
                      unplug standby devices.
                    </p>
                  </div>
                </li>
              )}
              {car <= 120 && transit >= 150 && meat <= 2 && energy <= 50 && (
                <li className="flex gap-2 items-start p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      Looking good! Your current settings are near sustainable targets.
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Challenge others or set a new goal in the{' '}
                      <a href="/challenges" className="underline">
                        Challenges
                      </a>{' '}
                      page.
                    </p>
                  </div>
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
});
