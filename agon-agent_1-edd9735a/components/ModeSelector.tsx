import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { TravelMode } from '../lib/types';
import { iconForMode, labelForMode } from '../lib/navIcons';
import { colors, radii } from '../lib/theme';

const MODES: TravelMode[] = ['car', 'bus', 'cycle', 'walk'];

interface Props {
  value: TravelMode;
  onChange: (m: TravelMode) => void;
  etaByMode?: Partial<Record<TravelMode, string>>;
}

export default function ModeSelector({ value, onChange, etaByMode }: Props) {
  return (
    <View style={styles.row}>
      {MODES.map((m) => {
        const active = m === value;
        return (
          <TouchableOpacity
            key={m}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(m)}
            activeOpacity={0.8}
          >
            <Ionicons name={iconForMode(m) as any} size={18} color={active ? '#fff' : colors.textSecondary} />
            <Text style={[styles.label, active && styles.labelActive]}>{labelForMode(m)}</Text>
            {etaByMode?.[m] ? (
              <Text style={[styles.eta, active && styles.labelActive]}>{etaByMode[m]}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  labelActive: { color: '#fff' },
  eta: { fontSize: 10, color: colors.textMuted },
});
