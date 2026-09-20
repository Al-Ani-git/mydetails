import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// react-native-webview's TS types don't line up cleanly with React 19's
// JSX typings in this Expo SDK; the component itself works fine at runtime.
const AnyWebView = WebView as unknown as React.ComponentType<any>;
import type { LatLon, LocationFix, MapTheme, SpeedCamera } from '../lib/types';
import { NATIVE_MAP_HTML } from './nativeMapHtml';

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
  /** Bump this number to force the map to re-measure & redraw full-bleed — used right when a screen transition (e.g. Start navigation) completes. */
  resizeSignal?: number;
  /** Reports true/false as live map tiles succeed/fail to load. */
  onHealthChange?: (healthy: boolean) => void;
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
  const webRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const run = useCallback(
    (js: string) => {
      if (ready) webRef.current?.injectJavaScript(js + '; true;');
    },
    [ready]
  );

  const onMessage = useCallback(
    (e: any) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === 'ready') setReady(true);
        if (data.type === 'click') onMapPress?.({ lat: data.lat, lon: data.lon });
        if (data.type === 'pan') onUserPanStart?.();
        if (data.type === 'health') onHealthChange?.(!!data.healthy);
      } catch {
        // ignore
      }
    },
    [onMapPress, onUserPanStart, onHealthChange]
  );

  useEffect(() => {
    run(`window.uknp.setTheme(${JSON.stringify(theme)})`);
  }, [theme, run]);

  useEffect(() => {
    if (!userFix) return;
    run(`window.uknp.setUser(${userFix.lat}, ${userFix.lon}, ${userFix.heading ?? 0})`);
  }, [userFix, run]);

  useEffect(() => {
    run(`window.uknp.setFollow(${follow}, ${!!navigating}, ${userFix ? userFix.lat : 'null'}, ${userFix ? userFix.lon : 'null'})`);
  }, [follow, navigating, userFix, run]);

  useEffect(() => {
    run(`window.uknp.setDestination(${destination ? destination.lat : 'null'}, ${destination ? destination.lon : 'null'})`);
  }, [destination, run]);

  useEffect(() => {
    const coords = (routeCoords || []).map((c) => [c.lat, c.lon]);
    run(`window.uknp.setRoute(${JSON.stringify(coords)}, ${traveledCount}, ${follow})`);
  }, [routeCoords, traveledCount, follow, run]);

  useEffect(() => {
    run(`window.uknp.setCameras(${JSON.stringify(cameras)})`);
  }, [cameras, run]);

  // Native WebKit/Android WebView frame resizes don't reliably fire a DOM
  // 'resize' event inside the page, which is exactly what produces a blank
  // page or a narrow sliver of map the instant this component mounts full
  // -screen on the Navigation screen. Forcing Leaflet to re-measure itself
  // whenever the RN layout actually changes (and once more right after the
  // page reports ready) guarantees the map always fills the screen.
  const forceInvalidate = useCallback(() => {
    run('window.uknp && window.uknp.invalidateSize && window.uknp.invalidateSize()');
  }, [run]);

  useEffect(() => {
    if (!ready) return;
    forceInvalidate();
    const t1 = setTimeout(forceInvalidate, 150);
    const t2 = setTimeout(forceInvalidate, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, forceInvalidate]);

  // Definitive fix for "Start navigation opens a blank page": re-measure the
  // instant the parent screen reports its transition has actually finished
  // (React Navigation's focus event), rather than guessing with timers.
  useEffect(() => {
    if (resizeSignal === undefined) return;
    forceInvalidate();
  }, [resizeSignal, forceInvalidate]);

  return (
    <View style={styles.container} onLayout={forceInvalidate}>
      <AnyWebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: NATIVE_MAP_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#0B1220' },
  webview: { flex: 1, backgroundColor: '#0B1220' },
});
