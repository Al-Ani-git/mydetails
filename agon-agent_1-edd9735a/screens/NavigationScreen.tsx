import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Animated, Easing, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LiveMap from '../components/LiveMap';
import InstructionBanner from '../components/InstructionBanner';
import CameraAlertToast from '../components/CameraAlertToast';
import { useLiveLocation } from '../lib/location';
import { useNavState } from '../lib/navState';
import { useApp } from '../lib/store';
import { useRouteProgress } from '../lib/routeProgress';
import { getRoute, formatDistance, formatDuration, etaClock } from '../lib/routing';
import { getCamerasNearRoute } from '../lib/speedCameras';
import { colors, radii, shadow } from '../lib/theme';
import { iconForMode } from '../lib/navIcons';

const OFF_ROUTE_THRESHOLD_M = 65;
const CAMERA_ALERT_DISTANCE_M = 400;
const { height: SCREEN_H } = Dimensions.get('window');
// Height of the narrow live-location "letterbox" strip shown the instant
// navigation starts, before the view opens up into full turn-by-turn mode.
const INTRO_STRIP_HALF_HEIGHT = 96;

export default function NavigationScreen() {
  const navigation = useNavigation();
  const { fix } = useLiveLocation();
  const app = useApp();
  const navState = useNavState();
  const progress = useRouteProgress(navState.route, fix, navState.routeCameras);

  const [rerouting, setRerouting] = useState(false);
  const lastSpokenStepRef = useRef<string | null>(null);
  const announcedCamerasRef = useRef<Set<string>>(new Set());
  const rerouteLockRef = useRef(false);
  const fixRef = useRef(fix);
  fixRef.current = fix;

  // The single biggest cause of "Start navigation opens a blank page" is the
  // full-screen stack transition finishing *after* Leaflet already measured
  // its container at 0×0. Rather than guessing with timers, we bump this key
  // the exact moment React Navigation reports the screen is focused (i.e.
  // the slide-up transition has completed) and force the map to re-measure
  // and redraw itself full-bleed right then.
  const [resizeSignal, setResizeSignal] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setResizeSignal((n) => n + 1);
      const t = setTimeout(() => setResizeSignal((n) => n + 1), 300);
      return () => clearTimeout(t);
    }, [])
  );

  // Cinematic start-of-navigation transition: rather than snapping straight
  // into the full turn-by-turn UI (which on a slow layout pass can look like
  // a blank page), we first reveal only a narrow strip of the live map
  // centred on the user's real GPS position — proving the location fix is
  // real and live — then that strip opens up into full navigation with
  // turn-by-turn guidance to the next road, exit or junction.
  const [showIntro, setShowIntro] = useState(true);
  const introProgress = useRef(new Animated.Value(0)).current; // 0 = narrow strip, 1 = fully open
  const hasFixOnceRef = useRef(false);
  if (fix) hasFixOnceRef.current = true;

  useEffect(() => {
    // Wait briefly for a real GPS fix so the narrow strip genuinely shows the
    // user's live location rather than an empty map; fall back to opening
    // anyway after a short ceiling so navigation never stalls on a bad fix.
    let cancelled = false;
    const poll = setInterval(() => {
      if (cancelled) return;
      if (hasFixOnceRef.current) {
        clearInterval(poll);
        openNav();
      }
    }, 100);
    const ceiling = setTimeout(openNav, 1800);

    function openNav() {
      if (cancelled) return;
      cancelled = true;
      clearInterval(poll);
      clearTimeout(ceiling);
      Animated.timing(introProgress, {
        toValue: 1,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => setShowIntro(false));
    }

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(ceiling);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barHeight = introProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(0, SCREEN_H / 2 - INTRO_STRIP_HALF_HEIGHT), 0],
  });
  const captionOpacity = introProgress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });

  const endNavigation = useCallback(() => {
    Speech.stop();
    navState.endNavigation();
    navState.reset();
    navigation.goBack();
  }, [navState, navigation]);

  // Voice guidance for the current step.
  useEffect(() => {
    if (!app.voiceGuidance || !progress?.currentStep) return;
    if (progress.distanceToManeuverM < 250 && lastSpokenStepRef.current !== progress.currentStep.instruction) {
      lastSpokenStepRef.current = progress.currentStep.instruction;
      Speech.speak(progress.currentStep.instruction, { language: 'en-GB', rate: 1.0 });
    }
  }, [progress?.currentStep, progress?.distanceToManeuverM, app.voiceGuidance]);

  // Voice + haptic-style alert for upcoming speed cameras.
  useEffect(() => {
    if (!app.cameraAlerts || !progress) return;
    const nearest = progress.camerasAhead[0];
    if (nearest && nearest.distanceM < CAMERA_ALERT_DISTANCE_M && !announcedCamerasRef.current.has(nearest.camera.id)) {
      announcedCamerasRef.current.add(nearest.camera.id);
      if (app.voiceGuidance) {
        Speech.speak(
          `Speed camera ahead${nearest.camera.maxspeedText ? `, limit ${nearest.camera.maxspeedText}` : ''}`,
          { language: 'en-GB' }
        );
      }
    }
  }, [progress?.camerasAhead, app.cameraAlerts, app.voiceGuidance]);

  // Automatic rerouting when the driver deviates from the planned route.
  useEffect(() => {
    if (!progress || !navState.destination || !fix) return;
    if (progress.offRouteM > OFF_ROUTE_THRESHOLD_M && !rerouteLockRef.current) {
      rerouteLockRef.current = true;
      setRerouting(true);
      (async () => {
        try {
          const result = await getRoute(
            navState.mode,
            { lat: fix.lat, lon: fix.lon },
            { lat: navState.destination!.lat, lon: navState.destination!.lon }
          );
          navState.setRoute(result);
          const cams = await getCamerasNearRoute(result.coords);
          navState.setRouteCameras(cams);
          lastSpokenStepRef.current = null;
          if (app.voiceGuidance) Speech.speak('Rerouting', { language: 'en-GB' });
        } catch {
          // keep existing route if rerouting fails; will retry on next deviation tick
        } finally {
          setRerouting(false);
          setTimeout(() => {
            rerouteLockRef.current = false;
          }, 4000);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.offRouteM]);

  // Arrival detection.
  useEffect(() => {
    if (progress?.arrived) {
      Speech.speak('You have arrived at your destination', { language: 'en-GB' });
      Alert.alert('You have arrived', navState.destination?.label || 'Destination reached', [
        { text: 'Done', onPress: endNavigation },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.arrived]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speedMps = fix?.speedMps ?? 0;
  const speedDisplay =
    app.unit === 'imperial' ? `${Math.max(0, Math.round(speedMps * 2.23694))}` : `${Math.max(0, Math.round(speedMps * 3.6))}`;
  const speedUnitLabel = app.unit === 'imperial' ? 'mph' : 'km/h';

  const nearestCameraAhead = progress?.camerasAhead?.[0];
  const showCameraAlert = !!nearestCameraAhead && nearestCameraAhead.distanceM < CAMERA_ALERT_DISTANCE_M;

  // Self-healing map health: if the live tile provider genuinely can't be
  // reached, show a brief "reconnecting" banner and force a fresh retry
  // instead of ever leaving the user staring at a dead "not available" map.
  const [mapDegraded, setMapDegraded] = useState(false);
  const handleMapHealth = useCallback((healthy: boolean) => setMapDegraded(!healthy), []);

  return (
    <View style={styles.container}>
      <LiveMap
        userFix={fix}
        routeCoords={navState.route?.coords || null}
        traveledCount={progress?.traveledIndex}
        destination={navState.destination ? { lat: navState.destination.lat, lon: navState.destination.lon } : null}
        cameras={navState.routeCameras}
        follow
        navigating
        theme={app.mapTheme}
        resizeSignal={resizeSignal}
        onHealthChange={handleMapHealth}
      />

      {mapDegraded && (
        <View style={styles.mapHealthPill}>
          <Ionicons name="cloud-offline" size={14} color="#fff" />
          <Text style={styles.mapHealthText}>Reconnecting live map…</Text>
        </View>
      )}

      {showIntro && (
        <>
          <Animated.View style={[styles.introBar, styles.introBarTop, { height: barHeight }]} pointerEvents="none" />
          <Animated.View style={[styles.introBar, styles.introBarBottom, { height: barHeight }]} pointerEvents="none" />
          {/* Viewfinder-style accent frame around the narrow live-location
              strip — corner brackets + edge lines make it unmistakably a
              deliberate "camera on your real position" reveal, not a
              stalled/blank screen, while it tracks the same reveal animation. */}
          <Animated.View style={[styles.introFrameLine, { top: barHeight }]} pointerEvents="none" />
          <Animated.View style={[styles.introFrameLine, { bottom: barHeight }]} pointerEvents="none" />
          <Animated.View style={[styles.cornerBracket, styles.cornerTL, { top: barHeight, opacity: captionOpacity }]} pointerEvents="none" />
          <Animated.View style={[styles.cornerBracket, styles.cornerTR, { top: barHeight, opacity: captionOpacity }]} pointerEvents="none" />
          <Animated.View style={[styles.cornerBracket, styles.cornerBL, { bottom: barHeight, opacity: captionOpacity }]} pointerEvents="none" />
          <Animated.View style={[styles.cornerBracket, styles.cornerBR, { bottom: barHeight, opacity: captionOpacity }]} pointerEvents="none" />
          <Animated.View style={[styles.introCaptionWrap, { opacity: captionOpacity }]} pointerEvents="none">
            <View style={styles.introDotRow}>
              <View style={[styles.liveDot, !fix && styles.liveDotPending]} />
              <Text style={styles.introCaption}>
                {fix ? 'Live location locked' : 'Finding your live location…'}
              </Text>
            </View>
            <Text style={styles.introSub} numberOfLines={1}>
              Starting {navState.mode} navigation to {navState.destination?.label || 'destination'}
            </Text>
          </Animated.View>
        </>
      )}

      <SafeAreaView style={styles.topSafe} pointerEvents="box-none">
        <InstructionBanner
          step={progress?.currentStep || null}
          distanceToStepM={progress?.distanceToManeuverM || 0}
          unit={app.unit}
          nextStep={progress?.nextStep || null}
        />
        <CameraAlertToast
          visible={showCameraAlert}
          distanceLabel={nearestCameraAhead ? formatDistance(nearestCameraAhead.distanceM, app.unit) : ''}
          speedLimit={nearestCameraAhead?.camera.maxspeedText || null}
        />
      </SafeAreaView>

      {rerouting && (
        <View style={styles.reroutingPill}>
          <Ionicons name="sync" size={14} color="#fff" />
          <Text style={styles.reroutingText}>Rerouting…</Text>
        </View>
      )}

      <View style={styles.speedBadge}>
        <Text style={styles.speedValue}>{speedDisplay}</Text>
        <Text style={styles.speedUnit}>{speedUnitLabel}</Text>
      </View>

      <SafeAreaView style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          <View style={styles.modeTag}>
            <Ionicons name={iconForMode(navState.mode) as any} size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statBig}>{formatDuration(progress?.durationRemainingS ?? navState.route?.durationS ?? 0)}</Text>
            <Text style={styles.statSmall}>{etaClock(progress?.durationRemainingS ?? navState.route?.durationS ?? 0)} arrival</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statBig}>{formatDistance(progress?.distanceRemainingM ?? navState.route?.distanceM ?? 0, app.unit)}</Text>
            <Text style={styles.statSmall}>remaining</Text>
          </View>
          <TouchableOpacity style={styles.endBtn} onPress={endNavigation}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  introBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    zIndex: 40,
  },
  introBarTop: { top: 0 },
  introBarBottom: { bottom: 0 },
  introFrameLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    zIndex: 42,
  },
  cornerBracket: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: colors.accent,
    zIndex: 43,
  },
  cornerTL: { left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cornerBL: { left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cornerBR: { right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  introCaptionWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '50%',
    marginTop: -28,
    zIndex: 41,
    alignItems: 'center',
  },
  introDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  introCaption: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  introSub: { color: colors.textSecondary, fontSize: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveDotPending: { backgroundColor: colors.warning },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  reroutingPill: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    backgroundColor: colors.purple,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...shadow,
  },
  reroutingText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  mapHealthPill: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    backgroundColor: colors.textMuted,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 60,
    ...shadow,
  },
  mapHealthText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  speedBadge: {
    position: 'absolute',
    left: 16,
    bottom: 150,
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.danger,
    ...shadow,
  },
  speedValue: { fontSize: 24, fontWeight: '900', color: '#111' },
  speedUnit: { fontSize: 10, fontWeight: '700', color: '#333', marginTop: -2 },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: radii.lg,
    padding: 16,
    gap: 14,
    ...shadow,
  },
  modeTag: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCol: { flex: 1 },
  statBig: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  statSmall: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  endBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
