import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { LatLon, PlaceResult, RouteResult, SpeedCamera, TravelMode } from './types';

interface NavState {
  destination: PlaceResult | null;
  mode: TravelMode;
  route: RouteResult | null;
  routeLoading: boolean;
  routeError: string | null;
  routeCameras: SpeedCamera[];
  navigating: boolean;
  setDestination: (p: PlaceResult | null) => void;
  setMode: (m: TravelMode) => void;
  setRoute: (r: RouteResult | null) => void;
  setRouteLoading: (b: boolean) => void;
  setRouteError: (e: string | null) => void;
  setRouteCameras: (c: SpeedCamera[]) => void;
  startNavigation: () => void;
  endNavigation: () => void;
  reset: () => void;
}

const Ctx = createContext<NavState | null>(null);

export function NavStateProvider({ children }: { children: React.ReactNode }) {
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const [mode, setMode] = useState<TravelMode>('car');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeCameras, setRouteCameras] = useState<SpeedCamera[]>([]);
  const [navigating, setNavigating] = useState(false);

  const startNavigation = useCallback(() => setNavigating(true), []);
  const endNavigation = useCallback(() => setNavigating(false), []);
  const reset = useCallback(() => {
    setDestination(null);
    setRoute(null);
    setRouteError(null);
    setRouteCameras([]);
    setNavigating(false);
  }, []);

  const value = useMemo<NavState>(
    () => ({
      destination,
      mode,
      route,
      routeLoading,
      routeError,
      routeCameras,
      navigating,
      setDestination,
      setMode,
      setRoute,
      setRouteLoading,
      setRouteError,
      setRouteCameras,
      startNavigation,
      endNavigation,
      reset,
    }),
    [destination, mode, route, routeLoading, routeError, routeCameras, navigating, startNavigation, endNavigation, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavState(): NavState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNavState must be used within NavStateProvider');
  return ctx;
}

export type { LatLon };
