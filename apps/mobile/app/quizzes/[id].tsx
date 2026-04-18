import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@quibly/shared/constants';
import { ArrowLeft, Trophy, Zap, Flame, RotateCcw } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Quiz, Question } from '@quibly/shared';
import { getQuiz } from '../../services/quizzes';
import { useGamification } from '../../hooks/useGamification';
import QuizOption from '../../components/quizzes/QuizOption';
import QuizProgress from '../../components/quizzes/QuizProgress';
import XPToast from '../../components/common/XPToast';
import ConfettiOverlay from '../../components/common/ConfettiOverlay';

const { width: SW } = Dimensions.get('window');
const LABELS = ['A', 'B', 'C', 'D'];
const RING_SIZE = 140;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export default function QuizPlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('quizzes');
  const { award, lastXpResult, clearLastResult } = useGamification();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<(boolean | null)[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showXp, setShowXp] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gamification
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [showCombo, setShowCombo] = useState(false);

  useEffect(() => {
    const quizId = Array.isArray(id) ? id[0] : id;
    if (!quizId) return;
    (async () => {
      try {
        const data = await getQuiz(quizId);
        setQuiz(data);
        const sorted = data.questions?.sort((a: Question, b: Question) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) ?? [];
        setQuestions(sorted);
        setAnswers(new Array(sorted.length).fill(null));
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load quiz');
      }
      setLoading(false);
    })();
  }, [id]);

  const handleSelect = useCallback(async (optionIndex: number) => {
    if (revealed) return;
    setSelectedIndex(optionIndex);
    setRevealed(true);

    const question = questions[currentIndex];
    const isCorrect = optionIndex === question.correct_index;

    setAnswers((prev) => { const next = [...prev]; next[currentIndex] = isCorrect; return next; });

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Combo bonus at 3+
      if (newStreak >= 3 && newStreak % 3 === 0) {
        setShowCombo(true);
        setTimeout(() => setShowCombo(false), 1500);
      }
    } else {
      setStreak(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    try {
      const result = await award(isCorrect ? 'quiz_correct' : 'quiz_wrong');
      if (result) {
        setTotalXpEarned((prev) => prev + (result.xp_awarded ?? 0));
        setShowXp(true);
      }
    } catch {}

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedIndex(null);
        setRevealed(false);
      } else {
        setIsComplete(true);
        const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
        if (Math.round((finalCorrect / questions.length) * 100) >= 70) setShowConfetti(true);
      }
    }, 1500);
  }, [revealed, currentIndex, questions, correctCount, streak, bestStreak, award]);

  const getOptionState = (optionIndex: number) => {
    if (!revealed) return selectedIndex === optionIndex ? 'selected' : 'default';
    const question = questions[currentIndex];
    if (optionIndex === question.correct_index) return 'correct';
    if (optionIndex === selectedIndex) return 'incorrect';
    return 'default';
  };

  const handleRetake = () => {
    setCurrentIndex(0); setSelectedIndex(null); setRevealed(false);
    setAnswers(new Array(questions.length).fill(null));
    setCorrectCount(0); setIsComplete(false); setShowConfetti(false);
    setStreak(0); setBestStreak(0); setTotalXpEarned(0);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>
      </SafeAreaView>
    );
  }

  if (error || !quiz || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#1A2E4A" />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error ?? t('empty')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const percent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const ringOffset = RING_CIRC * (1 - percent / 100);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <XPToast xp={lastXpResult?.xp_awarded ?? 0} visible={showXp} onDone={() => { setShowXp(false); clearLastResult(); }} />
      <ConfettiOverlay trigger={showConfetti} />

      {/* Combo toast */}
      {showCombo && (
        <View style={styles.comboToast}>
          <Flame size={18} color="#F59E0B" />
          <Text style={styles.comboText}>Combo! +10 bonus XP</Text>
        </View>
      )}

      {isComplete ? (
        /* ── RESULTS ── */
        <ScrollView contentContainerStyle={styles.resultsScroll}>
          <View style={styles.trophyCircle}>
            <Trophy size={48} color="#D97706" />
          </View>

          <Text style={styles.resultsTitle}>
            {percent >= 70 ? 'Congratulations!' : percent >= 50 ? 'Good job!' : 'Keep practicing!'}
          </Text>

          {/* Score ring */}
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                stroke="#E2E8F0" strokeWidth={RING_STROKE} fill="none" />
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                stroke={percent >= 70 ? '#059669' : percent >= 50 ? '#1E40AF' : '#EF4444'}
                strokeWidth={RING_STROKE} fill="none"
                strokeDasharray={`${RING_CIRC}`} strokeDashoffset={ringOffset}
                strokeLinecap="round" />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringPercent}>{percent}%</Text>
            </View>
          </View>

          <Text style={styles.scoreText}>{correctCount}/{questions.length} correct</Text>

          {/* Stats cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Zap size={20} color="#1E40AF" />
              <Text style={styles.statValue}>{totalXpEarned}</Text>
              <Text style={styles.statLabel}>XP earned</Text>
            </View>
            <View style={styles.statCard}>
              <Flame size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{bestStreak}</Text>
              <Text style={styles.statLabel}>Best streak</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleRetake}>
            <RotateCcw size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>{t('retake')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ── QUIZ ── */
        <>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={22} color="#1A2E4A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              Question {currentIndex + 1}/{questions.length}
            </Text>
            {streak > 0 ? (
              <View style={styles.streakBadge}>
                <Flame size={14} color="#F59E0B" />
                <Text style={styles.streakText}>{streak}</Text>
              </View>
            ) : <View style={{ width: 40 }} />}
          </View>

          <QuizProgress total={questions.length} current={currentIndex} answers={answers} />

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
            {/* Question card */}
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>{questions[currentIndex].question}</Text>
              {questions[currentIndex].image_url ? (
                <Image source={{ uri: questions[currentIndex].image_url }}
                  style={styles.questionImage} resizeMode="cover" />
              ) : null}
            </View>

            {/* Options */}
            {questions[currentIndex].options.map((option, i) => (
              <QuizOption
                key={i}
                label={LABELS[i]}
                text={option}
                state={getOptionState(i)}
                onPress={() => handleSelect(i)}
                disabled={revealed}
              />
            ))}

            {/* Feedback */}
            {revealed && (
              <View style={[styles.feedbackCard, {
                backgroundColor: selectedIndex === questions[currentIndex].correct_index ? '#D1FAE5' : '#FEE2E2',
              }]}>
                <Text style={[styles.feedbackText, {
                  color: selectedIndex === questions[currentIndex].correct_index ? '#059669' : '#DC2626',
                }]}>
                  {selectedIndex === questions[currentIndex].correct_index ? t('correct') : t('incorrect')}
                </Text>
                {selectedIndex !== questions[currentIndex].correct_index && (
                  <Text style={styles.correctAnswer}>
                    {t('correctAnswer', { answer: questions[currentIndex].options[questions[currentIndex].correct_index] })}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF5FF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, fontFamily: FONTS.medium, color: '#8BA3BC' },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 12 },
  retryBtnText: { color: '#1E40AF', fontFamily: FONTS.semiBold, fontSize: 14 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: FONTS.bold, color: '#1A2E4A', textAlign: 'center' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 },
  streakText: { fontSize: 14, fontFamily: FONTS.bold, color: '#D97706' },

  // Combo toast
  comboToast: { position: 'absolute', top: 110, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  comboText: { fontSize: 14, fontFamily: FONTS.bold, color: '#D97706' },

  // Content
  contentInner: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  questionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  questionText: { fontSize: 18, fontFamily: FONTS.bold, color: '#1A2E4A', lineHeight: 26 },
  questionImage: { width: '100%', height: 180, borderRadius: 14, marginTop: 14 },

  feedbackCard: { borderRadius: 14, padding: 16, marginTop: 4 },
  feedbackText: { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 4 },
  correctAnswer: { fontSize: 14, fontFamily: FONTS.medium, color: '#4A6580' },

  // Results
  resultsScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40 },
  trophyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  resultsTitle: { fontSize: 28, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 24 },

  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringPercent: { fontSize: 36, fontFamily: FONTS.bold, color: '#1A2E4A' },
  scoreText: { fontSize: 16, fontFamily: FONTS.medium, color: '#8BA3BC', marginBottom: 28 },

  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 32, width: '100%' },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statValue: { fontSize: 24, fontFamily: FONTS.bold, color: '#1A2E4A', marginTop: 6, marginBottom: 2 },
  statLabel: { fontSize: 12, fontFamily: FONTS.medium, color: '#8BA3BC' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', backgroundColor: '#1E40AF', borderRadius: 16, paddingVertical: 16, marginBottom: 12, shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  primaryBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#FFFFFF' },
  secondaryBtn: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
  secondaryBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#4A6580' },
});
