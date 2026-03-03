import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { useTranslation } from 'react-i18next';

interface StreakBadgeProps {
  streak: number;
  onPress?: () => void;
}

export default function StreakBadge({ streak, onPress }: StreakBadgeProps) {
  const { t } = useTranslation('home');

  return (
    <TouchableOpacity style={styles.badge} activeOpacity={0.7} onPress={onPress} disabled={!onPress}>
      <Flame size={16} color={COLORS.warning} fill={COLORS.warning} style={{ marginRight: 4 }} />
      <Text style={styles.text}>{t('dayStreak', { count: streak })}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  text: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.warning },
});
