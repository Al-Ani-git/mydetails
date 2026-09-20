import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii } from '../lib/theme';
import type { PlaceResult } from '../lib/types';

interface Props {
  place: PlaceResult;
  icon?: string;
  onPress: (p: PlaceResult) => void;
}

export default function SearchResultItem({ place, icon = 'location', onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(place)} activeOpacity={0.7}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon as any} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label} numberOfLines={1}>{place.label}</Text>
        {!!place.sublabel && (
          <Text style={styles.sublabel} numberOfLines={1}>{place.sublabel}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, gap: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  sublabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
