import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = "", 
  width = "100%", 
  height = "1rem" 
}) => {
  return (
    <div 
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={{ width, height }}
    />
  );
};

export const StatsCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <Skeleton className="rounded-lg" width="48px" height="48px" />
        <div className="flex-1">
          <Skeleton width="60%" height="24px" className="mb-2" />
          <Skeleton width="40%" height="16px" className="mb-1" />
          <Skeleton width="80%" height="12px" />
        </div>
      </div>
    </div>
  );
};

export const RouteCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <Skeleton className="rounded-lg" width="32px" height="32px" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton width="60px" height="20px" className="rounded-full" />
            <Skeleton width="40px" height="16px" />
          </div>
          <Skeleton width="90%" height="16px" className="mb-2" />
          <Skeleton width="70%" height="12px" className="mb-3" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton width="100%" height="12px" />
            <Skeleton width="100%" height="12px" />
            <Skeleton width="100%" height="12px" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const MapSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 h-[600px]">
      <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4 animate-pulse"></div>
          <Skeleton width="120px" height="16px" className="mx-auto mb-2" />
          <Skeleton width="200px" height="12px" className="mx-auto" />
        </div>
      </div>
    </div>
  );
};