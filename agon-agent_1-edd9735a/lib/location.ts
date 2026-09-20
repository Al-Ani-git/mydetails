import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { LocationFix } from './types';

// Refresh tick used to re-render consumers at a smooth cadence.
// Real GPS chips typically report fixes at ~1Hz (sometimes faster with
// BestForNavigation). To honour the "0.2s tracking" requirement we run a
// 200ms UI clock that (a) applies the latest REAL fix the instant it
// arrives from the OS/browser, and (b) between real fixes, dead-reckons
// the marker forward using the device's OWN last-known heading & speed
// (v * dt) — never random jitter — so movement stays smooth and 100%
// derived from real sensor data.
export const LOCATION_REFRESH_MS = 200;

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

interface LiveLocationState {
  fix: LocationFix | null;
  rawFix: LocationFix | null;
  permission: PermissionState;
  errorMsg: string | null;
  accuracyLabel: string;
}

const EARTH_R = 6371000;

function metersToDegLat(m: number) {
  return (m / EARTH_R) * (180 / Math.PI);
}
function metersToDegLon(m: number, atLat: number) {
  return (m / (EARTH_R * Math.cos((atLat * Math.PI) / 180))) * (180 / Math.PI);
}

export function useLiveLocation() {
  const [state, setState] = useState<LiveLocationState>({
    fix: null,
    rawFix: null,
    permission: 'unknown',
    errorMsg: null,
    accuracyLabel: 'Acquiring GPS…',
  });

  const rawFixRef = useRef<LocationFix | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchSubRef = useRef<{ remove: () => void } | null>(null);

  const applyDeadReckon = useCallback(() => {
    const raw = rawFixRef.current;
    if (!raw) return;
    const now = Date.now();
    const dtS = (now - raw.timestamp) / 1000;
    let { lat, lon } = raw;
    if (raw.speedMps && raw.speedMps > 0.3 && raw.heading !== null && dtS > 0 && dtS < 8) {
      const dist = raw.speedMps * dtS;
      const headRad = (raw.heading * Math.PI) / 180;
      lat = raw.lat + metersToDegLat(dist * Math.cos(headRad));
      lon = raw.lon + metersToDegLon(dist * Math.sin(headRad), raw.lat);
    }
    setState((s) => ({
      ...s,
      fix: {
        lat,
        lon,
        heading: raw.heading,
        speedMps: raw.speedMps,
        accuracyM: raw.accuracyM,
        timestamp: now,
      },
      accuracyLabel:
        raw.accuracyM != null
          ? `±${Math.round(raw.accuracyM)}m GPS accuracy`
          : 'GPS accuracy unknown',
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (Platform.OS === 'web') {
        if (!('geolocation' in navigator)) {
          setState((s) => ({ ...s, permission: 'unsupported', errorMsg: 'Geolocation not supported by this browser.' }));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          () => {
            if (cancelled) return;
            setState((s) => ({ ...s, permission: 'granted' }));
            const watchId = navigator.geolocation.watchPosition(
              (pos) => {
                rawFixRef.current = {
                  lat: pos.coords.latitude,
                  lon: pos.coords.longitude,
                  heading: pos.coords.heading,
                  speedMps: pos.coords.speed,
                  accuracyM: pos.coords.accuracy,
                  timestamp: Date.now(),
                };
                setState((s) => ({ ...s, rawFix: rawFixRef.current }));
              },
              (err) => {
                setState((s) => ({ ...s, errorMsg: err.message, permission: err.code === 1 ? 'denied' : s.permission }));
              },
              { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
            );
            watchSubRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
          },
          (err) => {
            setState((s) => ({ ...s, permission: err.code === 1 ? 'denied' : s.permission, errorMsg: err.message }));
          },
          { enableHighAccuracy: true, timeout: 15000 }
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setState((s) => ({ ...s, permission: 'denied', errorMsg: 'Location permission denied. Enable it in Settings to track your real position.' }));
        return;
      }
      setState((s) => ({ ...s, permission: 'granted' }));

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: LOCATION_REFRESH_MS,
          distanceInterval: 0,
        },
        (loc) => {
          rawFixRef.current = {
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            heading: loc.coords.heading,
            speedMps: loc.coords.speed,
            accuracyM: loc.coords.accuracy,
            timestamp: Date.now(),
          };
          setState((s) => ({ ...s, rawFix: rawFixRef.current }));
        }
      );
      if (cancelled) {
        sub.remove();
        return;
      }
      watchSubRef.current = sub;
    }

    start();
    tickRef.current = setInterval(applyDeadReckon, LOCATION_REFRESH_MS);

    return () => {
      cancelled = true;
      if (tickRef.current) clearInterval(tickRef.current);
      if (watchSubRef.current) watchSubRef.current.remove();
    };
  }, [applyDeadReckon]);

  return state;
}
