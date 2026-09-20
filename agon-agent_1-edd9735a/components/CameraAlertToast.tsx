import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, shadow } from '../lib/theme';

interface Props {
  visible: boolean;
  distanceLabel: string;
  speedLimit: string | null;
}

export default function CameraAlertToast({ visible, distanceLabel, speedLimit }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
  }, [visible, anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        },
      ]}
    >
      <Ionicons name="camera" size={22} color="#fff" />
      <Text style={styles.text}>Speed camera in {distanceLabel}{speedLimit ? ` • ${speedLimit}` : ''}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 50,
    ...shadow,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
});
