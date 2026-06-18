import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse rounded bg-slate-200 dark:bg-forest-800 ${className}`} aria-hidden="true" />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl space-y-4" aria-hidden="true">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex items-end gap-2 h-48 pt-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-3xl space-y-4" aria-hidden="true">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-forest-800">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between items-center py-2">
            <div className="flex gap-3 items-center">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
