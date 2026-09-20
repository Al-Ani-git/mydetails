import type { LatLon, RouteResult, RouteStep, TravelMode } from './types';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

const PROFILE_BY_MODE: Record<TravelMode, string> = {
  car: 'driving',
  bus: 'driving',
  cycle: 'cycling',
  walk: 'foot',
};

// Real-world average speed multipliers applied to the OSRM road-network
// duration to reflect how each travel mode actually differs from a car
// on the same road graph (OSRM's public demo only hosts a driving graph).
const DURATION_FACTOR: Record<TravelMode, number> = {
  car: 1,
  bus: 1.55, // stops, boarding, bus lanes/traffic
  cycle: 2.6,
  walk: 7.5,
};

const MANEUVER_VERBS: Record<string, string> = {
  turn: 'Turn',
  'new name': 'Continue onto',
  depart: 'Head out',
  arrive: 'Arrive at your destination',
  merge: 'Merge',
  'on ramp': 'Take the ramp',
  'off ramp': 'Take the exit',
  fork: 'Keep',
  'end of road': 'At the end of the road, turn',
  continue: 'Continue',
  roundabout: 'At the roundabout, take the exit onto',
  rotary: 'At the roundabout, take the exit onto',
  'roundabout turn': 'At the roundabout, turn',
  notification: 'Continue',
  'exit rotary': 'Exit the roundabout onto',
  'exit roundabout': 'Exit the roundabout onto',
};

const MODIFIER_TEXT: Record<string, string> = {
  uturn: 'a U-turn',
  'sharp right': 'sharp right',
  right: 'right',
  'slight right': 'slightly right',
  straight: 'straight ahead',
  'slight left': 'slightly left',
  left: 'left',
  'sharp left': 'sharp left',
};

function stepInstruction(type: string, modifier: string | undefined, roadName: string, exit?: number): string {
  if (type === 'arrive') return 'Arrive at your destination';
  if (type === 'depart') return `Head ${modifier ? MODIFIER_TEXT[modifier] || '' : ''} on ${roadName || 'the road'}`.trim();
  if (type.includes('roundabout') || type === 'rotary') {
    const verb = MANEUVER_VERBS[type] || 'At the roundabout, take the exit onto';
    return `${verb} ${roadName || 'the road'}${exit ? ` (exit ${exit})` : ''}`;
  }
  const verb = MANEUVER_VERBS[type] || 'Continue';
  if (type === 'new name' || type === 'continue') {
    return `${verb} ${roadName || 'the road'}`;
  }
  const mod = modifier ? MODIFIER_TEXT[modifier] : '';
  const road = roadName ? ` onto ${roadName}` : '';
  return `${verb} ${mod}${road}`.replace(/\s+/g, ' ').trim();
}

export async function getRoute(mode: TravelMode, origin: LatLon, destination: LatLon): Promise<RouteResult> {
  const profile = PROFILE_BY_MODE[mode];
  const url = `${OSRM_BASE}/${profile}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing service error (${res.status})`);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes || !json.routes.length) {
    throw new Error('No route could be found between these points.');
  }
  const route = json.routes[0];

  // Build the drawable route line by concatenating each step's own geometry
  // (rather than the separate `overview` polyline) so that step boundaries
  // line up exactly with the coordinate array used for live progress
  // tracking during navigation.
  const steps: RouteStep[] = [];
  const coords: LatLon[] = [];
  const stepStartIndex: number[] = [];
  for (const leg of route.legs) {
    for (const step of leg.steps) {
      const roadName: string = step.name || '';
      const maneuverType: string = step.maneuver.type;
      const modifier: string | undefined = step.maneuver.modifier;
      const exit: number | undefined = step.maneuver.exit;
      const stepCoords: LatLon[] = step.geometry.coordinates.map(([lon, lat]: [number, number]) => ({ lat, lon }));
      stepStartIndex.push(coords.length);
      steps.push({
        instruction: stepInstruction(maneuverType, modifier, roadName, exit),
        maneuverType,
        modifier,
        roadName,
        distanceM: step.distance,
        durationS: step.duration * DURATION_FACTOR[mode],
        coords: stepCoords,
      });
      const start = coords.length > 0 ? 1 : 0; // avoid duplicating the shared boundary point
      coords.push(...stepCoords.slice(start));
    }
  }

  return {
    mode,
    coords,
    distanceM: route.distance,
    durationS: route.duration * DURATION_FACTOR[mode],
    steps,
    stepStartIndex,
  };
}

export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number, unit: 'imperial' | 'metric'): string {
  if (unit === 'imperial') {
    const miles = m / 1609.344;
    if (miles < 0.1) return `${Math.round(m * 3.28084)} ft`;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  if (m < 950) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 1) return '<1 min';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} hr ${m} min`;
}

export function etaClock(seconds: number): string {
  const arrival = new Date(Date.now() + seconds * 1000);
  return arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
