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
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Camera, Plus, X, ChevronUp, ChevronDown, CheckCircle } from 'lucide-react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { getFeedPosts, toggleReaction, addComment, getComments } from '../../../services/feed';
import type { ReactionEmoji } from '@quibly/shared';

// ─── Theme ───

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
};

const REACTION_EMOJIS: ReactionEmoji[] = ['🔥', '🧠', '💀', '👑', '⚡'];

// ─── Types ───

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

// ─── Helpers ───

function timeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Main Screen ───

export default function LeagueFeedScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Fetch feed ───

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

  // ─── Reaction toggling ───

  const handleReaction = useCallback(
    async (postId: string, emoji: ReactionEmoji) => {
      if (!user || !leagueId) return;

      // Optimistic update
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;

          const reactions = { ...post.reactions };
          const emojiList = reactions[emoji] ? [...reactions[emoji]] : [];

          if (emojiList.includes(user.uid)) {
            // Remove reaction
            reactions[emoji] = emojiList.filter((id) => id !== user.uid);
          } else {
            // Add reaction
            reactions[emoji] = [...emojiList, user.uid];
          }

          return { ...post, reactions };
        }),
      );

      try {
        await toggleReaction(leagueId, postId, emoji, user.uid);
      } catch {
        // Revert on failure by re-fetching
        await fetchFeed();
      }
    },
    [user, leagueId, fetchFeed],
  );

  // ─── Add comment ───

  const handleAddComment = useCallback(
    async (postId: string, content: string) => {
      if (!user || !content.trim() || !leagueId) return;

      // Optimistic: increment comment count
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          return { ...post, comment_count: post.comment_count + 1 };
        }),
      );

      try {
        await addComment(leagueId, postId, user.uid, content.trim());
      } catch {
        // Revert on failure
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

  // ─── Render ───

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ArrowLeft size={18} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Feed</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>{'\u2039 Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Feed</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedPostCard
              post={item}
              currentUserId={user?.uid ?? ''}
              leagueId={leagueId!}
              onReaction={handleReaction}
              onAddComment={handleAddComment}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <BookOpen size={48} color={COLORS.primary} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a study session to post to the league feed!
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Post Card Component ───

interface FeedPostCardProps {
  post: FirebaseFeedPost;
  currentUserId: string;
  leagueId: string;
  onReaction: (postId: string, emoji: ReactionEmoji) => void;
  onAddComment: (postId: string, content: string) => void;
}

function FeedPostCard({
  post,
  currentUserId,
  leagueId,
  onReaction,
  onAddComment,
}: FeedPostCardProps) {
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
      {/* ─── Header ─── */}
      <View style={styles.cardHeader}>
        {post.avatar_url ? (
          <Image
            source={{ uri: post.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {getInitials(post.username ?? '?')}
            </Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.username}>{post.username ?? 'Unknown'}</Text>
          <Text style={styles.handle}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>

      {/* ─── Content ─── */}
      <View style={styles.cardContent}>
        {/* Subject tag */}
        {post.subject_name && (
          <View
            style={[
              styles.subjectPill,
              { backgroundColor: (post.subject_color ?? COLORS.primary) + '25' },
            ]}
          >
            <View
              style={[styles.subjectDot, { backgroundColor: post.subject_color ?? COLORS.primary }]}
            />
            <Text style={[styles.subjectText, { color: post.subject_color ?? COLORS.primary }]}>
              {post.subject_name}
            </Text>
          </View>
        )}

        {/* Duration */}
        <Text style={styles.durationText}>
          Studied for{' '}
          <Text style={styles.durationHighlight}>
            {durationMinutes} {durationMinutes === 1 ? 'minute' : 'minutes'}
          </Text>
        </Text>

        {/* Points */}
        <Text style={styles.pointsText}>+{pointsEarned} SP</Text>

        {/* Verified badge */}
        {isVerified && (
          <View style={styles.verifiedPill}>
            <CheckCircle size={13} color={COLORS.success} style={{ marginRight: 4 }} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}

        {/* Proof photo thumbnail */}
        {post.show_proof_photo && (
          <View style={styles.proofPhotoContainer}>
            <View style={styles.proofPhotoBlur}>
              <Camera size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.proofPhotoLabel}>Proof submitted</Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── Reactions Row ─── */}
      <View style={styles.reactionsRow}>
        {REACTION_EMOJIS.map((emoji) => {
          const emojiList = reactions[emoji] ?? [];
          const count = emojiList.length;
          if (count === 0 && !showEmojiPicker) return null;

          const hasReacted = emojiList.includes(currentUserId);

          return (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.reactionPill,
                hasReacted && styles.reactionPillActive,
              ]}
              onPress={() => {
                onReaction(post.id, emoji);
                setShowEmojiPicker(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {count > 0 && (
                <Text
                  style={[
                    styles.reactionCount,
                    hasReacted && styles.reactionCountActive,
                  ]}
                >
                  {count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {!showEmojiPicker && (
          <TouchableOpacity
            style={styles.addReactionButton}
            onPress={() => setShowEmojiPicker(true)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        {showEmojiPicker && (
          <TouchableOpacity
            style={styles.closePickerButton}
            onPress={() => setShowEmojiPicker(false)}
            activeOpacity={0.7}
          >
            <X size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Comments Preview ─── */}
      <TouchableOpacity
        style={styles.commentsToggle}
        onPress={handleToggleComments}
        activeOpacity={0.7}
      >
        <Text style={styles.commentsToggleText}>
          {post.comment_count === 0
            ? 'Add a comment...'
            : post.comment_count === 1
              ? '1 comment'
              : `${post.comment_count} comments`}
        </Text>
        {showComments
          ? <ChevronUp size={14} color={COLORS.textMuted} />
          : <ChevronDown size={14} color={COLORS.textMuted} />
        }
      </TouchableOpacity>

      {/* ─── Expanded Comments ─── */}
      {showComments && (
        <View style={styles.commentsSection}>
          {loadingComments ? (
            <ActivityIndicator color={COLORS.primary} style={{ padding: 16 }} />
          ) : (
            comments.length > 0 && (
              <View style={styles.commentsList}>
                {comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} />
                ))}
              </View>
            )
          )}

          {/* Comment input */}
          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor={COLORS.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleSubmitComment}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              style={[
                styles.commentSendButton,
                !commentText.trim() && styles.commentSendButtonDisabled,
              ]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.commentSendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Comment Item Component ───

function CommentItem({ comment }: { comment: CommentData }) {
  return (
    <View style={styles.commentItem}>
      {comment.avatar_url ? (
        <Image
          source={{ uri: comment.avatar_url }}
          style={styles.commentAvatar}
        />
      ) : (
        <View style={styles.commentAvatarPlaceholder}>
          <Text style={styles.commentAvatarInitials}>
            {getInitials(comment.username ?? '?')}
          </Text>
        </View>
      )}
      <View style={styles.commentBody}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentUsername}>
            {comment.username ?? 'Unknown'}
          </Text>
          <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
        </View>
        <Text style={styles.commentContent}>{comment.content}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backText: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: '600',
  },
  headerBarTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },

  // ─── Empty State ───
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ─── Card ───
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  // ─── Card Header ───
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: COLORS.primaryLight,
    fontSize: 14,
    fontWeight: '700',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  handle: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 1,
  },

  // ─── Card Content ───
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  subjectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  durationText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 6,
  },
  durationHighlight: {
    color: COLORS.text,
    fontWeight: '600',
  },
  pointsText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 8,
  },
  verifiedCheck: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  verifiedText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Proof Photo ───
  proofPhotoContainer: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  proofPhotoBlur: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  proofPhotoIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  proofPhotoLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },

  // ─── Reactions ───
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reactionPillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '18',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  reactionCountActive: {
    color: COLORS.primaryLight,
  },
  addReactionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReactionPlus: {
    color: COLORS.textMuted,
    fontSize: 18,
    fontWeight: '500',
    marginTop: -1,
  },
  closePickerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePickerText: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: '500',
    marginTop: -2,
  },

  // ─── Comments Toggle ───
  commentsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commentsToggleText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  commentsChevron: {
    color: COLORS.textMuted,
    fontSize: 10,
  },

  // ─── Comments Section ───
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitials: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
    marginLeft: 10,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentUsername: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  commentTime: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  commentContent: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
    lineHeight: 19,
  },

  // ─── Comment Input ───
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentSendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  commentSendButtonDisabled: {
    opacity: 0.4,
  },
  commentSendText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
