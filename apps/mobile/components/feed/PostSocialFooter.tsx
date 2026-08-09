import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { FeedComment, ReactionEmoji } from '@quibly/shared';
import { getComments } from '../../services/feed';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import type { FirebaseFeedPost } from './PostCard';
import { timeAgo } from './PostCard';
import { autorDoComentario, type ComentarioComAutor } from '../../lib/comentario-autor';
import Avatar from '../ui/Avatar';

const REACTION_EMOJIS: ReactionEmoji[] = ['🔥', '🧠', '💀', '👑', '⚡'];

type FeedCommentData = FeedComment & ComentarioComAutor;

interface PostSocialFooterProps {
  post: FirebaseFeedPost;
  currentUserId: string;
  leagueId: string;
  onReaction: (postId: string, emoji: ReactionEmoji) => void;
  onAddComment: (postId: string, content: string) => void;
}

export default function PostSocialFooter({
  post,
  currentUserId,
  leagueId,
  onReaction,
  onAddComment,
}: PostSocialFooterProps) {
  const { t } = useTranslation('feed');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<FeedCommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    onAddComment(post.id, commentText);
    setCommentText('');
  };

  const handleToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (!next || comments.length > 0) return;
    setLoadingComments(true);
    try {
      setComments(await getComments(leagueId, post.id) as FeedCommentData[]);
    } catch {
      // The feed remains usable if comments fail to load.
    } finally {
      setLoadingComments(false);
    }
  };

  return (
    <View style={styles.footer}>
      <View style={styles.reactionsRow}>
        {REACTION_EMOJIS.map((emoji) => {
          const users = post.reactions?.[emoji] ?? [];
          if (users.length === 0 && !showEmojiPicker) return null;
          const selected = users.includes(currentUserId);
          return (
            <TouchableOpacity
              key={emoji}
              style={[styles.reactionPill, selected && styles.reactionPillSelected]}
              onPress={() => {
                onReaction(post.id, emoji);
                setShowEmojiPicker(false);
              }}
            >
              <Text>{emoji}</Text>
              {users.length > 0 ? (
                <Text style={styles.reactionCount}>{users.length}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.reactionAction}
          onPress={() => setShowEmojiPicker((value) => !value)}
        >
          {showEmojiPicker
            ? <X size={16} color={c.fgSubtle} />
            : <Plus size={16} color={c.fgSubtle} />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.commentsToggle} onPress={handleToggleComments}>
        <Text style={styles.commentsToggleText}>
          {post.comment_count === 0
            ? t('addComment')
            : t('comment', { count: post.comment_count })}
        </Text>
        {/* O chevron faz par com o rótulo ao lado, que é `fgMuted`; em
            `fgSubtle` ele lia como desabilitado. */}
        {showComments
          ? <ChevronUp size={14} color={c.fgMuted} />
          : <ChevronDown size={14} color={c.fgMuted} />}
      </TouchableOpacity>

      {showComments ? (
        <View style={styles.commentsSection}>
          {loadingComments ? <ActivityIndicator color={c.fgMuted} /> : null}
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder={t('commentPlaceholder')}
              // Placeholder é texto que se lê antes de digitar — `fgMuted`.
              // `fgSubtle` (3,5:1) fica para detalhe desabilitado.
              placeholderTextColor={c.fgMuted}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleSubmitComment}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSubmitComment}
              disabled={!commentText.trim()}
            >
              <Text style={[styles.sendText, !commentText.trim() && styles.disabled]}>
                {t('common:send')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CommentItem({ comment }: { comment: FeedCommentData }) {
  const { t } = useTranslation('feed');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Pelo helper, e não lendo os campos aqui: a API manda o autor em `user`, e
  // ler `username`/`profile` fazia todo comentário virar "desconhecido". Ver
  // `lib/comentario-autor`.
  const { nome, avatar, pro } = autorDoComentario(comment);
  const name = nome ?? t('common:unknown');
  const label = timeAgo(comment.created_at, t);

  return (
    <View style={styles.commentItem}>
      <Avatar uri={avatar} name={name} size={28} pro={pro} />
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentName}>{name}</Text>
          <Text style={styles.commentTime}>{label}</Text>
        </View>
        <Text style={styles.commentContent}>{comment.content}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  footer: { backgroundColor: c.surface },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.border,
  },
  reactionPillSelected: { borderColor: c.borderStrong, backgroundColor: c.surfacePressed },
  reactionCount: { ...text.caption, color: c.fgMuted },
  reactionAction: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  commentsToggleText: { ...text.caption, color: c.fgMuted },
  commentsSection: { borderTopWidth: 1, borderTopColor: c.border, padding: space.md, gap: space.md },
  commentItem: { flexDirection: 'row' },
  commentBody: { flex: 1, marginLeft: space.sm },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  commentName: { ...text.caption, color: c.fg },
  commentTime: { ...text.caption, color: c.fgMuted },
  commentContent: { ...text.label, color: c.fg, marginTop: space.xs },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  commentInput: {
    ...text.label,
    color: c.fg,
    flex: 1,
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  sendButton: { padding: space.sm },
  sendText: { ...text.label, color: c.fgMuted },
  disabled: { color: c.fgSubtle },
});
