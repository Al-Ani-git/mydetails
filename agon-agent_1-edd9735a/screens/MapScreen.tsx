import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import LiveMap from '../components/LiveMap';
import ModeSelector from '../components/ModeSelector';
import RouteSummarySheet from '../components/RouteSummarySheet';
import SearchResultItem from '../components/SearchResultItem';
import { useLiveLocation } from '../lib/location';
import { useNavState } from '../lib/navState';
import { useApp } from '../lib/store';
import { getRoute } from '../lib/routing';
import { getCamerasNearRoute, getSpeedCamerasInBounds, boundsFromCoords } from '../lib/speedCameras';
import { reverseGeocode } from '../lib/geocode';
import { colors, radii, shadow } from '../lib/theme';
import type { RootStackParamList } from '../lib/navTypes';
import type { SpeedCamera, MapTheme } from '../lib/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const THEME_CYCLE: MapTheme[] = ['night', 'day', 'satellite'];

export default function MapScreen() {
  const navigation = useNavigation<Nav>();
  const { fix, permission, errorMsg, accuracyLabel } = useLiveLocation();
  const app = useApp();
  const navState = useNavState();

  const [follow, setFollow] = useState(true);
  const [nearbyCameras, setNearbyCameras] = useState<SpeedCamera[]>([]);
  const fixRef = useRef(fix);
  fixRef.current = fix;

  // Fetch real OSM speed cameras around the user's live position periodically.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const f = fixRef.current;
      if (!f) return;
      const bounds = boundsFromCoords([{ lat: f.lat, lon: f.lon }], 0.045);
      const cams = await getSpeedCamerasInBounds(bounds);
      if (!cancelled) setNearbyCameras(cams);
    }
    load();
    const id = setInterval(load, 45000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [!!fix]);

  const fetchRouteFor = useCallback(async () => {
    const dest = navState.destination;
    const f = fixRef.current;
    if (!dest || !f) return;
    navState.setRouteLoading(true);
    navState.setRouteError(null);
    try {
      const result = await getRoute(navState.mode, { lat: f.lat, lon: f.lon }, { lat: dest.lat, lon: dest.lon });
      navState.setRoute(result);
      setFollow(false);
      const cams = await getCamerasNearRoute(result.coords);
      navState.setRouteCameras(cams);
    } catch (e: any) {
      navState.setRouteError(e?.message || 'Could not calculate a route. Check your connection.');
      navState.setRoute(null);
    } finally {
      navState.setRouteLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState.destination, navState.mode]);

  useEffect(() => {
    if (navState.destination) fetchRouteFor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState.destination, navState.mode]);

  const handleMapPress = useCallback(
    async (pt: { lat: number; lon: number }) => {
      const label = await reverseGeocode(pt);
      navState.setDestination({ id: 'tap', label: label.split(',')[0], sublabel: label, lat: pt.lat, lon: pt.lon });
    },
    [navState]
  );

  const handleStart = useCallback(() => {
    if (navState.destination) app.addRecent(navState.destination);
    navState.startNavigation();
    navigation.navigate('Navigation');
  }, [navState, navigation, app]);

  const handleCancel = useCallback(() => {
    navState.reset();
    setFollow(true);
  }, [navState]);

  const cycleTheme = useCallback(() => {
    const idx = THEME_CYCLE.indexOf(app.mapTheme);
    app.setMapTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  }, [app]);

  const camerasToShow = navState.route ? navState.routeCameras : nearbyCameras;

  return (
    <View style={styles.container}>
      <LiveMap
        userFix={fix}
        routeCoords={navState.route?.coords || null}
        destination={navState.destination}
        cameras={camerasToShow}
        follow={follow}
        theme={app.mapTheme}
        onMapPress={handleMapPress}
        onUserPanStart={() => setFollow(false)}
      />

      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        {!navState.destination && (
          <TouchableOpacity style={styles.searchBar} activeOpacity={0.85} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <Text style={styles.searchPlaceholder}>Where to?</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.themeBtn} onPress={cycleTheme}>
          <Ionicons
            name={app.mapTheme === 'night' ? 'moon' : app.mapTheme === 'day' ? 'sunny' : 'earth'}
            size={20}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </SafeAreaView>

      {permission === 'denied' && (
        <View style={styles.permBanner}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={styles.permText}>Location permission needed for your real position — enable it in system settings.</Text>
        </View>
      )}

      {!fix && permission !== 'denied' && (
        <View style={styles.acquiring}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.acquiringText}>Acquiring live GPS signal…</Text>
        </View>
      )}

      {fix && !navState.destination && (
        <View style={styles.accuracyPill}>
          <View style={styles.liveDot} />
          <Text style={styles.accuracyText}>{accuracyLabel} • updating 5×/sec</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.recenterBtn, { bottom: navState.destination ? 260 : 120 }]}
        onPress={() => setFollow(true)}
      >
        <Ionicons name="locate" size={22} color={follow ? colors.accent : colors.textPrimary} />
      </TouchableOpacity>

      {!navState.destination && app.recents.length > 0 && (
        <View style={styles.recentsPanel}>
          <Text style={styles.recentsTitle}>Recent destinations</Text>
          {app.recents.slice(0, 3).map((p) => (
            <SearchResultItem
              key={p.id}
              place={p}
              icon="time-outline"
              onPress={(place) => navState.setDestination(place)}
            />
          ))}
        </View>
      )}

      {navState.destination && (
        <View style={styles.bottomWrap}>
          <View style={styles.modeWrap}>
            <ModeSelector value={navState.mode} onChange={navState.setMode} />
          </View>
          <RouteSummarySheet
            route={navState.route}
            loading={navState.routeLoading}
            error={navState.routeError}
            unit={app.unit}
            destinationLabel={navState.destination.label}
            onStart={handleStart}
            onCancel={handleCancel}
            cameraCount={navState.routeCameras.length}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 4,
    gap: 10,
    alignItems: 'flex-start',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...shadow,
  },
  searchPlaceholder: { color: colors.textSecondary, fontSize: 15 },
  themeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  permBanner: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  permText: { color: '#fff', flex: 1, fontSize: 12, fontWeight: '600' },
  acquiring: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    ...shadow,
  },
  acquiringText: { color: colors.textSecondary, fontSize: 13 },
  accuracyPill: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    ...shadow,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  accuracyText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  recentsPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    ...shadow,
  },
  recentsTitle: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, fontWeight: '700' },
  bottomWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modeWrap: { paddingHorizontal: 16, marginBottom: 10 },
});
