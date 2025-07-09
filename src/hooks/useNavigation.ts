import { useState, useCallback } from 'react';

type TabType = 'overview' | 'planner' | 'schedule' | 'calendar' | 'notifications';

interface UseNavigationReturn {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  navigateToTab: (tab: TabType) => void;
}

export const useNavigation = (): UseNavigationReturn => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const navigateToTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  return {
    activeTab,
    setActiveTab,
    navigateToTab
  };
};