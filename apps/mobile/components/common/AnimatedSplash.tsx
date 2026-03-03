import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { COLORS, FONTS } from '@quibly/shared/constants';

const LETTERS = ['Q', 'U', 'I', 'B', 'L', 'Y'];
const LETTER_STAGGER = 80;
const LETTER_START = 600;
const DOT_COUNT = 3;

function AnimatedLetter({ letter, index }: { letter: string; index: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    const delay = LETTER_START + index * LETTER_STAGGER;
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 12, stiffness: 120 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.Text style={[styles.letter, style]}>{letter}</Animated.Text>;
}

function AnimatedDot({ index }: { index: number }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Dots appear at 2000ms, then loop
    opacity.value = withDelay(
      2000 + index * 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

export default function AnimatedSplash() {
  // Logo
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);

  // Glow
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  // Subtitle
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(10);

  useEffect(() => {
    // Phase 1: Logo entrance (0-600ms)
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withSpring(1, { damping: 10, stiffness: 100 });

    // Glow pulse (starts at 200ms, loops)
    glowOpacity.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(0.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    glowScale.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );

    // Phase 3: Subtitle (1500-1900ms)
    subtitleOpacity.value = withDelay(1500, withTiming(1, { duration: 400 }));
    subtitleTranslateY.value = withDelay(
      1500,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Logo with glow */}
      <View style={styles.logoContainer}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={logoStyle}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Letter row */}
      <View style={styles.letterRow}>
        {LETTERS.map((letter, i) => (
          <AnimatedLetter key={i} letter={letter} index={i} />
        ))}
      </View>

      {/* Subtitle */}
      <Animated.Text style={[styles.subtitle, subtitleStyle]}>
        Lock In. Compete. Win.
      </Animated.Text>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <AnimatedDot key={i} index={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 22,
  },
  letterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  letter: {
    fontFamily: FONTS.bold,
    fontSize: 36,
    color: COLORS.text,
  },
  subtitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});
