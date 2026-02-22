import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { LeaderboardEntry } from '@quibly/shared';

const COLORS = {
  background: '#0A0A0F',
  surface: '#141420',
  surfaceLight: '#1E1E2E',
  border: '#2A2A3E',
  primary: '#1E40AF',
  primaryLight: '#2B53D8',
  secondary: '#00D4AA',
  accent: '#FF6B6B',
  warning: '#FFB84D',
  success: '#00D4AA',
  error: '#FF4757',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

const RANK_COLORS = [COLORS.gold, COLORS.silver, COLORS.bronze];
const PODIUM_HEIGHTS = [140, 110, 90];

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
}

function PodiumPlace({
  entry,
  rank,
  height,
  color,
}: {
  entry: LeaderboardEntry;
  rank: number;
  height: number;
  color: string;
}) {
  const initial = entry.username ? entry.username[0].toUpperCase() : '?';

  return (
    <View style={styles.podiumPlace}>
      {/* Avatar */}
      <View style={[styles.avatarWrapper, { borderColor: color }]}>
        {entry.avatar_url ? (
          <View style={[styles.avatar, { backgroundColor: color + '33' }]}>
            <Text style={[styles.avatarText, { color }]}>{initial}</Text>
          </View>
        ) : (
          <View style={[styles.avatar, { backgroundColor: color + '33' }]}>
            <Text style={[styles.avatarText, { color }]}>{initial}</Text>
          </View>
        )}
        {rank === 1 && <Crown size={22} color={COLORS.gold} fill={COLORS.gold} style={styles.crown} />}
      </View>

      {/* Username */}
      <Text style={styles.podiumUsername} numberOfLines={1}>
        {entry.username}
      </Text>

      {/* SP */}
      <Text style={[styles.podiumSP, { color }]}>{entry.total_sp.toLocaleString()} SP</Text>

      {/* Pedestal */}
      <View style={[styles.pedestal, { height, backgroundColor: color + '22', borderColor: color }]}>
        <Text style={[styles.pedestalRank, { color }]}>#{rank}</Text>
      </View>
    </View>
  );
}

export default function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  const { t } = useTranslation('feed');

  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('podium.noRankings')}</Text>
      </View>
    );
  }

  const first = entries[0] ?? null;
  const second = entries[1] ?? null;
  const third = entries[2] ?? null;

  return (
    <View style={styles.container}>
      {/* Order: 2nd, 1st, 3rd */}
      <View style={styles.podiumRow}>
        {second ? (
          <PodiumPlace entry={second} rank={2} height={PODIUM_HEIGHTS[1]} color={RANK_COLORS[1]} />
        ) : (
          <View style={styles.podiumPlace} />
        )}

        {first ? (
          <PodiumPlace entry={first} rank={1} height={PODIUM_HEIGHTS[0]} color={RANK_COLORS[0]} />
        ) : (
          <View style={styles.podiumPlace} />
        )}

        {third ? (
          <PodiumPlace entry={third} rank={3} height={PODIUM_HEIGHTS[2]} color={RANK_COLORS[2]} />
        ) : (
          <View style={styles.podiumPlace} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  podiumPlace: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  crown: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    fontSize: 22,
  },
  podiumUsername: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    maxWidth: 100,
    textAlign: 'center',
  },
  podiumSP: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  pedestal: {
    width: '90%',
    borderRadius: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  pedestalRank: {
    fontSize: 24,
    fontWeight: '800',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});
