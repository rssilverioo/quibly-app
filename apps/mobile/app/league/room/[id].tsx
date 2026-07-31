import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, Plus, Timer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import FeedRow from '../../../components/feed/FeedRow';
import type { FirebaseFeedPost } from '../../../components/feed/PostCard';
import { MascotBlock } from '../../../components/mascot';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import { cacheFeedPost } from '../../../lib/feed-detail-cache';
import { feedDayLabel, roomFeedPostToCardPost, startsNewFeedDay } from '../../../lib/feed-post';
import { challengeTimeLeft, isStudyChallenge } from '../../../lib/rooms-home';
import { getLiveMembers, type LiveMember } from '../../../services/leagues';
import { getMyRooms, getRoomFeed, type RoomSummary } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

export default function RoomFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [live, setLive] = useState<LiveMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const rooms = await getMyRooms();
    const current = rooms.find((candidate) => candidate.id === id) ?? null;
    setRoom(current);
    if (!current) return;
    const [page, liveMembers] = await Promise.all([getRoomFeed(id), getLiveMembers()]);
    setPosts(page.items.map((post) => roomFeedPostToCardPost(post, id)));
    setLive(liveMembers.filter((member) => member.league_id === id));
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load().catch(() => {}).finally(() => active && setLoading(false));
    const interval = setInterval(() => void load().catch(() => {}), 30_000);
    return () => { active = false; clearInterval(interval); };
  }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (loading || !room) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

  const challenge = room.active_challenge;
  const studyMode = isStudyChallenge(challenge);
  const timeLeft = challenge ? challengeTimeLeft(challenge.ends_at, challenge.server_time) : null;

  const hero = challenge ? (
    <Press onPress={() => router.push(`/league/challenge/${challenge.id}`)}>
      {room.cover_url ? (
        <Image source={{ uri: room.cover_url }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.coverFallback}><MascotBlock state="idle" size={96} /></View>
      )}
      <View style={styles.statsStrip}>
        <View style={styles.statColumn}>
          <Avatar uri={challenge.leader?.avatar_url ?? null} name={challenge.leader?.display_name ?? ''} size={28} />
          <View><Text style={styles.statValue}>{challenge.leader?.metric_value ?? 0}</Text><Text style={styles.statLabel}>Leader</Text></View>
        </View>
        <View style={styles.statColumn}>
          <Avatar uri={null} name={t('rooms.you')} size={28} />
          <View><Text style={styles.statValue}>{challenge.me.metric_value}</Text><Text style={styles.statLabel}>{t('rooms.you')}</Text></View>
        </View>
        <View style={styles.statColumn}>
          <CalendarDays size={25} color={c.fgMuted} />
          <View><Text style={styles.statValue}>{timeLeft?.days ?? 0}</Text><Text style={styles.statLabel}>{t('rooms.daysLeftLabel')}</Text></View>
        </View>
      </View>
    </Press>
  ) : (
    <Press onPress={() => router.push(`/league/challenge/new?roomId=${room.id}`)} style={styles.noChallenge}>
      <Text style={styles.overline}>{t('rooms.noChallenge')}</Text>
      <Text style={styles.action}>{t('rooms.createChallenge')}</Text>
    </Press>
  );

  const liveStrip = studyMode && live.length > 0 ? (
    <View style={styles.liveStrip}>
      <Text style={styles.overline}>{t('rooms.studyingNow')}</Text>
      {live.map((member) => (
        <View key={member.session_id} style={styles.livePerson}>
          <Avatar uri={member.avatar_url} name={member.display_name} size={36} />
          <View style={{ flex: 1 }}><Text style={styles.liveName}>{member.display_name}</Text><Text style={styles.liveMeta}>{member.subject_name} · {t('rooms.minutesNow', { count: member.elapsed_minutes })}</Text></View>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.backRow}><Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press></View>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<><Text style={styles.title}>{room.name}</Text>{hero}{liveStrip}{studyMode ? <Press onPress={() => router.push('/session/setup')} style={styles.timer}><Timer size={18} color={c.fg} /><Text style={styles.action}>{t('rooms.startTimer')}</Text></Press> : null}</>}
        renderItem={({ item, index }) => (
          <View>
            {startsNewFeedDay(posts, index) ? <Text style={styles.day}>{feedDayLabel(item.created_at, i18n.language)}</Text> : null}
            <FeedRow post={item} locale={i18n.language} onPress={() => { cacheFeedPost(item); router.push(`/league/feed/post/${item.id}`); }} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(studyMode ? 'rooms.feedEmptySubtitle' : 'rooms.photoFeedEmptySubtitle')}</Text>}
      />
      <Press haptic="medium" onPress={() => router.push(`/league/post/${room.id}`)} style={styles.fab}><Plus size={26} color={c.fgOnAccent} /></Press>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  backRow: { height: 44, paddingHorizontal: space.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.xl, paddingBottom: 110, flexGrow: 1 },
  title: { ...text.title1, color: c.fg, marginBottom: space.xl },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg },
  coverFallback: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  statsStrip: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
  statColumn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  statValue: { ...text.bodyStrong, color: c.fg },
  statLabel: { ...text.caption, color: c.fgMuted },
  noChallenge: { padding: space.lg, backgroundColor: c.surface, borderRadius: radius.lg, marginBottom: space.md },
  overline: { ...text.overline, color: c.fgMuted },
  action: { ...text.label, color: c.fg, marginTop: 3 },
  liveStrip: { padding: space.lg, backgroundColor: c.surface, borderRadius: radius.lg, gap: space.md, marginBottom: space.md },
  livePerson: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  liveName: { ...text.bodyStrong, color: c.fg },
  liveMeta: { ...text.caption, color: c.fgMuted },
  timer: { height: 52, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginBottom: space.md },
  day: { ...text.label, color: c.fgMuted, textAlign: 'center', paddingVertical: space.md },
  empty: { ...text.body, color: c.fgMuted, textAlign: 'center', paddingTop: space.xxl },
  fab: { position: 'absolute', right: space.xl, bottom: 28, width: 58, height: 58, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
});
