export type TravelMode = 'car' | 'bus' | 'cycle' | 'walk';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface LocationFix {
  lat: number;
  lon: number;
  heading: number | null;
  speedMps: number | null;
  accuracyM: number | null;
  timestamp: number;
}

export interface RouteStep {
  instruction: string;
  maneuverType: string;
  modifier?: string;
  roadName: string;
  distanceM: number;
  durationS: number;
  coords: LatLon[];
}

export interface RouteResult {
  mode: TravelMode;
  coords: LatLon[];
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
  /** Index into `coords` where each step begins (same length as `steps`). */
  stepStartIndex: number[];
}

export interface SpeedCamera {
  id: string;
  lat: number;
  lon: number;
  maxspeedText: string | null;
  kind: 'fixed' | 'average' | 'mobile' | 'traffic_signal' | 'unknown';
}

export interface PlaceResult {
  id: string;
  label: string;
  sublabel: string;
  lat: number;
  lon: number;
}

export type UnitSystem = 'imperial' | 'metric';
export type MapTheme = 'night' | 'day' | 'satellite';
