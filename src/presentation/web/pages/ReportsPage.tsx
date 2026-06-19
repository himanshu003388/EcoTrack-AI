import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../main';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/Skeleton';
import type { ReportSummary } from '../../../application/use-cases/GenerateReport';
import {
  Printer,
  Flame,
  Leaf,
  DollarSign,
  AlertTriangle,
  Copy,
  Check,
  Lightbulb,
  ArrowRight,
  Footprints,
  Target,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchReports = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/reports', {
        headers: token !== null ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const json = (await res.json()) as ReportSummary;
        setData(json);
      } else {
        throw new Error('Failed to retrieve reports data.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const handlePrint = (): void => {
    toast('info', 'Opening print dialog...');
    window.print();
  };

  const handleCopyLink = (): void => {
    if (!data) return;
    setCopied(true);
    const statsText = `EcoTrack AI Carbon Report: I saved ${data.carbonSaved} kg of CO2e and $${data.moneySaved} this month! My log streak is ${data.streak} days. Level: ${data.level}. Track yours at EcoTrackAI.com`;
    void navigator.clipboard.writeText(statsText);
    toast('success', 'Stats copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading reports">
        <div className="h-8 w-48 bg-slate-200 dark:bg-forest-800 animate-pulse rounded" aria-hidden="true"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <span className="sr-only">Loading reports data...</span>
      </div>
    );
  }

  if ((error !== null && error !== '') || !data) {
    return (
      <div
        className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400 rounded-3xl"
        role="alert"
      >
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <p className="font-semibold">Error: {error ?? 'Could not load carbon reports.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 print:p-8 print:bg-white">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Carbon Reports & Impact Card
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Review detailed monthly summaries, export reports, and share your ecological progress.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-forest-700 bg-white dark:bg-forest-900 hover:bg-slate-50 dark:hover:bg-forest-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
            aria-label="Print report"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6 print:w-full" role="region" aria-label="Monthly carbon report details">
          <div
            ref={reportRef}
            className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-8 rounded-[32px] shadow-sm space-y-6 print:border-none print:shadow-none transition-colors duration-200"
          >
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-forest-800 pb-4">
              <div>
                <span className="text-forest-600 dark:text-forest-400 font-bold text-xs uppercase tracking-wider">
                  OFFICIAL CARBON SUMMARY
                </span>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  EcoTrack AI Monthly Report
                </h2>
              </div>
              <div className="text-right">
                <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500">Date Generated</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4" aria-label="Report metrics">
              <div className="p-4 bg-slate-50 dark:bg-forest-800/60 rounded-2xl">
                <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Total Footprint
                </span>
                <span
                  className="text-2xl font-extrabold text-slate-800 dark:text-white font-display"
                  aria-label={`${data.totalEmissions} kilograms CO2 logged`}
                >
                  {data.totalEmissions} kg
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">CO₂e logged</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-forest-800/60 rounded-2xl">
                <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Daily Average
                </span>
                <span
                  className="text-2xl font-extrabold text-slate-800 dark:text-white font-display"
                  aria-label={`${data.averageDaily} kilograms CO2 per day`}
                >
                  {data.averageDaily} kg
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">CO₂e / day</span>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-forest-800/60 rounded-2xl">
                <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Carbon Saved
                </span>
                <span
                  className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-display"
                  aria-label={`${data.carbonSaved} kilograms CO2 saved`}
                >
                  -{data.carbonSaved} kg
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">vs National Average</span>
              </div>
            </div>

            <div className="space-y-3 pt-2" aria-label="Emission breakdown by category">
              <h3 className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Emission Breakdown by Category
              </h3>
              <div className="border border-slate-100 dark:border-forest-800 rounded-2xl overflow-hidden">
                <table
                  className="w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300"
                  role="table"
                  aria-label="Category breakdown table"
                >
                  <thead className="bg-slate-50 dark:bg-forest-800 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-forest-800">
                    <tr>
                      <th scope="col" className="p-3">
                        Category
                      </th>
                      <th scope="col" className="p-3 text-right">
                        Emissions (kg CO₂e)
                      </th>
                      <th scope="col" className="p-3 text-right">
                        Percentage share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-forest-800/60">
                    {data.categoryBreakdown.map((item) => {
                      const sharePct =
                        data.totalEmissions > 0 ? Math.round((item.emissions / data.totalEmissions) * 100) : 0;
                      return (
                        <tr key={item.category}>
                          <td className="p-3 capitalize">{item.category.replace('_', ' ')}</td>
                          <td className="p-3 text-right font-mono">{item.emissions} kg</td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{sharePct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 pt-2" aria-label="Carbon target goals">
              <h3 className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Past Carbon Target Goals
              </h3>
              {data.goals.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No historical target goals set.</p>
              ) : (
                <div
                  className="border border-slate-100 dark:border-forest-800 rounded-2xl overflow-hidden divide-y divide-slate-50 dark:divide-forest-800/60 text-xs"
                  role="list"
                  aria-label="Goal history"
                >
                  {data.goals.map((goal, i) => (
                    <div key={i} className="p-3 flex justify-between items-center font-semibold" role="listitem">
                      <div className="flex gap-2 items-center">
                        <span
                          className={goal.achieved ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}
                          aria-label={goal.achieved ? 'Achieved' : 'Not achieved'}
                        >
                          {goal.achieved ? '✔' : '✖'}
                          <span className="sr-only">{goal.achieved ? 'Goal achieved' : 'Goal not achieved'}</span>
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">
                          Target Goal Limit: {goal.target} kg CO₂e
                        </span>
                      </div>
                      <span className="text-slate-400 dark:text-slate-500 font-mono">Ends: {goal.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="print:hidden space-y-6">
          <div
            className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm flex flex-col gap-6 transition-colors duration-200"
            role="region"
            aria-label="Shareable impact card"
          >
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Shareable Impact Card</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Download or copy stats to inspire your social networks.
              </p>
            </div>

            <div
              className="p-6 bg-gradient-to-br from-forest-600 to-forest-800 text-white rounded-[28px] shadow-xl relative overflow-hidden flex flex-col justify-between aspect-[4/3] max-w-sm mx-auto w-full"
              aria-label={`Impact card for ${user?.username}: ${data.carbonSaved} kg CO2 saved, $${data.moneySaved} saved, ${data.streak} day streak`}
            >
              <div
                className="absolute top-[-20%] left-[-20%] h-36 w-36 rounded-full bg-emerald-400/20 filter blur-xl"
                aria-hidden="true"
              ></div>
              <div
                className="absolute bottom-[-20%] right-[-20%] h-36 w-36 rounded-full bg-sky-400/20 filter blur-xl"
                aria-hidden="true"
              ></div>

              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-1.5">
                  <Leaf className="h-5 w-5 text-emerald-300 fill-emerald-300" aria-hidden="true" />
                  <span className="font-display font-extrabold text-sm tracking-tight">EcoTrack AI</span>
                </div>
                <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 bg-white/10 rounded-full">
                  IMPACT SCORECARD
                </span>
              </div>

              <div className="z-10 py-4 space-y-1">
                <span className="block text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">
                  CARBON CO₂e SAVED
                </span>
                <span
                  className="text-4xl font-extrabold font-display block tracking-tight"
                  aria-label={`${data.carbonSaved} kilograms`}
                >
                  {data.carbonSaved} kg
                </span>
                <div className="flex gap-4 pt-1.5">
                  <span className="text-xs font-semibold text-emerald-100 flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                    Saved: ${data.moneySaved}
                  </span>
                  <span className="text-xs font-semibold text-emerald-100 flex items-center gap-1">
                    <Flame className="h-3 w-3 text-emerald-300 fill-emerald-300" aria-hidden="true" />
                    Streak: {data.streak} Days
                  </span>
                </div>
              </div>

              <div className="z-10 flex justify-between items-end border-t border-white/10 pt-3">
                <div>
                  <span className="block text-[10px] text-emerald-200 font-semibold truncate max-w-40">
                    {user?.username}
                  </span>
                  <span className="text-[9px] text-slate-300 font-medium">{data.level}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-emerald-200 font-semibold">Badges</span>
                  <span className="text-xs font-bold text-emerald-300">{data.badgesCount} Unlocked</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 bg-slate-50 dark:bg-forest-800 hover:bg-slate-100 dark:hover:bg-forest-700 border border-slate-200/50 dark:border-forest-700 hover:border-slate-300 dark:hover:border-forest-600 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2"
                aria-label={copied ? 'Copied to clipboard' : 'Copy shareable stats to clipboard'}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    Copied Stats to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    Copy Shareable Stats
                  </>
                )}
              </button>
            </div>
          </div>

          <div
            className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[32px] shadow-sm space-y-4 transition-colors duration-200"
            role="region"
            aria-label="Your next steps to reduce your footprint"
          >
            <h3 className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="h-4 w-4 text-forest-500" aria-hidden="true" />
              Your Next Steps
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Based on your current report, here are simple actions to keep reducing:
            </p>
            <div className="space-y-2.5">
              <div className="flex gap-2.5 items-start p-3 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl">
                <Footprints className="h-4 w-4 text-forest-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <a
                    href="/tracker"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-forest-600 dark:hover:text-forest-400 transition-colors"
                  >
                    Log a walking commute <ArrowRight className="h-3 w-3 inline" aria-hidden="true" />
                  </a>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Replace one car trip with walking this week — saves ~2 kg CO₂ per trip.
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 items-start p-3 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl">
                <Flame className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <a
                    href="/simulator"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-forest-600 dark:hover:text-forest-400 transition-colors"
                  >
                    Simulate energy savings <ArrowRight className="h-3 w-3 inline" aria-hidden="true" />
                  </a>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Model how reducing energy or car use shrinks your monthly footprint.
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 items-start p-3 bg-slate-50 dark:bg-forest-800/60 border border-slate-100 dark:border-forest-800 rounded-2xl">
                <Lightbulb className="h-4 w-4 text-forest-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <a
                    href="/coach"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-forest-600 dark:hover:text-forest-400 transition-colors"
                  >
                    Ask Eco Coach for personalized tips <ArrowRight className="h-3 w-3 inline" aria-hidden="true" />
                  </a>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Get tailored advice based on your specific activity data and goals.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
