import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { FirebaseFeedPost } from './PostCard';
import { Mascot } from '../mascot';
import Avatar from '../ui/Avatar';
import Press from '../ui/Press';
import { useTheme, type Palette, radius, space, text } from '../../theme';

interface FeedRowProps {
  post: FirebaseFeedPost;
  locale: string;
  onPress: () => void;
}

export default function FeedRow({ post, locale, onPress }: FeedRowProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const title = post.caption?.trim() || post.subject_name || 'Estudo';
  const time = new Date(post.created_at).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit',
  });
  const photo = post.show_proof_photo && post.proof_photo_url;

  return (
    <Press onPress={onPress} style={styles.row}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={styles.fallback}>
          <Mascot state="idle" size={34} plate={false} animate={false} />
        </View>
      )}
      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <View style={styles.byline}>
          <Avatar uri={post.avatar_url} name={post.username} size={18} />
          <Text numberOfLines={1} style={styles.author}>{post.username}</Text>
        </View>
      </View>
      <Text style={styles.time}>{time}</Text>
    </Press>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  row: { height: 72, flexDirection: 'row', alignItems: 'center', gap: space.md },
  // Rounded square, measured off the GymRats reference (~9pt on a 56pt tile).
  // A circle would crop ~21% of the proof photo, and the photo is the product.
  // The 56x56 geometry itself is owner-approved — see feed-row-structure.test.ts.
  thumbnail: { width: 56, height: 56, borderRadius: radius.sm },
  fallback: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { flex: 1, justifyContent: 'center' },
  title: { ...text.bodyStrong, color: c.fg },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  author: { ...text.caption, color: c.fgMuted, flexShrink: 1 },
  time: { ...text.caption, color: c.fgMuted },
});
