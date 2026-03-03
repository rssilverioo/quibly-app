import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { ArrowLeft } from 'lucide-react-native';
import type { Quiz, Question } from '@quibly/shared';
import { getQuiz } from '../../services/quizzes';
import { useGamification } from '../../hooks/useGamification';
import QuizOption from '../../components/quizzes/QuizOption';
import QuizProgress from '../../components/quizzes/QuizProgress';
import XPToast from '../../components/common/XPToast';
import ConfettiOverlay from '../../components/common/ConfettiOverlay';

const LABELS = ['A', 'B', 'C', 'D'];

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

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await getQuiz(id);
        setQuiz(data);
        const sorted = data.questions?.sort((a, b) => a.sort_order - b.sort_order) ?? [];
        setQuestions(sorted);
        setAnswers(new Array(sorted.length).fill(null));
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const handleSelect = useCallback(async (optionIndex: number) => {
    if (revealed) return;
    setSelectedIndex(optionIndex);
    setRevealed(true);

    const question = questions[currentIndex];
    const isCorrect = optionIndex === question.correct_index;

    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = isCorrect;
      return next;
    });

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    try {
      const result = await award(isCorrect ? 'quiz_correct' : 'quiz_wrong');
      if (result) setShowXp(true);
    } catch {}

    // Auto-advance after 1.5s
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedIndex(null);
        setRevealed(false);
      } else {
        setIsComplete(true);
        const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
        const percent = Math.round((finalCorrect / questions.length) * 100);
        if (percent >= 70) {
          setShowConfetti(true);
        }
      }
    }, 1500);
  }, [revealed, currentIndex, questions, correctCount, award]);

  const getOptionState = (optionIndex: number) => {
    if (!revealed) return selectedIndex === optionIndex ? 'selected' : 'default';
    const question = questions[currentIndex];
    if (optionIndex === question.correct_index) return 'correct';
    if (optionIndex === selectedIndex) return 'incorrect';
    return 'default';
  };

  const handleRetake = () => {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setRevealed(false);
    setAnswers(new Array(questions.length).fill(null));
    setCorrectCount(0);
    setIsComplete(false);
    setShowConfetti(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><Text style={styles.emptyText}>{t('empty')}</Text></View>
      </SafeAreaView>
    );
  }

  const percent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <XPToast xp={lastXpResult?.xp_awarded ?? 0} visible={showXp} onDone={() => { setShowXp(false); clearLastResult(); }} />
      <ConfettiOverlay trigger={showConfetti} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{quiz.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <QuizProgress total={questions.length} current={currentIndex} answers={answers} />

      {isComplete ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsEmoji}>{percent >= 70 ? '🎉' : percent >= 50 ? '👍' : '💪'}</Text>
          <Text style={styles.resultsTitle}>{t('results')}</Text>
          <Text style={styles.resultsScore}>{t('score', { correct: correctCount, total: questions.length })}</Text>
          <Text style={styles.resultsPercent}>{t('scorePercent', { percent })}</Text>
          <Text style={styles.resultsMessage}>
            {percent >= 70 ? t('great') : percent >= 50 ? t('good') : t('tryAgain')}
          </Text>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={handleRetake}>
            <Text style={styles.primaryButtonText}>{t('retake')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          {/* Question */}
          <Text style={styles.questionNumber}>
            {t('questionOf', { current: currentIndex + 1, total: questions.length })}
          </Text>
          <Text style={styles.questionText}>{questions[currentIndex].question}</Text>

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
            <View style={styles.feedback}>
              <Text style={[styles.feedbackText, { color: selectedIndex === questions[currentIndex].correct_index ? COLORS.success : COLORS.error }]}>
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text, textAlign: 'center' },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  questionNumber: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 24, lineHeight: 28 },
  feedback: { marginTop: 8, padding: 16, backgroundColor: COLORS.surface, borderRadius: 14 },
  feedbackText: { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 4 },
  correctAnswer: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  resultsContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resultsEmoji: { fontSize: 48, marginBottom: 16 },
  resultsTitle: { fontSize: 28, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 8 },
  resultsScore: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.textSecondary, marginBottom: 4 },
  resultsPercent: { fontSize: 48, fontFamily: FONTS.bold, color: COLORS.primary, marginBottom: 8 },
  resultsMessage: { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginBottom: 32 },
  primaryButton: { width: '100%', backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  secondaryButton: { width: '100%', backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  secondaryButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.textSecondary },
});
