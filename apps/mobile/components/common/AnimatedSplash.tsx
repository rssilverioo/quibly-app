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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const FINISH_AT = 2800;
const LOGO_SIZE = W * 0.28;
const HALF = LOGO_SIZE / 2;
const SPREAD = 60;

interface Props {
  onFinish?: () => void;
}

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

// Each piece shows one quadrant of the logo
function LogoPiece({ quadrant, delay }: { quadrant: 'tl' | 'tr' | 'bl' | 'br'; delay: number }) {
  const offsetX = useSharedValue(
    quadrant === 'tl' || quadrant === 'bl' ? -SPREAD : SPREAD,
  );
  const offsetY = useSharedValue(
    quadrant === 'tl' || quadrant === 'tr' ? -SPREAD : SPREAD,
  );
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(
    quadrant === 'tl' ? -15 : quadrant === 'tr' ? 15 : quadrant === 'bl' ? 15 : -15,
  );

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    offsetX.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 120 }));
    offsetY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 120 }));
    rotate.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 120 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  // Position the clipping container so only one quadrant shows
  const clipStyle = {
    top: quadrant === 'tl' || quadrant === 'tr' ? 0 : HALF,
    left: quadrant === 'tl' || quadrant === 'bl' ? 0 : HALF,
  };

  // Offset the image inside the clip to show the correct quarter
  const imageOffset = {
    top: quadrant === 'bl' || quadrant === 'br' ? -HALF : 0,
    left: quadrant === 'tr' || quadrant === 'br' ? -HALF : 0,
  };

  return (
    <Animated.View style={[styles.pieceClip, clipStyle, style]}>
      <Image
        source={require('../../assets/logo.png')}
        style={[styles.pieceImage, imageOffset]}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

export default function AnimatedSplash({ onFinish }: Props) {
  const rootOpacity = useSharedValue(1);
  const shimmerOpacity = useSharedValue(0);
  const fullLogoOpacity = useSharedValue(0);
  const piecesOpacity = useSharedValue(1);

  useEffect(() => {
    // After pieces assemble, flash shimmer then reveal full logo
    shimmerOpacity.value = withDelay(900, withSequence(
      withTiming(0.6, { duration: 200 }),
      withTiming(0, { duration: 400 }),
    ));
    // Hide pieces, show full logo after shimmer
    piecesOpacity.value = withDelay(1000, withTiming(0, { duration: 100 }));
    fullLogoOpacity.value = withDelay(1000, withTiming(1, { duration: 300 }));

    const t = setTimeout(() => {
      rootOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) });
      setTimeout(() => onFinish?.(), 300);
    }, FINISH_AT);

    return () => clearTimeout(t);
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmerOpacity.value }));
  const fullLogoStyle = useAnimatedStyle(() => ({ opacity: fullLogoOpacity.value }));
  const piecesStyle = useAnimatedStyle(() => ({ opacity: piecesOpacity.value }));

  const cx = W / 2;
  const cy = H * 0.42;
  const logoLeft = cx - HALF;
  const logoTop = cy - HALF;

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <LinearGradient
        colors={['#A8D8EA', '#87CEEB', '#6CB4E0', '#B8D8F0', '#E8F4FD', '#F5FAFF']}
        locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Light flares for depth */}
      <View style={[styles.flare, { left: W * 0.08, top: H * 0.12, width: 130, height: 130 }]} />
      <View style={[styles.flare, { right: W * 0.05, top: H * 0.22, width: 90, height: 90 }]} />
      <View style={[styles.flare, { left: W * 0.4, top: H * 0.06, width: 70, height: 70 }]} />

      {/* Sparkles */}
      <Sparkle x={cx - 95} y={cy - 110} size={2.5} delay={800} />
      <Sparkle x={cx + 85} y={cy - 85} size={2} delay={1100} />
      <Sparkle x={cx - 120} y={cy + 15} size={2} delay={1400} />
      <Sparkle x={cx + 110} y={cy - 25} size={2.5} delay={900} />
      <Sparkle x={cx - 45} y={cy - 135} size={3} delay={1000} />
      <Sparkle x={cx + 55} y={cy + 95} size={2} delay={1300} />
      <Sparkle x={cx - 130} y={cy - 55} size={2} delay={700} />
      <Sparkle x={cx + 130} y={cy + 45} size={2.5} delay={1200} />

      {/* Logo assembling from 4 pieces */}
      <View style={[styles.logoFrame, { left: logoLeft, top: logoTop }]}>
        {/* Pieces fly in and assemble */}
        <Animated.View style={[StyleSheet.absoluteFill, piecesStyle]}>
          <LogoPiece quadrant="tl" delay={100} />
          <LogoPiece quadrant="tr" delay={200} />
          <LogoPiece quadrant="bl" delay={300} />
          <LogoPiece quadrant="br" delay={400} />
        </Animated.View>

        {/* Full clean logo appears after assembly */}
        <Animated.View style={[styles.fullLogo, fullLogoStyle]}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.fullLogoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Shimmer flash on transition */}
        <Animated.View style={[styles.shimmer, shimmerStyle]} />
      </View>

      {/* Clouds — layered, dreamy */}
      <View style={styles.cloudArea}>
        <View style={[styles.puff, { left: W * 0.05, bottom: 100, width: 130, height: 48, backgroundColor: 'rgba(255,255,255,0.25)' }]} />
        <View style={[styles.puff, { left: W * 0.45, bottom: 105, width: 100, height: 42, backgroundColor: 'rgba(255,255,255,0.2)' }]} />
        <View style={[styles.puff, { left: W * 0.75, bottom: 98, width: 110, height: 45, backgroundColor: 'rgba(255,255,255,0.22)' }]} />

        <View style={[styles.puff, { left: -10, bottom: 65, width: 140, height: 55, backgroundColor: 'rgba(255,255,255,0.45)' }]} />
        <View style={[styles.puff, { left: W * 0.3, bottom: 70, width: 120, height: 52, backgroundColor: 'rgba(255,255,255,0.4)' }]} />
        <View style={[styles.puff, { left: W * 0.6, bottom: 62, width: 130, height: 50, backgroundColor: 'rgba(255,255,255,0.42)' }]} />

        <View style={[styles.puff, { left: -15, bottom: 30, width: 150, height: 58, backgroundColor: 'rgba(255,255,255,0.65)' }]} />
        <View style={[styles.puff, { left: W * 0.25, bottom: 35, width: 130, height: 60, backgroundColor: 'rgba(255,255,255,0.6)' }]} />
        <View style={[styles.puff, { left: W * 0.55, bottom: 28, width: 140, height: 55, backgroundColor: 'rgba(255,255,255,0.65)' }]} />
        <View style={[styles.puff, { left: W * 0.8, bottom: 32, width: 110, height: 56, backgroundColor: 'rgba(255,255,255,0.6)' }]} />

        <View style={styles.cloudBase} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#A8D8EA',
    overflow: 'hidden',
  },
  flare: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoFrame: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    zIndex: 5,
  },
  pieceClip: {
    position: 'absolute',
    width: HALF,
    height: HALF,
    overflow: 'hidden',
    borderRadius: LOGO_SIZE * 0.11,
  },
  pieceImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    position: 'absolute',
  },
  fullLogo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  fullLogoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.22,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: LOGO_SIZE * 0.22,
    backgroundColor: '#FFFFFF',
  },
  cloudArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: H * 0.18,
  },
  puff: {
    position: 'absolute',
    borderRadius: 999,
  },
  cloudBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
