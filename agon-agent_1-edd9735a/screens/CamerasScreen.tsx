import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveLocation } from '../lib/location';
import { getSpeedCamerasInBounds, boundsFromCoords } from '../lib/speedCameras';
import { haversineMeters, formatDistance } from '../lib/routing';
import { useApp } from '../lib/store';
import { colors, radii, shadow } from '../lib/theme';
import type { SpeedCamera } from '../lib/types';

const KIND_META: Record<SpeedCamera['kind'], { label: string; color: string; icon: string }> = {
  fixed: { label: 'Fixed camera', color: colors.danger, icon: 'camera' },
  average: { label: 'Average-speed zone', color: colors.warning, icon: 'speedometer' },
  mobile: { label: 'Mobile enforcement', color: colors.purple, icon: 'camera-outline' },
  traffic_signal: { label: 'Traffic enforcement', color: colors.accent, icon: 'alert-circle' },
  unknown: { label: 'Speed enforcement', color: colors.textSecondary, icon: 'camera' },
};

export default function CamerasScreen() {
  const { fix } = useLiveLocation();
  const app = useApp();
  const [cameras, setCameras] = useState<SpeedCamera[]>([]);
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(8);

  const load = useCallback(async () => {
    if (!fix) return;
    setLoading(true);
    const padDeg = radiusKm / 111;
    const bounds = boundsFromCoords([{ lat: fix.lat, lon: fix.lon }], padDeg);
    const cams = await getSpeedCamerasInBounds(bounds);
    setCameras(cams);
    setLoading(false);
  }, [fix, radiusKm]);

  useEffect(() => {
    load();
  }, [load]);

  const withDistance = cameras
    .map((c) => ({ camera: c, distanceM: fix ? haversineMeters({ lat: fix.lat, lon: fix.lon }, { lat: c.lat, lon: c.lon }) : 0 }))
    .sort((a, b) => a.distanceM - b.distanceM);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>UK Speed Cameras</Text>
        <Text style={styles.subtitle}>Live OpenStreetMap enforcement data near you</Text>
      </View>

      <View style={styles.radiusRow}>
        {[5, 8, 15, 25].map((r) => (
          <TouchableOpacity key={r} style={[styles.radiusChip, radiusKm === r && styles.radiusChipActive]} onPress={() => setRadiusKm(r)}>
            <Text style={[styles.radiusText, radiusKm === r && styles.radiusTextActive]}>{r} km</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!fix && (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.emptyText}>Waiting for your live location…</Text>
        </View>
      )}

      {fix && (
        <FlatList
          data={withDistance}
          keyExtractor={(item) => item.camera.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                <Text style={styles.emptyText}>No known speed cameras within {radiusKm} km</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const meta = KIND_META[item.camera.kind];
            return (
              <View style={styles.card}>
                <View style={[styles.iconCircle, { backgroundColor: meta.color }]}>
                  <Ionicons name={meta.icon as any} size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{meta.label}</Text>
                  <Text style={styles.cardSub}>
                    {item.camera.maxspeedText ? `Limit ${item.camera.maxspeedText} • ` : ''}
                    {item.camera.lat.toFixed(4)}, {item.camera.lon.toFixed(4)}
                  </Text>
                </View>
                <Text style={styles.distance}>{formatDistance(item.distanceM, app.unit)}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  radiusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 14, marginBottom: 6 },
  radiusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  radiusChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  radiusText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  radiusTextActive: { color: '#fff' },
  list: { padding: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 4,
    ...shadow,
  },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardSub: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  distance: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
