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
import { onLiveTimerAction } from '../../services/study-timer';
import { mascotForSession, milestoneForMinutes, minutesToNextMilestone } from '@quibly/shared';

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
  /**
   * Bumped once a second purely to re-render. The number on screen is derived
   * from `displayedElapsedSeconds()`, which reads the server's last count plus
   * the wall-clock time since it arrived — so this component needs a reason to
   * recompute, not a counter of its own.
   */
  const [, forceRender] = useState(0);

  const {
    isRunning, isPaused, isDisconnected, phase, phaseElapsedSeconds, pomodorosCompleted,
    timerMode, workDuration, breakDuration, subjectName, subjectColor,
    tick, pause, resume, startBreak, startWork,
    endSession, reset, syncNow, displayedElapsedSeconds,
  } = useSessionStore();

  const isStopwatch = timerMode === 'stopwatch';

  // Stopwatch counts up with no target; the others count down within a phase.
  const phaseDuration = phase === 'work' ? workDuration : breakDuration;
  const totalPhaseSeconds = phaseDuration * 60;
  const remainingSeconds = Math.max(0, totalPhaseSeconds - phaseElapsedSeconds);

  const shownSeconds = isStopwatch ? displayedElapsedSeconds() : remainingSeconds;
  const hours = Math.floor(shownSeconds / 3600);
  const minutes = Math.floor((shownSeconds % 3600) / 60);
  const seconds = shownSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  // A six-hour stopwatch needs an hours field; a 25-minute pomodoro doesn't.
  const timerDisplay =
    isStopwatch && hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(isStopwatch ? minutes + hours * 60 : minutes)}:${pad(seconds)}`;

  // Nothing to fill for a stopwatch — the ring stays a plain track.
  const progress = isStopwatch
    ? 0
    : totalPhaseSeconds > 0
      ? (totalPhaseSeconds - remainingSeconds) / totalPhaseSeconds
      : 0;

  // Work is the accent; break drops to muted so the two phases are legible
  // at a glance from across a desk.
  const activeColor = phase === 'work' ? c.accent : c.fgMuted;

  // The mascot climbs a ladder as the session runs — see
  // packages/shared/src/session-milestones.ts. Driven by *credited* minutes
  // (the server's number), not by the phase countdown, so it reflects real
  // study time rather than where you are inside one pomodoro block.
  const creditedMinutes = Math.floor(displayedElapsedSeconds() / 60);
  const milestone = milestoneForMinutes(creditedMinutes);
  const toNext = minutesToNextMilestone(creditedMinutes);

  // Coming back to the foreground is exactly when the local picture is most
  // likely to be stale, so ask the server rather than extrapolating. The old
  // code guessed the gap with `fastForward(delta)`; now there is a real answer
  // to ask for, and guessing would only reintroduce client-side timekeeping.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  // Navigating away no longer pauses the session. The whole point of Fase 1 is
  // that the timer keeps running when the screen — or the app — goes away.
  useFocusEffect(useCallback(() => undefined, []));

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
        forceRender((n) => n + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [isRunning, tick]);

  useEffect(() => {
    // A stopwatch has no phase to roll over.
    if (isStopwatch) return;
    if (remainingSeconds <= 0 && isRunning && phaseElapsedSeconds > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (phase === 'work') void startBreak(); else void startWork();
    }
  }, [isStopwatch, remainingSeconds, isRunning, phase, phaseElapsedSeconds, startBreak, startWork]);

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
          // No local pause first — `end` is itself terminal on the server, and
          // pausing would only add a stray interval to the session's record.
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
  }, [endSession, goHome, isEnding, tr]);

  // Pause / resume / end tapped on the Android notification or the iOS Live
  // Activity run the same store methods as the in-app controls, so the two
  // surfaces can never disagree about what the session is doing. Declared after
  // `handleEndSession` because it closes over it.
  useEffect(() => {
    return onLiveTimerAction((action) => {
      if (action === 'pause') void pause();
      else if (action === 'resume') void resume();
      else if (action === 'end') handleEndSession();
    });
  }, [pause, resume, handleEndSession]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Always available now. Leaving the screen no longer stops the timer,
          so there is no reason to hide the way out while it runs. */}
      <Press
        haptic={false}
        scale={0.92}
        onPress={() => router.back()}
        style={styles.backBtn}
      >
        <ArrowLeft size={22} color={c.fgMuted} />
      </Press>

      <Text style={{ ...t.overline, color: activeColor, letterSpacing: 4 }}>
        {isStopwatch
          ? tr('active.stopwatch')
          : phase === 'work'
            ? tr('active.work')
            : tr('active.break')}
      </Text>

      {/* The heartbeat has been failing past the grace window: the server has
          already closed this session and credited it up to the last beat.
          Saying so is better than animating a timer that runs nowhere. */}
      {isDisconnected && (
        <Text style={{ ...t.label, color: c.danger, marginTop: space.sm, textAlign: 'center' }}>
          {tr('active.disconnected')}
        </Text>
      )}

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
            state={mascotForSession(creditedMinutes, isRunning && phase === 'work')}
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

      {/* The rung, and how far the next one is. The countdown is the point:
          "13 min para o próximo" lands exactly when someone is deciding
          whether to stop, which is the only moment it can change anything. */}
      <View style={styles.milestoneRow}>
        <Text style={{ ...t.label, color: c.accent }}>{tr(milestone.labelKey)}</Text>
        {toNext !== null && isRunning && (
          <Text style={{ ...t.caption, color: c.fgSubtle }}>
            {tr('milestone.toNext', { minutes: toNext })}
          </Text>
        )}
      </View>

      {/* Cycle dots are meaningless without a target duration. */}
      {!isStopwatch && (
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
      )}
      {isStopwatch && <View style={styles.stopwatchSpacer} />}

      <Press
        haptic="medium"
        scale={0.92}
        disabled={isDisconnected}
        onPress={() => void (isRunning ? pause() : resume())}
        style={[
          styles.controlBtn,
          { backgroundColor: activeColor, opacity: isDisconnected ? 0.4 : 1 },
        ]}
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
  milestoneRow: { alignItems: 'center', gap: 2, marginTop: space.sm },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },

  dotsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.xxl },
  cycleDot: { width: 8, height: 8, borderRadius: 4 },
  /** Keeps the control button in the same spot when the cycle dots are gone. */
  stopwatchSpacer: { height: 8, marginTop: space.lg, marginBottom: space.xxl },

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
