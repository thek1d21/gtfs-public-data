import { useState, useCallback } from 'react';
import { Route } from '../types/gtfs';

interface UseRouteSelectionReturn {
  selectedRoute: string | undefined;
  selectedRouteDetails: Route | null;
  handleRouteSelect: (routeId: string | undefined) => void;
  handleRouteDetails: (route: Route) => void;
  clearRouteDetails: () => void;
}

export const useRouteSelection = (): UseRouteSelectionReturn => {
  const [selectedRoute, setSelectedRoute] = useState<string | undefined>();
  const [selectedRouteDetails, setSelectedRouteDetails] = useState<Route | null>(null);

  const handleRouteSelect = useCallback((routeId: string | undefined) => {
    setSelectedRoute(routeId);
  }, []);

  const handleRouteDetails = useCallback((route: Route) => {
    setSelectedRouteDetails(route);
  }, []);

  const clearRouteDetails = useCallback(() => {
    setSelectedRouteDetails(null);
  }, []);

  return {
    selectedRoute,
    selectedRouteDetails,
    handleRouteSelect,
    handleRouteDetails,
    clearRouteDetails
  };
};