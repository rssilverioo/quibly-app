import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { BookOpen, Camera, Plus, X, ChevronUp, ChevronDown, CheckCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { COLORS } from '@quibly/shared/constants';
import { useAuth } from '../contexts/AuthContext';
import { getFeedPosts, toggleReaction, addComment, getComments } from '../services/feed';
import type { ReactionEmoji } from '@quibly/shared';

const REACTION_EMOJIS: ReactionEmoji[] = ['🔥', '🧠', '💀', '👑', '⚡'];

interface FirebaseFeedPost {
  id: string;
  league_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  session_id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  show_proof_photo: boolean;
  proof_photo_url: string | null;
  total_duration_minutes: number;
  points_earned: number;
  is_verified: boolean;
  reactions: Record<string, string[]>;
  comment_count: number;
  created_at: string;
}

interface CommentData {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

function timeAgo(dateString: string, t: TFunction): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return t('timeAgo.justNow');
  if (seconds < 3600) return t('timeAgo.minutesAgo', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('timeAgo.hoursAgo', { count: Math.floor(seconds / 3600) });
  return t('timeAgo.daysAgo', { count: Math.floor(seconds / 86400) });
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Comment Item ───

function CommentItem({ comment }: { comment: CommentData }) {
  const { t } = useTranslation('feed');
  return (
    <View style={styles.commentItem}>
      {comment.avatar_url ? (
        <Image source={{ uri: comment.avatar_url }} style={styles.commentAvatar} />
      ) : (
        <View style={styles.commentAvatarPlaceholder}>
          <Text style={styles.commentAvatarInitials}>{getInitials(comment.username ?? '?')}</Text>
        </View>
      )}
      <View style={styles.commentBody}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentUsername}>{comment.username ?? t('common:unknown')}</Text>
          <Text style={styles.commentTime}>{timeAgo(comment.created_at, t)}</Text>
        </View>
        <Text style={styles.commentContent}>{comment.content}</Text>
      </View>
    </View>
  );
}

// ─── Feed Post Card ───

function FeedPostCard({
  post,
  currentUserId,
  leagueId,
  onReaction,
  onAddComment,
}: {
  post: FirebaseFeedPost;
  currentUserId: string;
  leagueId: string;
  onReaction: (postId: string, emoji: ReactionEmoji) => void;
  onAddComment: (postId: string, content: string) => void;
}) {
  const { t } = useTranslation('feed');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  const durationMinutes = post.total_duration_minutes ?? 0;
  const pointsEarned = post.points_earned ?? 0;
  const isVerified = post.is_verified ?? false;
  const reactions = post.reactions ?? {};

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      onAddComment(post.id, commentText);
      setCommentText('');
    }
  };

  const handleToggleComments = async () => {
    const newState = !showComments;
    setShowComments(newState);
    if (newState && comments.length === 0) {
      setLoadingComments(true);
      try {
        const data = await getComments(leagueId, post.id);
        setComments(data as any);
      } catch {
        // Silently fail
      } finally {
        setLoadingComments(false);
      }
      setTimeout(() => commentInputRef.current?.focus(), 300);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        {post.avatar_url ? (
          <Image source={{ uri: post.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials(post.username ?? '?')}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.username}>{post.username ?? t('common:unknown')}</Text>
          <Text style={styles.handle}>{timeAgo(post.created_at, t)}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {post.subject_name && (
          <View style={[styles.subjectPill, { backgroundColor: (post.subject_color ?? COLORS.primary) + '25' }]}>
            <View style={[styles.subjectDot, { backgroundColor: post.subject_color ?? COLORS.primary }]} />
            <Text style={[styles.subjectText, { color: post.subject_color ?? COLORS.primary }]}>{post.subject_name}</Text>
          </View>
        )}
        <Text style={styles.durationText}>
          {t('studiedFor')}<Text style={styles.durationHighlight}>{t('minute', { count: durationMinutes })}</Text>
        </Text>
        <Text style={styles.pointsText}>+{pointsEarned} SP</Text>
        {isVerified && (
          <View style={styles.verifiedPill}>
            <CheckCircle size={13} color={COLORS.success} style={{ marginRight: 4 }} />
            <Text style={styles.verifiedText}>{t('common:verified')}</Text>
          </View>
        )}
        {post.show_proof_photo && (
          <View style={styles.proofPhotoContainer}>
            <View style={styles.proofPhotoBlur}>
              <Camera size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.proofPhotoLabel}>{t('proofSubmitted')}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Reactions */}
      <View style={styles.reactionsRow}>
        {REACTION_EMOJIS.map((emoji) => {
          const emojiList = reactions[emoji] ?? [];
          const count = emojiList.length;
          if (count === 0 && !showEmojiPicker) return null;
          const hasReacted = emojiList.includes(currentUserId);
          return (
            <TouchableOpacity
              key={emoji}
              style={[styles.reactionPill, hasReacted && styles.reactionPillActive]}
              onPress={() => { onReaction(post.id, emoji); setShowEmojiPicker(false); }}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 0 && <Text style={[styles.reactionCount, hasReacted && styles.reactionCountActive]}>{count}</Text>}
            </TouchableOpacity>
          );
        })}
        {!showEmojiPicker && (
          <TouchableOpacity style={styles.addReactionButton} onPress={() => setShowEmojiPicker(true)} activeOpacity={0.7}>
            <Plus size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
        {showEmojiPicker && (
          <TouchableOpacity style={styles.closePickerButton} onPress={() => setShowEmojiPicker(false)} activeOpacity={0.7}>
            <X size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Comments Toggle */}
      <TouchableOpacity style={styles.commentsToggle} onPress={handleToggleComments} activeOpacity={0.7}>
        <Text style={styles.commentsToggleText}>
          {post.comment_count === 0 ? t('addComment') : t('comment', { count: post.comment_count })}
        </Text>
        {showComments ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
      </TouchableOpacity>

      {/* Expanded Comments */}
      {showComments && (
        <View style={styles.commentsSection}>
          {loadingComments ? (
            <ActivityIndicator color={COLORS.primary} style={{ padding: 16 }} />
          ) : (
            comments.length > 0 && (
              <View style={styles.commentsList}>
                {comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)}
              </View>
            )
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder={t('commentPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleSubmitComment}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.commentSendButton, !commentText.trim() && styles.commentSendButtonDisabled]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.commentSendText}>{t('common:send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Feed Tab ───

export default function LeagueFeedTab({ leagueId }: { leagueId: string }) {
  const { t } = useTranslation('feed');
  const { user } = useAuth();
  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!leagueId) return;
    try {
      const data = await getFeedPosts(leagueId);
      setPosts(data as FirebaseFeedPost[]);
    } catch {
      // Silently fail
    }
  }, [leagueId]);

  useEffect(() => {
    (async () => {
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

  const handleReaction = useCallback(
    async (postId: string, emoji: ReactionEmoji) => {
      if (!user || !leagueId) return;
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const reactions = { ...post.reactions };
          const emojiList = reactions[emoji] ? [...reactions[emoji]] : [];
          if (emojiList.includes(user.uid)) {
            reactions[emoji] = emojiList.filter((id) => id !== user.uid);
          } else {
            reactions[emoji] = [...emojiList, user.uid];
          }
          return { ...post, reactions };
        }),
      );
      try {
        await toggleReaction(leagueId, postId, emoji, user.uid);
      } catch {
        await fetchFeed();
      }
    },
    [user, leagueId, fetchFeed],
  );

  const handleAddComment = useCallback(
    async (postId: string, content: string) => {
      if (!user || !content.trim() || !leagueId) return;
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          return { ...post, comment_count: post.comment_count + 1 };
        }),
      );
      try {
        await addComment(leagueId, postId, user.uid, content.trim());
      } catch {
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            return { ...post, comment_count: Math.max(0, post.comment_count - 1) };
          }),
        );
      }
    },
    [user, leagueId],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FeedPostCard
          post={item}
          currentUserId={user?.uid ?? ''}
          leagueId={leagueId}
          onReaction={handleReaction}
          onAddComment={handleAddComment}
        />
      )}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>{t('emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('emptySubtitle')}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  separator: { height: 12 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + '30', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: COLORS.primaryLight, fontSize: 14, fontWeight: '700' },
  headerInfo: { marginLeft: 12, flex: 1 },
  username: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  handle: { color: COLORS.textMuted, fontSize: 13, marginTop: 1 },

  cardContent: { paddingHorizontal: 16, paddingBottom: 14 },
  subjectPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginBottom: 10 },
  subjectDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  subjectText: { fontSize: 13, fontWeight: '600' },
  durationText: { color: COLORS.textSecondary, fontSize: 15, marginBottom: 6 },
  durationHighlight: { color: COLORS.text, fontWeight: '600' },
  pointsText: { color: COLORS.primary, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: COLORS.success + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginBottom: 8 },
  verifiedText: { color: COLORS.success, fontSize: 13, fontWeight: '600' },

  proofPhotoContainer: { marginTop: 4, borderRadius: 12, overflow: 'hidden' },
  proofPhotoBlur: { backgroundColor: COLORS.surfaceLight, borderRadius: 12, paddingVertical: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  proofPhotoLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },

  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  reactionPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  reactionPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '18' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  reactionCountActive: { color: COLORS.primaryLight },
  addReactionButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  closePickerButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },

  commentsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  commentsToggleText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },

  commentsSection: { borderTopWidth: 1, borderTopColor: COLORS.border },
  commentsList: { paddingHorizontal: 16, paddingTop: 12 },
  commentItem: { flexDirection: 'row', marginBottom: 12 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary + '25', alignItems: 'center', justifyContent: 'center' },
  commentAvatarInitials: { color: COLORS.primaryLight, fontSize: 10, fontWeight: '700' },
  commentBody: { flex: 1, marginLeft: 10 },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentUsername: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  commentTime: { color: COLORS.textMuted, fontSize: 11 },
  commentContent: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2, lineHeight: 19 },

  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  commentInput: { flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, color: COLORS.text, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  commentSendButton: { backgroundColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  commentSendButtonDisabled: { opacity: 0.4 },
  commentSendText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
});
