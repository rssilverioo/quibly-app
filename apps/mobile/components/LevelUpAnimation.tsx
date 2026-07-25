import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { staticDark as c } from '../theme';
import { Mascot } from './mascot';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: c.accent,
  primaryLight: c.accent,
  secondary: c.accent,
  text: c.fg,
  gold: c.gold,
};

const FONTS = {
  bold: 'Inter_700Bold',
  semiBold: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
};

const NUM_PARTICLES = 24;
const NUM_RINGS = 3;

interface LevelUpAnimationProps {
  newLevel: number;
  onComplete: () => void;
}

interface Particle {
  translateX: Animated.Value;
  translateY: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  angle: number;
  distance: number;
}

export default function LevelUpAnimation({ newLevel, onComplete }: LevelUpAnimationProps) {
  const { t } = useTranslation('feed');
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const labelScale = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const numberScale = useRef(new Animated.Value(0)).current;
  const numberOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.5)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const ringScales = useRef(Array.from({ length: NUM_RINGS }, () => new Animated.Value(0))).current;
  const ringOpacities = useRef(Array.from({ length: NUM_RINGS }, () => new Animated.Value(0.6))).current;
  const dismissOpacity = useRef(new Animated.Value(0)).current;

  const particleColors = [COLORS.primary, COLORS.primaryLight, COLORS.gold, COLORS.secondary, c.danger, c.warning];

  const particles = useRef<Particle[]>(
    Array.from({ length: NUM_PARTICLES }, (_, i) => {
      const angle = (i / NUM_PARTICLES) * Math.PI * 2;
      const distance = 120 + Math.random() * 140;
      return {
        translateX: new Animated.Value(0),
        translateY: new Animated.Value(0),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
        color: particleColors[i % particleColors.length],
        size: 4 + Math.random() * 8,
        angle,
        distance,
      };
    })
  ).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Phase 1: Flash + overlay
    Animated.sequence([
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 0.8, duration: 150, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]),

      // Phase 2: "LEVEL UP" label
      Animated.parallel([
        Animated.spring(labelScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(labelOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),

      // Phase 3: Level number + glow + particles + rings
      Animated.parallel([
        // Number entrance
        Animated.spring(numberScale, { toValue: 1, tension: 60, friction: 5, useNativeDriver: true }),
        Animated.timing(numberOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),

        // Glow pulse
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowOpacity, { toValue: 0.6, duration: 300, useNativeDriver: true }),
            Animated.spring(glowScale, { toValue: 1.2, tension: 40, friction: 4, useNativeDriver: true }),
          ]),
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowScale, { toValue: 1.4, duration: 800, useNativeDriver: true }),
              Animated.timing(glowScale, { toValue: 1.1, duration: 800, useNativeDriver: true }),
            ]),
          ),
        ]),

        // Expanding rings
        ...ringScales.map((ringScale, i) =>
          Animated.sequence([
            Animated.delay(i * 200),
            Animated.parallel([
              Animated.timing(ringScale, { toValue: 1, duration: 800, useNativeDriver: true }),
              Animated.timing(ringOpacities[i], { toValue: 0, duration: 800, useNativeDriver: true }),
            ]),
          ])
        ),

        // Particles burst
        ...particles.map((p, i) =>
          Animated.sequence([
            Animated.delay(100 + Math.random() * 200),
            Animated.parallel([
              Animated.timing(p.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
              Animated.spring(p.scale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
              Animated.timing(p.translateX, {
                toValue: Math.cos(p.angle) * p.distance,
                duration: 600 + Math.random() * 400,
                useNativeDriver: true,
              }),
              Animated.timing(p.translateY, {
                toValue: Math.sin(p.angle) * p.distance,
                duration: 600 + Math.random() * 400,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
              Animated.timing(p.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
          ])
        ),
      ]),
    ]).start();

    // Show "tap to continue" after delay
    const tapTimer = setTimeout(() => {
      Animated.timing(dismissOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 2000);

    // Auto-dismiss after 4s
    const autoTimer = setTimeout(() => {
      handleDismiss();
    }, 4000);

    return () => {
      clearTimeout(tapTimer);
      clearTimeout(autoTimer);
    };
  }, []);

  const handleDismiss = () => {
    Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      onComplete();
    });
  };

  return (
    <TouchableWithoutFeedback onPress={handleDismiss}>
      <Animated.View style={[styles.container, { opacity: overlayOpacity }]}>
        <StatusBar hidden />

        {/* White flash */}
        <Animated.View style={[styles.flash, { opacity: flashOpacity }]} />

        {/* Expanding rings */}
        {ringScales.map((ringScale, i) => (
          <Animated.View
            key={`ring-${i}`}
            style={[
              styles.ring,
              {
                width: 200 + i * 80,
                height: 200 + i * 80,
                borderRadius: 100 + i * 40,
                opacity: ringOpacities[i],
                transform: [{ scale: ringScale }],
              },
            ]}
          />
        ))}

        {/* Glow behind number */}
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Particles */}
        {particles.map((p, i) => (
          <Animated.View
            key={`particle-${i}`}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [
                  { translateX: p.translateX },
                  { translateY: p.translateY },
                  { scale: p.scale },
                ],
              },
            ]}
          />
        ))}

        {/* "LEVEL UP" label */}
        <Animated.View
          style={[
            styles.labelContainer,
            {
              opacity: labelOpacity,
              transform: [{ scale: labelScale }],
            },
          ]}
        >
          <Mascot state="celebrate" size={160} />
          <Text style={styles.labelText}>{t('levelUp.label')}</Text>
        </Animated.View>

        {/* Level number */}
        <Animated.View
          style={[
            styles.numberContainer,
            {
              opacity: numberOpacity,
              transform: [{ scale: numberScale }],
            },
          ]}
        >
          <Text style={styles.numberText}>{newLevel}</Text>
        </Animated.View>

        {/* Tap to continue */}
        <Animated.View style={[styles.dismissContainer, { opacity: dismissOpacity }]}>
          <Text style={styles.dismissText}>{t('levelUp.tapToContinue')}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 5, 12, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primary,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 20,
  },
  particle: {
    position: 'absolute',
  },
  labelContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
  },
  labelText: {
    color: COLORS.gold,
    fontSize: 22,
    fontFamily: FONTS.bold,
    letterSpacing: 8,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  numberContainer: {
    position: 'absolute',
  },
  numberText: {
    color: COLORS.text,
    fontSize: 120,
    fontFamily: FONTS.bold,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
  dismissContainer: {
    position: 'absolute',
    bottom: 80,
  },
  dismissText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontFamily: FONTS.medium,
    letterSpacing: 1,
  },
});
