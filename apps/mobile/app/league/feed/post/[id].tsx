import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import PostCard from '../../../../components/feed/PostCard';
import Press from '../../../../components/ui/Press';
import { getCachedFeedPost } from '../../../../lib/feed-detail-cache';
import { useTheme, type Palette, space, text } from '../../../../theme';

export default function FeedPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const post = getCachedFeedPost(id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
        <Text style={styles.title}>Post</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.body}>
        {post ? <PostCard post={post} /> : <Text style={styles.missing}>Post indisponível</Text>}
      </View>
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
