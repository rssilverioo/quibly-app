import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import AppleSignInButton from '../../components/auth/AppleSignInButton';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { useTheme, type Palette, NIGHT_GRADIENT, text as ty, space, radius } from '../../theme';
import { trackScreen } from '../../lib/analytics';

/**
 * O login é a única tela do app que não é `c.bg`, e isso é deliberado
 * (`DESIGN-GYMRATS §5.15`): é a moldura da marca, não uma superfície de
 * produto. Ela fica escura mesmo com o app claro.
 *
 * Consequência que quebrou a tela até hoje: `c.fg` é a cor de texto da
 * *superfície do tema*, e aqui não há superfície de tema nenhuma. Com o app
 * virando claro, `c.fg` (#17171B) passou a ser pintado sobre o céu noturno — o
 * wordmark, a tagline e as fórmulas fantasma sumiram. Quem trabalha em cima de
 * palco escuro fixo é `c.fgOnScrim` / `c.fgOnScrimMuted`, e é por isso que
 * esses dois tokens existem (ver `colors.ts`).
 *
 * Os alfas de branco abaixo continuam literais de propósito: a paleta
 * semântica descreve superfícies do produto, e não vale inventar um
 * `fgOnGradient70` para uma tela só.
 */
const { width: W, height: H } = Dimensions.get('window');
const LOGO_SIZE = 96;
const LOGO_CENTER_Y = H * 0.42 - LOGO_SIZE / 2;
const LOGO_FINAL_Y = H * 0.12;
const SPLASH_HOLD = 1800;
const TRANSITION_DUR = 700;

/* ── ghost formula — fades in/out in place ── */
function GhostSymbol({
  text, x, y, size, rotate, delay, duration = 5000, color,
}: {
  text: string; x: number; y: number; size: number; rotate: number; delay: number; duration?: number; color: string;
}) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.14, { duration: duration * 0.4, easing: Easing.out(Easing.ease) }),
        withTiming(0.14, { duration: duration * 0.3 }),
        withTiming(0, { duration: duration * 0.3, easing: Easing.in(Easing.ease) }),
      ), -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.Text
      style={[{
        position: 'absolute', left: x, top: y, fontSize: size, fontWeight: '300',
        color, transform: [{ rotate: `${rotate}deg` }], letterSpacing: 1,
      }, style]}
    >{text}</Animated.Text>
  );
}

/* ── soft particle ── */
function Particle({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.45, { duration: 2000, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.in(Easing.ease) }),
      ), -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{
      position: 'absolute', left: x, top: y, width: size, height: size,
      borderRadius: size / 2, backgroundColor: color,
    }, style]} />
  );
}

/* ── drifting cloud ── */
function DriftingCloud({ y, delay, speed, opacity: maxOp, scale = 1, color }: {
  y: number; delay: number; speed: number; opacity: number; scale?: number; color: string;
}) {
  const tx = useSharedValue(-W * 0.6);
  useEffect(() => {
    tx.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(W * 1.1, { duration: speed, easing: Easing.linear }),
        withTiming(-W * 0.6, { duration: 0 }),
      ), -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { scale }],
  }));
  const bw = W * 0.35;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: y, width: W * 0.7, height: bw * 0.35, opacity: maxOp }, style]}>
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: bw, height: bw * 0.28, borderRadius: bw, backgroundColor: color }} />
      <View style={{ position: 'absolute', bottom: bw * 0.1, left: bw * 0.15, width: bw * 0.5, height: bw * 0.4, borderRadius: bw, backgroundColor: color }} />
      <View style={{ position: 'absolute', bottom: bw * 0.08, left: bw * 0.4, width: bw * 0.55, height: bw * 0.35, borderRadius: bw, backgroundColor: color }} />
      <View style={{ position: 'absolute', bottom: bw * 0.12, left: bw * 0.25, width: bw * 0.4, height: bw * 0.45, borderRadius: bw, backgroundColor: color }} />
    </Animated.View>
  );
}

/* ── Apple-style dual shine sweep over logo ── */
function ShineOverlay({ color }: { color: string }) {
  const sweep1 = useSharedValue(-1);
  const sweep2 = useSharedValue(-1);

  useEffect(() => {
    sweep1.value = withDelay(SPLASH_HOLD + TRANSITION_DUR, withRepeat(
      withSequence(
        withTiming(2, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
        withDelay(2000, withTiming(-1, { duration: 0 })),
      ), -1, false,
    ));
    sweep2.value = withDelay(SPLASH_HOLD + TRANSITION_DUR + 250, withRepeat(
      withSequence(
        withTiming(2, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
        withDelay(2000, withTiming(-1, { duration: 0 })),
      ), -1, false,
    ));
  }, []);

  const style1 = useAnimatedStyle(() => ({
    opacity: interpolate(sweep1.value, [-1, 0, 0.35, 0.7, 2], [0, 0, 0.5, 0, 0]),
    transform: [
      { translateY: interpolate(sweep1.value, [-1, 0, 2], [-50, -50, 140]) },
      { rotate: '-20deg' },
    ],
  }));

  const style2 = useAnimatedStyle(() => ({
    opacity: interpolate(sweep2.value, [-1, 0, 0.35, 0.7, 2], [0, 0, 0.3, 0, 0]),
    transform: [
      { translateY: interpolate(sweep2.value, [-1, 0, 2], [-50, -50, 140]) },
      { rotate: '-20deg' },
    ],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', top: 0, left: -30, right: -30, height: 24,
        borderRadius: 12, backgroundColor: color,
      }, style1]} />
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', top: 0, left: -30, right: -30, height: 10,
        borderRadius: 5, backgroundColor: color,
      }, style2]} />
    </>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { message } = useLocalSearchParams<{ message?: string }>();
  const [error, setError] = useState('');

  /* ── splash → login transition ── */
  const phase = useSharedValue(0); // 0 = splash centered, 1 = login position
  const uiOpacity = useSharedValue(0);

  useEffect(() => {
    trackScreen('login');
  }, []);

  useEffect(() => {
    // Hold splash, then transition
    phase.value = withDelay(SPLASH_HOLD,
      withTiming(1, { duration: TRANSITION_DUR, easing: Easing.inOut(Easing.cubic) }),
    );
    // UI fades in after logo settles
    uiOpacity.value = withDelay(SPLASH_HOLD + TRANSITION_DUR * 0.6,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const logoContainerStyle = useAnimatedStyle(() => ({
    top: interpolate(phase.value, [0, 1], [LOGO_CENTER_Y, LOGO_FINAL_Y]),
  }));

  const logoScaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(phase.value, [0, 1], [1.3, 1]) },
    ],
  }));

  const uiStyle = useAnimatedStyle(() => ({
    opacity: uiOpacity.value,
    transform: [{ translateY: interpolate(uiOpacity.value, [0, 1], [20, 0]) }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        // Só as paradas do céu noturno. As pontas vinham de `c.bg` e
        // `c.surfaceRaised`, o que no app claro punha #F7F7F9 no topo e
        // #F1F1F5 no pé: o gradiente ia de branco a quase preto e de volta a
        // branco. O palco é a marca, e a marca não muda com o tema (§5.15).
        colors={NIGHT_GRADIENT}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* clouds */}
      <DriftingCloud y={H * 0.22} delay={0} speed={25000} opacity={0.12} color={c.fgOnScrim} />
      <DriftingCloud y={H * 0.42} delay={8000} speed={30000} opacity={0.08} scale={0.85} color={c.fgOnScrim} />

      {/* ghost formulas */}
      <GhostSymbol text="E = mc²" x={W * 0.06} y={H * 0.05} size={14} rotate={-12} delay={500} color={c.fgOnScrim} />
      <GhostSymbol text="π" x={W * 0.8} y={H * 0.04} size={28} rotate={8} delay={2000} duration={6000} color={c.fgOnScrim} />
      <GhostSymbol text="∫" x={W * 0.65} y={H * 0.12} size={32} rotate={-5} delay={3500} color={c.fgOnScrim} />
      <GhostSymbol text="H₂O" x={W * 0.15} y={H * 0.15} size={13} rotate={15} delay={1000} color={c.fgOnScrim} />
      <GhostSymbol text="Δ" x={W * 0.85} y={H * 0.2} size={24} rotate={-8} delay={4000} color={c.fgOnScrim} />
      <GhostSymbol text="a² + b² = c²" x={W * 0.02} y={H * 0.28} size={11} rotate={6} delay={1500} duration={6000} color={c.fgOnScrim} />
      <GhostSymbol text="∞" x={W * 0.75} y={H * 0.32} size={26} rotate={-3} delay={2500} color={c.fgOnScrim} />
      <GhostSymbol text="Fe" x={W * 0.1} y={H * 0.4} size={16} rotate={10} delay={3000} color={c.fgOnScrim} />
      <GhostSymbol text="Σ" x={W * 0.82} y={H * 0.42} size={22} rotate={-14} delay={800} color={c.fgOnScrim} />
      <GhostSymbol text="λ" x={W * 0.7} y={H * 0.08} size={20} rotate={-7} delay={6000} color={c.fgOnScrim} />
      <GhostSymbol text="CO₂" x={W * 0.4} y={H * 0.02} size={12} rotate={9} delay={4500} color={c.fgOnScrim} />
      <GhostSymbol text="√" x={W * 0.55} y={H * 0.38} size={30} rotate={-6} delay={1800} color={c.fgOnScrim} />
      <GhostSymbol text="θ" x={W * 0.6} y={H * 0.25} size={22} rotate={7} delay={1200} color={c.fgOnScrim} />

      {/* particles */}
      <Particle x={W * 0.2} y={H * 0.08} size={4} delay={300} color={c.fgOnScrim} />
      <Particle x={W * 0.7} y={H * 0.15} size={3} delay={1500} color={c.fgOnScrim} />
      <Particle x={W * 0.45} y={H * 0.06} size={5} delay={2800} color={c.fgOnScrim} />
      <Particle x={W * 0.85} y={H * 0.28} size={3} delay={800} color={c.fgOnScrim} />
      <Particle x={W * 0.1} y={H * 0.33} size={4} delay={3500} color={c.fgOnScrim} />
      <Particle x={W * 0.55} y={H * 0.18} size={3} delay={4200} color={c.fgOnScrim} />
      <Particle x={W * 0.3} y={H * 0.42} size={4} delay={1200} color={c.fgOnScrim} />
      <Particle x={W * 0.78} y={H * 0.38} size={3} delay={2000} color={c.fgOnScrim} />

      {/* ── LOGO — starts centered (splash), rises to top (login) ── */}
      <Animated.View style={[styles.logoAbsolute, logoContainerStyle]}>
        <Animated.View style={[styles.logoWrap, logoScaleStyle]}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <ShineOverlay color={c.fgOnScrim} />
        </Animated.View>
      </Animated.View>

      {/* ── UI — fades in after logo rises ── */}
      <Animated.View style={[styles.uiLayer, uiStyle]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* spacer for logo */}
          <View style={{ height: LOGO_FINAL_Y + LOGO_SIZE + 8 }} />

          <View style={styles.brandGroup}>
            <Image source={require('../../assets/quibly-text.png')} style={styles.brandImage} resizeMode="contain" />
            <View style={styles.taglinePill}>
              <Text style={styles.tagline}>{t('tagline')}</Text>
            </View>
          </View>

          {/* push buttons to bottom */}
          <View style={{ flex: 1 }} />

          {/* Sem painel de vidro e sem o divisor "login": os blocos da §5.15
              são rótulo, botões e linha legal. O resto era ornamento. */}
          <View style={styles.actionArea}>
            {message ? (
              <View style={styles.successBanner}><Text style={styles.bannerText}>{message}</Text></View>
            ) : null}
            {error ? (
              <View style={styles.errorBanner}><Text style={styles.bannerText}>{error}</Text></View>
            ) : null}

            <Text style={styles.ctaLabel}>{t('login.socialSubtitle')}</Text>

            <View style={styles.buttons}>
              <AppleSignInButton onError={setError} />
              <GoogleSignInButton onError={setError} />
            </View>

            <Text style={styles.legal}>{t('login.legal')}</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/**
 * Alfas de branco, não tokens: ver a nota no topo do arquivo. Cada número é o
 * peso do bloco na §5.15 — 70% tagline, 60% rótulo, 45% legal.
 */
const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1 },

  /* logo — absolute so it can animate freely */
  logoAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 22,
    overflow: 'hidden',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 22,
  },

  /* UI layer */
  uiLayer: {
    flex: 1,
    zIndex: 5,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
  },
  brandGroup: {
    alignItems: 'center',
  },
  brandImage: {
    width: 160,
    height: 44,
    tintColor: c.fgOnScrim,
    marginBottom: space.md,
  },
  taglinePill: {
    height: 34,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
  },
  tagline: {
    ...ty.caption,
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  actionArea: {
    width: '100%',
  },
  ctaLabel: {
    ...ty.caption,
    color: 'rgba(255,255,255,0.60)',
    textAlign: 'center',
    marginBottom: space.md,
  },
  buttons: { gap: space.md },
  successBanner: {
    backgroundColor: c.success,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  errorBanner: {
    backgroundColor: c.danger,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  bannerText: {
    ...ty.caption,
    color: c.fgOnScrim,
    textAlign: 'center',
  },
  legal: {
    ...ty.caption,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: space.lg,
  },
});
