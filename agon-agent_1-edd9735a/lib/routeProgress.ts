import { useMemo, useRef } from 'react';
import type { LocationFix, RouteResult, RouteStep, SpeedCamera } from './types';
import { haversineMeters } from './routing';

export interface RouteProgress {
  traveledIndex: number;
  distanceRemainingM: number;
  durationRemainingS: number;
  currentStep: RouteStep | null;
  nextStep: RouteStep | null;
  distanceToManeuverM: number;
  offRouteM: number;
  arrived: boolean;
  camerasAhead: { camera: SpeedCamera; distanceM: number }[];
}

const CUM_CACHE = new WeakMap<RouteResult, number[]>();

function cumulativeDistances(route: RouteResult): number[] {
  const cached = CUM_CACHE.get(route);
  if (cached) return cached;
  const cum = [0];
  for (let i = 1; i < route.coords.length; i++) {
    cum.push(cum[i - 1] + haversineMeters(route.coords[i - 1], route.coords[i]));
  }
  CUM_CACHE.set(route, cum);
  return cum;
}

export function useRouteProgress(route: RouteResult | null, fix: LocationFix | null, cameras: SpeedCamera[]): RouteProgress | null {
  const lastIndexRef = useRef(0);

  return useMemo(() => {
    if (!route || !fix || route.coords.length < 2) {
      lastIndexRef.current = 0;
      return null;
    }
    const coords = route.coords;
    const cum = cumulativeDistances(route);
    const point = { lat: fix.lat, lon: fix.lon };

    const searchStart = Math.max(0, lastIndexRef.current - 15);
    const searchEnd = Math.min(coords.length - 1, lastIndexRef.current + 120);
    let bestIdx = searchStart;
    let bestDist = Infinity;
    for (let i = searchStart; i <= searchEnd; i++) {
      const d = haversineMeters(point, coords[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    lastIndexRef.current = bestIdx;

    const totalDist = cum[cum.length - 1];
    const distanceRemainingM = Math.max(0, totalDist - cum[bestIdx]);
    const progressRatio = totalDist > 0 ? cum[bestIdx] / totalDist : 0;
    const durationRemainingS = Math.max(0, route.durationS * (1 - progressRatio));

    // Find which step this index belongs to.
    let stepIdx = 0;
    for (let s = 0; s < route.stepStartIndex.length; s++) {
      if (route.stepStartIndex[s] <= bestIdx) stepIdx = s;
      else break;
    }
    const currentStep = route.steps[stepIdx] || null;
    const nextStep = route.steps[stepIdx + 1] || null;
    const stepEndIdx = stepIdx + 1 < route.stepStartIndex.length ? route.stepStartIndex[stepIdx + 1] : coords.length - 1;
    const distanceToManeuverM = Math.max(0, cum[stepEndIdx] - cum[bestIdx]);

    const destination = coords[coords.length - 1];
    const arrived = haversineMeters(point, destination) < 25 || bestIdx >= coords.length - 2;

    const camerasAhead = cameras
      .map((camera) => {
        // Approximate camera's position along the route by nearest coord.
        let nearest = Infinity;
        let nearestIdx = -1;
        for (let i = bestIdx; i < coords.length; i += Math.max(1, Math.floor((coords.length - bestIdx) / 200) || 1)) {
          const d = haversineMeters({ lat: camera.lat, lon: camera.lon }, coords[i]);
          if (d < nearest) {
            nearest = d;
            nearestIdx = i;
          }
        }
        if (nearestIdx === -1 || nearest > 60) return null;
        const distanceM = Math.max(0, cum[nearestIdx] - cum[bestIdx]);
        return { camera, distanceM };
      })
      .filter((v): v is { camera: SpeedCamera; distanceM: number } => !!v && v.distanceM < 1500)
      .sort((a, b) => a.distanceM - b.distanceM);

    return {
      traveledIndex: bestIdx,
      distanceRemainingM,
      durationRemainingS,
      currentStep,
      nextStep,
      distanceToManeuverM,
      offRouteM: bestDist,
      arrived,
      camerasAhead,
    };
  }, [route, fix, cameras]);
}
