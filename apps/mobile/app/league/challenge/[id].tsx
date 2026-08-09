import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { unidadeDaMetrica } from '../../../lib/metrica';
import { formatarTempoDeEstudo } from '../../../lib/study-time';

import { Mascot } from '../../../components/mascot';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import RoomTabBar from '../../../components/rooms/RoomTabBar';
import { ordinal } from '../../../lib/ordinal';
import { challengeTimeLeft } from '../../../lib/rooms-home';
import {
  getChallengeLeaderboard,
  getRoomDetails,
  type ChallengeDetails,
  type ChallengeLeaderboard,
} from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';
import SeloVerificado from '../../../components/ui/SeloVerificado';
import { voltar } from '../../../lib/navegacao';

/** Cinco linhas de esqueleto: a forma do placar é conhecida, então esperar com
 *  a forma certa é melhor que esperar com um spinner (§4.4). */
const SKELETON_ROWS = [0, 1, 2, 3, 4];

export default function ChallengeLeaderboardScreen() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId?: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [data, setData] = useState<ChallengeLeaderboard | null>(null);
  // O payload do placar não traz `starts_at` nem `elapsed_fraction` — quem tem
  // isso é `/rooms/:id/details`. A barra de progresso só aparece quando a sala
  // é conhecida; sem ela, some (nunca uma barra vazia inventada).
  const [details, setDetails] = useState<ChallengeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setFailed(true);
      return;
    }
    try {
      const [board, roomDetails] = await Promise.all([
        getChallengeLeaderboard(id),
        roomId ? getRoomDetails(roomId).catch(() => null) : Promise.resolve(null),
      ]);
      setData(board);
      setDetails(roomDetails);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id, roomId]);

  useEffect(() => { void load().finally(() => setLoading(false)); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    setFailed(false);
    void load().finally(() => setLoading(false));
  };

  const nav = (
    <View style={styles.nav}>
      <Press onPress={() => voltar()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {nav}
        <View style={styles.content}>
          <View style={styles.card}>
            {SKELETON_ROWS.map((row) => (
              <View key={row} style={styles.row}>
                <View style={styles.skeletonAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={[styles.skeletonBar, { width: '55%' }]} />
                  <View style={[styles.skeletonBar, { width: '30%', marginTop: 6, height: 10 }]} />
                </View>
                {row < SKELETON_ROWS.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (failed || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {nav}
        <View style={styles.center}>
          <Mascot state="worried" size={96} animate={false} />
          <Text style={styles.stateBody}>{t('rooms.rankingsUnavailable')}</Text>
          <Press onPress={retry} style={styles.stateAction}><Text style={styles.link}>{t('rooms.tryAgain')}</Text></Press>
        </View>
      </SafeAreaView>
    );
  }

  const timeLeft = challengeTimeLeft(data.challenge.ends_at, data.challenge.server_time);
  const ended = new Date(data.challenge.ends_at).getTime() <= new Date(data.challenge.server_time).getTime();
  const winner = ended ? data.entries[0] ?? null : null;
  const elapsed = details ? Math.max(0, Math.min(1, details.challenge.elapsed_fraction)) : null;
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
  const invite = details?.room.invite_code;

  const header = (
    <View>
      {/* O payoff do prazo: quando o desafio acaba, a tela declara o vencedor
          antes de mostrar a tabela. */}
      {winner ? (
        <View style={styles.winnerBlock}>
          <Mascot state="trophy" size={132} animate={false} />
          <Text style={styles.winnerName}>{t('rooms.challengeWinner', { name: winner.display_name })}</Text>
          <Text style={styles.stateBody}>{t('rooms.challengeEnded')}</Text>
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>{data.challenge.title}</Text>

      {elapsed !== null ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${elapsed * 100}%` }, timeLeft.urgent && !ended && styles.progressUrgent]} />
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>{t('rooms.started', { date: dateLabel(details!.challenge.starts_at) })}</Text>
            <Text style={styles.dateText}>{t('rooms.finishes', { date: dateLabel(details!.challenge.ends_at) })}</Text>
          </View>
        </>
      ) : (
        <Text style={styles.dateText}>{t('rooms.daysLeft', { count: timeLeft.days })}</Text>
      )}

      <Text style={styles.section}>{t('rooms.rankingsTitle')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {nav}
      <FlatList
        data={data.entries}
        keyExtractor={(entry) => entry.user_id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          const isMe = item.rank === data.me.rank && item.metric_value === data.me.metric_value;
          const last = index === data.entries.length - 1;
          const digits = String(item.rank);
          const suffix = ordinal(item.rank, i18n.language).slice(digits.length);
          return (
            <Press
              onPress={() => router.push({
                pathname: '/league/challenge/[id]/member/[userId]',
                params: {
                  id,
                  userId: item.user_id,
                  name: item.display_name,
                  avatar: item.avatar_url ?? '',
                  rank: String(item.rank),
                  value: String(item.metric_value),
                  unit: unidadeDaMetrica(data.challenge.metric_unit, item.metric_value, t),
                },
              })}
              style={[styles.rowWrap, index === 0 && styles.rowFirst, last && styles.rowLast, isMe && styles.meRow]}
            >
              {isMe ? <View style={styles.meBar} /> : null}
              <View style={styles.row}>
                <Avatar uri={item.avatar_url} name={item.display_name} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nomeLinha}>
                    <Text style={styles.name} numberOfLines={1}>{item.display_name}{isMe ? ` · ${t('rooms.you')}` : ''}</Text>
                    <SeloVerificado selo={item.verification} size={13} />
                  </View>
                  {/* A métrica é o dia; as horas viram a linha de baixo. O
                      número que ordena e o número que informa não podem
                      competir pelo mesmo peso. */}
                  <Text style={styles.metric}>
                    {item.metric_value} {unidadeDaMetrica(data.challenge.metric_unit, item.metric_value, t)}
                  </Text>
                  {item.minutes > 0 ? (
                    <Text style={styles.metricSecundaria}>{formatarTempoDeEstudo(item.minutes)}</Text>
                  ) : null}
                </View>
                <Text style={styles.rank}>{digits}<Text style={styles.rankSuffix}>{suffix}</Text></Text>
                <ChevronRight size={17} color={c.fgSubtle} />
                {!last && !isMe ? <View style={styles.divider} /> : null}
              </View>
            </Press>
          );
        }}
        ListEmptyComponent={(
          <View style={styles.emptyBlock}>
            <Mascot state="reading" size={120} animate={false} />
            <Text style={styles.emptyTitle}>{t('rooms.leaderboardEmpty')}</Text>
            {invite ? (
              <Press onPress={() => Share.share({ message: `https://tryquibly.com/join/${invite}` })} style={styles.stateAction}>
                <Text style={styles.link}>{t('rooms.invite')}</Text>
              </Press>
            ) : null}
          </View>
        )}
      />
      <RoomTabBar roomId={roomId ?? id} challengeId={id} active="rankings" />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, paddingHorizontal: space.lg },
  nav: { height: 44, paddingHorizontal: space.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  title: { ...text.title2, color: c.fg, marginBottom: space.md },
  // 18pt, largura total: o único lugar do app onde o accent ocupa área além do
  // FAB. REF 18,2 na tela de estatísticas do GymRats.
  progressTrack: { height: 18, borderRadius: radius.full, backgroundColor: c.surfacePressed, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: c.accent },
  progressUrgent: { backgroundColor: c.deadline },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  dateText: { ...text.caption, color: c.fgMuted },
  section: { ...text.bodyStrong, color: c.fg, marginTop: space.xl, marginBottom: space.md },
  card: { backgroundColor: c.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  // O card único é montado a partir das linhas: a primeira arredonda em cima, a
  // última embaixo, e a borda vive em cada linha para o `FlatList` não precisar
  // de um contêiner que quebraria a virtualização.
  rowWrap: { backgroundColor: c.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border, overflow: 'hidden' },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm },
  row: { height: 58, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.sm, paddingRight: space.lg },
  // Recuada até a coluna do nome (8 de inset + 40 de avatar + 12 de gap = 60),
  // como a referência. Absoluta para não deslocar o conteúdo da linha.
  divider: { position: 'absolute', left: 60, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  meRow: { backgroundColor: c.accentSoft },
  meBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: c.accent, zIndex: 1 },
  // `flexShrink` no nome e não na linha: nome longo encolhe, o selo nunca —
  // um selo cortado pela metade é pior que nenhum.
  nomeLinha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { ...text.bodyStrong, color: c.fg, flexShrink: 1 },
  metric: { ...text.caption, color: c.fgMuted, marginTop: 2 },
  // Mais apagada que a métrica: as horas informam, os dias ordenam. Dar o mesmo
  // peso às duas devolveria a dúvida de qual número vale.
  metricSecundaria: { ...text.caption, color: c.fgSubtle },
  rank: { ...text.title3, color: c.fg },
  rankSuffix: { ...text.label, color: c.fg },
  winnerBlock: { alignItems: 'center', paddingBottom: space.xl },
  winnerName: { ...text.title2, color: c.fg, textAlign: 'center', marginTop: space.lg },
  emptyBlock: { alignItems: 'center', paddingTop: space.xxl },
  emptyTitle: { ...text.title2, color: c.fg, textAlign: 'center', marginTop: space.lg },
  stateBody: { ...text.body, color: c.fgMuted, textAlign: 'center', marginTop: space.sm },
  stateAction: { minHeight: 44, justifyContent: 'center' },
  link: { ...text.bodyStrong, color: c.accent },
  skeletonAvatar: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: c.skeleton },
  skeletonBar: { height: 12, borderRadius: radius.full, backgroundColor: c.skeleton },
});
