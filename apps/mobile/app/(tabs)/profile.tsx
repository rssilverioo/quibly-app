import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, RefreshControl, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { logout as firebaseLogout, deleteAccount } from '../../services/auth';
import { uploadAvatar } from '../../services/storage';
import { updateProfile } from '../../services/auth';
import { getAllAchievements, seedAchievements, type AchievementWithStatus } from '../../services/achievements';
import { COLORS, FONTS, xpForLevel, calculateTitle } from '@quibly/shared/constants';
import {
  Clock, ShieldCheck, Flame, Zap, Target, Star,
  LogOut, ChevronRight, Camera, Trophy, BookOpen,
  Crown, Users, Award, GraduationCap, Skull, Shield, Lock, Pencil, Globe, Trash2,
} from 'lucide-react-native';
import i18n from '../../lib/i18n';
import StreakCalendarModal from '../../components/StreakCalendarModal';
import { getMyLeagues } from '../../services/leagues';
import type { League } from '@quibly/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAT_CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 12) / 2;

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const ACHIEVEMENT_ICONS: Record<string, any> = {
  Flame, Clock, GraduationCap, Skull, BookOpen, Target, Zap,
  ShieldCheck, Shield, Users, Crown, Star, Award, Trophy,
};

export default function ProfileScreen() {
  const { t } = useTranslation('profile');
  const { user, profile, refreshProfile, setProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);

  const achievementsFetched = useRef(false);

  const fetchAchievements = useCallback(async () => {
    try {
      const data = await getAllAchievements();
      setAchievements(data);
      achievementsFetched.current = true;
    } catch {
      // Achievements endpoint may not be seeded yet - fail silently
      // Don't cascade into seedAchievements on every load
      if (!achievementsFetched.current) {
        try {
          await seedAchievements();
          const data = await getAllAchievements();
          setAchievements(data);
          achievementsFetched.current = true;
        } catch {
          // API not available - just show profile without achievements
        }
      }
    }
  }, []);

  useEffect(() => {
    if (profile && !achievementsFetched.current) fetchAchievements();
  }, [profile, fetchAchievements]);

  useEffect(() => {
    if (user) {
      getMyLeagues(user.uid).then(setLeagues).catch(() => {});
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchAchievements()]);
    setRefreshing(false);
  }, [refreshProfile, fetchAchievements]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('permissionRequired'), t('allowPhotoAccess')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0] && user) {
      try {
        const url = await uploadAvatar(user.uid, result.assets[0].uri);
        const updated = await updateProfile({ avatar_url: url });
        if (updated) setProfile(updated);
      } catch { Alert.alert(t('common:error'), t('avatarUploadError')); }
    }
  };

  const handleLogout = () => {
    Alert.alert(t('logOutConfirmTitle'), t('logOutConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('logOut'), style: 'destructive', onPress: async () => {
        await firebaseLogout();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('deleteAccountConfirmTitle'), t('deleteAccountConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('deleteAccount'), style: 'destructive', onPress: async () => {
        try {
          await deleteAccount();
          router.replace('/(auth)/login');
        } catch {
          Alert.alert(t('common:error'), t('deleteAccountError'));
        }
      }},
    ]);
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 12 }} />
        <Text style={styles.loadingText}>{t('common:loading')}</Text>
        <TouchableOpacity style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.surface, borderRadius: 10 }} onPress={refreshProfile}>
          <Text style={{ color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 14 }}>{t('common:retry', { defaultValue: 'Retry' })}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentLevel = profile.level;
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpInCurrentLevel = profile.total_xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  const xpProgress = xpNeeded > 0 ? Math.min(xpInCurrentLevel / xpNeeded, 1) : 0;
  const totalHours = Math.floor(profile.total_study_minutes / 60);
  const title = calculateTitle(profile);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>

        <View style={styles.headerSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{getInitials(profile.username)}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}><Camera size={13} color={COLORS.text} strokeWidth={2.5} /></View>
          </TouchableOpacity>
          <Text style={styles.username}>{profile.username}</Text>
          <Text style={styles.handle}>@{profile.handle}</Text>
          <View style={[styles.titleBadge, { borderColor: title.color + '40', backgroundColor: title.color + '15' }]}>
            <Text style={[styles.titleText, { color: title.color }]}>{t(`titles.${title.id}`)}</Text>
          </View>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        <View style={styles.xpCard}>
          <View style={styles.xpCardHeader}>
            <View style={styles.levelBadge}><View style={styles.levelBadgeInner}><Text style={styles.levelBadgeNumber}>{currentLevel}</Text></View></View>
            <View style={styles.xpInfo}>
              <Text style={styles.levelLabel}>{t('home:level')} {currentLevel}</Text>
              <Text style={styles.xpText}>{formatNumber(Math.max(0, xpInCurrentLevel))} / {formatNumber(xpNeeded)} {t('common:xp')}</Text>
            </View>
          </View>
          <View style={styles.xpBarContainer}><View style={styles.xpBarBackground}><View style={[styles.xpBarFill, { width: `${Math.max(xpProgress * 100, 2)}%` }]} /></View></View>
        </View>

        <Text style={styles.sectionTitle}>{t('stats')}</Text>
        <View style={styles.statsGrid}>
          {[
            { Icon: Clock, value: formatNumber(totalHours), label: t('totalHours'), color: COLORS.primary },
            { Icon: ShieldCheck, value: formatNumber(profile.verified_hours), label: t('verifiedHours'), color: COLORS.success },
            { Icon: Flame, value: t('streakDays', { count: profile.current_streak }), label: t('currentStreak'), color: COLORS.accent, onPress: () => setShowStreakCalendar(true) },
            { Icon: Zap, value: t('streakDays', { count: profile.longest_streak }), label: t('longestStreak'), color: COLORS.warning, onPress: () => setShowStreakCalendar(true) },
            { Icon: Target, value: `${profile.lock_in_score}/100`, label: t('lockInScore'), color: COLORS.primaryLight },
            { Icon: Star, value: formatNumber(profile.total_xp), label: t('totalXP'), color: COLORS.gold },
          ].map((stat) => {
            const content = (
              <>
                <stat.Icon size={20} color={stat.color} style={{ marginBottom: 8 }} />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </>
            );
            return stat.onPress ? (
              <TouchableOpacity key={stat.label} style={styles.statCard} activeOpacity={0.7} onPress={stat.onPress}>
                {content}
              </TouchableOpacity>
            ) : (
              <View key={stat.label} style={styles.statCard}>
                {content}
              </View>
            );
          })}
        </View>

        {/* Achievements — compact horizontal */}
        {achievements.length > 0 && (
          <>
            <View style={styles.achievementsHeader}>
              <Text style={styles.sectionTitle}>{t('achievements')}</Text>
              <Text style={styles.achievementsCount}>
                {achievements.filter((a) => a.unlocked).length}/{achievements.length}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementsScroll}>
              {achievements
                .sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0))
                .map((a) => {
                  const IconComponent = ACHIEVEMENT_ICONS[a.icon] || Trophy;
                  return (
                    <View key={a.id} style={[styles.achievementChip, !a.unlocked && styles.achievementChipLocked]}>
                      <View style={[styles.achievementChipIcon, a.unlocked ? { backgroundColor: '#DBEAFE' } : { backgroundColor: '#F1F5F9' }]}>
                        {a.unlocked
                          ? <IconComponent size={16} color="#1E40AF" />
                          : <Lock size={12} color="#8BA3BC" />
                        }
                      </View>
                      <Text style={[styles.achievementChipName, !a.unlocked && { color: '#8BA3BC' }]} numberOfLines={1}>{a.name}</Text>
                    </View>
                  );
                })}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>{t('settings')}</Text>

        {/* Account */}
        <View style={styles.settingsContainer}>
          <TouchableOpacity style={[styles.settingsRow, styles.settingsRowBorder]} onPress={() => router.push('/league' as any)} activeOpacity={0.7}>
            <View style={[styles.settingsIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Trophy size={17} color="#D97706" />
            </View>
            <Text style={styles.settingsLabel}>{t('leagues:title', { defaultValue: 'My Leagues' })}</Text>
            {leagues.length > 0 && <Text style={styles.settingsBadge}>{leagues.length}</Text>}
            <ChevronRight size={17} color="#8BA3BC" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsRow, styles.settingsRowBorder]} onPress={() => router.push('/pricing')} activeOpacity={0.7}>
            <View style={[styles.settingsIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Crown size={17} color="#D97706" />
            </View>
            <Text style={styles.settingsLabel}>{t('pricing:myPlan')}</Text>
            <ChevronRight size={17} color="#8BA3BC" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/profile/edit')} activeOpacity={0.7}>
            <View style={[styles.settingsIconWrap, { backgroundColor: COLORS.primaryLight + '18' }]}>
              <Pencil size={17} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.settingsLabel}>{t('editProfile')}</Text>
            <ChevronRight size={17} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Language */}
        <View style={[styles.settingsContainer, { marginTop: 12 }]}>
          <View style={styles.settingsRow}>
            <View style={[styles.settingsIconWrap, { backgroundColor: COLORS.primaryLight + '18' }]}>
              <Globe size={17} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.settingsLabel}>{t('language')}</Text>
          </View>
          <View style={styles.langToggleContainer}>
            <TouchableOpacity
              style={[styles.langOption, i18n.language === 'en' && styles.langOptionActive]}
              onPress={() => i18n.changeLanguage('en')}
              activeOpacity={0.7}
            >
              <Text style={[styles.langOptionText, i18n.language === 'en' && styles.langOptionTextActive]}>
                English
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, i18n.language === 'pt-BR' && styles.langOptionActive]}
              onPress={() => i18n.changeLanguage('pt-BR')}
              activeOpacity={0.7}
            >
              <Text style={[styles.langOptionText, i18n.language === 'pt-BR' && styles.langOptionTextActive]}>
                Português (BR)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Log Out & Delete Account */}
        <View style={[styles.settingsContainer, { marginTop: 12 }]}>
          <TouchableOpacity style={[styles.settingsRow, styles.settingsRowBorder]} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.settingsIconWrap, { backgroundColor: COLORS.error + '15' }]}>
              <LogOut size={17} color={COLORS.error} />
            </View>
            <Text style={[styles.settingsLabel, { color: COLORS.error }]}>{t('logOut')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={[styles.settingsIconWrap, { backgroundColor: COLORS.error + '15' }]}>
              <Trash2 size={17} color={COLORS.error} />
            </View>
            <Text style={[styles.settingsLabel, { color: COLORS.error }]}>{t('deleteAccount')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <StreakCalendarModal
        visible={showStreakCalendar}
        onClose={() => setShowStreakCalendar(false)}
        currentStreak={profile.current_streak}
        longestStreak={profile.longest_streak}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF5FF' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },
  loadingContainer: { flex: 1, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#8BA3BC', fontSize: 16 },
  headerSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#1E40AF' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#3B82F6' },
  avatarInitials: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#EEF5FF' },
  avatarEditIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  username: { color: '#1A2E4A', fontSize: 24, fontWeight: '700', marginTop: 14 },
  handle: { color: '#8BA3BC', fontSize: 15, marginTop: 4 },
  titleBadge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  titleText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  bio: { color: '#4A6580', fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 20, lineHeight: 20 },
  xpCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  xpCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  levelBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1E40AF' },
  levelBadgeInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center' },
  levelBadgeNumber: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  xpInfo: { marginLeft: 16, flex: 1 },
  levelLabel: { color: '#1A2E4A', fontSize: 18, fontWeight: '700' },
  xpText: { color: '#8BA3BC', fontSize: 14, marginTop: 2 },
  xpBarContainer: { marginBottom: 8 },
  xpBarBackground: { height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: '#1E40AF', borderRadius: 5 },
  sectionTitle: { color: '#1A2E4A', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { width: STAT_CARD_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statIcon: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  statValue: { color: '#1A2E4A', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#8BA3BC', fontSize: 12, marginTop: 4, fontWeight: '500' },
  // Achievements — horizontal chips
  achievementsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  achievementsCount: { color: '#8BA3BC', fontSize: 14, fontWeight: '600' },
  achievementsScroll: { paddingRight: 24, marginBottom: 24 },
  achievementChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  achievementChipLocked: { opacity: 0.45 },
  achievementChipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  achievementChipName: { color: '#1A2E4A', fontSize: 12, fontWeight: '600' },
  settingsBadge: { backgroundColor: '#DBEAFE', color: '#1E40AF', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 6, overflow: 'hidden' },
  // Settings
  settingsContainer: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  settingsIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  settingsLabel: { flex: 1, fontSize: 15, fontFamily: FONTS.medium, color: '#1A2E4A' },
  logoutRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  langToggleContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  langOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  langOptionActive: { backgroundColor: '#1E40AF' },
  langOptionText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#8BA3BC' },
  langOptionTextActive: { color: '#FFFFFF' },
  // Leagues
  leagueActions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  leagueCreateBtn: { flex: 1, height: 40, backgroundColor: '#1E40AF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  leagueCreateText: { color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.bold },
  leagueJoinBtn: { flex: 1, height: 40, backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#1E40AF' },
  leagueJoinText: { color: '#1E40AF', fontSize: 14, fontFamily: FONTS.bold },
  leagueCard: { width: 140, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  leagueTrophy: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  leagueName: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#1A2E4A', marginBottom: 4 },
  leagueMeta: { fontSize: 11, fontFamily: FONTS.medium, color: '#8BA3BC' },
  leagueEmpty: { alignItems: 'center', paddingVertical: 24, marginBottom: 16 },
  leagueEmptyText: { fontSize: 14, fontFamily: FONTS.medium, color: '#8BA3BC', marginTop: 8 },
});
