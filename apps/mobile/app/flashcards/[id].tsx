import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { ArrowLeft, ChevronLeft, ChevronRight, Headphones } from 'lucide-react-native';
import type { FlashcardSet, Flashcard } from '@quibly/shared';
import { getFlashcardSet } from '../../services/flashcards';
import { createAudioSession } from '../../services/audio-sessions';
import { useGamification } from '../../hooks/useGamification';
import FlashcardCard from '../../components/flashcards/FlashcardCard';
import XPToast from '../../components/common/XPToast';
import ConfettiOverlay from '../../components/common/ConfettiOverlay';

export default function FlashcardPlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('flashcards');
  const { award, lastXpResult, clearLastResult } = useGamification();

  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showXp, setShowXp] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [reviewedCards, setReviewedCards] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setId = Array.isArray(id) ? id[0] : id;
    if (!setId) return;
    (async () => {
      try {
        const data = await getFlashcardSet(setId);
        setSet(data);
        const flashcards = data.flashcards ?? [];
        setCards(flashcards.sort((a: Flashcard, b: Flashcard) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      } catch (err: any) {
        console.error('[FlashcardPlayer] Failed to load:', err?.message);
        setError(err?.message ?? 'Failed to load flashcards');
      }
      setLoading(false);
    })();
  }, [id]);

  const handleFlip = useCallback(async () => {
    if (reviewedCards.has(currentIndex)) return;
    setReviewedCards((prev) => new Set(prev).add(currentIndex));
    try {
      const result = await award('flashcard_review');
      if (result) {
        setShowXp(true);
      }
    } catch {}
  }, [currentIndex, reviewedCards, award]);

  const goNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      setIsComplete(true);
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleReviewAgain = () => {
    setCurrentIndex(0);
    setIsComplete(false);
    setShowConfetti(false);
    setReviewedCards(new Set());
  };

  const handleStudyWithAudio = useCallback(async () => {
    const setId = Array.isArray(id) ? id[0] : id;
    if (!setId) return;
    try {
      const created = await createAudioSession(setId, 20);
      router.push({ pathname: '/session/audio', params: { id: created.id } });
    } catch (err: any) {
      console.error('[FlashcardPlayer] Audio session failed:', err?.message);
    }
  }, [id, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  if (error || !set || cards.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error ?? t('empty')}</Text>
          <TouchableOpacity style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.surface, borderRadius: 10 }}
            onPress={() => router.back()}>
            <Text style={{ color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 14 }}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <XPToast xp={lastXpResult?.xp_awarded ?? 0} visible={showXp} onDone={() => { setShowXp(false); clearLastResult(); }} />
      <ConfettiOverlay trigger={showConfetti} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{set.title}</Text>
        <TouchableOpacity onPress={handleStudyWithAudio} style={styles.audioBtn} hitSlop={10}>
          <Headphones size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((currentIndex + 1) / cards.length) * 100}%` }]} />
      </View>

      {isComplete ? (
        <View style={styles.completeContainer}>
          <Text style={styles.completeTitle}>{t('complete')}</Text>
          <Text style={styles.completeMessage}>{t('completeMessage', { count: cards.length })}</Text>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={handleReviewAgain}>
            <Text style={styles.primaryButtonText}>{t('reviewAgain')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Card */}
          <View style={styles.cardContainer}>
            <FlashcardCard
              key={currentIndex}
              front={cards[currentIndex].front}
              back={cards[currentIndex].back}
              explain={cards[currentIndex].explain}
              imageUrl={cards[currentIndex].image_url}
              onFlip={handleFlip}
            />
            <Text style={styles.flipHint}>{t('flip')}</Text>
          </View>

          {/* Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.navBtn, currentIndex === 0 && { opacity: 0.3 }]}
              onPress={goPrev} disabled={currentIndex === 0}>
              <ChevronLeft size={28} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtnNext} onPress={goNext}>
              <Text style={styles.navBtnNextText}>
                {currentIndex === cards.length - 1 ? t('common:done') : t('next')}
              </Text>
              <ChevronRight size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </>
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
  headerTitle: { flex: 1, fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text, marginHorizontal: 8 },
  counter: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  audioBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 4, backgroundColor: COLORS.surfaceLight, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  cardContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  flipHint: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  navBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  navBtnNext: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, backgroundColor: COLORS.primary, borderRadius: 16, gap: 4 },
  navBtnNextText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  completeContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  completeTitle: { fontSize: 28, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 8 },
  completeMessage: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32 },
  primaryButton: { width: '100%', backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text },
  secondaryButton: { width: '100%', backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  secondaryButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.textSecondary },
});
