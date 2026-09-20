import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RouteResult, UnitSystem } from '../lib/types';
import { formatDistance, formatDuration, etaClock } from '../lib/routing';
import { colors, radii, shadow } from '../lib/theme';
import PrimaryButton from './PrimaryButton';

interface Props {
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
  unit: UnitSystem;
  destinationLabel: string;
  onStart: () => void;
  onCancel: () => void;
  cameraCount: number;
}

export default function RouteSummarySheet({ route, loading, error, unit, destinationLabel, onStart, onCancel, cameraCount }: Props) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <Ionicons name="flag" size={18} color={colors.accent} />
        <Text style={styles.dest} numberOfLines={1}>{destinationLabel}</Text>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>Fetching live route from OSRM…</Text>
        </View>
      )}

      {!!error && !loading && <Text style={styles.error}>{error}</Text>}

      {route && !loading && !error && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{formatDuration(route.durationS)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{formatDistance(route.distanceM, unit)}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{etaClock(route.durationS)}</Text>
              <Text style={styles.statLabel}>Arrival</Text>
            </View>
          </View>
          {cameraCount > 0 && (
            <View style={styles.camRow}>
              <Ionicons name="camera" size={14} color={colors.warning} />
              <Text style={styles.camText}>{cameraCount} speed camera{cameraCount === 1 ? '' : 's'} on this route</Text>
            </View>
          )}
          <View style={styles.actions}>
            <PrimaryButton label="Start navigation" icon="navigate" onPress={onStart} style={{ flex: 1 }} />
          </View>
        </>
      )}
      <PrimaryButton label="Cancel" variant="ghost" onPress={onCancel} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 18,
    paddingBottom: 28,
    ...shadow,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dest: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  loadingRow: { paddingVertical: 20, alignItems: 'center' },
  loadingText: { color: colors.textSecondary },
  error: { color: colors.danger, marginVertical: 12, fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statBlock: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  camRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.12)', padding: 8, borderRadius: radii.sm, marginBottom: 12 },
  camText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
});
