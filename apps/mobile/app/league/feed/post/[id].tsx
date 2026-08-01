import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ReactionEmoji } from '@quibly/shared';

import PostCard from '../../../../components/feed/PostCard';
import PostSocialFooter from '../../../../components/feed/PostSocialFooter';
import Press from '../../../../components/ui/Press';
import { useAuth } from '../../../../contexts/AuthContext';
import { addComment, toggleReaction } from '../../../../services/feed';
import { getCachedFeedPost } from '../../../../lib/feed-detail-cache';
import { useTheme, type Palette, space, text } from '../../../../theme';

export default function FeedPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // The cache is populated by whichever feed row opened this screen, so the
  // post is already known; local state only exists to make reactions and the
  // comment count respond immediately instead of after a round trip.
  const [post, setPost] = useState(() => getCachedFeedPost(id));
  const leagueId = post?.league_id ?? '';

  const onReaction = useCallback(async (postId: string, emoji: ReactionEmoji) => {
    if (!user || !leagueId) return;
    const previous = post;
    setPost((current) => {
      if (!current) return current;
      const reactions = { ...current.reactions };
      const users = [...(reactions[emoji] ?? [])];
      reactions[emoji] = users.includes(user.uid)
        ? users.filter((uid) => uid !== user.uid)
        : [...users, user.uid];
      return { ...current, reactions };
    });
    try {
      await toggleReaction(leagueId, postId, emoji, user.uid);
    } catch {
      setPost(previous); // Put the pill back rather than lie about the state.
    }
  }, [leagueId, post, user]);

  const onAddComment = useCallback(async (postId: string, content: string) => {
    if (!user || !leagueId || !content.trim()) return;
    setPost((current) => current && { ...current, comment_count: current.comment_count + 1 });
    try {
      await addComment(leagueId, postId, user.uid, content.trim());
    } catch {
      setPost((current) => current && {
        ...current,
        comment_count: Math.max(0, current.comment_count - 1),
      });
    }
  }, [leagueId, user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
        <Text style={styles.title}>{t('rooms.post')}</Text>
        <View style={styles.back} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {post ? (
            <>
              <PostCard post={post} />
              {leagueId ? (
                <PostSocialFooter
                  post={post}
                  currentUserId={user?.uid ?? ''}
                  leagueId={leagueId}
                  onReaction={onReaction}
                  onAddComment={onAddComment}
                />
              ) : null}
            </>
          ) : (
            <Text style={styles.missing}>{t('rooms.postUnavailable')}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.bodyStrong, color: c.fg },
  body: { padding: space.xl },
  missing: { ...text.body, color: c.fgMuted, textAlign: 'center' },
});
