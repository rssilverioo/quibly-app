import React, { useEffect, useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { useTheme, type Palette, radius, space, text } from '../../theme';

interface XPToastProps {
  xp: number;
  visible: boolean;
  onDone?: () => void;
}

export default function XPToast({ xp, visible, onDone }: XPToastProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (visible && onDone) {
      const timer = setTimeout(onDone, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20, scale: 0.8 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      exit={{ opacity: 0, translateY: -20 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.container}
    >
      <Text style={styles.text}>+{xp} XP</Text>
    </MotiView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    // Era `gold + 'DD'`: token deprecado (o pódio saiu) e, pior, concatenação de
    // alpha em cima do hex — quebra silenciosamente no dia em que o token virar
    // `rgba()`. Ganho de XP é confirmação positiva; quem carrega isso é o accent,
    // com o único par de cores que a paleta garante legível nos dois modos.
    backgroundColor: c.accent,
    paddingHorizontal: 20,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    zIndex: 999,
  },
  text: {
    ...text.bodyStrong,
    color: c.fgOnAccent,
  },
});
