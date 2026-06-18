import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../main';
import { CardSkeleton, ChartSkeleton } from '../components/Skeleton';
import {
  TrendingUp, AlertTriangle, Lightbulb, CheckCircle, TrendingDown, Target, Info
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import type { ForecastData } from '../../../types/forecast';

export const ForecastPage: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await fetch('/api/forecast', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        throw new Error('Failed to retrieve forecast data.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading forecast">
        <div className="h-8 w-48 bg-slate-200 dark:bg-forest-800 animate-pulse rounded" aria-hidden="true"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <ChartSkeleton />
        <span className="sr-only">Loading forecast data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400 rounded-3xl" role="alert">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <p className="font-semibold">Error: {error || 'Could not load carbon forecast.'}</p>
        </div>
      </div>
    );
  }

  const chartData = [
    { period: 'Past Fortnight', value: Math.round(data.nextMonthEstimate / 2.1) },
    { period: 'Current Month (Est)', value: Math.round(data.nextMonthEstimate) },
    { period: 'Next Month (Projected)', value: Math.round(data.nextMonthEstimate * (1 + (data.trendPercentage / 100 || 0))) }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Future Emission Forecast
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Predicting upcoming carbon footprint levels based on your historical daily logging behavior.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Forecast Metrics Overview">
        <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between" role="region" aria-label="Next month projection">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Next Month Projection</span>
            <span className={`p-1.5 rounded-xl ${data.trendDirection === 'decreasing' ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : data.trendDirection === 'increasing' ? 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-forest-800 text-slate-600 dark:text-slate-400'}`}>
              {data.trendDirection === 'decreasing' ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> : <TrendingUp className="h-4 w-4" aria-hidden="true" />}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white font-display" aria-label={`${data.nextMonthEstimate} kilograms CO2 projected`}>{data.nextMonthEstimate}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">kg CO₂e</span>
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            {data.trendDirection === 'stable' ? (
              <span>Footprint is stable (+0% change)</span>
            ) : (
              <span className={data.trendDirection === 'decreasing' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
                {data.trendDirection === 'decreasing' ? 'Decreasing trend' : 'Increasing trend'} ({data.trendPercentage}%)
              </span>
            )}
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between" role="region" aria-label="Goal achievement probability">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Goal Achievement Probability</span>
            <span className="p-1.5 bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl"><Target className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white font-display" aria-label={`${data.goalAchievementProbability} percent probability`}>{data.goalAchievementProbability}%</span>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-slate-100 dark:bg-forest-800 h-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={data.goalAchievementProbability} aria-valuemin={0} aria-valuemax={100} aria-label="Goal probability">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  data.goalAchievementProbability >= 75 ? 'bg-emerald-500' : data.goalAchievementProbability >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${data.goalAchievementProbability}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between" role="region" aria-label="Risk assessment">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Footprint Risk Assessment</span>
            <span className="p-1.5 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl"><AlertTriangle className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div className="mt-4">
            {data.riskAreas.length > 0 ? (
              <div className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <span>{data.riskAreas.length} active risk areas flagged</span>
              </div>
            ) : (
              <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                <span>Healthy - No risk flags</span>
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {data.riskAreas.length > 0 ? 'Log more recycling or walk sessions to offset rising trends.' : 'All category footprints remain within stable levels.'}
          </div>
        </div>
      </section>

      <section className="p-5 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20 border border-sky-100 dark:border-sky-800/60 rounded-3xl" role="region" aria-label="What the forecast means in plain language">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300">What This Means for You</h2>
            <p className="mt-1.5 text-xs font-medium text-sky-700 dark:text-sky-400 leading-relaxed">
              {data.trendDirection === 'decreasing' && (
                <>
                  Your carbon footprint is trending <strong>downward</strong>! Based on your recent logging, you are on track to reduce your monthly footprint by <strong>{Math.abs(data.trendPercentage)}%</strong>. Keep up the great work — your sustainable habits are making a measurable difference. Visit the <a href="/challenges" className="underline font-bold">Challenges</a> page to keep the momentum going.
                </>
              )}
              {data.trendDirection === 'increasing' && (
                <>
                  Your carbon footprint is trending <strong>upward</strong> by <strong>{data.trendPercentage}%</strong>. This forecast helps you see the impact before it grows. Simple actions like choosing public transport, reducing meat intake, or lowering home energy use can reverse this trend. Try the <a href="/simulator" className="underline font-bold">Simulator</a> to model quick changes.
                </>
              )}
              {data.trendDirection === 'stable' && (
                <>
                  Your carbon footprint is holding <strong>steady</strong>. This is a great baseline to improve from. Even small changes — like replacing one car trip with walking or one meat meal with a plant-based option — can shift your trend from stable to decreasing. Ask your <a href="/coach" className="underline font-bold">Eco Coach</a> for personalized tips.
                </>
              )}
            </p>
            <p className="mt-1.5 text-xs text-sky-600 dark:text-sky-500">
              <strong>Remember:</strong> The global sustainable target is <strong>5.5 kg CO₂e per person per day</strong> (IPCC recommendation). Every kg you reduce brings us closer to climate goals.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-[32px] shadow-sm flex flex-col justify-between min-h-[350px] transition-colors duration-200" role="region" aria-label="Carbon projections chart">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">Carbon Projections Chart</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Model showing estimated timeline for next month (kg CO₂e)</p>
          </div>
          <div className="mt-6 flex-1 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorForecast)" name="CO₂e (kg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm space-y-4 transition-colors duration-200" role="region" aria-label="Risk areas">
            <h3 className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Risk Areas Flagged
            </h3>
            {data.riskAreas.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">No category increases flagged. Keep maintaining your low-carbon logs!</p>
            ) : (
              <div className="space-y-3" role="list" aria-label="Risk details">
                {data.riskAreas.map((risk, idx) => (
                  <div key={idx} className="p-3 bg-amber-50/50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl flex gap-2 items-start text-xs font-semibold text-slate-700 dark:text-slate-300" role="listitem">
                    <span className="text-amber-500 mt-0.5" aria-hidden="true">⚠</span>
                    <p className="leading-relaxed font-medium">{risk.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm space-y-4 transition-colors duration-200" role="region" aria-label="Improvement opportunities">
            <h3 className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-forest-500" aria-hidden="true" />
              Eco Recommendations
            </h3>
            <div className="space-y-3" role="list" aria-label="Recommendations">
              {data.improvementOpportunities.map((opp: string, idx: number) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl flex gap-2 items-start text-xs font-semibold text-slate-700 dark:text-slate-300" role="listitem">
                  <span className="text-forest-500" aria-hidden="true">✦</span>
                  <p className="leading-relaxed font-medium text-slate-600 dark:text-slate-400">{opp}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
