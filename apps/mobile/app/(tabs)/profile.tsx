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
import { logout as firebaseLogout } from '../../services/auth';
import { uploadAvatar } from '../../services/storage';
import { updateProfile } from '../../services/auth';
import { getAllAchievements, seedAchievements, type AchievementWithStatus } from '../../services/achievements';
import { COLORS, FONTS, xpForLevel, calculateTitle } from '@quibly/shared/constants';
import {
  Clock, ShieldCheck, Flame, Zap, Target, Star,
  LogOut, ChevronRight, Camera, Trophy, BookOpen,
  Crown, Users, Award, GraduationCap, Skull, Shield, Lock, Pencil, Globe,
} from 'lucide-react-native';
import i18n from '../../lib/i18n';
import StreakCalendarModal from '../../components/StreakCalendarModal';

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

        {/* Achievements */}
        {achievements.length > 0 && (
          <>
            <View style={styles.achievementsHeader}>
              <Text style={styles.sectionTitle}>{t('achievements')}</Text>
              <Text style={styles.achievementsCount}>
                {t('achievementCount', { unlocked: achievements.filter((a) => a.unlocked).length, total: achievements.length })}
              </Text>
            </View>
            <View style={styles.achievementsGrid}>
              {achievements.map((a) => {
                const IconComponent = ACHIEVEMENT_ICONS[a.icon] || Trophy;
                return (
                  <View
                    key={a.id}
                    style={[
                      styles.achievementCard,
                      !a.unlocked && styles.achievementCardLocked,
                    ]}
                  >
                    <View
                      style={[
                        styles.achievementIconContainer,
                        a.unlocked
                          ? { backgroundColor: COLORS.primary + '22' }
                          : { backgroundColor: COLORS.surfaceLight },
                      ]}
                    >
                      {a.unlocked ? (
                        <IconComponent size={22} color={COLORS.primary} />
                      ) : (
                        <Lock size={16} color={COLORS.textMuted} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.achievementName,
                        !a.unlocked && styles.achievementNameLocked,
                      ]}
                      numberOfLines={1}
                    >
                      {a.name}
                    </Text>
                    <Text style={styles.achievementDesc} numberOfLines={2}>
                      {a.description}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>{t('settings')}</Text>
        <View style={styles.settingsContainer}>
          <TouchableOpacity style={[styles.settingsRow, styles.settingsRowBorder]} onPress={() => router.push('/pricing')} activeOpacity={0.7}>
            <Crown size={18} color={COLORS.gold} style={{ width: 28 }} />
            <Text style={[styles.settingsLabel, { color: COLORS.text }]}>{t('pricing:myPlan')}</Text>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsRow, styles.settingsRowBorder]} onPress={() => router.push('/profile/edit')} activeOpacity={0.7}>
            <Pencil size={18} color={COLORS.primaryLight} style={{ width: 28 }} />
            <Text style={[styles.settingsLabel, { color: COLORS.text }]}>{t('editProfile')}</Text>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsRow, styles.settingsRowBorder]}
            onPress={() => {
              Alert.alert(
                t('language'),
                undefined,
                [
                  { text: 'English', onPress: () => i18n.changeLanguage('en') },
                  { text: 'Portugues (BR)', onPress: () => i18n.changeLanguage('pt-BR') },
                  { text: t('common:cancel'), style: 'cancel' },
                ],
              );
            }}
            activeOpacity={0.7}
          >
            <Globe size={18} color={COLORS.primaryLight} style={{ width: 28 }} />
            <Text style={[styles.settingsLabel, { color: COLORS.text }]}>{t('language')}</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 14, fontWeight: '500', marginRight: 8 }}>
              {i18n.language === 'pt-BR' ? 'Portugues (BR)' : 'English'}
            </Text>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsRow} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={18} color={COLORS.error} style={{ width: 28 }} />
            <Text style={[styles.settingsLabel, { color: COLORS.error }]}>{t('logOut')}</Text>
            <ChevronRight size={18} color={COLORS.error} />
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
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textMuted, fontSize: 16 },
  headerSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.primary },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.primaryLight },
  avatarInitials: { color: COLORS.text, fontSize: 28, fontWeight: '700' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },
  avatarEditIcon: { color: COLORS.text, fontSize: 16, fontWeight: '700', lineHeight: 18 },
  username: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginTop: 14 },
  handle: { color: COLORS.textMuted, fontSize: 15, marginTop: 4 },
  titleBadge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  titleText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  bio: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 20, lineHeight: 20 },
  xpCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  xpCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  levelBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(124,92,252,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.primary },
  levelBadgeInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  levelBadgeNumber: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  xpInfo: { marginLeft: 16, flex: 1 },
  levelLabel: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  xpText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  xpBarContainer: { marginBottom: 8 },
  xpBarBackground: { height: 10, backgroundColor: COLORS.surfaceLight, borderRadius: 5, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 5 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { width: STAT_CARD_WIDTH, backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  statIcon: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  statLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, fontWeight: '500' },
  // Achievements
  achievementsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  achievementsCount: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  achievementCard: { width: (SCREEN_WIDTH - 24 * 2 - 20) / 3, backgroundColor: COLORS.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  achievementCardLocked: { opacity: 0.45 },
  achievementIconContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  achievementName: { color: COLORS.text, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  achievementNameLocked: { color: COLORS.textMuted },
  achievementDesc: { color: COLORS.textMuted, fontSize: 9, textAlign: 'center', lineHeight: 12 },
  // Settings
  settingsContainer: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 24 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border + '55' },
  settingsIcon: { fontSize: 16, fontWeight: '700', width: 28 },
  settingsLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  settingsChevron: { fontSize: 16, fontWeight: '600' },
});
