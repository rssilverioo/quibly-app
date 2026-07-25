import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

interface Props {
  size?: number;
  /** Defaults to the `live` color. Pass a palette color to re-tint. */
  color?: string;
}

/**
 * Breathing dot that marks "happening right now".
 *
 * The halo pulses, the core doesn't — a pulsing core reads as a loading
 * spinner, a pulsing halo reads as a heartbeat.
 */
export default function LiveDot({ size = 8, color }: Props) {
  const { c } = useTheme();
  const tint = color ?? c.live;
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, []);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.8 }],
  }));

  return (
    <View style={[styles.wrap, { width: size * 3, height: size * 3 }]}>
      <Animated.View
        style={[
          styles.halo,
          haloStyle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
        ]}
      />
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
});
