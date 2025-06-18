import React from 'react';
import { Bus, MapPin } from 'lucide-react';

interface HeaderProps {
  feedInfo?: {
    feed_publisher_name: string;
    feed_version: string;
  };
}

export const Header: React.FC<HeaderProps> = ({ feedInfo }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 p-2 bg-madrid-primary/10 rounded-lg">
              <Bus className="w-6 h-6 text-madrid-primary" />
              <MapPin className="w-5 h-5 text-madrid-secondary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Madrid Transit Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                {feedInfo?.feed_publisher_name || 'CRTM Transit Network'}
              </p>
            </div>
          </div>
          
          {feedInfo?.feed_version && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
              <span>Data Version:</span>
              <span className="font-medium text-gray-900">{feedInfo.feed_version}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};