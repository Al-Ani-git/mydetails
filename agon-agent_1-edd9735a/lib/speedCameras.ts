import type { LatLon, SpeedCamera } from './types';

// Overpass mirrors tried in order — real, live, crowd-sourced OpenStreetMap
// data (the same open dataset used by many real navigation apps for camera
// enforcement locations across the UK).
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function boundsFromCoords(coords: LatLon[], padDeg = 0.03): Bounds {
  let south = 90, north = -90, west = 180, east = -180;
  for (const c of coords) {
    south = Math.min(south, c.lat);
    north = Math.max(north, c.lat);
    west = Math.min(west, c.lon);
    east = Math.max(east, c.lon);
  }
  return { south: south - padDeg, north: north + padDeg, west: west - padDeg, east: east + padDeg };
}

function classify(tags: Record<string, string>): SpeedCamera['kind'] {
  if (tags.enforcement === 'average_speed' || tags.maxspeed_type === 'average') return 'average';
  if (tags.enforcement === 'maxspeed' || tags.highway === 'speed_camera') return 'fixed';
  if (tags.traffic_calming) return 'traffic_signal';
  return 'unknown';
}

async function runOverpassQuery(query: string): Promise<any> {
  let lastErr: any = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = await res.json();
      if (json && Array.isArray(json.elements)) return json;
      throw new Error('Malformed Overpass response');
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error('All Overpass endpoints failed');
}

export async function getSpeedCamerasInBounds(b: Bounds): Promise<SpeedCamera[]> {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const query = `[out:json][timeout:20];(
    node["highway"="speed_camera"](${bbox});
    node["enforcement"="maxspeed"](${bbox});
    node["enforcement"="average_speed"](${bbox});
  );out body 300;`;
  try {
    const json = await runOverpassQuery(query);
    const seen = new Set<string>();
    const cams: SpeedCamera[] = [];
    for (const el of json.elements) {
      if (el.type !== 'node') continue;
      const id = `osm-${el.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const tags = el.tags || {};
      cams.push({
        id,
        lat: el.lat,
        lon: el.lon,
        maxspeedText: tags.maxspeed || null,
        kind: classify(tags),
      });
    }
    return cams;
  } catch (e) {
    return [];
  }
}

export async function getCamerasNearRoute(coords: LatLon[]): Promise<SpeedCamera[]> {
  if (!coords.length) return [];
  // Sample the route to keep the bbox tight but still cover the whole path.
  const sampled = coords.filter((_, i) => i % Math.max(1, Math.floor(coords.length / 40)) === 0);
  const bounds = boundsFromCoords(sampled, 0.01);
  return getSpeedCamerasInBounds(bounds);
}
