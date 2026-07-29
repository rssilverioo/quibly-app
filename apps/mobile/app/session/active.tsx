import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions, AppState } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Pause, Play, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';

import { useSessionStore } from '../../stores/session.store';
import { useAuth } from '../../contexts/AuthContext';
import LevelUpAnimation from '../../components/LevelUpAnimation';
import Press from '../../components/ui/Press';
import { Mascot } from '../../components/mascot';
import { useTheme, text as t, space, radius } from '../../theme';
import { track } from '../../lib/analytics';

const { width: SW } = Dimensions.get('window');
const TIMER_SIZE = Math.min(SW * 0.72, 300);
const STROKE_WIDTH = 6;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TOTAL_CYCLES = 4;

export default function ActiveSessionScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('session');
  const { c } = useTheme();
  const { refreshProfile } = useAuth();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpTo, setLevelUpTo] = useState<number | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const {
    elapsedSeconds, isRunning, phase, pomodorosCompleted,
    workDuration, breakDuration, subjectName, subjectColor,
    tick, pause, resume, startBreak, startWork,
    endSession, reset, fastForward,
  } = useSessionStore();

  const phaseDuration = phase === 'work' ? workDuration : breakDuration;
  const totalPhaseSeconds = phaseDuration * 60;
  const remainingSeconds = Math.max(0, totalPhaseSeconds - elapsedSeconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timerDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progress = totalPhaseSeconds > 0 ? (totalPhaseSeconds - remainingSeconds) / totalPhaseSeconds : 0;

  // Work is the accent; break drops to muted so the two phases are legible
  // at a glance from across a desk.
  const activeColor = phase === 'work' ? c.accent : c.fgMuted;

  const backgroundedAtRef = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && isRunning) {
        backgroundedAtRef.current = Date.now();
      } else if (nextState === 'active' && backgroundedAtRef.current && isRunning) {
        const delta = Math.floor((Date.now() - backgroundedAtRef.current) / 1000);
        backgroundedAtRef.current = null;
        if (delta > 0) fastForward(delta);
      }
    });
    return () => sub.remove();
  }, [isRunning, fastForward]);

  useFocusEffect(
    useCallback(() => {
      return () => { if (isRunning) pause(); };
    }, [isRunning, pause])
  );

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => { tick(); }, 1000);
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [isRunning, tick]);

  useEffect(() => {
    if (remainingSeconds <= 0 && isRunning && elapsedSeconds > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (phase === 'work') startBreak(); else startWork();
    }
  }, [remainingSeconds, isRunning, phase, elapsedSeconds, startBreak, startWork]);

  const goHome = useCallback(async () => {
    reset();
    await refreshProfile();
    router.replace('/');
  }, [reset, refreshProfile, router]);

  const handleEndSession = useCallback(() => {
    if (isEnding) return;
    Alert.alert(tr('active.endConfirmTitle'), tr('active.endConfirmMessage'), [
      { text: tr('common:cancel'), style: 'cancel' },
      {
        text: tr('active.endSession'),
        style: 'destructive',
        onPress: async () => {
          setIsEnding(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          pause();
          try {
            const result = await endSession();
            // session_completed is server-sourced (ARCHITECTURE.md §3: the
            // server, not the client, owns duration/points). This one is a
            // pure activation milestone the server has no reason to know
            // about — it's about *this device's* funnel, not money.
            if (result.isFirstSession) {
              track('first_session_completed', { minutes: result.durationMinutes });
            }
            if (result.previousLevel && result.newLevel && result.newLevel > result.previousLevel) {
              setLevelUpTo(result.newLevel);
              setShowLevelUp(true);
              return;
            }
          } catch (err) {
            console.error('[EndSession]', err);
            setIsEnding(false);
          }
          goHome();
        },
      },
    ]);
  }, [endSession, pause, goHome, isEnding, tr]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {!isRunning && (
        <Press
          haptic={false}
          scale={0.92}
          onPress={() => { pause(); router.back(); }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={c.fgMuted} />
        </Press>
      )}

      <Text style={{ ...t.overline, color: activeColor, letterSpacing: 4 }}>
        {phase === 'work' ? tr('active.work') : tr('active.break')}
      </Text>

      <View style={styles.timerWrap}>
        <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke={c.surface}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke={activeColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            strokeLinecap="round"
          />
        </Svg>

        {/* Inside the ring: the mascot works while you work and dozes on the
            break. It's the one screen people stare at for 25 minutes. */}
        <View style={styles.timerTextWrap}>
          <Mascot
            state={phase === 'work' ? 'focused' : 'break'}
            size={92}
            animate={isRunning}
          />
          <Text
            style={{
              ...t.display,
              color: c.fg,
              fontVariant: ['tabular-nums'],
              marginTop: -space.sm,
            }}
          >
            {timerDisplay}
          </Text>
        </View>
      </View>

      {subjectName && (
        <View style={styles.subjectRow}>
          <View style={[styles.subjectDot, { backgroundColor: subjectColor ?? c.accent }]} />
          <Text style={{ ...t.label, color: c.fgMuted }}>{subjectName}</Text>
        </View>
      )}

      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_CYCLES }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.cycleDot,
              i < pomodorosCompleted
                ? { backgroundColor: c.accent }
                : { borderWidth: 1.5, borderColor: c.borderStrong },
            ]}
          />
        ))}
      </View>

      <Press
        haptic="medium"
        scale={0.92}
        onPress={() => (isRunning ? pause() : resume())}
        style={[styles.controlBtn, { backgroundColor: activeColor }]}
      >
        {isRunning ? (
          <Pause size={26} color={c.fgOnAccent} fill={c.fgOnAccent} />
        ) : (
          <Play size={26} color={c.fgOnAccent} fill={c.fgOnAccent} style={{ marginLeft: 3 }} />
        )}
      </Press>

      <Press
        haptic="light"
        scale={0.95}
        onPress={handleEndSession}
        disabled={isEnding}
        style={[styles.endBtn, { opacity: isEnding ? 0.4 : 1 }]}
      >
        <Square size={14} color={c.danger} />
        <Text style={{ ...t.label, color: c.danger }}>
          {isEnding ? tr('active.ending') : tr('active.endSession')}
        </Text>
      </Press>

      {showLevelUp && levelUpTo && (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <LevelUpAnimation newLevel={levelUpTo} onComplete={goHome} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  backBtn: { position: 'absolute', top: 60, left: space.lg, padding: space.sm },

  timerWrap: {
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
    marginBottom: space.xl,
  },
  timerTextWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },

  dotsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.xxl },
  cycleDot: { width: 8, height: 8, borderRadius: 4 },

  controlBtn: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    marginTop: space.lg,
  },
});
