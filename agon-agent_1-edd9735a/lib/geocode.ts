import type { LatLon, PlaceResult } from './types';

// UK bounding box used to bias/limit results to the United Kingdom.
export const UK_BBOX = { west: -8.65, south: 49.85, east: 1.85, north: 60.9 };

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

function buildLabel(props: any): { label: string; sublabel: string } {
  const name = props.name || props.street || props.housenumber || 'Unnamed place';
  const parts = [props.street, props.city || props.town || props.village, props.county, props.postcode, props.country]
    .filter((p, idx, arr) => p && arr.indexOf(p) === idx && p !== name);
  return { label: name, sublabel: parts.join(', ') };
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=${UK_BBOX.west},${UK_BBOX.south},${UK_BBOX.east},${UK_BBOX.north}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const json = await res.json();
    const feats: any[] = json.features || [];
    return feats.map((f, i) => {
      const [lon, lat] = f.geometry.coordinates;
      const { label, sublabel } = buildLabel(f.properties || {});
      return { id: `${f.properties?.osm_id ?? i}-${lat}-${lon}`, label, sublabel, lat, lon };
    });
  } catch (e) {
    return [];
  }
}

export async function reverseGeocode(point: LatLon): Promise<string> {
  try {
    const url = `${NOMINATIM_URL}/reverse?format=json&lat=${point.lat}&lon=${point.lon}&zoom=17&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-GB' } });
    if (!res.ok) throw new Error('reverse geocode failed');
    const json = await res.json();
    return json.display_name || `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
  } catch {
    return `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
  }
}
