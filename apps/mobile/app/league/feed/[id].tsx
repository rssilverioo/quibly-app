import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ReactionEmoji } from '@quibly/shared';
import PostCard, {
  type FirebaseFeedPost,
} from '../../../components/feed/PostCard';
import PostSocialFooter from '../../../components/feed/PostSocialFooter';
import { useAuth } from '../../../contexts/AuthContext';
import { addComment, getFeedPosts, toggleReaction } from '../../../services/feed';
import { useTheme, type Palette, space, text } from '../../../theme';

export default function LeagueFeedScreen() {
  const { t } = useTranslation('feed');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!leagueId) return;
    try {
      setPosts(await getFeedPosts(leagueId) as FirebaseFeedPost[]);
    } catch {
      // Preserve the last successful feed on transient errors.
    }
  }, [leagueId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchFeed();
      setLoading(false);
    })();
  }, [fetchFeed]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }, [fetchFeed]);

  const handleReaction = useCallback(async (postId: string, emoji: ReactionEmoji) => {
    if (!user || !leagueId) return;
    setPosts((current) => current.map((post) => {
      if (post.id !== postId) return post;
      const reactions = { ...post.reactions };
      const users = [...(reactions[emoji] ?? [])];
      reactions[emoji] = users.includes(user.uid)
        ? users.filter((id) => id !== user.uid)
        : [...users, user.uid];
      return { ...post, reactions };
    }));
    try {
      await toggleReaction(leagueId, postId, emoji, user.uid);
    } catch {
      await fetchFeed();
    }
  }, [fetchFeed, leagueId, user]);

  const handleAddComment = useCallback(async (postId: string, content: string) => {
    if (!user || !leagueId || !content.trim()) return;
    setPosts((current) => current.map((post) => post.id === postId
      ? { ...post, comment_count: post.comment_count + 1 }
      : post));
    try {
      await addComment(leagueId, postId, user.uid, content.trim());
    } catch {
      setPosts((current) => current.map((post) => post.id === postId
        ? { ...post, comment_count: Math.max(0, post.comment_count - 1) }
        : post));
    }
  }, [leagueId, user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={18} color={c.fgMuted} />
          <Text style={styles.backText}>{t('common:back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feed</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <PostCard loading />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View>
                <PostCard post={item} />
                <PostSocialFooter
                  post={item}
                  currentUserId={user?.uid ?? ''}
                  leagueId={leagueId!}
                  onReaction={handleReaction}
                  onAddComment={handleAddComment}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            ListEmptyComponent={(
              <View style={styles.emptyContainer}>
                <BookOpen size={48} color={c.fgMuted} />
                <Text style={styles.emptyTitle}>{t('emptyTitle')}</Text>
                <Text style={styles.emptySubtitle}>{t('emptySubtitle')}</Text>
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: space.xs, width: 72 },
  backText: { ...text.label, color: c.fgMuted },
  headerTitle: { ...text.bodyStrong, color: c.fg },
  headerSpacer: { width: 72 },
  loadingContainer: { padding: space.lg },
  listContent: { padding: space.lg, paddingBottom: space.xxl },
  separator: { height: space.lg },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: space.sm },
  emptyTitle: { ...text.title3, color: c.fg },
  emptySubtitle: { ...text.label, color: c.fgMuted, textAlign: 'center' },
});
