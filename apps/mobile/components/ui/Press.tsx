import { type ReactNode } from 'react';
import { Pressable, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion, PRESS_SCALE } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Physical feedback on press. Off only for low-stakes taps. */
  haptic?: false | 'light' | 'medium';
  /** How far it compresses. Big surfaces should move less. */
  scale?: number;
}

/**
 * Every tappable surface in the app. Spring compression + haptics.
 *
 * This exists because `activeOpacity={0.85}` — what the app used before —
 * is the single clearest tell of a default React Native build.
 */
export default function Press({
  children,
  onPress,
  style,
  disabled,
  haptic = 'light',
  scale = PRESS_SCALE,
}: Props) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(1 - pressed.value * (1 - scale), motion.snappy) },
    ],
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      disabled={disabled}
      onPressIn={() => {
        pressed.value = 1;
        if (haptic) {
          Haptics.impactAsync(
            haptic === 'medium'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
          ).catch(() => {});
        }
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      onPress={onPress}
    >
      {children}
    </AnimatedPressable>
  );
}
