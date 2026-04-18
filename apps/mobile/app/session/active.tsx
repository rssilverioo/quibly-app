import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, AppState } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Pause, Play, Square } from 'lucide-react-native';
import { FONTS } from '@quibly/shared/constants';
import Svg, { Circle } from 'react-native-svg';
import { useSessionStore } from '../../stores/session.store';
import { useAuth } from '../../contexts/AuthContext';
import ProofCheckModal from '../../components/ProofCheckModal';
import LevelUpAnimation from '../../components/LevelUpAnimation';

const { width: SW } = Dimensions.get('window');
const TIMER_SIZE = Math.min(SW * 0.7, 280);
const STROKE_WIDTH = 10;
const RADIUS = (TIMER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const WORK_COLOR = '#1E40AF';
const BREAK_COLOR = '#10B981';

export default function ActiveSessionScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpTo, setLevelUpTo] = useState<number | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const {
    elapsedSeconds, isRunning, phase, pomodorosCompleted,
    workDuration, breakDuration, subjectName, subjectColor,
    pendingProofCheck, tick, pause, resume, startBreak, startWork,
    endSession, reset, fastForward,
  } = useSessionStore();

  const totalCycles = 4;
  const currentPhaseDuration = phase === 'work' ? workDuration : breakDuration;
  const totalPhaseSeconds = currentPhaseDuration * 60;
  const remainingSeconds = Math.max(0, totalPhaseSeconds - elapsedSeconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timerDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progress = totalPhaseSeconds > 0 ? (totalPhaseSeconds - remainingSeconds) / totalPhaseSeconds : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const activeColor = phase === 'work' ? WORK_COLOR : BREAK_COLOR;

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
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [isRunning, tick]);

  useEffect(() => {
    if (remainingSeconds <= 0 && isRunning && elapsedSeconds > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (phase === 'work') startBreak(); else startWork();
    }
  }, [remainingSeconds, isRunning, phase, elapsedSeconds, startBreak, startWork]);

  const handlePauseResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    isRunning ? pause() : resume();
  }, [isRunning, pause, resume]);

  const handleBack = useCallback(() => { pause(); router.back(); }, [pause, router]);

  const goHome = useCallback(async () => {
    reset();
    await refreshProfile();
    router.replace('/');
  }, [reset, refreshProfile, router]);

  const handleEndSession = useCallback(() => {
    if (isEnding) return;
    Alert.alert('End Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Session', style: 'destructive', onPress: async () => {
        setIsEnding(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        pause();
        try {
          const result = await endSession();
          if (result.previousLevel && result.newLevel && result.newLevel > result.previousLevel) {
            setLevelUpTo(result.newLevel);
            setShowLevelUp(true);
            return;
          }
        } catch (err) { console.error('[EndSession]', err); setIsEnding(false); }
        goHome();
      }},
    ]);
  }, [endSession, pause, goHome, isEnding]);

  return (
    <View style={styles.container}>
      {/* Back button — only when paused */}
      {!isRunning && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={18} color="#8BA3BC" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}

      {/* Phase label */}
      <Text style={[styles.phaseLabel, { color: activeColor }]}>
        {phase === 'work' ? 'WORK' : 'BREAK'}
      </Text>

      {/* Circular timer */}
      <View style={styles.timerWrap}>
        <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Background track */}
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke="#E2E8F0"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={TIMER_SIZE / 2}
            cy={TIMER_SIZE / 2}
            r={RADIUS}
            stroke={activeColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        {/* Timer text centered */}
        <View style={styles.timerTextWrap}>
          <Text style={styles.timerText}>{timerDisplay}</Text>
        </View>
      </View>

      {/* Subject */}
      {subjectName && (
        <View style={styles.subjectRow}>
          <View style={[styles.subjectDot, { backgroundColor: subjectColor ?? WORK_COLOR }]} />
          <Text style={styles.subjectName}>{subjectName}</Text>
        </View>
      )}

      {/* Pomodoro dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: totalCycles }).map((_, i) => (
          <View key={i} style={[styles.dot, i < pomodorosCompleted ? { backgroundColor: WORK_COLOR } : styles.dotEmpty]} />
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: activeColor }]}
          onPress={handlePauseResume}
          activeOpacity={0.85}
        >
          {isRunning
            ? <Pause size={28} color="#FFFFFF" />
            : <Play size={28} color="#FFFFFF" style={{ marginLeft: 3 }} />
          }
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.endBtn, isEnding && { opacity: 0.5 }]}
        onPress={handleEndSession}
        activeOpacity={0.7}
        disabled={isEnding}
      >
        <Square size={16} color="#EF4444" style={{ marginRight: 6 }} />
        <Text style={styles.endBtnText}>{isEnding ? 'Ending...' : 'End Session'}</Text>
      </TouchableOpacity>

      {pendingProofCheck && <ProofCheckModal />}

      {showLevelUp && levelUpTo && (
        <LevelUpAnimation newLevel={levelUpTo} onComplete={goHome} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  backButton: { position: 'absolute', top: 60, left: 20, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  backText: { color: '#8BA3BC', fontSize: 16, fontFamily: FONTS.medium },

  phaseLabel: { fontSize: 14, fontFamily: FONTS.bold, letterSpacing: 6, textTransform: 'uppercase', marginBottom: 32 },

  timerWrap: { width: TIMER_SIZE, height: TIMER_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  timerTextWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  timerText: { color: '#1A2E4A', fontSize: 56, fontFamily: FONTS.bold, letterSpacing: 2 },

  subjectRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  subjectName: { color: '#4A6580', fontSize: 15, fontFamily: FONTS.medium },

  dotsRow: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotEmpty: { borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: 'transparent' },

  controls: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  controlBtn: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },

  endBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  endBtnText: { color: '#EF4444', fontSize: 14, fontFamily: FONTS.medium },
});
