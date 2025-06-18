import React from 'react';
import { Bus } from 'lucide-react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <Bus className="w-12 h-12 text-madrid-primary mx-auto animate-bounce" />
          <div className="absolute inset-0 w-12 h-12 border-4 border-madrid-primary/20 border-t-madrid-primary rounded-full animate-spin mx-auto"></div>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Loading Transit Data
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Parsing GTFS data for Madrid's bus network...
        </p>
      </div>
    </div>
  );
};