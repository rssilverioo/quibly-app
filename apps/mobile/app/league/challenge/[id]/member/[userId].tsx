import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import PostCard, { type FirebaseFeedPost } from '../../../../../components/feed/PostCard';
import Avatar from '../../../../../components/ui/Avatar';
import Press from '../../../../../components/ui/Press';
import { feedPagePosts, roomFeedPostToCardPost } from '../../../../../lib/feed-post';
import { getChallengeMemberPosts } from '../../../../../services/rooms';
import { useTheme, type Palette, space, text } from '../../../../../theme';
import { voltar } from '../../../../../lib/navegacao';

const PAGE_SIZE = 20;

export default function ChallengeMemberFeedScreen() {
  const params = useLocalSearchParams<{
    id: string; userId: string; name?: string; avatar?: string;
    rank?: string; value?: string; unit?: string;
    /** '1' quando a pessoa assina — ver `components/plano/MolduraPro`. */
    pro?: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (nextPage: number, replace = false) => {
    if (!params.id || !params.userId) return;
    const result = await getChallengeMemberPosts(params.id, params.userId, nextPage, PAGE_SIZE);
    // Esta rota **de fato** responde `items` — é a irmã dela, o feed da sala,
    // que responde `posts`. `feedPagePosts` aceita as duas para que ninguém
    // precise lembrar qual é qual (ver `services/rooms.ts`).
    const next = feedPagePosts(result).map((post) => roomFeedPostToCardPost(post));
    setPosts((current) => replace ? next : [...current, ...next]);
    setPage(nextPage);
    setTotal(result.total);
  }, [params.id, params.userId]);

  useEffect(() => {
    void load(1, true).catch(() => setPosts([])).finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(1, true).catch(() => {});
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || posts.length >= total) return;
    setLoadingMore(true);
    await load(page + 1).catch(() => {});
    setLoadingMore(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.nav}>
        <Press onPress={() => voltar()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
        <Text style={styles.navTitle}>{t('rooms.memberHistory')}</Text>
        <View style={styles.back} />
      </View>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        // `list` e não `detail`: aqui os posts são vários numa lista, e é o
        // único lugar onde a moldura do card ainda separa um do outro.
        renderItem={({ item }) => <PostCard post={item} variant="list" />}
        ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={(
          <View style={styles.personHeader}>
            <Avatar uri={params.avatar || null} name={params.name || ''} size={56} pro={params.pro === '1'} />
            <Text style={styles.name}>{params.name}</Text>
            <Text style={styles.summary}>
              {t('rooms.memberChallengeSummary', {
                rank: params.rank,
                value: params.value,
                unit: params.unit,
              })}
            </Text>
          </View>
        )}
        ListEmptyComponent={loading
          ? <ActivityIndicator color={c.accent} />
          : <Text style={styles.empty}>{t('rooms.memberNoPosts')}</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={c.accent} /> : null}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  nav: { height: 56, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: c.border },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { ...text.bodyStrong, color: c.fg },
  // 16 em toda tela de sala: a foto da prova ganha os 8pt de cada lado que a
  // margem de 24 tirava dela.
  list: { padding: space.lg, flexGrow: 1 },
  personHeader: { alignItems: 'center', paddingBottom: space.xl },
  name: { ...text.title3, color: c.fg, marginTop: space.md },
  summary: { ...text.label, color: c.fgMuted, marginTop: space.xs },
  empty: { ...text.body, color: c.fgMuted, textAlign: 'center', paddingTop: space.xxl },
});
