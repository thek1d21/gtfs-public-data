import React from 'react';
import { Bus } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Loading Transit Data",
  size = 'lg',
  className = ""
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const containerClasses = size === 'lg' 
    ? "min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"
    : "flex items-center justify-center p-4";

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="text-center">
        <div className="relative">
          <Bus className={`${sizeClasses[size]} text-madrid-primary mx-auto animate-bounce`} />
          <div className={`absolute inset-0 ${sizeClasses[size]} border-4 border-madrid-primary/20 border-t-madrid-primary rounded-full animate-spin mx-auto`}></div>
        </div>
        {size === 'lg' && (
          <>
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {message}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Parsing GTFS data for Madrid's bus network...
            </p>
          </>
        )}
        {size === 'md' && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {message}...
          </p>
        )}
      </div>
    </div>
  );
};