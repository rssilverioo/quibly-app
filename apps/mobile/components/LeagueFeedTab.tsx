import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ReactionEmoji } from '@quibly/shared';
import { useAuth } from '../contexts/AuthContext';
import { addComment, getFeedPosts, toggleReaction } from '../services/feed';
import { useTheme, type Palette, space, text } from '../theme';
import PostCard, { type FirebaseFeedPost } from './feed/PostCard';
import PostSocialFooter from './feed/PostSocialFooter';

export default function LeagueFeedTab({ leagueId }: { leagueId: string }) {
  const { t } = useTranslation('feed');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();
  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!leagueId) return;
    try {
      setPosts(await getFeedPosts(leagueId) as FirebaseFeedPost[]);
    } catch {
      // The existing feed keeps the last successful result on transient errors.
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
    if (!user) return;
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
    if (!user || !content.trim()) return;
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <PostCard loading />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View>
          <PostCard post={item} />
          <PostSocialFooter
            post={item}
            currentUserId={user?.uid ?? ''}
            leagueId={leagueId}
            onReaction={handleReaction}
            onAddComment={handleAddComment}
          />
        </View>
      )}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={c.fgMuted}
        />
      )}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={(
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color={c.fgMuted} />
          <Text style={styles.emptyTitle}>{t('emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('emptySubtitle')}</Text>
        </View>
      )}
    />
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  loadingContainer: { padding: space.lg },
  listContent: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  separator: { height: space.lg },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: space.sm },
  emptyTitle: { ...text.title3, color: c.fg },
  emptySubtitle: { ...text.label, color: c.fgMuted, textAlign: 'center' },
});
