import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, type Palette, space } from '../../theme';

interface QuizProgressProps {
  total: number;
  current: number;
  answers: (boolean | null)[];
}

export default function QuizProgress({ total, current, answers }: QuizProgressProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(progress, 100)}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { paddingHorizontal: 20, paddingVertical: space.sm },
  // O trilho era `c.border`, hairline de 1,25:1 no claro — a barra vazia sumia.
  // Trilho é preenchimento, e o preenchimento neutro da paleta é `surfaceRaised`.
  barTrack: { height: 8, backgroundColor: c.surfaceRaised, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: c.accent, borderRadius: 4 },
});
