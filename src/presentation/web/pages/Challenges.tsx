import React, { useState, useEffect } from 'react';
import { useAuth, AppUser } from '../main';
import { useToast } from '../components/Toast';
import { Trophy, Award, Plus, Flame, Zap, Sprout, Shield, Crown } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';
import confetti from 'canvas-confetti';

interface ChallengeItem {
  id: number;
  title: string;
  category: string;
  description: string;
  pointsReward: number;
  co2Target: number;
  durationDays: number;
}

interface JoinedChallenge {
  challengeId: number;
  status: 'active' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  title: string;
  description: string;
  category: string;
  pointsReward: number;
  co2Target: number;
  durationDays: number;
}

export const Challenges: React.FC = () => {
  const { token, user, refreshUser } = useAuth();
  const { toast } = useToast();
  
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [joined, setJoined] = useState<JoinedChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallengesAndBadges = async (): Promise<void> => {
    try {
      const chRes = await fetch('/api/challenges', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (chRes.ok) {
        const json = (await chRes.json()) as { challenges: ChallengeItem[]; joined: JoinedChallenge[] };
        setChallenges(json.challenges);
        setJoined(json.joined);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChallengesAndBadges();
  }, [token]);

  const handleJoin = async (id: number): Promise<void> => {
    try {
      const res = await fetch(`/api/challenges/${id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        toast('success', 'Enrolled in challenge successfully! Track activities matching this category.');
        void fetchChallengesAndBadges();
      } else {
        toast('error', data.error || 'Failed to join challenge.');
      }
    } catch {
      toast('error', 'Failed to join challenge.');
    }
  };

  const handleComplete = async (id: number): Promise<void> => {
    try {
      const res = await fetch(`/api/challenges/${id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        toast('success', 'Congratulations! Challenge completed and points awarded.');
        void confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.7 },
          colors: ['#8b5cf6', '#10b981', '#f59e0b', '#38bdf8']
        });
        void refreshUser();
        void fetchChallengesAndBadges();
      } else {
        toast('error', data.error || 'Failed to complete challenge.');
      }
    } catch {
      toast('error', 'Failed to complete challenge.');
    }
  };

  const badgeCabinet = [
    { id: 1, name: 'First Footprint', desc: 'Log your first carbon activity', icon: Sprout, iconColor: 'text-emerald-500', check: (u: AppUser): boolean => u.points >= 10 },
    { id: 2, name: 'Consistent Tracker', desc: 'Maintain a 3-day log streak', icon: Flame, iconColor: 'text-amber-500', check: (u: AppUser): boolean => u.streak >= 3 },
    { id: 3, name: 'Streak Veteran', desc: 'Maintain a 7-day log streak', icon: Zap, iconColor: 'text-yellow-500', check: (u: AppUser): boolean => u.streak >= 7 },
    { id: 4, name: 'Sapling Status', desc: 'Reach the Sapling XP level', icon: Sprout, iconColor: 'text-forest-500', check: (u: AppUser): boolean => u.points >= 101 },
    { id: 5, name: 'Green Activist', desc: 'Earn 500 environmental points', icon: Shield, iconColor: 'text-emerald-600', check: (u: AppUser): boolean => u.points >= 500 },
    { id: 6, name: 'Climate Champion', desc: 'Reach Climate Hero status', icon: Crown, iconColor: 'text-purple-500', check: (u: AppUser): boolean => u.points >= 1001 }
  ];

  const getNextLevelInfo = (points: number): { next: string; needed: number; progress: number } => {
    if (points >= 1001) return { next: 'Climate Hero (Max)', needed: 0, progress: 100 };
    if (points >= 601) return { next: 'Climate Hero', needed: 1001 - points, progress: Math.round(((points - 600) / 400) * 100) };
    if (points >= 301) return { next: 'Forest Guardian', needed: 601 - points, progress: Math.round(((points - 300) / 300) * 100) };
    if (points >= 101) return { next: 'Tree', needed: 301 - points, progress: Math.round(((points - 100) / 200) * 100) };
    return { next: 'Sapling', needed: 101 - points, progress: Math.round((points / 100) * 100) };
  };

  if (loading || !user) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading challenges">
        <div className="h-8 w-48 bg-slate-200 dark:bg-forest-800 animate-pulse rounded" aria-hidden="true"></div>
        <CardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <span className="sr-only">Loading challenges and achievements...</span>
      </div>
    );
  }

  const nextLevel = getNextLevelInfo(user.points);
  const activeChallenges = joined.filter(j => j.status === 'active');

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Eco Challenges & Achievements
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Complete weekly sustainability challenges, earn points, level up your profile, and collect green badges.
        </p>
      </div>

      <section className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-8 rounded-[32px] shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8 items-center" aria-label="Points progress card">
        <div className="space-y-1">
          <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">Current Tier</span>
          <h2 className="font-display text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="h-8 w-8 text-forest-500 fill-forest-50" aria-hidden="true" />
            <span aria-label={`Current level: ${user.level}`}>{user.level}</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{user.points} XP accumulated</span>
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Progress to {nextLevel.next}</span>
            <span>{nextLevel.needed > 0 ? `${nextLevel.needed} XP needed` : 'Max Level achieved'}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-forest-800 h-3.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={nextLevel.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Level progress: ${nextLevel.progress} percent`}>
            <div
              className="bg-forest-500 h-full rounded-full transition-all duration-300 shadow-inner"
              style={{ width: `${nextLevel.progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500" aria-hidden="true">
            <span>Seedling</span>
            <span>Sapling (100)</span>
            <span>Tree (300)</span>
            <span>Forest Guardian (600)</span>
            <span>Climate Hero (1000)</span>
          </div>
        </div>
      </section>

      <section aria-label="Active challenges" className="space-y-4">
        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trophy className="h-5 w-5 text-forest-500" aria-hidden="true" />
          Active Challenges ({activeChallenges.length})
        </h3>
        {activeChallenges.length === 0 ? (
          <div className="p-6 bg-slate-50 dark:bg-forest-800/60 border border-slate-200/50 dark:border-forest-700 border-dashed rounded-3xl text-center text-slate-400 dark:text-slate-500 text-xs font-semibold">
            No active challenges. Review available options below to start a challenge!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="list" aria-label="Active challenge cards">
            {activeChallenges.map((ch) => {
              const progressPct = Math.round((ch.progress / ch.durationDays) * 100);
              return (
                <div key={ch.challengeId} className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm flex flex-col justify-between gap-4" role="listitem">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-forest-50 dark:bg-forest-800 border border-forest-100 dark:border-forest-700 text-forest-700 dark:text-forest-300 rounded-full uppercase">
                      {ch.category.toUpperCase()}
                    </span>
                    <h4 className="font-display font-bold text-slate-800 dark:text-slate-200 text-base mt-1">{ch.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{ch.description}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span>Log days progress</span>
                      <span>{ch.progress} / {ch.durationDays} days</span>
                    </div>
                    <div className="w-full bg-slate-50 dark:bg-forest-800 border border-slate-100 dark:border-forest-700 h-2.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Challenge progress: ${progressPct} percent`}>
                      <div
                        className="bg-forest-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Reward: +{ch.pointsReward} XP</span>
                    <button
                      onClick={() => { void handleComplete(ch.challengeId); }}
                      className="px-3.5 py-1.5 bg-forest-500 hover:bg-forest-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-forest-500/10"
                      aria-label={`Complete challenge: ${ch.title}`}
                    >
                      Complete Challenge
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Available challenges" className="space-y-4">
        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">Available Challenges</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" role="list" aria-label="Available challenge cards">
          {challenges
            .filter((ch) => !joined.some((j) => j.challengeId === ch.id))
            .map((ch) => (
              <div key={ch.id} className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[200px]" role="listitem">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 dark:bg-forest-800 border border-slate-200/50 dark:border-forest-700 text-slate-500 dark:text-slate-400 rounded-full uppercase">
                    {ch.category.toUpperCase()}
                  </span>
                  <h4 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mt-1.5">{ch.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">{ch.description}</p>
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-slate-50 dark:border-forest-800 mt-4">
                  <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    <span className="block font-bold text-slate-700 dark:text-slate-300">+{ch.pointsReward} XP</span>
                    <span>{ch.durationDays} days</span>
                  </div>
                  <button
                    onClick={() => { void handleJoin(ch.id); }}
                    className="p-2 bg-slate-50 dark:bg-forest-800 hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-600 dark:text-forest-400 border border-slate-100 dark:border-forest-700 rounded-xl hover:border-forest-200 dark:hover:border-forest-600 transition-colors flex items-center justify-center"
                    aria-label={`Enrol in challenge: ${ch.title}`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section aria-label="Badges cabinet" className="space-y-4">
        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="h-5 w-5 text-forest-500" aria-hidden="true" />
          Badges Cabinet
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6" role="list" aria-label="Achievement badges">
          {badgeCabinet.map((badge) => {
            const isEarned = badge.check(user);
            return (
              <div
                key={badge.id}
                className={`p-5 bg-white dark:bg-forest-900 border rounded-3xl shadow-sm text-center flex flex-col items-center justify-between min-h-[140px] transition-all duration-300 ${
                  isEarned
                    ? 'border-forest-100 dark:border-forest-700 bg-white dark:bg-forest-900 ring-1 ring-forest-500/5'
                    : 'border-slate-200/50 dark:border-forest-800 opacity-40 bg-slate-50/50 dark:bg-forest-900/50'
                }`}
                role="listitem"
                aria-label={`Badge: ${badge.name} - ${isEarned ? 'Unlocked' : 'Locked'}`}
              >
                <span className={`block ${isEarned ? badge.iconColor : 'text-slate-300 dark:text-slate-600'}`} aria-hidden="true">
                  <badge.icon className="h-10 w-10" strokeWidth={1.5} />
                </span>
                <div className="mt-3">
                  <span className="block font-display font-bold text-xs text-slate-800 dark:text-slate-200">{badge.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1 leading-snug block">{badge.desc}</span>
                </div>
                {isEarned ? (
                  <span className="mt-2 text-[8px] font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-full uppercase tracking-wider">
                    UNLOCKED
                  </span>
                ) : (
                  <span className="mt-2 text-[8px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-forest-800 border border-slate-200/50 dark:border-forest-700 text-slate-400 dark:text-slate-500 rounded-full uppercase tracking-wider">
                    LOCKED
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
