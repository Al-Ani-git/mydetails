import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RouteStep, UnitSystem } from '../lib/types';
import { formatDistance } from '../lib/routing';
import { iconForManeuver } from '../lib/navIcons';
import { colors, radii, shadow } from '../lib/theme';

interface Props {
  step: RouteStep | null;
  distanceToStepM: number;
  unit: UnitSystem;
  nextStep: RouteStep | null;
}

export default function InstructionBanner({ step, distanceToStepM, unit, nextStep }: Props) {
  if (!step) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={iconForManeuver(step.maneuverType, step.modifier) as any} size={30} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.distance}>{formatDistance(distanceToStepM, unit)}</Text>
        <Text style={styles.instruction} numberOfLines={2}>{step.instruction}</Text>
        {nextStep ? (
          <Text style={styles.then} numberOfLines={1}>Then {nextStep.instruction.toLowerCase()}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    gap: 14,
    ...shadow,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distance: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  instruction: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  then: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
