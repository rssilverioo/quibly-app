import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { COLORS, FONTS } from '@quibly/shared/constants';

interface XPToastProps {
  xp: number;
  visible: boolean;
  onDone?: () => void;
}

export default function XPToast({ xp, visible, onDone }: XPToastProps) {
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: COLORS.gold + 'DD',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 999,
  },
  text: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.background,
  },
});
