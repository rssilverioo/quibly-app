import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, xpForLevel } from '@quibly/shared/constants';
import { useTranslation } from 'react-i18next';

interface XPProgressBarProps {
  level: number;
  totalXp: number;
}

export default function XPProgressBar({ level, totalXp }: XPProgressBarProps) {
  const { t } = useTranslation('home');
  const xpCurrent = xpForLevel(level);
  const xpNext = xpForLevel(level + 1);
  const xpInto = totalXp - xpCurrent;
  const xpNeeded = xpNext - xpCurrent;
  const progress = xpNeeded > 0 ? Math.min(xpInto / xpNeeded, 1) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{t('levelProgress', { current: level, next: level + 1 })}</Text>
        <Text style={styles.numbers}>{t('xpProgress', { current: Math.max(0, xpInto).toLocaleString(), total: xpNeeded.toLocaleString() })}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(progress * 100, 2)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.textSecondary },
  numbers: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  track: { height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.primary },
});
