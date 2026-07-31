import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import RoomTabBar from '../../../components/rooms/RoomTabBar';
import { challengeTimeLeft } from '../../../lib/rooms-home';
import { getChallengeLeaderboard, type ChallengeLeaderboard } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

export default function ChallengeLeaderboardScreen() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId?: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [data, setData] = useState<ChallengeLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setData(await getChallengeLeaderboard(id));
  }, [id]);

  useEffect(() => { void load().finally(() => setLoading(false)); }, [load]);
  const refresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (loading || !data) {
    return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;
  }

  const timeLeft = challengeTimeLeft(data.challenge.ends_at, data.challenge.server_time);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{data.challenge.title}</Text>
          <Text style={styles.subtitle}>{t('rooms.daysLeft', { count: timeLeft.days })}</Text>
        </View>
      </View>

      <FlatList
        data={data.entries}
        keyExtractor={(entry) => entry.user_id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        ListHeaderComponent={<Text style={styles.section}>{t('rooms.leaderboard')}</Text>}
        renderItem={({ item }) => {
          const isMe = item.rank === data.me.rank && item.metric_value === data.me.metric_value;
          return (
            <Press
              onPress={() => router.push({
                pathname: '/league/challenge/[id]/member/[userId]',
                params: {
                  id,
                  userId: item.user_id,
                  name: item.display_name,
                  avatar: item.avatar_url ?? '',
                  rank: String(item.rank),
                  value: String(item.metric_value),
                  unit: data.challenge.metric_unit,
                },
              })}
              style={[styles.row, isMe && styles.meRow]}
            >
              {isMe ? <View style={styles.meBar} /> : null}
              <Avatar uri={item.avatar_url} name={item.display_name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name}{isMe ? ` · ${t('rooms.you')}` : ''}</Text>
                <Text style={styles.metric}>{item.metric_value} {data.challenge.metric_unit}</Text>
              </View>
              <View style={styles.rankWrap}>
                <Text style={styles.rank}>{item.rank}</Text>
                <Text style={styles.ordinal}>º</Text>
              </View>
              <ChevronRight size={17} color={c.fgSubtle} />
            </Press>
          );
        }}
      />
      <RoomTabBar roomId={roomId ?? id} challengeId={id} active="rankings" />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.title3, color: c.fg },
  subtitle: { ...text.caption, color: c.fgMuted, marginTop: 2 },
  list: { padding: space.xl },
  section: { ...text.overline, color: c.fgMuted, marginBottom: space.md },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  meRow: { backgroundColor: c.accentSoft, borderBottomColor: 'transparent', borderRadius: radius.md, overflow: 'hidden' },
  meBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: c.accent },
  name: { ...text.bodyStrong, color: c.fg },
  metric: { ...text.label, color: c.fgMuted, marginTop: 2 },
  rankWrap: { flexDirection: 'row', alignItems: 'flex-start', minWidth: 38, justifyContent: 'flex-end' },
  rank: { ...text.title3, color: c.fg },
  ordinal: { ...text.caption, color: c.fg, marginTop: 2 },
});
