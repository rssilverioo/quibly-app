import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getLeague, getLeaderboard, getLeagueMembers, leaveLeague } from '../../services/leagues';
import LeaderboardPodium from '../../components/LeaderboardPodium';
import LeagueFeedTab from '../../components/LeagueFeedTab';
import type {
  League,
  LeagueMember,
  LeaderboardEntry,
  LeaderboardPeriod,
} from '@quibly/shared';
import { inviteUrl } from '@quibly/shared/constants';
import { useTheme, type Palette } from '../../theme';

const getColors = (c: Palette) => ({
  background: c.bg,
  surface: c.surface,
  surfaceLight: c.surfaceRaised,
  border: c.border,
  primary: c.accent,
  primaryLight: c.accent,
  secondary: c.accent,
  accent: c.danger,
  warning: c.warning,
  success: c.success,
  error: c.danger,
  text: c.fg,
  textSecondary: c.fgMuted,
  textMuted: c.fgSubtle,
  gold: c.gold,
  silver: c.silver,
  bronze: c.bronze,
});

function useLeagueStyles() {
  const { c } = useTheme();
  return useMemo(() => {
    const COLORS = getColors(c);
    return { c, COLORS, styles: makeStyles(c) };
  }, [c]);
}

type TabKey = 'leaderboard' | 'feed' | 'info';

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
}

function getRankColor(rank: number, COLORS: ReturnType<typeof getColors>): string {
  if (rank === 1) return COLORS.gold;
  if (rank === 2) return COLORS.silver;
  if (rank === 3) return COLORS.bronze;
  return COLORS.textMuted;
}

// ─── Leaderboard Row ───

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  const { t } = useTranslation('leagues');
  const { COLORS, styles } = useLeagueStyles();
  const initial = entry.username ? entry.username[0].toUpperCase() : '?';
  const rankColor = getRankColor(entry.rank, COLORS);

  return (
    <View style={[styles.lbRow, isCurrentUser && styles.lbRowHighlight]}>
      {/* Rank */}
      <View style={styles.lbRankCol}>
        <Text style={[styles.lbRank, { color: rankColor }]}>#{entry.rank}</Text>
      </View>

      {/* Avatar */}
      <View style={[styles.lbAvatar, isCurrentUser && { borderColor: COLORS.primary }]}>
        <Text style={styles.lbAvatarText}>{initial}</Text>
      </View>

      {/* User Info */}
      <View style={styles.lbUserInfo}>
        <Text style={styles.lbUsername} numberOfLines={1}>
          {entry.username}
          {isCurrentUser ? t('detail.youSuffix') : ''}
        </Text>
        <Text style={styles.lbHandle}>@{entry.handle}</Text>
      </View>

      {/* Stats */}
      <View style={styles.lbStats}>
        <Text style={styles.lbSP}>{entry.total_sp.toLocaleString()} SP</Text>
        <Text style={styles.lbMeta}>
          {t('detail.hoursLevel', { hours: entry.verified_hours, level: entry.level })}
        </Text>
      </View>
    </View>
  );
}

// ─── Info Tab Content ───

function InfoTabContent({
  league,
  members,
  currentUserId,
  onLeave,
  onRematch,
  loadingMembers,
}: {
  league: League;
  members: LeagueMember[];
  currentUserId: string | undefined;
  onLeave: () => void;
  onRematch: () => void;
  loadingMembers: boolean;
}) {
  const { t } = useTranslation('leagues');
  const { COLORS, styles } = useLeagueStyles();

  const modeStyles = useMemo(() => ({
    easy: { bg: COLORS.success + '22', text: COLORS.success, label: t('modes.easy') },
    competitive: { bg: COLORS.primary + '22', text: COLORS.primaryLight, label: t('modes.competitive') },
    hardcore: { bg: COLORS.accent + '22', text: COLORS.accent, label: t('modes.hardcore') },
  }), [t]);

  const modeStyle = modeStyles[league.mode as keyof typeof modeStyles] ?? modeStyles.easy;
  const isOwner = currentUserId === league.owner_id;

  const handleCopyCode = async () => {
    try {
      await Share.share({ message: inviteUrl(league.invite_code) });
    } catch {
      // User cancelled
    }
  };

  const handleShareInvite = async () => {
    try {
      await Share.share({
        message: t('create.shareMessage', { name: league.name, url: inviteUrl(league.invite_code) }),
      });
    } catch {
      // Cancelled
    }
  };

  return (
    <View style={styles.infoContainer}>
      {/* League Details */}
      <View style={styles.infoSection}>
        <Text style={styles.infoSectionTitle}>{t('detail.about')}</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('detail.name')}</Text>
            <Text style={styles.infoValue}>{league.name}</Text>
          </View>
          {league.description ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('detail.description')}</Text>
              <Text style={[styles.infoValue, { flex: 1 }]}>{league.description}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('detail.mode')}</Text>
            <View style={[styles.infoBadge, { backgroundColor: modeStyle.bg }]}>
              <Text style={[styles.infoBadgeText, { color: modeStyle.text }]}>
                {modeStyle.label}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('detail.privacy')}</Text>
            <Text style={styles.infoValue}>{league.privacy === 'public' ? t('common:public') : t('common:private')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('detail.dates')}</Text>
            <Text style={styles.infoValue}>{formatDateRange(league.start_date, league.end_date)}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>{t('detail.maxMembers')}</Text>
            <Text style={styles.infoValue}>{league.max_members}</Text>
          </View>
        </View>
      </View>

      {/* Invite Code */}
      <View style={styles.infoSection}>
        <Text style={styles.infoSectionTitle}>{t('detail.invite')}</Text>
        <View style={styles.inviteBox}>
          <Text style={styles.inviteCode}>{league.invite_code}</Text>
          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Text style={styles.inviteButtonText}>{t('detail.copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inviteButton, styles.inviteButtonOutline]}
              onPress={handleShareInvite}
              activeOpacity={0.7}
            >
              <Text style={[styles.inviteButtonText, { color: COLORS.primaryLight }]}>{t('detail.share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Members */}
      <View style={styles.infoSection}>
        <Text style={styles.infoSectionTitle}>
          {t('detail.membersCount', { count: members.length })}
        </Text>
        {loadingMembers ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 12 }} />
        ) : (
          members.map((member) => {
            const name = member.display_name ?? member.user?.username ?? 'Unknown';
            const initial = name[0].toUpperCase();
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{initial}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{name}</Text>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
                <Text style={styles.memberSP}>{member.total_sp} SP</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Actions */}
      <View style={styles.infoSection}>
        {league.status === 'completed' && (
          <TouchableOpacity
            style={styles.rematchButton}
            onPress={onRematch}
            activeOpacity={0.7}
          >
            <Text style={styles.rematchButtonText}>{t('detail.rematch')}</Text>
          </TouchableOpacity>
        )}

        {!isOwner && (
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={onLeave}
            activeOpacity={0.7}
          >
            <Text style={styles.leaveButtonText}>{t('detail.leaveLeague')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 40 }} />
    </View>
  );
}

// ─── Main Screen ───

export default function LeagueDetailScreen() {
  const { t } = useTranslation('leagues');
  const { COLORS, styles } = useLeagueStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const modeStyles = useMemo(() => ({
    easy: { bg: COLORS.success + '22', text: COLORS.success, label: t('modes.easy') },
    competitive: { bg: COLORS.primary + '22', text: COLORS.primaryLight, label: t('modes.competitive') },
    hardcore: { bg: COLORS.accent + '22', text: COLORS.accent, label: t('modes.hardcore') },
  }), [t]);

  const tabs = useMemo(() => [
    { key: 'leaderboard' as TabKey, label: t('detail.tabs.leaderboard') },
    { key: 'feed' as TabKey, label: t('detail.tabs.feed') },
    { key: 'info' as TabKey, label: t('detail.tabs.info') },
  ], [t]);

  const periodOptions = useMemo(() => [
    { key: 'weekly' as LeaderboardPeriod, label: t('detail.periods.weekly') },
    { key: 'monthly' as LeaderboardPeriod, label: t('detail.periods.monthly') },
    { key: 'all_time' as LeaderboardPeriod, label: t('detail.periods.allTime') },
  ], [t]);

  const [league, setLeague] = useState<League | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');
  const [loading, setLoading] = useState(true);

  // Leaderboard state
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Info state
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Fetch league details
  const fetchLeague = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getLeague(id);
      setLeague(data);
    } catch (err: any) {
      Alert.alert(t('common:error'), err?.message ?? t('detail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    if (!id) return;
    setLbLoading(true);
    try {
      const data = await getLeaderboard(id, period);
      setLeaderboard(data);
    } catch {
      // Silently fail
    } finally {
      setLbLoading(false);
      setRefreshing(false);
    }
  }, [id, period]);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!id) return;
    setLoadingMembers(true);
    try {
      const data = await getLeagueMembers(id);
      setMembers(data);
    } catch {
      // Silently fail
    } finally {
      setLoadingMembers(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLeague();
  }, [fetchLeague]);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    } else if (activeTab === 'info') {
      fetchMembers();
    }
  }, [activeTab, fetchLeaderboard, fetchMembers]);

  const handleLeave = () => {
    Alert.alert(t('detail.leaveConfirmTitle'), t('detail.leaveConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('detail.leave'),
        style: 'destructive',
        onPress: async () => {
          if (!id || !user) return;
          try {
            await leaveLeague(id, user.uid);
            router.back();
          } catch (err: any) {
            Alert.alert(t('common:error'), err?.message ?? t('detail.leaveError'));
          }
        },
      },
    ]);
  };

  const handleRematch = () => {
    router.push('/league/create');
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (loading || !league) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const modeStyle = modeStyles[league.mode as keyof typeof modeStyles] ?? modeStyles.easy;
  const podiumEntries = leaderboard.slice(0, 3);
  const restEntries = leaderboard.slice(3);

  // ─── Render ───

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Back + Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <ArrowLeft size={18} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
            <Text style={styles.backButtonText}>{t('common:back')}</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {league.name}
            </Text>
            <View style={[styles.modeBadge, { backgroundColor: modeStyle.bg }]}>
              <Text style={[styles.modeBadgeText, { color: modeStyle.text }]}>
                {modeStyle.label}
              </Text>
            </View>
          </View>
          <Text style={styles.headerDateRange}>
            {formatDateRange(league.start_date, league.end_date)}
          </Text>
        </View>

        {/* Completed Banner */}
        {league.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>{t('detail.leagueEnded')}</Text>
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabItemText, activeTab === tab.key && styles.tabItemTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'leaderboard' && (
          <View style={styles.tabContent}>
            {/* Period Filter */}
            <View style={styles.periodRow}>
              {periodOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.periodButton, period === opt.key && styles.periodButtonActive]}
                  onPress={() => setPeriod(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      period === opt.key && styles.periodButtonTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {lbLoading && leaderboard.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={restEntries}
                keyExtractor={(item) => item.user_id}
                renderItem={({ item }) => (
                  <LeaderboardRow
                    entry={item}
                    isCurrentUser={item.user_id === user?.uid}
                  />
                )}
                ListHeaderComponent={
                  <>
                    <LeaderboardPodium entries={podiumEntries} />
                    {restEntries.length > 0 && (
                      <View style={styles.lbDivider}>
                        <View style={styles.lbDividerLine} />
                      </View>
                    )}
                  </>
                }
                ListEmptyComponent={
                  podiumEntries.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>{t('detail.noRankings')}</Text>
                    </View>
                  ) : null
                }
                contentContainerStyle={styles.lbListContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={COLORS.primary}
                  />
                }
              />
            )}
          </View>
        )}

        {activeTab === 'feed' && id && (
          <View style={styles.tabContent}>
            <LeagueFeedTab leagueId={id} />
          </View>
        )}

        {activeTab === 'info' && (
          <FlatList
            data={[]}
            keyExtractor={() => 'info'}
            renderItem={null}
            ListHeaderComponent={
              <InfoTabContent
                league={league}
                members={members}
                currentUserId={user?.uid}
                onLeave={handleLeave}
                onRematch={handleRematch}
                loadingMembers={loadingMembers}
              />
            }
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => {
  const COLORS = getColors(c);
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButtonText: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    flexShrink: 1,
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerDateRange: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  // Completed Banner
  completedBanner: {
    backgroundColor: COLORS.warning + '22',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  completedBannerText: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '700',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabItemText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: COLORS.primaryLight,
  },

  // Tab Content
  tabContent: {
    flex: 1,
  },

  // Period Filter
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary + '22',
    borderColor: COLORS.primary,
  },
  periodButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: COLORS.primaryLight,
  },

  // Leaderboard List
  lbListContent: {
    paddingBottom: 40,
  },
  lbDivider: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  lbDividerLine: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Leaderboard Row
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '55',
  },
  lbRowHighlight: {
    backgroundColor: COLORS.primary + '11',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  lbRankCol: {
    width: 40,
  },
  lbRank: {
    fontSize: 15,
    fontWeight: '800',
  },
  lbAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  lbAvatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  lbUserInfo: {
    flex: 1,
  },
  lbUsername: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  lbHandle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  lbStats: {
    alignItems: 'flex-end',
  },
  lbSP: {
    color: COLORS.primaryLight,
    fontSize: 15,
    fontWeight: '700',
  },
  lbMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  // ─── Info Tab ───
  infoContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoSectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '55',
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginRight: 12,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  infoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Invite
  inviteBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    padding: 20,
    alignItems: 'center',
  },
  inviteCode: {
    color: COLORS.primaryLight,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 16,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  inviteButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  inviteButtonText: {
    color: c.fgOnAccent,
    fontSize: 13,
    fontWeight: '600',
  },

  // Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  memberRole: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textTransform: 'capitalize',
    marginTop: 1,
  },
  memberSP: {
    color: COLORS.primaryLight,
    fontSize: 14,
    fontWeight: '700',
  },

  // Actions
  rematchButton: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rematchButtonText: {
    color: c.fgOnAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  leaveButton: {
    height: 48,
    backgroundColor: COLORS.error + '18',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '44',
  },
  leaveButtonText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '600',
  },
  });
};
