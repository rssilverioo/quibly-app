import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
let BannerAd: any = null;
let BannerAdSize: any = {};
try {
  const ads = require('react-native-google-mobile-ads');
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
} catch {
  // Not available in Expo Go — banner won't render
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, xpForLevel, calculateTitle } from '@quibly/shared/constants';
import { Flame, BookOpen, ChevronRight, Trophy } from 'lucide-react-native';
import type { League, Subject } from '@quibly/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { getMyLeagues } from '../../services/leagues';
import { getSubjects } from '../../services/subjects';
import StreakCalendarModal from '../../components/StreakCalendarModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AD_UNIT_ID = 'ca-app-pub-7106022757613059/1065115011';

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
  const [leagues, setLeagues] = useState<League[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      const [leaguesList, subjectsList] = await Promise.allSettled([
        getMyLeagues(user.uid),
        getSubjects(user.uid),
      ]);

      if (leaguesList.status === 'fulfilled') setLeagues(leaguesList.value ?? []);
      if (subjectsList.status === 'fulfilled') setSubjects(subjectsList.value ?? []);
    } catch { /* Silently fail */ }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      await fetchDashboardData();
      if (mounted) setIsLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [fetchDashboardData]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      fetchDashboardData();
    }, [refreshProfile, fetchDashboardData])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchDashboardData(), refreshProfile()]);
    setIsRefreshing(false);
  }, [fetchDashboardData, refreshProfile]);

  const totalHours = profile ? Math.floor(profile.total_study_minutes / 60) : 0;
  const currentLevel = profile?.level ?? 1;
  const currentXp = profile?.total_xp ?? 0;
  const xpCurrentLevel = xpForLevel(currentLevel);
  const xpNextLevel = xpForLevel(currentLevel + 1);
  const xpIntoLevel = currentXp - xpCurrentLevel;
  const xpNeeded = xpNextLevel - xpCurrentLevel;
  const xpProgress = xpNeeded > 0 ? Math.min(xpIntoLevel / xpNeeded, 1) : 0;
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

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{t('greeting', { name: profile?.username ?? t('defaultName') })}</Text>
            {title && <Text style={[styles.headerTitle, { color: title.color }]}>{t(`profile:titles.${title.id}`)}</Text>}
          </View>
          <TouchableOpacity style={styles.streakBadge} activeOpacity={0.7} onPress={() => setShowStreakCalendar(true)}>
            <Flame size={16} color={COLORS.warning} fill={COLORS.warning} style={{ marginRight: 4 }} />
            <Text style={styles.streakText}>{t('dayStreak', { count: profile?.current_streak ?? 0 })}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}><Text style={styles.statValue}>{totalHours}</Text><Text style={styles.statLabel}>{t('totalHours')}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}><Text style={styles.statValue}>{currentLevel}</Text><Text style={styles.statLabel}>{t('level')}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}><Text style={styles.statValue}>{profile?.lock_in_score ?? 0}<Text style={styles.statValueMuted}>/100</Text></Text><Text style={styles.statLabel}>{t('lockIn')}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}><Text style={styles.statValue}>{formatXp(currentXp)}</Text><Text style={styles.statLabel}>{t('xpLabel')}</Text></View>
          </View>
        </View>

        <View style={styles.xpCard}>
          <View style={styles.xpHeader}>
            <Text style={styles.xpLabel}>{t('levelProgress', { current: currentLevel, next: currentLevel + 1 })}</Text>
            <Text style={styles.xpNumbers}>{t('xpProgress', { current: Math.max(0, xpIntoLevel).toLocaleString(), total: xpNeeded.toLocaleString() })}</Text>
          </View>
          <View style={styles.xpBarTrack}><View style={[styles.xpBarFill, { width: `${Math.max(xpProgress * 100, 2)}%` }]} /></View>
        </View>

        {isPaused && (
          <TouchableOpacity style={styles.activeSessionCard} activeOpacity={0.85} onPress={() => router.push('/session/active')}>
            <View style={[styles.activeSessionPulse, { backgroundColor: COLORS.warning }]} />
            <View style={styles.activeSessionContent}>
              <View style={styles.activeSessionLeft}>
                <View style={styles.activeSessionIndicator}><View style={[styles.activeDot, { backgroundColor: COLORS.warning }]} /><Text style={[styles.activeSessionTitle, { color: COLORS.warning }]}>{t('sessionPaused')}</Text></View>
                {pausedSubjectName && <Text style={styles.pausedSubjectText}>{pausedSubjectName}</Text>}
              </View>
              <View style={styles.resumeButton}><Text style={styles.resumeButtonText}>{t('resume')}</Text></View>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.startStudyCard} activeOpacity={0.85} onPress={() => router.push('/session/setup')}>
          <View style={styles.startStudyGradient}>
            <View style={styles.startStudyInner}>
              <BookOpen size={28} color={COLORS.text} style={{ marginRight: 16 }} />
              <View style={styles.startStudyText}>
                <Text style={styles.startStudyTitle}>{t('startStudying')}</Text>
                <Text style={styles.startStudySubtitle}>{t('startStudyingSubtitle')}</Text>
              </View>
              <ChevronRight size={28} color={'rgba(255,255,255,0.6)'} style={{ marginLeft: 8 }} />
            </View>
          </View>
        </TouchableOpacity>

        {BannerAd && (
          <View style={styles.adContainer}>
            <BannerAd
              unitId={AD_UNIT_ID}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            />
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('myLeagues')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/leagues')}><Text style={styles.seeAllLink}>{t('seeAll')}</Text></TouchableOpacity>
        </View>

        {leagues.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leaguesScroll}>
            {leagues.map((league) => (
              <TouchableOpacity key={league.id} style={styles.leagueCard} activeOpacity={0.85} onPress={() => router.push(`/league/${league.id}`)}>
                <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
                <View style={styles.leagueCardStats}>
                  <View style={styles.leagueStatItem}><Text style={styles.leagueStatValue}>{league.member_count ?? '-'}</Text><Text style={styles.leagueStatLabel}>{t('common:members')}</Text></View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyLeaguesCard}>
            <Trophy size={32} color={COLORS.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyLeaguesText}>{t('noLeaguesCta')}</Text>
            <TouchableOpacity style={styles.emptyLeaguesCta} activeOpacity={0.85} onPress={() => router.push('/(tabs)/leagues')}>
              <Text style={styles.emptyLeaguesCtaText}>{t('exploreLeagues')}</Text>
            </TouchableOpacity>
          </View>
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
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  streakIcon: { marginRight: 4 },
  streakText: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.warning },
  statsCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  statValueMuted: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  statLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
  xpCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  xpLabel: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.textSecondary },
  xpNumbers: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  xpBarTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceLight, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.primary },
  activeSessionCard: { backgroundColor: COLORS.surface, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.success + '40', overflow: 'hidden' },
  activeSessionPulse: { height: 3, backgroundColor: COLORS.success },
  activeSessionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  activeSessionLeft: { flex: 1, marginRight: 12 },
  activeSessionIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 8 },
  activeSessionTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.success },
  pausedSubjectText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: 2 },
  resumeButton: { backgroundColor: COLORS.success, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  resumeButtonText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.background },
  adContainer: { alignItems: 'center', marginBottom: 28, overflow: 'hidden', borderRadius: 12 },
  startStudyCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  startStudyGradient: { backgroundColor: COLORS.primary, borderRadius: 16, borderWidth: 1, borderColor: COLORS.primaryLight + '30' },
  startStudyInner: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  startStudyIcon: { marginRight: 16 },
  startStudyText: { flex: 1 },
  startStudyTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  startStudySubtitle: { fontSize: 14, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.75)' },
  startStudyArrow: { marginLeft: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
  seeAllLink: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.primary },
  leaguesScroll: { paddingRight: 20 },
  leagueCard: { width: SCREEN_WIDTH * 0.55, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginRight: 12, borderWidth: 1, borderColor: COLORS.border },
  leagueName: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 16 },
  leagueCardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  leagueStatItem: { alignItems: 'center' },
  leagueStatValue: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  leagueStatLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted },
  emptyLeaguesCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  emptyLeaguesIcon: { marginBottom: 12 },
  emptyLeaguesText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  emptyLeaguesCta: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyLeaguesCtaText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text },
});
