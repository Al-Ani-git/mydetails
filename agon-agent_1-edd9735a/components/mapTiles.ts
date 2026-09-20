import type { MapTheme } from '../lib/types';

export interface TileSpec {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  maxNativeZoom?: number;
}

export function tileUrlFor(theme: MapTheme): TileSpec {
  if (theme === 'night') {
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    };
  }
  if (theme === 'satellite') {
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
      // Esri's imagery source tops out around z19 in most of the UK — letting
      // Leaflet upscale beyond that (maxZoom > maxNativeZoom) keeps the map
      // filled with (slightly softened) imagery instead of ever going blank
      // or "not available" when the user zooms all the way in.
      maxZoom: 20,
      maxNativeZoom: 19,
    };
  }
  return {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  };
}

/**
 * Fallback raster tile used when a primary tile request fails (rate limit,
 * transient network blip, etc.). Swapping to this instead of leaving the
 * tile blank means the map never shows a grey "not available" hole at any
 * zoom level — it always has *something* real to display.
 */
export function fallbackTileUrl(z: number, x: number, y: number): string {
  const sub = ['a', 'b', 'c'][(x + y) % 3];
  return `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/**
 * Place-name / road-name / boundary label overlay.
 * The CARTO day & night basemaps already bake in labels, but the Esri
 * satellite imagery is label-free — so on satellite we stack this
 * transparent reference layer on top to keep every town, road and
 * junction clearly named and highlighted at every zoom level.
 */
export function labelsOverlayFor(theme: MapTheme): TileSpec | null {
  if (theme !== 'satellite') return null;
  return {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Labels © Esri',
    maxZoom: 20,
    maxNativeZoom: 19,
  };
}
