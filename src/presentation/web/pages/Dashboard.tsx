import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useAuth } from '../main';
import { useToast } from '../components/Toast';
import { CardSkeleton, ChartSkeleton } from '../components/Skeleton';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
  TrendingUp, Leaf, Info, Car, Zap, Smartphone, AlertTriangle, Award, CalendarDays, Target, TreePine,
  Footprints, Lightbulb, ArrowRight, Utensils, Flame, Sparkles
} from 'lucide-react';
import type { DashboardData, DailyAction, PieChartItem, ComparisonBarItem } from '../../../types/dashboard';

const COLORS = ['#1E3F20', '#10b981', '#38bdf8', '#78350f'];
const SUSTAINABLE_TARGET_DAILY = 5.5;
const DAYS_IN_MONTH = 30;

export const Dashboard: React.FC = memo(() => {
  const { token, refreshUser } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [dailyAction, setDailyAction] = useState<DailyAction | null>(null);
  const [actionLoading, setActionLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ecotrack_onboarded')) {
      return true;
    }
    return false;
  });

  const dismissOnboarding = (): void => {
    localStorage.setItem('ecotrack_onboarded', 'true');
    setShowOnboarding(false);
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as DashboardData;
        setData(json);
      } else {
        throw new Error('Failed to retrieve dashboard details.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchDailyAction = useCallback(async () => {
    try {
      const res = await fetch('/api/actions/daily', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as DailyAction;
        setDailyAction(json);
      }
    } catch {
      // Non-critical
    } finally {
      setActionLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchDashboardData();
    void fetchDailyAction();
  }, [fetchDashboardData, fetchDailyAction]);

  const handleSetGoal = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const target = parseFloat(newGoalTarget);
    if (isNaN(target) || target <= 0) {
      toast('warning', 'Please enter a valid positive target.');
      return;
    }
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetCo2: target }),
      });
      const resJson = (await res.json()) as { error?: string };
      if (res.ok) {
        toast('success', 'Carbon reduction goal set successfully!');
        setNewGoalTarget('');
        void fetchDashboardData();
        void refreshUser();
      } else {
        toast('error', resJson.error || 'Failed to set carbon target.');
      }
    } catch {
      toast('error', 'Failed to connect to the server.');
    }
  };

  const pieData: PieChartItem[] = useMemo(() => {
    if (!data) return [];
    return data.categoryBreakdown
      .map((item) => ({
        name: item.category.replace('_', ' ').toUpperCase(),
        value: item.emissions
      }))
      .filter((item) => item.value > 0);
  }, [data]);

  const comparisonData: ComparisonBarItem[] = useMemo(() => {
    if (!data) return [];
    const dailyAvg = data.emissions.monthly > 0
      ? Math.round((data.emissions.monthly / DAYS_IN_MONTH) * 10) / 10
      : 0;
    return [
      { name: 'National Avg', value: data.averages.nationalDaily, fill: '#ef4444' },
      { name: 'Global Avg', value: data.averages.globalDaily, fill: '#f59e0b' },
      { name: 'Sustainable Target', value: data.averages.sustainableDaily, fill: '#10b981' },
      { name: 'Your Daily Avg', value: dailyAvg, fill: '#1E3F20' }
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in" role="status" aria-label="Loading dashboard">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-200 dark:bg-forest-800 animate-pulse rounded" aria-hidden="true"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
        </div>
        <span className="sr-only">Loading dashboard data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 animate-fade-in">
        {showOnboarding && (
          <div className="p-6 bg-gradient-to-br from-forest-50 to-emerald-50 dark:from-forest-900/60 dark:to-emerald-900/30 border border-forest-100 dark:border-forest-800 rounded-3xl shadow-sm animate-slide-up" role="status" aria-live="polite">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="font-display text-lg font-bold text-forest-800 dark:text-forest-200">Welcome to EcoTrack AI!</h2>
                <p className="text-sm text-forest-700 dark:text-forest-300 leading-relaxed">
                  Start by <strong>logging your first activity</strong> &mdash; record your daily commute, meals, or energy use. Each log earns you XP and helps build your carbon profile.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <a href="/tracker" className="btn-press inline-flex items-center gap-1.5 px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors shadow-sm">
                    Log Your First Activity
                  </a>
                  <button onClick={dismissOnboarding} className="btn-press px-4 py-2 bg-white dark:bg-forest-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-forest-700 border border-slate-200 dark:border-forest-700 transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
              <button onClick={dismissOnboarding} className="text-forest-400 hover:text-forest-600 dark:hover:text-forest-300 p-1" aria-label="Dismiss welcome message">&times;</button>
            </div>
          </div>
        )}
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400 rounded-3xl" role="alert">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="font-semibold">Error: {error || 'Could not load dashboard.'}</p>
          </div>
          <button onClick={() => { void fetchDashboardData(); }} className="btn-press mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Carbon Intelligence Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Track and understand your personal carbon metrics.
          </p>
        </div>

        <div className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-3 rounded-2xl shadow-sm flex items-center gap-3">
          <form onSubmit={(e) => { void handleSetGoal(e); }} className="flex gap-2 items-center" aria-label="Set carbon reduction goal">
            <Target className="h-5 w-5 text-forest-500 shrink-0" aria-hidden="true" />
            <label htmlFor="goal-target" className="sr-only">Monthly Target CO2 in kg</label>
            <input
              id="goal-target"
              type="number"
              placeholder="Set monthly target (kg)"
              value={newGoalTarget}
              onChange={(e) => setNewGoalTarget(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-forest-700 bg-white dark:bg-forest-800 rounded-xl text-sm focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500 w-44 tabular-nums text-slate-900 dark:text-slate-100"
            />
            <button type="submit" className="btn-press px-3 py-1.5 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors">
              Set goal
            </button>
          </form>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" aria-label="Footprint overview cards">
        <div className="card-hover p-5 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm flex flex-col justify-between" role="region" aria-label="Sustainability score">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Score</span>
            <span className="p-1.5 bg-forest-50 dark:bg-forest-800 text-forest-600 dark:text-forest-300 rounded-xl"><Leaf className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white font-display tabular-nums" aria-label={`Sustainability score ${data.sustainabilityScore} out of 100`}>{data.sustainabilityScore}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">/ 100</span>
            </div>
            <div className="mt-2 text-xs font-medium text-forest-600 dark:text-forest-400 flex items-center gap-1.5">
              <Award className="h-4 w-4" aria-hidden="true" />
              <span>{data.userStats.level}</span>
            </div>
          </div>
        </div>

        <div className="card-hover p-5 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm flex flex-col justify-between" role="region" aria-label="Today's footprint">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Today</span>
            <span className="p-1.5 bg-slate-50 dark:bg-forest-800 text-slate-600 dark:text-slate-400 rounded-xl"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white font-display tabular-nums" aria-label={`${data.emissions.today} kilograms CO2 equivalent`}>{data.emissions.today}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">kg</span>
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Logged activities today</p>
          </div>
        </div>

        <div className="card-hover p-5 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm flex flex-col justify-between" role="region" aria-label="Monthly footprint">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Monthly</span>
            <span className="p-1.5 bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl"><TrendingUp className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white font-display tabular-nums">{data.emissions.monthly}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">kg</span>
            </div>
            {data.currentGoal ? (
              <p className="mt-2 text-xs font-medium text-sky-600 dark:text-sky-400">Target: {data.currentGoal.targetCo2} kg</p>
            ) : (
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">No target set</p>
            )}
          </div>
        </div>

        <div className="card-hover p-5 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm flex flex-col justify-between" role="region" aria-label="Annual projection">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Annual</span>
            <span className="p-1.5 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl"><Info className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white font-display tabular-nums">{data.emissions.annualProjection}</span>
              <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">kg</span>
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Based on 30-day habits</p>
          </div>
        </div>
      </section>

      {!actionLoading && dailyAction && (
        <section className="p-6 bg-gradient-to-br from-emerald-50 to-forest-50 dark:from-forest-800/80 dark:to-emerald-900/30 border border-emerald-100 dark:border-emerald-800/60 rounded-3xl shadow-sm" role="region" aria-label="Simple action of the day">
          <div className="flex items-start gap-4">
            <span className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 rounded-2xl shrink-0">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base font-bold text-emerald-800 dark:text-emerald-200">Today's Simple Action</h2>
                <span className="px-2 py-0.5 bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-wider">{dailyAction.action.difficulty} &middot; {dailyAction.action.duration}</span>
              </div>
              <p className="mt-1 text-lg font-bold text-emerald-900 dark:text-emerald-100">{dailyAction.action.title}</p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300 font-medium">{dailyAction.action.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg">{dailyAction.action.co2Saving}</span>
                <a href={dailyAction.action.link} className="btn-press inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">
                  Take this action <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium italic">{dailyAction.reason}</p>
            </div>
          </div>
        </section>
      )}

      <section className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm" role="region" aria-label="Quick actions to reduce your footprint">
        <div className="flex items-center gap-3 mb-4">
          <Footprints className="h-5 w-5 text-forest-500" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Simple Actions to Reduce Today</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a href="/tracker"
            className="btn-press flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl hover:bg-forest-50 dark:hover:bg-forest-800 hover:border-forest-200 dark:hover:border-forest-600 transition-all text-center group"
            aria-label="Log a walking commute, a simple action to reduce transport emissions">
            <Footprints className="h-6 w-6 text-forest-500 group-hover:scale-110 transition-transform" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Log a Walk</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Replace car, save ~2 kg</span>
          </a>
          <a href="/tracker"
            className="btn-press flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl hover:bg-forest-50 dark:hover:bg-forest-800 hover:border-forest-200 dark:hover:border-forest-600 transition-all text-center group"
            aria-label="Log a vegetarian meal, a simple action to reduce diet emissions">
            <Utensils className="h-6 w-6 text-forest-500 group-hover:scale-110 transition-transform" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Skip Meat Today</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Save ~4.6 kg CO₂e</span>
          </a>
          <a href="/simulator"
            className="btn-press flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl hover:bg-forest-50 dark:hover:bg-forest-800 hover:border-forest-200 dark:hover:border-forest-600 transition-all text-center group"
            aria-label="Explore energy reduction scenarios in the simulator">
            <Flame className="h-6 w-6 text-forest-500 group-hover:scale-110 transition-transform" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Reduce Energy</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Simulate savings</span>
          </a>
          <a href="/coach"
            className="btn-press flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl hover:bg-forest-50 dark:hover:bg-forest-800 hover:border-forest-200 dark:hover:border-forest-600 transition-all text-center group"
            aria-label="Get personalized reduction tips from your AI Eco Coach">
            <Lightbulb className="h-6 w-6 text-forest-500 group-hover:scale-110 transition-transform" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Get Tips</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Personalized advice</span>
          </a>
        </div>
      </section>

      <section className="p-6 bg-gradient-to-br from-forest-600 to-forest-700 text-white rounded-[28px] shadow-md relative overflow-hidden" role="region" aria-label="Personalized insight and carbon literacy">
        <div className="absolute right-[-20px] bottom-[-20px] opacity-10" aria-hidden="true">
          <Leaf className="h-48 w-48 fill-white" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <TreePine className="h-6 w-6 text-emerald-300 shrink-0" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold">Personalized Insight</h2>
            </div>
            <p className="text-sm text-forest-100 leading-relaxed">{data.explanation}</p>
          </div>
          <div className="sm:w-64 p-4 bg-white/10 rounded-2xl border border-white/10">
            <h3 className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-2">Did You Know?</h3>
            <p className="text-xs text-forest-100 leading-relaxed">
              A typical car emits ~2.3 kg CO₂e per litre of petrol. Walking 2 km instead of driving saves about 0.5 kg — small swaps add up fast.
            </p>
            <a href="/coach" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-200 hover:text-white transition-colors">
              Ask Eco Coach for personalized tips <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <details className="p-4 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-2xl shadow-sm text-xs text-slate-500 dark:text-slate-400" aria-label="How to understand your carbon dashboard">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300 hover:text-forest-600 dark:hover:text-forest-400 transition-colors select-none">
          <Lightbulb className="h-4 w-4 inline mr-1.5 text-forest-500" aria-hidden="true" />
          How to understand these numbers
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p><strong>CO₂e</strong> (carbon dioxide equivalent) is the standard unit for measuring your carbon footprint. It combines all greenhouse gases into one number.</p>
          <p><strong>Sustainability Score</strong> (out of 100) rates how your habits compare to the {SUSTAINABLE_TARGET_DAILY} kg/person/day IPCC sustainable target. Higher is better.</p>
          <p><strong>Real-World Equivalents</strong> translate abstract kg numbers into tangible comparisons so you can understand the scale of your impact.</p>
          <p>Use the <strong>Quick Actions</strong> above to take simple reduction steps, or visit the <a href="/simulator" className="text-forest-600 dark:text-forest-400 font-bold hover:underline">Simulator</a> to model bigger lifestyle changes.</p>
        </div>
      </details>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-label="Footprint analysis charts">
        <div className="lg:col-span-2 p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-[28px] shadow-sm flex flex-col justify-between min-h-[350px] transition-colors duration-200" role="region" aria-label="Emissions trend chart">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">Emissions Trend</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Daily aggregated footprint &middot; Last 15 days</p>
          </div>
          <div className="mt-6 flex-1 h-56" role="img" aria-label={`Chart showing daily CO2 emissions over the last 15 days.`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E3F20" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#1E3F20" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="emissions" stroke="#1E3F20" strokeWidth={2} fillOpacity={1} fill="url(#colorEmissions)" name="CO₂e (kg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            <summary className="cursor-pointer font-medium select-none hover:text-slate-600 dark:hover:text-slate-300 transition-colors">View data table</summary>
            <table className="w-full mt-2 border-collapse border border-slate-100 dark:border-forest-800 text-left tabular-nums">
              <caption className="sr-only">Daily emissions data table</caption>
              <thead>
                <tr className="bg-slate-50 dark:bg-forest-800">
                  <th className="p-1.5 border border-slate-100 dark:border-forest-800 text-xs font-semibold text-slate-600 dark:text-slate-300" scope="col">Date</th>
                  <th className="p-1.5 border border-slate-100 dark:border-forest-800 text-xs font-semibold text-slate-600 dark:text-slate-300" scope="col">kg CO₂e</th>
                </tr>
              </thead>
              <tbody>
                {data.trends.map((t) => (
                  <tr key={t.date} className="hover:bg-slate-50 dark:hover:bg-forest-800">
                    <td className="p-1.5 border border-slate-100 dark:border-forest-800 text-slate-700 dark:text-slate-300">{t.date}</td>
                    <td className="p-1.5 border border-slate-100 dark:border-forest-800 text-slate-700 dark:text-slate-300">{t.emissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-[28px] shadow-sm flex flex-col justify-between min-h-[350px] transition-colors duration-200" role="region" aria-label="Emissions by category">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">Emissions by Category</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Share of last 30 days</p>
          </div>
          <div className="mt-4 flex-1 flex items-center justify-center h-48 relative">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 text-sm space-y-2">
                <p>No emissions logged this month.</p>
                <a href="/tracker" className="inline-block text-forest-500 font-semibold hover:underline text-xs">Log your first activity &rarr;</a>
              </div>
            )}
            {pieData.length > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none" aria-hidden="true">
                <span className="text-2xl font-bold font-display text-slate-800 dark:text-white tabular-nums">{data.emissions.monthly}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Total kg</span>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-1.5" role="list" aria-label="Category breakdown">
            {data.categoryBreakdown.map((item, index) => (
              <div key={item.category} className="flex justify-between items-center text-xs" role="listitem">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} aria-hidden="true"></span>
                  <span className="text-slate-600 dark:text-slate-400 font-medium capitalize truncate">{item.category.replace('_', ' ')}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums shrink-0 ml-2">{item.percentage}% &middot; {item.emissions} kg</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-label="Footprint comparison and equivalents">
        <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-[28px] shadow-sm flex flex-col justify-between min-h-[350px] transition-colors duration-200" role="region" aria-label="Comparison chart">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">How You Compare</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Daily avg vs. standards (kg CO₂e/day)</p>
          </div>
          <div className="mt-6 flex-1 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {comparisonData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed flex items-start gap-1.5 mt-3">
            <Info className="h-3.5 w-3.5 text-forest-500 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Global sustainable target is <strong>{SUSTAINABLE_TARGET_DAILY} kg</strong> per person per day for IPCC climate goals.</span>
          </p>
        </div>

        <div className="lg:col-span-2 p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-[28px] shadow-sm flex flex-col justify-between transition-colors duration-200" role="region" aria-label="Real-world equivalents">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">Real-World Equivalents</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Your monthly emissions converted to tangible concepts</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl flex gap-3.5 items-center card-hover">
              <span className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-2xl"><Leaf className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <span className="block text-2xl font-bold text-slate-900 dark:text-white font-display tabular-nums" aria-label={`${data.equivalents.treesNeeded} trees needed to offset`}>{data.equivalents.treesNeeded}</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Trees to offset / year</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl flex gap-3.5 items-center card-hover">
              <span className="p-3 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded-2xl"><Car className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <span className="block text-2xl font-bold text-slate-900 dark:text-white font-display tabular-nums" aria-label={`${data.equivalents.carKm} kilometers driven`}>{data.equivalents.carKm}</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Km driven by car</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl flex gap-3.5 items-center card-hover">
              <span className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-2xl"><Zap className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <span className="block text-2xl font-bold text-slate-900 dark:text-white font-display tabular-nums" aria-label={`${data.equivalents.electricityHours} hours of air conditioning`}>{data.equivalents.electricityHours}</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Hours of A/C</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl flex gap-3.5 items-center card-hover">
              <span className="p-3 bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 rounded-2xl"><Smartphone className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <span className="block text-2xl font-bold text-slate-900 dark:text-white font-display tabular-nums" aria-label={`${data.equivalents.phoneCharges} phone charges`}>{data.equivalents.phoneCharges}</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Phone charges</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">* Calculated using EPA and DEFRA averages. 1 tree absorbs ~22 kg CO₂/year.</p>
        </div>
      </section>
    </div>
  );
});
