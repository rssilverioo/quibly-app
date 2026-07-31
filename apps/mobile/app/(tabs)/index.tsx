import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, ChevronRight, Plus, Timer, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import PostCard, { type FirebaseFeedPost } from '../../components/feed/PostCard';
import { MascotBlock } from '../../components/mascot';
import Press from '../../components/ui/Press';
import { resolveRoomsHome } from '../../lib/rooms-home';
import { getMyRooms, getRoomFeed, type RoomFeedPost, type RoomSummary } from '../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { useTabBarClearance } from './_layout';

function toPost(post: RoomFeedPost, roomId: string): FirebaseFeedPost {
  return {
    id: post.id,
    kind: post.session ? 'session' : 'standalone',
    league_id: roomId,
    user_id: post.author.user_id,
    username: post.author.display_name,
    avatar_url: post.author.avatar_url,
    session_id: post.session?.id ?? '',
    subject_id: '',
    subject_name: post.session?.subject.name ?? '',
    subject_color: post.session?.subject.color ?? '',
    show_proof_photo: post.show_proof_photo,
    proof_photo_url: post.photo_url,
    total_duration_minutes: post.session?.minutes ?? 0,
    points_earned: post.session?.xp_earned ?? 0,
    is_verified: post.session?.is_verified ?? false,
    reactions: {},
    comment_count: post.comment_count,
    created_at: post.created_at,
    caption: post.caption,
    challenge_title: post.challenge?.title,
  };
}

export default function RoomsScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tabClearance = useTabBarClearance();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const nextRooms = await getMyRooms();
    setRooms(nextRooms);
    if (nextRooms.length === 1) {
      const page = await getRoomFeed(nextRooms[0].id);
      setPosts(page.items.map((post) => toPost(post, nextRooms[0].id)));
    } else {
      setPosts([]);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    void load().catch(() => {}).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [load]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }, [load]);

  const state = resolveRoomsHome(rooms);
  const join = () => {
    const normalized = code.trim();
    if (normalized) router.push(`/league/join/${encodeURIComponent(normalized)}`);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

  if (state.kind === 'empty') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <MascotBlock state="wave" size={150} />
          <Text style={styles.title}>{tr('rooms.emptyTitle')}</Text>
          <Text style={styles.subtitle}>{tr('rooms.emptySubtitle')}</Text>
          <Press haptic="medium" onPress={() => router.push('/league/create')} style={styles.primaryButton}>
            <Plus size={18} color={c.fgOnAccent} />
            <Text style={styles.primaryText}>{tr('rooms.create')}</Text>
          </Press>
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              onSubmitEditing={join}
              autoCapitalize="characters"
              placeholder={tr('rooms.code')}
              placeholderTextColor={c.fgSubtle}
              style={styles.input}
            />
            <Press onPress={join} style={styles.joinButton}><Text style={styles.joinText}>{tr('rooms.join')}</Text></Press>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (state.kind === 'feed') {
    const roomActions = (
      <View style={styles.actionsRow}>
        <Press
          haptic="medium"
          onPress={() => router.push(`/league/post/${state.room.id}`)}
          style={styles.actionCard}
        >
          <Camera size={20} color={c.fg} />
          <Text style={styles.actionText}>{tr('rooms.postPhoto')}</Text>
        </Press>
        <Press
          haptic="medium"
          onPress={() => router.push('/session/setup')}
          style={styles.actionCard}
        >
          <Timer size={20} color={c.fg} />
          <Text style={styles.actionText}>{tr('rooms.startTimer')}</Text>
        </Press>
      </View>
    );
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => <PostCard post={item} />}
          ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
          contentContainerStyle={[styles.feed, { paddingBottom: tabClearance }]}
          ListHeaderComponent={<><Text style={styles.title}>{state.room.name}</Text>{roomActions}</>}
          ListEmptyComponent={
            <Press onPress={() => router.push('/session/setup')} style={styles.feedEmpty}>
              <Text style={styles.emptyTitle}>{tr('rooms.feedEmptyTitle')}</Text>
              <Text style={styles.subtitle}>{tr('rooms.feedEmptySubtitle')}</Text>
            </Press>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={state.rooms}
        keyExtractor={(room) => room.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabClearance }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        ListHeaderComponent={<Text style={styles.title}>{tr('rooms.listTitle')}</Text>}
        renderItem={({ item }) => (
          <Press onPress={() => router.push(`/league/feed/${item.id}`)} style={styles.roomRow}>
            <View style={styles.roomIcon}><Users size={18} color={c.fgMuted} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomName}>{item.name}</Text>
              <Text style={styles.roomMeta}>
                {item.active_challenge?.title ?? tr('rooms.createChallenge')} · {tr('members', { count: item.member_count })}
              </Text>
            </View>
            {item.unread_posts > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{item.unread_posts}</Text></View>}
            <ChevronRight size={18} color={c.fgSubtle} />
          </Press>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  title: { ...text.title2, color: c.fg, marginBottom: space.xl },
  subtitle: { ...text.body, color: c.fgMuted, textAlign: 'center', lineHeight: 22 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: 80 },
  emptyTitle: { ...text.title3, color: c.fg, textAlign: 'center', marginBottom: space.xs },
  primaryButton: { marginTop: space.xl, height: 52, width: '100%', borderRadius: radius.lg, backgroundColor: c.accent, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...text.bodyStrong, color: c.fgOnAccent },
  joinRow: { flexDirection: 'row', gap: space.sm, width: '100%', marginTop: space.md },
  input: { flex: 1, height: 50, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: space.lg, color: c.fg, backgroundColor: c.surface, ...text.body },
  joinButton: { height: 50, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  joinText: { ...text.label, color: c.fg },
  feed: { paddingHorizontal: space.xl, paddingTop: space.md, flexGrow: 1 },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
  actionCard: { flex: 1, minHeight: 68, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm },
  actionText: { ...text.label, color: c.fg },
  feedEmpty: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: 100 },
  list: { paddingHorizontal: space.xl, paddingTop: space.md },
  roomRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  roomIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  roomName: { ...text.bodyStrong, color: c.fg },
  roomMeta: { ...text.caption, color: c.fgMuted, marginTop: 3 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  unreadText: { ...text.caption, color: c.fgOnAccent },
});
