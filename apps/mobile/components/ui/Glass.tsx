import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';

import { useTheme, radius as R } from '../../theme';

/**
 * One glass surface, three rendering paths.
 *
 * Liquid Glass is an iOS 26 API. Rather than gate features on OS version at
 * every call site, this component degrades on its own:
 *
 *  1. **iOS 26+** — real Liquid Glass: refracts and reacts to what scrolls
 *     underneath.
 *  2. **Older iOS** — `expo-blur`, the frosted `UIVisualEffectView`. Not the
 *     same effect, but genuinely translucent.
 *  3. **Android** — a tinted solid surface. `expo-blur` on Android is a
 *     software approximation that costs real frames on mid-range devices,
 *     which is most of the Brazilian install base.
 *
 * Glass only reads as glass when something passes behind it. On a flat
 * near-black background it collapses into grey, so callers should place it
 * over scrolling content, not over an empty screen.
 */

export type GlassVariant =
  /** Chrome that content scrolls under: tab bar, headers. */
  | 'chrome'
  /** A raised surface sitting on the page: cards. */
  | 'surface';

interface Props {
  children?: ReactNode;
  variant?: GlassVariant;
  style?: StyleProp<ViewStyle>;
  /** Grows and shimmers on touch. iOS 26 only; ignored elsewhere. */
  interactive?: boolean;
  /** Corner radius. Liquid Glass needs it explicitly to shape its refraction. */
  cornerRadius?: number;
}

export default function Glass({
  children,
  variant = 'surface',
  style,
  interactive = false,
  cornerRadius = R.lg,
}: Props) {
  const { c, mode } = useTheme();

  // Chrome sits over moving content and can afford to be more transparent;
  // a card holds text and needs a floor for legibility.
  const fallbackTint = variant === 'chrome' ? 0.55 : 0.75;

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        interactive={interactive}
        colorScheme={mode}
        style={[{ borderRadius: cornerRadius, overflow: 'hidden' }, style]}
      >
        {children}
      </LiquidGlassView>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[{ borderRadius: cornerRadius, overflow: 'hidden' }, style]}>
        <BlurView
          intensity={variant === 'chrome' ? 60 : 40}
          tint={mode === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* The blur alone doesn't reach the palette's contrast on a near-black
            ground; this thin wash puts it back without killing translucency. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: c.surface, opacity: variant === 'chrome' ? 0.35 : 0.5 },
          ]}
        />
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: cornerRadius,
          overflow: 'hidden',
          backgroundColor: c.surface,
          opacity: fallbackTint + 0.25,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** True when the current device renders real Liquid Glass. */
export const glassIsLive = isLiquidGlassSupported;
