import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { LatLon, LocationFix, MapTheme, SpeedCamera } from '../lib/types';
import { tileUrlFor, labelsOverlayFor, fallbackTileUrl } from './mapTiles';

// Tracks consecutive tile failures across BOTH the primary source and its
// OSM fallback. If real live map data genuinely can't be reached (not just
// a single flaky tile), we report degraded health upstream so the screen
// can show a transient "reconnecting" indicator and this file can force a
// full layer rebuild — the map is never left silently dead.
function attachTileFallback(layer: any, onHealthChange?: (healthy: boolean) => void) {
  let consecutiveFailures = 0;
  let successTimer: ReturnType<typeof setTimeout> | null = null;
  layer.on('tileload', () => {
    consecutiveFailures = 0;
    onHealthChange?.(true);
  });
  layer.on('tileerror', (e: any) => {
    if (e?.coords && e?.tile) {
      const { z, x, y } = e.coords;
      const fallbackUrl = fallbackTileUrl(z, x, y);
      if (e.tile.src !== fallbackUrl) {
        e.tile.src = fallbackUrl;
        return;
      }
    }
    consecutiveFailures += 1;
    if (consecutiveFailures >= 4) {
      onHealthChange?.(false);
      if (successTimer) clearTimeout(successTimer);
      successTimer = setTimeout(() => layer.redraw(), 1500);
    }
  });
}

export interface LiveMapProps {
  userFix: LocationFix | null;
  routeCoords: LatLon[] | null;
  traveledCount?: number;
  destination: LatLon | null;
  cameras: SpeedCamera[];
  follow: boolean;
  theme: MapTheme;
  navigating?: boolean;
  onMapPress?: (point: LatLon) => void;
  onUserPanStart?: () => void;
  /** Bump this number to force Leaflet to re-measure & redraw full-bleed — used right when a screen transition (e.g. Start navigation) completes. */
  resizeSignal?: number;
  /** Reports true/false as live map tiles succeed/fail to load. */
  onHealthChange?: (healthy: boolean) => void;
}

let leafletCssInjected = false;
function ensureLeafletCss() {
  if (leafletCssInjected || typeof document === 'undefined') return;
  leafletCssInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.innerHTML = `
    .uknp-user-dot { width:22px;height:22px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.35); }
    .uknp-user-arrow { width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:16px solid #3b82f6;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
    .uknp-cam-icon { display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,0.45); }
    .uknp-dest-pin { width:16px;height:16px;border-radius:50% 50% 50% 0;background:#ef4444;border:2px solid #fff;transform:rotate(-45deg); }
    .leaflet-control-attribution { font-size:9px !important; }
  `;
  document.head.appendChild(style);
}

export default function LiveMap({
  userFix,
  routeCoords,
  traveledCount = 0,
  destination,
  cameras,
  follow,
  theme,
  navigating,
  onMapPress,
  onUserPanStart,
  resizeSignal,
  onHealthChange,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const traveledLineRef = useRef<any>(null);
  const camMarkersRef = useRef<Map<string, any>>(new Map());
  const tileLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const onMapPressRef = useRef(onMapPress);
  const onUserPanStartRef = useRef(onUserPanStart);
  const onHealthChangeRef = useRef(onHealthChange);
  onMapPressRef.current = onMapPress;
  onUserPanStartRef.current = onUserPanStart;
  onHealthChangeRef.current = onHealthChange;

  useEffect(() => {
    ensureLeafletCss();
    let mounted = true;
    (async () => {
      const L = await import('leaflet');
      if (!mounted || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, {
        center: [51.5074, -0.1278],
        zoom: 15,
        minZoom: 3,
        zoomControl: false,
        attributionControl: true,
      });
      L.control.scale({ position: 'bottomleft', imperial: true, metric: true }).addTo(map);
      const t = tileUrlFor(theme);
      tileLayerRef.current = L.tileLayer(t.url, {
        attribution: t.attribution,
        subdomains: t.subdomains || 'abc',
        maxZoom: t.maxZoom,
        maxNativeZoom: t.maxNativeZoom,
      }).addTo(map);
      attachTileFallback(tileLayerRef.current, (h) => onHealthChangeRef.current?.(h));
      const labelSpec = labelsOverlayFor(theme);
      if (labelSpec) {
        labelsLayerRef.current = L.tileLayer(labelSpec.url, {
          attribution: labelSpec.attribution,
          maxZoom: labelSpec.maxZoom,
          maxNativeZoom: labelSpec.maxNativeZoom,
          pane: 'shadowPane',
        }).addTo(map);
        attachTileFallback(labelsLayerRef.current);
      }
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      map.on('click', (e: any) => {
        onMapPressRef.current?.({ lat: e.latlng.lat, lon: e.latlng.lng });
      });
      map.on('dragstart', () => onUserPanStartRef.current?.());
      mapRef.current = map;
      readyRef.current = true;

      // Fix for the map rendering as a blank page or a narrow sliver of
      // tiles: Leaflet measures its container's size once at creation time.
      // If that measurement happens before the surrounding flex layout (or a
      // screen-transition animation) has settled — very common the instant
      // the Navigation screen mounts — the map freezes at that undersized
      // viewport forever. A ResizeObserver plus a couple of safety-net
      // timers force Leaflet to re-measure and redraw full-bleed tiles the
      // moment the real layout is ready.
      const forceResize = () => {
        if (mapRef.current) mapRef.current.invalidateSize({ animate: false });
      };
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        resizeObsRef.current = new ResizeObserver(forceResize);
        resizeObsRef.current.observe(containerRef.current);
      }
      forceResize();
      setTimeout(forceResize, 120);
      setTimeout(forceResize, 400);
      setTimeout(forceResize, 900);
      if (typeof window !== 'undefined') window.addEventListener('resize', forceResize);
    })();
    return () => {
      mounted = false;
      if (resizeObsRef.current) {
        resizeObsRef.current.disconnect();
        resizeObsRef.current = null;
      }
      if (typeof window !== 'undefined') {
        // Same handler reference isn't retained across renders, but the
        // observer above is the primary mechanism; window listener is a
        // best-effort fallback that is safe to leave (idempotent no-op if
        // the map is already removed).
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force a fresh re-measure whenever the parent explicitly signals a screen
  // transition just completed (e.g. React Navigation reports the Navigation
  // screen is now focused after "Start navigation" finishes its slide-up) —
  // this is the definitive fix for the map ever appearing blank or as a
  // narrow sliver right after switching screens.
  useEffect(() => {
    if (resizeSignal === undefined || !mapRef.current) return;
    mapRef.current.invalidateSize({ animate: false });
  }, [resizeSignal]);

  // theme change — swap base tiles and keep place-name labels visible at
  // every zoom level, including on the label-free satellite imagery.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }
    const t = tileUrlFor(theme);
    tileLayerRef.current = L.tileLayer(t.url, {
      attribution: t.attribution,
      subdomains: t.subdomains || 'abc',
      maxZoom: t.maxZoom,
      maxNativeZoom: t.maxNativeZoom,
    }).addTo(map);
    attachTileFallback(tileLayerRef.current);
    const labelSpec = labelsOverlayFor(theme);
    if (labelSpec) {
      labelsLayerRef.current = L.tileLayer(labelSpec.url, {
        attribution: labelSpec.attribution,
        maxZoom: labelSpec.maxZoom,
        maxNativeZoom: labelSpec.maxNativeZoom,
        pane: 'shadowPane',
      }).addTo(map);
      attachTileFallback(labelsLayerRef.current);
    }
    map.invalidateSize({ animate: false });
  }, [theme]);

  // user marker + follow
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !userFix) return;
    const heading = userFix.heading ?? 0;
    const html = `<div style="transform: rotate(${heading}deg); display:flex; flex-direction:column; align-items:center;">
        <div class="uknp-user-arrow"></div>
        <div class="uknp-user-dot" style="margin-top:-6px;"></div>
      </div>`;
    const icon = L.divIcon({ html, className: '', iconSize: [30, 40], iconAnchor: [15, 24] });
    const latlng: [number, number] = [userFix.lat, userFix.lon];
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latlng);
      userMarkerRef.current.setIcon(icon);
    }
    if (follow) {
      map.setView(latlng, navigating ? 17 : map.getZoom(), { animate: true, duration: 0.2 });
    }
  }, [userFix, follow, navigating]);

  // destination marker
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
    if (destination) {
      const icon = L.divIcon({ html: '<div class="uknp-dest-pin"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 14] });
      destMarkerRef.current = L.marker([destination.lat, destination.lon], { icon }).addTo(map);
    }
  }, [destination]);

  // route polyline
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (traveledLineRef.current) {
      map.removeLayer(traveledLineRef.current);
      traveledLineRef.current = null;
    }
    if (routeCoords && routeCoords.length > 1) {
      const latlngs = routeCoords.map((c) => [c.lat, c.lon]) as [number, number][];
      routeLineRef.current = L.polyline(latlngs, { color: '#3b82f6', weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(map);
      if (traveledCount > 1) {
        const traveled = latlngs.slice(0, traveledCount);
        traveledLineRef.current = L.polyline(traveled, { color: '#64748b', weight: 6, opacity: 0.8, lineCap: 'round' }).addTo(map);
      }
      if (!follow) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60] });
      }
    }
  }, [routeCoords, traveledCount, follow]);

  // camera markers
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const existing = camMarkersRef.current;
    const nextIds = new Set(cameras.map((c) => c.id));
    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        map.removeLayer(marker);
        existing.delete(id);
      }
    }
    for (const cam of cameras) {
      if (existing.has(cam.id)) continue;
      const color = cam.kind === 'average' ? '#f59e0b' : cam.kind === 'fixed' ? '#ef4444' : '#a855f7';
      const html = `<div class="uknp-cam-icon" style="background:${color};">📷</div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [26, 26], iconAnchor: [13, 13] });
      const marker = L.marker([cam.lat, cam.lon], { icon });
      marker.bindTooltip(cam.maxspeedText ? `Speed camera • ${cam.maxspeedText}` : 'Speed camera', { direction: 'top' });
      marker.addTo(map);
      existing.set(cam.id, marker);
    }
  }, [cameras]);

  return (
    <View style={styles.container}>
      {/* @ts-ignore web-only div host for leaflet */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' },
});
