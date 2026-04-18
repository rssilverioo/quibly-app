import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const FINISH_AT = 2800;
const LOGO_SIZE = W * 0.3;

interface Props {
  onFinish?: () => void;
}

/* ── sparkle star ── */
function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.ease) }),
      ), -1, false,
    ));
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0.3, { duration: 900, easing: Easing.in(Easing.ease) }),
      ), -1, false,
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <View style={{ width: size, height: size * 2.5, borderRadius: size, backgroundColor: '#FFFFFF', position: 'absolute', left: size * 0.75, top: 0 }} />
      <View style={{ width: size * 2.5, height: size, borderRadius: size, backgroundColor: '#FFFFFF', position: 'absolute', left: 0, top: size * 0.75 }} />
    </Animated.View>
  );
}

/* ── drifting cloud ── */
function Cloud({ y, delay, speed, opacity: maxOp, scale = 1 }: {
  y: number; delay: number; speed: number; opacity: number; scale?: number;
}) {
  const tx = useSharedValue(-W * 0.7);
  useEffect(() => {
    tx.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(W * 1.2, { duration: speed, easing: Easing.linear }),
        withTiming(-W * 0.7, { duration: 0 }),
      ), -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { scale }],
  }));
  const bw = W * 0.3;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: y, width: W * 0.6, height: bw * 0.4, opacity: maxOp }, style]}>
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: bw, height: bw * 0.3, borderRadius: bw, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', bottom: bw * 0.08, left: bw * 0.12, width: bw * 0.55, height: bw * 0.4, borderRadius: bw, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', bottom: bw * 0.06, left: bw * 0.35, width: bw * 0.5, height: bw * 0.35, borderRadius: bw, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', bottom: bw * 0.1, left: bw * 0.22, width: bw * 0.4, height: bw * 0.42, borderRadius: bw, backgroundColor: '#FFFFFF' }} />
    </Animated.View>
  );
}

export default function AnimatedSplash({ onFinish }: Props) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.5);
  const logoY = useSharedValue(20);
  const glowOpacity = useSharedValue(0);
  const rootOpacity = useSharedValue(1);

  useEffect(() => {
    // Logo enters
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    logoScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 90 }));
    logoY.value = withDelay(200, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));

    // Soft glow behind logo
    glowOpacity.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(0.25, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.08, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    ));

    // Exit
    const t = setTimeout(() => {
      rootOpacity.value = withTiming(0, { duration: 350, easing: Easing.in(Easing.cubic) });
      setTimeout(() => onFinish?.(), 350);
    }, FINISH_AT);

    return () => clearTimeout(t);
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { translateY: logoY.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const cx = W / 2;
  const cy = H * 0.38;

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      {/* Sky gradient */}
      <LinearGradient
        colors={['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#E0EFFF']}
        locations={[0, 0.15, 0.35, 0.55, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Sparkles */}
      <Sparkle x={cx - 90} y={cy - 100} size={2.5} delay={400} />
      <Sparkle x={cx + 70} y={cy - 80} size={3} delay={800} />
      <Sparkle x={cx - 60} y={cy + 70} size={2} delay={1200} />
      <Sparkle x={cx + 95} y={cy - 30} size={2.5} delay={600} />
      <Sparkle x={cx - 110} y={cy - 40} size={2} delay={1000} />
      <Sparkle x={cx + 50} y={cy - 120} size={3} delay={500} />
      <Sparkle x={cx - 30} y={cy + 100} size={2} delay={900} />
      <Sparkle x={cx + 110} y={cy + 50} size={2.5} delay={1400} />

      {/* Glow behind logo */}
      <Animated.View style={[styles.glow, { left: cx - LOGO_SIZE * 0.9, top: cy - LOGO_SIZE * 0.65 }, glowStyle]} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { top: cy - LOGO_SIZE * 0.5 }, logoStyle]}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Cloud layers — bottom, moving */}
      <Cloud y={H * 0.62} delay={0} speed={18000} opacity={0.5} scale={0.9} />
      <Cloud y={H * 0.68} delay={3000} speed={22000} opacity={0.6} scale={1.1} />
      <Cloud y={H * 0.72} delay={6000} speed={16000} opacity={0.55} scale={0.85} />
      <Cloud y={H * 0.58} delay={9000} speed={25000} opacity={0.35} scale={0.7} />

      {/* Dense cloud bed at very bottom */}
      <View style={styles.cloudBed}>
        <View style={[styles.bedPuff, { left: -20, width: 140, height: 60, bottom: 30 }]} />
        <View style={[styles.bedPuff, { left: W * 0.2, width: 120, height: 70, bottom: 35 }]} />
        <View style={[styles.bedPuff, { left: W * 0.45, width: 150, height: 65, bottom: 28 }]} />
        <View style={[styles.bedPuff, { left: W * 0.7, width: 130, height: 60, bottom: 32 }]} />
        <View style={[styles.bedPuff, { left: W * 0.1, width: 100, height: 80, bottom: 45 }]} />
        <View style={[styles.bedPuff, { left: W * 0.55, width: 110, height: 75, bottom: 40 }]} />
        <View style={styles.bedBase} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: LOGO_SIZE * 1.8,
    height: LOGO_SIZE * 1.8,
    borderRadius: LOGO_SIZE * 0.9,
    backgroundColor: '#93C5FD',
    zIndex: 1,
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.22,
  },
  cloudBed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: H * 0.15,
  },
  bedPuff: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  bedBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});
