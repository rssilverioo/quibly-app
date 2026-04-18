import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Image, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS, calculateTitle } from '@quibly/shared/constants';
import { ChevronRight, BookOpen, HelpCircle, Timer, Upload, Sparkles, Headphones } from 'lucide-react-native';
import type { FlashcardSet, Quiz } from '@quibly/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { listFlashcardSets } from '../../services/flashcards';
import { listQuizzes } from '../../services/quizzes';
import { getStudyDates } from '../../services/sessions';
import StreakCalendarModal from '../../components/StreakCalendarModal';
import StreakBadge from '../../components/gamification/StreakBadge';
import { AlertCircle, TrendingUp, CheckCircle, Plus, ArrowRight } from 'lucide-react-native';
import { getFocusAreas, addFocusArea, type FocusArea } from '../../services/focus-areas';

const { width: SW } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation('home');
  const { user, profile, refreshProfile } = useAuth();
  const { isPaused, subjectName: pausedSubjectName } = useSessionStore();

  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [todaySessions, setTodaySessions] = useState(0);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [addingFocus, setAddingFocus] = useState(false);
  const [focusTopic, setFocusTopic] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const [sets, quizList, studyDates, areas] = await Promise.allSettled([
        listFlashcardSets(),
        listQuizzes(),
        getStudyDates(now.getFullYear(), now.getMonth() + 1),
        getFocusAreas(),
      ]);
      if (sets.status === 'fulfilled') setFlashcardSets(sets.value ?? []);
      if (quizList.status === 'fulfilled') setQuizzes(quizList.value ?? []);
      if (studyDates.status === 'fulfilled') {
        const today = now.toISOString().split('T')[0];
        const todayData = studyDates.value?.find((d) => d.date.startsWith(today));
        setTodaySessions(todayData ? Math.ceil(todayData.minutes / 25) : 0);
      }
      if (areas.status === 'fulfilled') {
        setFocusAreas(areas.value ?? []);
      }
    } catch {}
  }, [user]);

  const hasLoaded = useRef(false);
  const isFetching = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isFetching.current) return;
      isFetching.current = true;
      let cancelled = false;
      (async () => {
        if (!hasLoaded.current) setIsLoading(true);
        try {
          await Promise.allSettled([fetchData(), refreshProfile()]);
        } catch {}
        if (!cancelled) { setIsLoading(false); hasLoaded.current = true; }
        isFetching.current = false;
      })();
      return () => { cancelled = true; isFetching.current = false; };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.allSettled([fetchData(), refreshProfile()]);
    setIsRefreshing(false);
  }, [fetchData, refreshProfile]);

  const title = profile ? calculateTitle(profile) : null;
  const hasContent = flashcardSets.length > 0 || quizzes.length > 0;

  if (isLoading) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#EEF5FF', '#DCEAFE', '#E8F4FD']} style={StyleSheet.absoluteFill} />
        <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#EEF5FF', '#DCEAFE', '#E8F4FD']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{t('greeting', { name: profile?.username || user?.displayName || t('defaultName') })}</Text>
              {title && <Text style={[styles.titleBadge, { color: title.color }]}>{t(`profile:titles.${title.id}`)}</Text>}
            </View>
            <StreakBadge streak={profile?.current_streak ?? 0} onPress={() => setShowStreakCalendar(true)} />
          </View>

          {/* Focus Areas — only show when there's data */}
          {focusAreas.length > 0 && (
            <View style={styles.focusSection}>
              <Text style={styles.focusSectionTitle}>Focus Areas</Text>

              {focusAreas.map((area) => {
                const isWeak = area.status === 'weak';
                const isMastered = area.status === 'mastered';
                const statusColor = isWeak ? '#EF4444' : isMastered ? '#10B981' : '#F59E0B';
                const statusBg = isWeak ? '#FEE2E2' : isMastered ? '#D1FAE5' : '#FEF3C7';
                const statusLabel = isWeak ? 'Needs work' : isMastered ? 'Mastered' : 'Getting better';

                return (
                  <TouchableOpacity
                    key={area.id}
                    style={styles.focusCard}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/generate', params: { topic: area.topic, fromTopic: 'true' } } as any)}
                  >
                    <View style={[styles.focusIndicator, { backgroundColor: statusColor }]} />
                    <View style={styles.focusContent}>
                      <Text style={styles.focusTopic}>{area.topic}</Text>
                      <View style={styles.focusMetaRow}>
                        <View style={[styles.focusStatusBadge, { backgroundColor: statusBg }]}>
                          <Text style={[styles.focusStatusText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                        <Text style={styles.focusScore}>{area.score}%</Text>
                      </View>
                    </View>
                    <ArrowRight size={18} color="#8BA3BC" />
                  </TouchableOpacity>
                );
              })}

              {/* Add topic */}
              {addingFocus ? (
                <View style={styles.addFocusInput}>
                  <TextInput
                    style={styles.focusInput}
                    placeholder="What topic are you struggling with?"
                    placeholderTextColor="#8BA3BC"
                    value={focusTopic}
                    onChangeText={setFocusTopic}
                    autoFocus
                    onSubmitEditing={async () => {
                      if (!focusTopic.trim()) return;
                      try {
                        const area = await addFocusArea(focusTopic.trim());
                        setFocusAreas((prev) => [area, ...prev]);
                        setFocusTopic('');
                        setAddingFocus(false);
                      } catch {}
                    }}
                    returnKeyType="done"
                  />
                </View>
              ) : (
                <TouchableOpacity style={styles.addFocusBtn} activeOpacity={0.85} onPress={() => setAddingFocus(true)}>
                  <Plus size={18} color="#1E40AF" />
                  <Text style={styles.addFocusBtnText}>Add a topic you're struggling with</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick Actions Grid — 2x2 */}
          <Text style={styles.sectionLabel}>{t('quickActions', { defaultValue: 'Quick Actions' })}</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#DBEAFE' }]} activeOpacity={0.85} onPress={() => router.push('/upload')}>
              <View style={[styles.gridIcon, { backgroundColor: '#1E40AF' }]}>
                <Upload size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.gridTitle}>{t('uploadPdf')}</Text>
              <Text style={styles.gridSub}>{t('uploadPdfSub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#D1FAE5' }]} activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/generate', params: { fromTopic: 'true' } } as any)}>
              <View style={[styles.gridIcon, { backgroundColor: '#059669' }]}>
                <Sparkles size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.gridTitle}>{t('generateByTopic')}</Text>
              <Text style={styles.gridSub}>{t('generateByTopicSub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#EDE9FE' }]} activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/library')}>
              <View style={[styles.gridIcon, { backgroundColor: '#7C3AED' }]}>
                <BookOpen size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.gridTitle}>{t('library', { defaultValue: 'Library' })}</Text>
              <Text style={styles.gridSub}>{t('librarySub', { defaultValue: 'Your flashcards & quizzes' })}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.gridCard, { backgroundColor: '#FEE2E2' }]} activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/library')}>
              <View style={[styles.gridIcon, { backgroundColor: '#DC2626' }]}>
                <HelpCircle size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.gridTitle}>{t('quizzes', { defaultValue: 'Quizzes' })}</Text>
              <Text style={styles.gridSub}>{t('quizzesSub', { defaultValue: 'Test your knowledge' })}</Text>
            </TouchableOpacity>
          </View>

          {/* Paused session */}
          {isPaused && (
            <TouchableOpacity style={styles.pausedCard} activeOpacity={0.85} onPress={() => router.push('/session/active')}>
              <View style={styles.pausedDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pausedTitle}>{t('sessionPaused')}</Text>
                {pausedSubjectName && <Text style={styles.pausedSubject}>{pausedSubjectName}</Text>}
              </View>
              <View style={styles.resumeBtn}><Text style={styles.resumeText}>{t('resume')}</Text></View>
            </TouchableOpacity>
          )}

          {/* Continue Studying */}
          {hasContent && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('continueStudying')}</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
                  <Text style={styles.seeAll}>{t('seeAll')}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {flashcardSets.slice(0, 5).map((set) => (
                  <TouchableOpacity key={set.id} style={styles.studyCard} activeOpacity={0.85}
                    onPress={() => router.push(`/flashcards/${set.id}`)}>
                    <View style={[styles.studyBadge, { backgroundColor: '#DBEAFE' }]}>
                      <BookOpen size={16} color="#1E40AF" />
                    </View>
                    <Text style={styles.studyTitle} numberOfLines={2}>{set.title}</Text>
                    <Text style={styles.studyMeta}>{set._count?.flashcards ?? '?'} cards</Text>
                  </TouchableOpacity>
                ))}
                {quizzes.slice(0, 5).map((quiz) => (
                  <TouchableOpacity key={quiz.id} style={styles.studyCard} activeOpacity={0.85}
                    onPress={() => router.push(`/quizzes/${quiz.id}`)}>
                    <View style={[styles.studyBadge, { backgroundColor: '#FEE2E2' }]}>
                      <HelpCircle size={16} color="#DC2626" />
                    </View>
                    <Text style={styles.studyTitle} numberOfLines={2}>{quiz.title}</Text>
                    <Text style={styles.studyMeta}>{quiz._count?.questions ?? '?'} questions</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>

      <StreakCalendarModal
        visible={showStreakCalendar}
        onClose={() => setShowStreakCalendar(false)}
        currentStreak={profile?.current_streak ?? 0}
        longestStreak={profile?.longest_streak ?? 0}
      />
    </View>
  );
}

const CARD_GAP = 12;
const GRID_CARD_W = (SW - 40 - CARD_GAP) / 2;

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingTop: 4 },
  greeting: { fontSize: 26, fontFamily: FONTS.bold, color: '#1A2E4A', letterSpacing: -0.5 },
  titleBadge: { fontSize: 13, fontFamily: FONTS.semiBold, marginTop: 3, letterSpacing: 0.3 },

  // Hero
  heroCard: { borderRadius: 24, marginBottom: 24, overflow: 'hidden', shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  heroInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24 },
  heroTitle: { fontSize: 22, fontFamily: FONTS.bold, color: '#FFFFFF', marginBottom: 4 },
  heroSub: { fontSize: 14, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.75)' },
  heroIconCircle: { width: 56, height: 56, borderRadius: 56, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  // Section label
  // Focus Areas
  focusSection: { marginBottom: 20 },
  focusSectionTitle: { fontSize: 18, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 12 },
  focusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, overflow: 'hidden' },
  focusIndicator: { width: 4, height: 36, borderRadius: 2, marginRight: 14 },
  focusContent: { flex: 1 },
  focusTopic: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#1A2E4A', marginBottom: 4 },
  focusMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  focusStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  focusStatusText: { fontSize: 11, fontFamily: FONTS.semiBold },
  focusScore: { fontSize: 12, fontFamily: FONTS.medium, color: '#8BA3BC' },
  addFocusBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DBEAFE', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#93C5FD', borderStyle: 'dashed' },
  addFocusBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: '#1E40AF' },
  addFocusInput: { marginTop: 4 },
  focusInput: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: FONTS.medium, color: '#1A2E4A', borderWidth: 1.5, borderColor: '#1E40AF' },

  sectionLabel: { fontSize: 18, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 14 },

  // Grid 2x2
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, marginBottom: 24 },
  gridCard: { width: GRID_CARD_W, borderRadius: 20, padding: 16, minHeight: 130 },
  gridIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridTitle: { fontSize: 15, fontFamily: FONTS.bold, color: '#1A2E4A', marginBottom: 4 },
  gridSub: { fontSize: 11, fontFamily: FONTS.regular, color: '#4A6580', lineHeight: 15 },

  // Paused
  pausedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  pausedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B', marginRight: 12 },
  pausedTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#1A2E4A' },
  pausedSubject: { fontSize: 12, fontFamily: FONTS.regular, color: '#8BA3BC', marginTop: 2 },
  resumeBtn: { backgroundColor: '#10B981', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12 },
  resumeText: { fontSize: 13, fontFamily: FONTS.bold, color: '#FFFFFF' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.bold, color: '#1A2E4A' },
  seeAll: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#3B82F6' },
  hScroll: { paddingRight: 20, marginBottom: 8 },

  // Study cards
  studyCard: { width: SW * 0.38, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginRight: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  studyBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  studyTitle: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#1A2E4A', marginBottom: 6 },
  studyMeta: { fontSize: 11, fontFamily: FONTS.medium, color: '#8BA3BC' },
});
