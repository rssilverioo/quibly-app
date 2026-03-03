import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '@quibly/shared/constants';

interface QuizProgressProps {
  total: number;
  current: number;
  answers: (boolean | null)[];
}

export default function QuizProgress({ total, current, answers }: QuizProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => {
        let color = COLORS.surfaceLight;
        if (answers[i] === true) color = COLORS.success;
        else if (answers[i] === false) color = COLORS.error;
        else if (i === current) color = COLORS.primary;

        return <View key={i} style={[styles.bubble, { backgroundColor: color }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 20, flexWrap: 'wrap' },
  bubble: { width: 10, height: 10, borderRadius: 5 },
});
