import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@quibly/shared/constants';

interface LevelBadgeProps {
  level: number;
  size?: 'small' | 'large';
}

export default function LevelBadge({ level, size = 'small' }: LevelBadgeProps) {
  const isLarge = size === 'large';
  const outerSize = isLarge ? 56 : 36;
  const innerSize = isLarge ? 44 : 28;

  return (
    <View style={[styles.outer, { width: outerSize, height: outerSize, borderRadius: outerSize / 2 }]}>
      <View style={[styles.inner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
        <Text style={[styles.number, isLarge && styles.numberLarge]}>{level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: 'rgba(30,64,175,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.primary },
  inner: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text },
  numberLarge: { fontSize: 20 },
});
