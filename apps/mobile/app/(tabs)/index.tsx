import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, xpForLevel, calculateTitle } from '@quibly/shared/constants';
import { FileText, ChevronRight, Sparkles, BookOpen, HelpCircle, Crown, Timer } from 'lucide-react-native';
import type { FlashcardSet, Quiz } from '@quibly/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { useUsage } from '../../hooks/useUsage';
import { listDocuments, type DocumentWithCounts } from '../../services/documents';
import { listFlashcardSets } from '../../services/flashcards';
import { listQuizzes } from '../../services/quizzes';
import StreakCalendarModal from '../../components/StreakCalendarModal';
import StreakBadge from '../../components/gamification/StreakBadge';
import XPProgressBar from '../../components/gamification/XPProgressBar';
import GamificationStats from '../../components/gamification/GamificationStats';
import UploadZone from '../../components/upload/UploadZone';
import { Clock, Star, Target, Zap } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatXp(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return String(xp);
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation('home');
  const { user, profile, refreshProfile } = useAuth();

  const { isPaused, subjectName: pausedSubjectName } = useSessionStore();
  const { usage, refresh: refreshUsage } = useUsage();
  const [documents, setDocuments] = useState<DocumentWithCounts[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [topic, setTopic] = useState('');

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      const [docs, sets, quizList] = await Promise.allSettled([
        listDocuments(),
        listFlashcardSets(),
        listQuizzes(),
      ]);
      if (docs.status === 'fulfilled') setDocuments(docs.value ?? []);
      if (sets.status === 'fulfilled') setFlashcardSets(sets.value ?? []);
      if (quizList.status === 'fulfilled') setQuizzes(quizList.value ?? []);
    } catch { /* Silently fail */ }
  }, [user]);

  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        if (!hasLoaded.current) setIsLoading(true);
        await Promise.all([fetchDashboardData(), refreshProfile()]);
        if (!cancelled) {
          setIsLoading(false);
          hasLoaded.current = true;
        }
      }
      load();
      return () => { cancelled = true; };
    }, [fetchDashboardData, refreshProfile])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchDashboardData(), refreshProfile(), refreshUsage()]);
    setIsRefreshing(false);
  }, [fetchDashboardData, refreshProfile, refreshUsage]);

  const handleGenerateTopic = () => {
    if (!topic.trim()) return;
    router.push({ pathname: '/generate', params: { topic: topic.trim() } } as any);
    setTopic('');
  };

  const totalHours = profile ? Math.floor(profile.total_study_minutes / 60) : 0;
  const currentLevel = profile?.level ?? 1;
  const currentXp = profile?.total_xp ?? 0;
  const title = profile ? calculateTitle(profile) : null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{t('greeting', { name: profile?.username ?? t('defaultName') })}</Text>
            {title && <Text style={[styles.headerTitle, { color: title.color }]}>{t(`profile:titles.${title.id}`)}</Text>}
          </View>
          <StreakBadge streak={profile?.current_streak ?? 0} onPress={() => setShowStreakCalendar(true)} />
        </View>

        {/* Stats */}
        <View style={{ marginBottom: 16 }}>
          <GamificationStats stats={[
            { icon: <Clock size={18} color={COLORS.primary} />, value: String(totalHours), label: t('totalHours') },
            { icon: <Zap size={18} color={COLORS.warning} />, value: String(currentLevel), label: t('level') },
            { icon: <Target size={18} color={COLORS.primaryLight} />, value: `${profile?.lock_in_score ?? 0}`, label: t('lockIn') },
            { icon: <Star size={18} color={COLORS.gold} />, value: formatXp(currentXp), label: t('xpLabel') },
          ]} />
        </View>

        {/* XP Progress */}
        <View style={{ marginBottom: 16 }}>
          <XPProgressBar level={currentLevel} totalXp={currentXp} />
        </View>

        {/* Start Studying (Pomodoro) */}
        <TouchableOpacity style={styles.startStudyCard} activeOpacity={0.85} onPress={() => router.push('/session/setup')}>
          <View style={styles.startStudyInner}>
            <Timer size={24} color={COLORS.text} style={{ marginRight: 14 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.startStudyTitle}>{t('startStudying')}</Text>
              <Text style={styles.startStudySubtitle}>{t('startStudyingSubtitle')}</Text>
            </View>
            <ChevronRight size={24} color={'rgba(255,255,255,0.6)'} />
          </View>
        </TouchableOpacity>

        {/* Free Plan Banner */}
        {usage && usage.plan === 'FREE' && (
          <View style={styles.freeBanner}>
            <View style={styles.freeBannerLeft}>
              <Text style={styles.freeBannerTitle}>{t('freeBanner')}</Text>
              <Text style={styles.freeBannerUsage}>
                {t('freeBannerUsage', { used: usage.flashcard_sets.used, limit: usage.flashcard_sets.limit })} flashcards
                {' · '}
                {t('freeBannerUsage', { used: usage.quizzes.used, limit: usage.quizzes.limit })} quizzes
              </Text>
            </View>
            <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8} onPress={() => router.push('/pricing')}>
              <Crown size={14} color={COLORS.background} style={{ marginRight: 4 }} />
              <Text style={styles.upgradeBtnText}>{t('upgradePro')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Paused Session */}
        {isPaused && (
          <TouchableOpacity style={styles.activeSessionCard} activeOpacity={0.85} onPress={() => router.push('/session/active')}>
            <View style={[styles.activeSessionPulse, { backgroundColor: COLORS.warning }]} />
            <View style={styles.activeSessionContent}>
              <View style={styles.activeSessionLeft}>
                <View style={styles.activeSessionIndicator}>
                  <View style={[styles.activeDot, { backgroundColor: COLORS.warning }]} />
                  <Text style={[styles.activeSessionTitle, { color: COLORS.warning }]}>{t('sessionPaused')}</Text>
                </View>
                {pausedSubjectName && <Text style={styles.pausedSubjectText}>{pausedSubjectName}</Text>}
              </View>
              <View style={styles.resumeButton}><Text style={styles.resumeButtonText}>{t('resume')}</Text></View>
            </View>
          </TouchableOpacity>
        )}

        {/* Upload Zone */}
        <View style={{ marginBottom: 16 }}>
          <UploadZone onPress={() => router.push('/upload')} />
        </View>

        {/* Generate by Topic */}
        <View style={styles.generateCard}>
          <View style={styles.generateHeader}>
            <Sparkles size={18} color={COLORS.secondary} />
            <Text style={styles.generateTitle}>{t('generateByTopic')}</Text>
          </View>
          <View style={styles.generateRow}>
            <TextInput
              style={styles.topicInput}
              placeholder={t('topicPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={topic}
              onChangeText={setTopic}
              onSubmitEditing={handleGenerateTopic}
              returnKeyType="go"
            />
            <TouchableOpacity
              style={[styles.generateButton, !topic.trim() && { opacity: 0.5 }]}
              activeOpacity={0.8}
              onPress={handleGenerateTopic}
              disabled={!topic.trim()}
            >
              <Text style={styles.generateButtonText}>{t('generate')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Documents */}
        {documents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('recentDocuments')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {documents.slice(0, 5).map((doc) => (
                <TouchableOpacity key={doc.id} style={styles.docCard} activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/generate', params: { documentId: doc.id, documentTitle: doc.title } } as any)}>
                  <FileText size={24} color={COLORS.primary} style={{ marginBottom: 8 }} />
                  <Text style={styles.docTitle} numberOfLines={2}>{doc.title}</Text>
                  <Text style={styles.docMeta}>{doc._count.flashcard_sets} sets · {doc._count.quizzes} quizzes</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Continue Studying */}
        {(flashcardSets.length > 0 || quizzes.length > 0) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('continueStudying')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
                <Text style={styles.seeAllLink}>{t('seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {flashcardSets.slice(0, 4).map((set) => (
                <TouchableOpacity key={set.id} style={styles.studyCard} activeOpacity={0.85}
                  onPress={() => router.push(`/flashcards/${set.id}`)}>
                  <BookOpen size={20} color={COLORS.secondary} style={{ marginBottom: 8 }} />
                  <Text style={styles.studyCardTitle} numberOfLines={2}>{set.title}</Text>
                  <Text style={styles.studyCardMeta}>{set._count?.flashcards ?? '?'} cards</Text>
                </TouchableOpacity>
              ))}
              {quizzes.slice(0, 4).map((quiz) => (
                <TouchableOpacity key={quiz.id} style={styles.studyCard} activeOpacity={0.85}
                  onPress={() => router.push(`/quizzes/${quiz.id}`)}>
                  <HelpCircle size={20} color={COLORS.accent} style={{ marginBottom: 8 }} />
                  <Text style={styles.studyCardTitle} numberOfLines={2}>{quiz.title}</Text>
                  <Text style={styles.studyCardMeta}>{quiz._count?.questions ?? '?'} questions</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <StreakCalendarModal
        visible={showStreakCalendar}
        onClose={() => setShowStreakCalendar(false)}
        currentStreak={profile?.current_streak ?? 0}
        longestStreak={profile?.longest_streak ?? 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingTop: 4 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 28, fontFamily: FONTS.bold, color: COLORS.text, letterSpacing: -0.5 },
  headerTitle: { fontSize: 13, fontFamily: FONTS.semiBold, marginTop: 4, letterSpacing: 0.3 },
  // Start study
  startStudyCard: { backgroundColor: COLORS.primary, borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  startStudyInner: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  startStudyTitle: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  startStudySubtitle: { fontSize: 13, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.7)' },
  // Free banner
  freeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.gold + '30' },
  freeBannerLeft: { flex: 1, marginRight: 10 },
  freeBannerTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.gold, marginBottom: 2 },
  freeBannerUsage: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  upgradeBtnText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.background },
  // Paused session
  activeSessionCard: { backgroundColor: COLORS.surface, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.success + '40', overflow: 'hidden' },
  activeSessionPulse: { height: 3 },
  activeSessionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  activeSessionLeft: { flex: 1, marginRight: 12 },
  activeSessionIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  activeSessionTitle: { fontSize: 15, fontFamily: FONTS.semiBold },
  pausedSubjectText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: 2 },
  resumeButton: { backgroundColor: COLORS.success, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  resumeButtonText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.background },
  // Generate
  generateCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  generateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  generateTitle: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text, marginLeft: 8 },
  generateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicInput: { flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 14, fontFamily: FONTS.regular, borderWidth: 1, borderColor: COLORS.border },
  generateButton: { backgroundColor: COLORS.secondary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  generateButtonText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.background },
  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  seeAllLink: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.primary },
  horizontalScroll: { paddingRight: 20, marginBottom: 16 },
  // Document card
  docCard: { width: SCREEN_WIDTH * 0.4, backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginRight: 12, borderWidth: 1, borderColor: COLORS.border },
  docTitle: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.text, marginBottom: 6 },
  docMeta: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted },
  // Study card
  studyCard: { width: SCREEN_WIDTH * 0.4, backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginRight: 12, borderWidth: 1, borderColor: COLORS.border },
  studyCardTitle: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.text, marginBottom: 6 },
  studyCardMeta: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted },
});
