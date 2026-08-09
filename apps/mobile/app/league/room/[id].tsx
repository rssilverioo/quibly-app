import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, Pencil, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import FeedRow from '../../../components/feed/FeedRow';
import type { FirebaseFeedPost } from '../../../components/feed/PostCard';
import { Mascot } from '../../../components/mascot';
import { roomCoverForId, roomCoverHeight } from '../../../assets/room-covers';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import RoomTabBar from '../../../components/rooms/RoomTabBar';
import { useAuth } from '../../../contexts/AuthContext';
import { cacheFeedPost } from '../../../lib/feed-detail-cache';
import { feedDayLabel, feedPagePosts, roomFeedPostToCardPost, startsNewFeedDay } from '../../../lib/feed-post';
import { challengeTimeLeft } from '../../../lib/rooms-home';
import { formatarTempoDeEstudo } from '../../../lib/study-time';
import { getLiveMembers, type LiveMember } from '../../../services/leagues';
import { getMyRooms, getRoomFeed, type RoomSummary } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';
import FolhaDeDenuncia from '../../../components/moderation/FolhaDeDenuncia';
import { voltar } from '../../../lib/navegacao';

/** Altura da barra da sala (`RoomTabBar`), para o FAB pousar 16pt acima dela. */
const ROOM_TAB_BAR_HEIGHT = 66;

export default function RoomFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const { user } = useAuth();
  const { c } = useTheme();
  const { width: larguraDaJanela } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [posts, setPosts] = useState<FirebaseFeedPost[]>([]);
  const [live, setLive] = useState<LiveMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * O post que a pessoa segurou, ou `null`.
   *
   * Guarda o post inteiro e não só o id: a folha precisa do autor para
   * oferecer o bloqueio, e buscar de novo o que já está na mão seria uma ida à
   * rede para responder o que a lista já sabe.
   */
  const [denunciando, setDenunciando] = useState<(typeof posts)[number] | null>(null);
  // Falha de carregamento. Só vira tela de erro quando ainda não há sala em
  // mão: uma atualização de fundo que falha não pode apagar o feed que já está
  // desenhado.
  const [failed, setFailed] = useState(false);
  /**
   * A sala carregou, mas o **feed** não. Estado separado de propósito
   * (`DESIGN-GYMRATS §4.4`): antes, sala e feed dividiam um `catch` sem corpo,
   * então feed vazio e feed quebrado desenhavam exatamente a mesma tela — o
   * coelho lendo e "ninguém postou ainda". Foi assim que um `TypeError` de
   * contrato (`page.items` era `undefined`, porque o servidor manda `posts`)
   * passou semanas invisível: o app *dizia* que não havia nada.
   */
  const [feedFailed, setFeedFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setFailed(true);
      return;
    }

    // Duas etapas com dois `catch`, e não um só: o feed pode falhar sem que a
    // sala tenha falhado, e cada falha tem a sua tela.
    try {
      const rooms = await getMyRooms();
      const current = rooms.find((candidate) => candidate.id === id) ?? null;
      setRoom(current);
      if (!current) {
        setFailed(true);
        return;
      }
      setFailed(false);
    } catch (error) {
      // Nunca mais em silêncio. Um `catch` mudo aqui é o que escondeu a quebra
      // de contrato do feed; o log é o mínimo que separa "não tem nada" de
      // "quebrou".
      console.warn('[sala] não deu para carregar a sala', id, error);
      setFailed(true);
      return;
    }

    try {
      const [page, liveMembers] = await Promise.all([getRoomFeed(id), getLiveMembers()]);
      // `feedPagePosts` e não `page.items`: o envelope real é `posts`, e as duas
      // rotas de feed do servidor divergem entre si. Ver `services/rooms.ts`.
      setPosts(feedPagePosts(page).map((post) => roomFeedPostToCardPost(post, id, user?.uid ?? '')));
      setLive(liveMembers.filter((member) => member.league_id === id));
      setFeedFailed(false);
    } catch (error) {
      console.warn('[sala] não deu para carregar o feed', id, error);
      // Os posts já desenhados ficam. Uma atualização de fundo que falha não
      // apaga o feed — só acende o aviso quando não há o que mostrar.
      setFeedFailed(true);
    }
  }, [id, user?.uid]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load().finally(() => active && setLoading(false));
    const interval = setInterval(() => void load(), 30_000);
    return () => { active = false; clearInterval(interval); };
  }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    setFailed(false);
    setFeedFailed(false);
    void load().finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  // §4.4: a sala que não carrega mostra o coelho e um caminho de volta. Antes
  // esta linha era `return null` — tela em branco sem explicação nem saída.
  if (!room) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.backRow}>
          <Press onPress={() => voltar()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
        </View>
        <View style={styles.center}>
          <Mascot state="worried" size={96} animate={false} />
          <Text style={styles.stateBody}>{t('rooms.roomUnavailable')}</Text>
          <Press onPress={retry} style={styles.stateAction}>
            <Text style={styles.link}>{t('rooms.tryAgain')}</Text>
          </Press>
        </View>
      </SafeAreaView>
    );
  }

  const challenge = room.active_challenge;
  // Largura de dentro do card: a lista recua 16 de cada lado e o card tem 1pt
  // de borda de cada lado.
  const alturaDaCapa = roomCoverHeight(larguraDaJanela - space.lg * 2 - 2);
  const timeLeft = challenge ? challengeTimeLeft(challenge.ends_at, challenge.server_time) : null;

  // Capa e faixa de três colunas são UM card só — na referência não há costura
  // entre os dois. Daí a borda e o raio viverem no contêiner, e não em cada
  // peça: `overflow: 'hidden'` recorta a foto nos cantos de cima e a faixa
  // fecha os de baixo.
  const hero = challenge ? (
    <Press onPress={() => router.push({ pathname: '/league/challenge/[id]', params: { id: challenge.id, roomId: room.id } })} style={styles.hero}>
      <Image
        source={room.cover_url ? { uri: room.cover_url } : roomCoverForId(room.id)}
        style={[styles.cover, { height: alturaDaCapa }]}
        resizeMode="cover"
      />

      <View style={styles.statsStrip}>
        <View style={styles.statColumn}>
          <Avatar uri={challenge.leader?.avatar_url ?? null} name={challenge.leader?.display_name ?? ''} size={28} />
          <View><Text style={styles.statValue}>{challenge.leader?.metric_value ?? 0}</Text><Text style={styles.statLabel}>{t('rooms.leader')}</Text></View>
        </View>
        <View style={styles.statColumn}>
          <Avatar uri={null} name={t('rooms.you')} size={28} />
          <View><Text style={styles.statValue}>{challenge.me.metric_value}</Text><Text style={styles.statLabel}>{t('rooms.you')}</Text></View>
        </View>
        <View style={styles.statColumn}>
          <CalendarDays size={22} color={c.fgMuted} />
          <View><Text style={styles.statValue}>{timeLeft?.days ?? 0}</Text><Text style={styles.statLabel}>{t('rooms.daysLeftLabel')}</Text></View>
        </View>
      </View>
    </Press>
  ) : (
    <Press onPress={() => router.push(`/league/challenge/new?roomId=${room.id}`)} style={styles.noChallenge}>
      <Text style={styles.overline}>{t('rooms.noChallenge')}</Text>
      <Text style={styles.link}>{t('rooms.createChallenge')}</Text>
    </Press>
  );

  /**
   * Quem está com o timer ligado aparece aqui, em **qualquer** sala.
   *
   * Isto já foi atrás de `studyMode`, e o modo caiu em 04/08/2026 por decisão do
   * dono do produto: não existe sala de foto e sala de timer. Existe uma sala,
   * com duas portas — postar a foto, ou ligar o timer —, e quem liga o timer
   * aparece estudando para o grupo. É o focus mode, e continua sendo a única
   * coisa que mudamos de propósito em relação ao GymRats.
   *
   * **Ligar o timer não acontece aqui.** O botão morava logo abaixo desta faixa
   * e saiu no mesmo dia: a porta é a aba Estudar (`(tabs)/study.tsx`), que já
   * tinha o botão e é onde se escolhe matéria e duração. A sala mostra o
   * resultado — quem está estudando agora, e o post quando encerra —, não o
   * controle.
   */
  const liveStrip = live.length > 0 ? (
    <View style={styles.liveStrip}>
      <Text style={styles.overline}>{t('rooms.studyingNow')}</Text>
      {live.map((member) => (
        <View key={member.session_id} style={styles.livePerson}>
          <Avatar uri={member.avatar_url} name={member.display_name} size={36} />
          <View style={{ flex: 1 }}><Text style={styles.liveName}>{member.display_name}</Text><Text style={styles.liveMeta}>{member.subject_name} · {t('rooms.timeNow', { time: formatarTempoDeEstudo(member.elapsed_minutes) })}</Text></View>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* O lápis aparece **só para o dono**. Mostrá-lo a todo mundo e recusar
          no toque seria pior que escondê-lo: prometeria uma ação que não
          existe. A API confere a posse de novo — esta linha é conveniência, não
          segurança. */}
      <View style={styles.backRow}>
        <Press onPress={() => voltar()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
        {room.my_membership?.role === 'owner' ? (
          <Press
            onPress={() => router.push({
              // `as any` na rota: o typegen do expo-router só conhece arquivos
              // que já existiam quando rodou, e este é novo. Some no próximo
              // `expo start`.
              pathname: '/league/room/edit/[id]' as any,
              params: {
                id: room.id,
                name: room.name,
                description: room.description ?? '',
                cover: room.cover_url ?? '',
              },
            })}
            style={styles.back}
          >
            <Pencil size={19} color={c.fg} />
          </Press>
        ) : null}
      </View>
      <FolhaDeDenuncia
        visivel={denunciando !== null}
        alvo="post"
        alvoId={denunciando?.id ?? ''}
        autorId={denunciando?.user_id}
        autorNome={denunciando?.username}
        aoFechar={() => setDenunciando(null)}
        // Recarrega: quem bloqueou não deve continuar vendo o post na tela que
        // acabou de deixar de mostrá-lo no servidor.
        aoConcluir={refresh}
      />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<><Text style={styles.title}>{room.name}</Text>{hero}{liveStrip}</>}
        renderItem={({ item, index }) => (
          <View>
            {startsNewFeedDay(posts, index) ? <Text style={styles.day}>{feedDayLabel(item.created_at, i18n.language)}</Text> : null}
            {/* ~~"A moldura da linha mora aqui, não no `FeedRow`"~~ — era o
                plano, e ficou pela metade: a moldura entrou aqui e não saiu de
                lá, então cada linha vinha com duas. Quem desenha o card é o
                `FeedRow`; aqui fica só o respiro entre um e outro. */}
            <View style={styles.postCard}>
              <FeedRow
                post={item}
                locale={i18n.language}
                onPress={() => { cacheFeedPost(item); router.push(`/league/feed/post/${item.id}`); }}
                // Não sobre o próprio check-in: oferecer "denunciar" para si
                // mesmo é um menu que nunca leva a nada.
                onLongPress={item.user_id === user?.uid ? undefined : () => setDenunciando(item)}
              />
            </View>
          </View>
        )}
        // Feed vazio e feed quebrado NÃO podem parecer a mesma coisa
        // (`DESIGN-GYMRATS §4.4`). Vazio é o coelho lendo e um texto que diz o
        // que produz conteúdo; erro é o coelho `worried`, o que falhou, e
        // "Tentar novamente". Quando a lista não está vazia nada disto aparece:
        // uma atualização que falhou sobre um feed já desenhado é silenciosa de
        // propósito — o `console.warn` do `load` é quem registra.
        ListEmptyComponent={feedFailed ? (
          <View style={styles.emptyBlock}>
            <Mascot state="worried" size={96} animate={false} />
            <Text style={styles.stateBody}>{t('rooms.feedUnavailable')}</Text>
            <Press onPress={retry} style={styles.stateAction}>
              <Text style={styles.link}>{t('rooms.tryAgain')}</Text>
            </Press>
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Mascot state="reading" size={120} animate={false} />
            {/* Um texto só: sem modo, não há dois vazios diferentes a
                descrever. Ele nomeia as duas portas, que é o que a pessoa
                precisa saber para sair do vazio. */}
            <Text style={styles.emptyTitle}>{t('rooms.feedEmptyTitle')}</Text>
            <Text style={styles.stateBody}>{t('rooms.feedEmptySubtitle')}</Text>
          </View>
        )}
      />
      <Press haptic="medium" onPress={() => router.push({
          pathname: '/league/post/[id]',
          // O nome vai junto: quem está aqui já sabe qual é a sala, e fazer a
          // próxima tela redescobrir isso por rede é o que a deixava mostrando
          // "Publicando em —" enquanto carregava.
          params: { id: room.id, nome: room.name },
        })} style={styles.fab}><Plus size={26} color={c.fgOnAccent} /></Press>
      <RoomTabBar roomId={room.id} challengeId={challenge?.id} />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, paddingHorizontal: space.lg },
  backRow: { height: 44, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Margem lateral de 16 (`space.lg`) em toda a tela, como a referência. Era
  // 24, e era ela que obrigava a capa a se desfazer do recuo com margem
  // negativa. Com 16 a capa é só um bloco de largura cheia.
  list: { paddingHorizontal: space.lg, paddingBottom: 110, flexGrow: 1 },
  title: { ...text.title2, color: c.fg, marginBottom: space.md },
  hero: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
    marginBottom: 20,
  },
  // A capa é uma FAIXA, não um plano de fundo. O `maxHeight` protege telas
  // largas: em 393pt a proporção 2,5 dá 144pt, então o teto de 150 só age de um
  // iPad em diante — a 170 ele nunca agia.
  // Sem `aspectRatio` e sem `maxHeight` de propósito: a altura vem de
  // `alturaDeCapa`, e o porquê está lá. Repor qualquer um dos dois traz de
  // volta o card de 871pt.
  cover: {
    width: '100%',
    backgroundColor: c.skeleton,
  },
  // 56 = 14 de respiro + 28 de conteúdo + 14. `space-evenly` é o que reproduz a
  // posição dos três grupos na referência; `center` por terço e `space-between`
  // erram por mais de 20pt.
  statsStrip: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  statColumn: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statValue: { ...text.bodyStrong, color: c.fg },
  statLabel: { ...text.caption, color: c.fgMuted },
  noChallenge: { padding: space.lg, backgroundColor: c.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, marginBottom: 20 },
  overline: { ...text.overline, color: c.fgMuted },
  /** Link de ação — um dos três lugares onde o accent tem permissão de aparecer. */
  link: { ...text.bodyStrong, color: c.accent, marginTop: 3 },
  liveStrip: { padding: space.lg, backgroundColor: c.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, gap: space.md, marginBottom: space.md },
  livePerson: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  liveName: { ...text.bodyStrong, color: c.fg },
  liveMeta: { ...text.caption, color: c.fgMuted },
  // 12 + 17 de linha + 12 = 41pt (REF 37,7). Minúsculas, não caixa alta: a
  // referência repete este separador 3–5 vezes por tela e escolheu não pesar.
  day: { ...text.caption, color: c.fgMuted, textAlign: 'center', paddingVertical: space.md },
  // **Só espaçamento.** Este bloco já teve `surface`, `radius.sm`, borda de 1px
  // e o par `paddingLeft: sm` / `paddingRight: lg` — exatamente os mesmos
  // valores que `FeedRow.row` já aplica. O resultado eram duas molduras
  // idênticas, uma dentro da outra, e o padding horizontal cobrado duas vezes:
  // a linha aparecia com 382pt de largura dentro de um card de 408.
  //
  // Quem fica com a moldura é o `FeedRow`, e não por acaso: a dele está medida
  // contra a referência (72pt externos com borda de 1px dão os 69,9pt internos
  // do GymRats). Recriá-la aqui por fora empurrava o card real para 74pt e
  // afinava a linha.
  //
  // O respiro de 12pt entre linhas continua aqui, que é o lugar certo — o
  // `FeedRow` não conhece o vizinho, como o comentário dele mesmo diz.
  postCard: { marginBottom: space.md },
  emptyBlock: { alignItems: 'center', paddingTop: space.xxl },
  emptyTitle: { ...text.title2, color: c.fg, textAlign: 'center', marginTop: space.lg },
  stateBody: { ...text.body, color: c.fgMuted, textAlign: 'center', marginTop: space.sm },
  stateAction: { minHeight: 44, justifyContent: 'center' },
  fab: { position: 'absolute', right: space.lg, bottom: ROOM_TAB_BAR_HEIGHT + space.lg, width: 56, height: 56, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});
