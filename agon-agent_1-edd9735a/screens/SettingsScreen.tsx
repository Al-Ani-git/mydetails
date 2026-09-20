import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, SafeAreaView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../lib/store';
import { useLiveLocation, LOCATION_REFRESH_MS } from '../lib/location';
import { colors, radii, shadow } from '../lib/theme';
import type { MapTheme, UnitSystem } from '../lib/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  right,
  onPress,
}: {
  icon: string;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon as any} size={18} color={colors.accent} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {right}
    </Wrapper>
  );
}

export default function SettingsScreen() {
  const app = useApp();
  const { permission, accuracyLabel } = useLiveLocation();

  const unitOptions: { value: UnitSystem; label: string }[] = [
    { value: 'imperial', label: 'Miles / mph' },
    { value: 'metric', label: 'Km / km-h' },
  ];
  const themeOptions: { value: MapTheme; label: string; icon: string }[] = [
    { value: 'night', label: 'Night', icon: 'moon' },
    { value: 'day', label: 'Day', icon: 'sunny' },
    { value: 'satellite', label: 'Satellite', icon: 'earth' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <Section title="Live tracking">
          <Row
            icon="pulse"
            label="GPS refresh loop"
            right={<Text style={styles.rowValue}>{LOCATION_REFRESH_MS}ms (5×/sec)</Text>}
          />
          <Row
            icon="locate"
            label="Location permission"
            right={
              <Text style={[styles.rowValue, { color: permission === 'granted' ? colors.success : colors.danger }]}>
                {permission === 'granted' ? 'Granted' : permission === 'denied' ? 'Denied' : 'Pending'}
              </Text>
            }
          />
          <Row icon="analytics" label="Current accuracy" right={<Text style={styles.rowValue}>{accuracyLabel}</Text>} />
        </Section>

        <Section title="Units">
          <View style={styles.chipRow}>
            {unitOptions.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[styles.chip, app.unit === o.value && styles.chipActive]}
                onPress={() => app.setUnit(o.value)}
              >
                <Text style={[styles.chipText, app.unit === o.value && styles.chipTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title="Map style">
          <View style={styles.chipRow}>
            {themeOptions.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[styles.chip, app.mapTheme === o.value && styles.chipActive]}
                onPress={() => app.setMapTheme(o.value)}
              >
                <Ionicons name={o.icon as any} size={14} color={app.mapTheme === o.value ? '#fff' : colors.textSecondary} />
                <Text style={[styles.chipText, app.mapTheme === o.value && styles.chipTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title="Navigation">
          <Row
            icon="volume-high"
            label="Voice guidance"
            right={<Switch value={app.voiceGuidance} onValueChange={app.setVoiceGuidance} trackColor={{ true: colors.accent }} />}
          />
          <Row
            icon="camera"
            label="Speed camera alerts"
            right={<Switch value={app.cameraAlerts} onValueChange={app.setCameraAlerts} trackColor={{ true: colors.accent }} />}
          />
        </Section>

        <Section title="Recent destinations">
          {app.recents.length === 0 ? (
            <Text style={styles.emptyText}>No recent destinations yet.</Text>
          ) : (
            <TouchableOpacity onPress={app.clearRecents}>
              <Text style={styles.linkDanger}>Clear {app.recents.length} recent destination{app.recents.length === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          )}
        </Section>

        <Section title="Live data sources">
          <Text style={styles.aboutText}>
            Maps: OpenStreetMap & CARTO tiles{'\n'}
            Search: Photon / Komoot geocoder{'\n'}
            Routing: OSRM (car, cycle, walk, bus-estimate){'\n'}
            Speed cameras: OpenStreetMap community enforcement data (Overpass API), covering the whole of the UK{'\n'}
            Position: device GPS via expo-location, refreshed every {LOCATION_REFRESH_MS}ms
          </Text>
        </Section>

        <Text style={styles.footer}>UK Live Navigator • real maps, real routes, real speed camera data</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  section: { marginTop: 22, paddingHorizontal: 20 },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  sectionBody: { backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden', ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  rowValue: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  emptyText: { color: colors.textMuted, fontSize: 13, padding: 14, backgroundColor: colors.card, borderRadius: radii.lg },
  linkDanger: { color: colors.danger, fontSize: 13, fontWeight: '700', padding: 14, backgroundColor: colors.card, borderRadius: radii.lg },
  aboutText: { color: colors.textSecondary, fontSize: 12, lineHeight: 20, backgroundColor: colors.card, padding: 14, borderRadius: radii.lg, ...shadow },
  footer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 24 },
});
