import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, Dimensions, AppState } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { useSessionStore } from '../../stores/session.store';
import { useAuth } from '../../contexts/AuthContext';
import ProofCheckModal from '../../components/ProofCheckModal';
import LevelUpAnimation from '../../components/LevelUpAnimation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIMER_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

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

  // Fast-forward timer when returning from background
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

  // Auto-pause when navigating away from this screen
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

  const handleBack = useCallback(() => {
    pause();
    router.back();
  }, [pause, router]);

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
        } catch (err) {
          console.error('[EndSession] Error:', err);
          setIsEnding(false);
        }
        goHome();
      }},
    ]);
  }, [endSession, pause, goHome, isEnding]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {!isRunning && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={18} color={COLORS.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}
      <View style={styles.phaseContainer}>
        <Text style={[styles.phaseLabel, phase === 'break' && styles.phaseLabelBreak]}>
          {phase === 'work' ? 'WORK' : 'BREAK'}
        </Text>
      </View>

      <View style={styles.timerContainer}>
        <View style={[styles.timerOuter, phase === 'break' && styles.timerOuterBreak]}>
          <Text style={[styles.timerText, phase === 'break' && styles.timerTextBreak]}>{timerDisplay}</Text>
        </View>
      </View>

      {subjectName && (
        <View style={styles.subjectContainer}>
          <View style={[styles.subjectDot, { backgroundColor: subjectColor ?? COLORS.primary }]} />
          <Text style={styles.subjectNameText}>{subjectName}</Text>
        </View>
      )}

      <View style={styles.dotsContainer}>
        {Array.from({ length: totalCycles }).map((_, i) => (
          <View key={i} style={[styles.dot, i < pomodorosCompleted ? styles.dotFilled : styles.dotOutline]} />
        ))}
      </View>

      <TouchableOpacity style={styles.pauseButton} onPress={handlePauseResume} activeOpacity={0.7}>
        <Text style={styles.pauseButtonText}>{isRunning ? 'Pause' : 'Resume'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.endButton, isEnding && { opacity: 0.5 }]} onPress={handleEndSession} activeOpacity={0.7} disabled={isEnding}>
        <Text style={styles.endButtonText}>{isEnding ? 'Ending...' : 'End Session'}</Text>
      </TouchableOpacity>

      {pendingProofCheck && <ProofCheckModal />}

      {showLevelUp && levelUpTo && (
        <LevelUpAnimation newLevel={levelUpTo} onComplete={goHome} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  backButton: { position: 'absolute', top: 60, left: 20, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  backText: { color: COLORS.textSecondary, fontSize: 16, fontFamily: FONTS.medium },
  phaseContainer: { marginBottom: 32 },
  phaseLabel: { color: COLORS.primary, fontSize: 14, fontFamily: FONTS.bold, letterSpacing: 6, textTransform: 'uppercase' },
  phaseLabelBreak: { color: COLORS.secondary },
  timerContainer: { width: TIMER_SIZE, height: TIMER_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  timerOuter: { width: TIMER_SIZE, height: TIMER_SIZE, borderRadius: TIMER_SIZE / 2, borderWidth: 3, borderColor: COLORS.primary + '30', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface + '60' },
  timerOuterBreak: { borderColor: COLORS.secondary + '30' },
  timerText: { color: COLORS.text, fontSize: 64, fontFamily: FONTS.bold, letterSpacing: 2 },
  timerTextBreak: { color: COLORS.secondary },
  subjectContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  subjectDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  subjectNameText: { color: COLORS.textSecondary, fontSize: 15, fontFamily: FONTS.medium },
  dotsContainer: { flexDirection: 'row', gap: 10, marginBottom: 48 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFilled: { backgroundColor: COLORS.primary },
  dotOutline: { borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: 'transparent' },
  pauseButton: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: 16 },
  pauseButtonText: { color: COLORS.textSecondary, fontSize: 15, fontFamily: FONTS.medium },
  endButton: { paddingHorizontal: 24, paddingVertical: 10 },
  endButtonText: { color: COLORS.accent, fontSize: 14, fontFamily: FONTS.medium },
});
