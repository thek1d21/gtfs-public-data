import { useState, useCallback } from 'react';
import { Stop } from '../types/gtfs';

interface JourneyResult {
  id: string;
  fromStop: Stop;
  toStop: Stop;
  routes: Array<{
    route: any;
    fromStop: Stop;
    toStop: Stop;
    departureTime: string;
    arrivalTime: string;
    duration: number;
    stops: Stop[];
  }>;
  totalDuration: number;
  totalDistance: number;
  transfers: number;
  walkingTime: number;
}

interface UseJourneyPlanningReturn {
  selectedJourney: JourneyResult | null;
  handleJourneySelect: (journey: JourneyResult) => void;
  clearJourney: () => void;
}

export const useJourneyPlanning = (): UseJourneyPlanningReturn => {
  const [selectedJourney, setSelectedJourney] = useState<JourneyResult | null>(null);

  const handleJourneySelect = useCallback((journey: JourneyResult) => {
    setSelectedJourney(journey);
  }, []);

  const clearJourney = useCallback(() => {
    setSelectedJourney(null);
  }, []);

  return {
    selectedJourney,
    handleJourneySelect,
    clearJourney
  };
};