import React from 'react';
import { Bus, MapPin } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  feedInfo?: {
    feed_publisher_name: string;
    feed_version: string;
  };
}

export const Header: React.FC<HeaderProps> = ({ feedInfo }) => {
  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 p-2 bg-madrid-primary/10 dark:bg-madrid-primary/20 rounded-lg">
              <Bus className="w-6 h-6 text-madrid-primary" />
              <MapPin className="w-5 h-5 text-madrid-secondary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Madrid Transit Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {feedInfo?.feed_publisher_name || 'CRTM Transit Network'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {feedInfo?.feed_version && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Data Version:</span>
                <span className="font-medium text-gray-900 dark:text-white">{feedInfo.feed_version}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};