import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '@quibly/shared/constants';
import { staticDark as c } from '../../theme';

interface QuizProgressProps {
  total: number;
  current: number;
  answers: (boolean | null)[];
}

export default function QuizProgress({ total, current, answers }: QuizProgressProps) {
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(progress, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingVertical: 8 },
  barTrack: { height: 8, backgroundColor: c.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: c.accent, borderRadius: 4 },
});
