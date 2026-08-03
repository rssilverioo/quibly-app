import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { useTheme, type Palette, radius, space, text } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  /** Button label */
  title: string;
  /** Press handler */
  onPress: () => void;
  /** Show a loading spinner and disable interaction */
  loading?: boolean;
  /** Disable the button */
  disabled?: boolean;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Additional style for the button container */
  style?: ViewStyle;
}

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isDisabled = disabled || loading;

  const buttonStyles: ViewStyle[] = [
    styles.base,
    styles[`${variant}Container`],
    isDisabled && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`${variant}Text`],
    isDisabled && styles.disabledText,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          // O spinner segue a cor do rótulo daquela variante: em cima do accent
          // ele é `fgOnAccent`; nas outras duas o fundo é claro e ele é o accent.
          color={variant === 'primary' ? c.fgOnAccent : c.accent}
        />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  // `fontWeight: '600'` não existia de fato: com fonte customizada o RN ignora o
  // peso numérico e cai no regular. O degrau `bodyStrong` traz a família certa.
  text: { ...text.bodyStrong },
  disabled: { opacity: 0.5 },
  disabledText: { opacity: 0.7 },

  primaryContainer: { backgroundColor: c.accent },
  // Era `c.fg` — near-black em cima do accent, 2,1:1. O token de texto sobre
  // accent é `fgOnAccent`, e é ele que a paleta garante legível nos dois modos.
  primaryText: { color: c.fgOnAccent },

  secondaryContainer: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  secondaryText: { color: c.fg },

  ghostContainer: { backgroundColor: 'transparent' },
  ghostText: { color: c.accent },
});
