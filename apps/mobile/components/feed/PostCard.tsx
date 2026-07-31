import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme, type Palette, radius, space, text } from '../../theme';

export interface FirebaseFeedPost {
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
  caption?: string | null;
  challenge_title?: string | null;
}

export interface PostCardProps {
  post?: FirebaseFeedPost;
  editable?: boolean;
  loading?: boolean;
  onEditCaption?: () => void;
  onAddPhoto?: () => void;
}

export function timeAgo(
  dateString: string,
  t: TFunction,
  now = Date.now(),
): string {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(dateString).getTime()) / 1000),
  );
  if (seconds < 60) return t('timeAgo.justNow');
  if (seconds < 3600) {
    return t('timeAgo.minutesAgo', { count: Math.floor(seconds / 60) });
  }
  if (seconds < 86400) {
    return t('timeAgo.hoursAgo', { count: Math.floor(seconds / 3600) });
  }
  return t('timeAgo.daysAgo', { count: Math.floor(seconds / 86400) });
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

function PostCardSkeleton({ c }: { c: Palette }) {
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.card} accessibilityLabel="Carregando publicação">
      <View style={styles.byline}>
        <View style={[styles.avatar, styles.skeleton]} />
        <View style={styles.skeletonByline}>
          <View style={[styles.skeleton, styles.skeletonName]} />
          <View style={[styles.skeleton, styles.skeletonTime]} />
        </View>
      </View>
      <View style={[styles.skeleton, styles.skeletonSubject]} />
      <View style={styles.dataRow}>
        <View style={[styles.skeleton, styles.skeletonData]} />
        <View style={[styles.skeleton, styles.skeletonData]} />
      </View>
    </View>
  );
}

export default function PostCard({
  post,
  editable = false,
  loading = false,
  onEditCaption,
  onAddPhoto,
}: PostCardProps) {
  const { t } = useTranslation('feed');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  if (loading || !post) return <PostCardSkeleton c={c} />;

  const timeLabel = timeAgo(post.created_at, t);
  const showProofPhoto = post.show_proof_photo && Boolean(post.proof_photo_url);

  return (
    <View style={styles.card}>
      {showProofPhoto ? (
        <Image
          source={{ uri: post.proof_photo_url! }}
          style={styles.proofPhoto}
          resizeMode="cover"
          accessibilityLabel={t('proofPhotoAccessibility')}
        />
      ) : null}

      <View style={styles.byline}>
        {post.avatar_url ? (
          <Image source={{ uri: post.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>
              {getInitials(post.username)}
            </Text>
          </View>
        )}
        <Text style={styles.username} numberOfLines={1}>
          {post.username || t('common:unknown')}
        </Text>
        <Text style={styles.relativeTime}>· {timeLabel}</Text>
      </View>

      {post.subject_name ? (
        <View style={styles.subjectRow}>
          <View
            style={[
              styles.subjectDot,
              { backgroundColor: post.subject_color || c.fgMuted },
            ]}
          />
          <Text style={styles.subjectName}>{post.subject_name}</Text>
        </View>
      ) : null}

      <View style={styles.dataRow}>
        <View style={styles.dataPill}>
          <Text style={styles.minutesText}>
            ⏱ {t('minutesShort', { count: post.total_duration_minutes })}
          </Text>
          {post.is_verified ? <Text style={styles.verified}> ✓</Text> : null}
        </View>
        <View style={styles.dataPill}>
          <Text style={styles.xpText}>⚡ +{post.points_earned} XP</Text>
        </View>
      </View>

      {post.caption ? (
        <TouchableOpacity
          disabled={!editable || !onEditCaption}
          onPress={onEditCaption}
          activeOpacity={0.7}
        >
          <Text style={styles.caption}>{post.caption}</Text>
        </TouchableOpacity>
      ) : editable ? (
        <TouchableOpacity onPress={onEditCaption} activeOpacity={0.7}>
          <Text style={styles.captionPrompt}>{t('addCaption')}</Text>
        </TouchableOpacity>
      ) : null}

      {editable && !showProofPhoto && onAddPhoto ? (
        <TouchableOpacity onPress={onAddPhoto} activeOpacity={0.7}>
          <Text style={styles.addPhoto}>{t('addPhoto')}</Text>
        </TouchableOpacity>
      ) : null}

      {post.challenge_title ? (
        <Text style={styles.challengeLine}>
          {t('countsForChallenge', { challenge: post.challenge_title })}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    gap: space.md,
    overflow: 'hidden',
  },
  proofPhoto: {
    width: 'auto',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    marginHorizontal: -space.lg,
    marginTop: -space.lg,
  },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
  },
  avatar: { width: 32, height: 32, borderRadius: radius.full },
  avatarPlaceholder: {
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { ...text.caption, color: c.fgMuted },
  username: { ...text.bodyStrong, color: c.fg, marginLeft: space.sm, flexShrink: 1 },
  relativeTime: { ...text.caption, color: c.fgMuted, marginLeft: space.xs },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  subjectDot: { width: 8, height: 8, borderRadius: radius.full },
  subjectName: { ...text.title3, color: c.fg, flexShrink: 1 },
  dataRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dataPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  minutesText: { ...text.label, color: c.fg, fontFamily: text.bodyStrong.fontFamily },
  verified: { ...text.label, color: c.success },
  xpText: { ...text.label, color: c.fg },
  caption: { ...text.body, color: c.fg },
  captionPrompt: { ...text.body, color: c.fgMuted },
  addPhoto: { ...text.label, color: c.fgMuted },
  challengeLine: { ...text.caption, color: c.fgMuted },
  skeleton: { backgroundColor: c.surfaceRaised, borderRadius: radius.sm },
  skeletonByline: { marginLeft: space.sm, gap: space.xs },
  skeletonName: { width: 112, height: 12 },
  skeletonTime: { width: 64, height: 8 },
  skeletonSubject: { width: 148, height: 20 },
  skeletonData: { width: 96, height: 34, borderRadius: radius.full },
});
