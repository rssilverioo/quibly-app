import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ReactionEmoji } from '@quibly/shared';

import PostCard from '../../../../components/feed/PostCard';
import { Mascot } from '../../../../components/mascot';
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
            // §4.4: erro nunca é uma linha de texto solta no meio da tela — tem
            // cara (o coelho) e uma saída (voltar para o feed).
            <View style={styles.missingBlock}>
              <Mascot state="worried" size={96} animate={false} />
              <Text style={styles.missing}>{t('rooms.postUnavailable')}</Text>
              <Press onPress={() => router.back()} style={styles.missingAction}>
                <Text style={styles.link}>{t('rooms.backToFeed')}</Text>
              </Press>
            </View>
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
  // 16, não 24: a foto da prova ganha os 16pt de largura que a referência dá a
  // ela. É o bloco mais importante da tela.
  body: { padding: space.lg, flexGrow: 1 },
  missingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missing: { ...text.body, color: c.fgMuted, textAlign: 'center', marginTop: space.md },
  missingAction: { minHeight: 44, justifyContent: 'center' },
  link: { ...text.bodyStrong, color: c.accent },
});
