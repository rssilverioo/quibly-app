import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@quibly/shared/constants';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FINISH_AT = 2700;

interface Props {
  onFinish?: () => void;
}

const WAVE_TOP = SCREEN_H * 0.6;

interface WaveLayerProps {
  color: string;
  duration: number;
  amplitude: number;
  topOffset: number;
  zIndex: number;
}

function WaveLayer({ color, duration, amplitude, topOffset, zIndex }: WaveLayerProps) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(-SCREEN_W, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    y.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  // Build a wave shape using overlapping ellipses
  const blobCount = 8;
  const blobWidth = SCREEN_W / 3;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.waveLayer,
        { top: topOffset, height: SCREEN_H, zIndex },
        style,
      ]}
    >
      {/* Solid base */}
      <View style={[styles.waveBase, { backgroundColor: color, top: 30 }]} />
      {/* Crests: large ellipses overlapping along the top */}
      {Array.from({ length: blobCount }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -blobWidth / 4,
            left: i * (blobWidth * 0.7) - blobWidth * 0.2,
            width: blobWidth,
            height: blobWidth / 2,
            borderRadius: blobWidth,
            backgroundColor: color,
          }}
        />
      ))}
    </Animated.View>
  );
}

export default function AnimatedSplash({ onFinish }: Props) {
  const rootOpacity = useSharedValue(1);
  const rootScale = useSharedValue(1);
  const fadeIn = useSharedValue(0);

  const logoDrop = useSharedValue(-180);
  const logoOpacity = useSharedValue(0);
  const logoBobY = useSharedValue(0);
  const logoTilt = useSharedValue(0);

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 500 });

    logoOpacity.value = withDelay(200, withTiming(1, { duration: 350 }));
    logoDrop.value = withDelay(
      200,
      withSequence(
        withTiming(0, { duration: 700, easing: Easing.bezier(0.3, 1.4, 0.5, 1) }),
        withTiming(-12, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 280, easing: Easing.inOut(Easing.cubic) }),
      ),
    );

    logoBobY.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    logoTilt.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(-7, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
          withTiming(7, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    glowOpacity.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    glowScale.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );

    const t = setTimeout(() => {
      rootOpacity.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) });
      rootScale.value = withTiming(1.05, { duration: 400, easing: Easing.in(Easing.cubic) });
      setTimeout(() => onFinish?.(), 400);
    }, FINISH_AT);

    return () => clearTimeout(t);
  }, []);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
    transform: [{ scale: rootScale.value }],
  }));

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeIn.value }));

  const logoContainerStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoDrop.value + logoBobY.value },
      { rotate: `${logoTilt.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const logoY = WAVE_TOP - 50;

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <LinearGradient
        colors={['#0F1232', '#1E1B4B', '#312E81', '#1E40AF']}
        locations={[0, 0.3, 0.55, 0.8]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]} pointerEvents="none">
        <View style={[styles.star, { top: SCREEN_H * 0.08, left: SCREEN_W * 0.18, opacity: 0.7 }]} />
        <View style={[styles.star, styles.starSm, { top: SCREEN_H * 0.14, left: SCREEN_W * 0.7 }]} />
        <View style={[styles.star, { top: SCREEN_H * 0.21, left: SCREEN_W * 0.45, opacity: 0.5 }]} />
        <View style={[styles.star, styles.starSm, { top: SCREEN_H * 0.28, left: SCREEN_W * 0.85 }]} />
        <View style={[styles.star, { top: SCREEN_H * 0.32, left: SCREEN_W * 0.12, opacity: 0.6 }]} />
        <View style={[styles.star, styles.starSm, { top: SCREEN_H * 0.38, left: SCREEN_W * 0.6 }]} />
        <View style={[styles.star, { top: SCREEN_H * 0.05, left: SCREEN_W * 0.55, opacity: 0.4 }]} />
      </Animated.View>

      {/* Logo surfing */}
      <Animated.View style={[styles.logoContainer, { top: logoY }, logoContainerStyle]}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Wave layers */}
      <WaveLayer color="rgba(96,165,250,0.35)" duration={6000} amplitude={6} topOffset={WAVE_TOP - 8} zIndex={1} />
      <WaveLayer color="#1E40AF" duration={3500} amplitude={10} topOffset={WAVE_TOP + 18} zIndex={3} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  starSm: {
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.5,
  },
  logoContainer: {
    position: 'absolute',
    left: SCREEN_W / 2 - 50,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#60A5FA',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  waveLayer: {
    position: 'absolute',
    left: 0,
    width: SCREEN_W * 2,
  },
  waveBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_H,
  },
});
