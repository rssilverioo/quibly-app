import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { comprimirImagem } from '../../lib/comprimir-imagem';
import * as ImagePicker from 'expo-image-picker';

import PostCard, { type FirebaseFeedPost } from '../../components/feed/PostCard';
import LevelUpAnimation from '../../components/LevelUpAnimation';
import Press from '../../components/ui/Press';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionStore } from '../../stores/session.store';
import { api } from '../../lib/api';
import { feedPagePosts, roomFeedPostToCardPost } from '../../lib/feed-post';
import {
  collectSessionCopies,
  copyChipLabel,
  pickPrimaryCopy,
  type PublishedCopy,
} from '../../lib/published-post';
import { anexarFotoAoPost, getMyRooms, getRoomFeed } from '../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../theme';

/**
 * A tela pós-timer — `FLUXO §7`, `MARCA §3.4`, `DESIGN-GYMRATS §5.10`.
 *
 * **Quando esta tela abre, o post já existe.** Encerrar a sessão é que cria o
 * post (`DIRECAO-PRODUTO §3`); esta tela não publica nada. Daí o princípio que
 * governa tudo o que está aqui:
 *
 * > **O card não muda de forma quando você adiciona legenda ou foto.**
 *
 * O card em si é `<PostCard editable />`, e ele já cumpre a parte dele. O que
 * este arquivo entrega é a **moldura**, e é ali que a tela vive ou morre. Como
 * cada proibição da `§3.4` está resolvida, uma por uma:
 *
 * - **Nenhum verbo no futuro ou imperativo.** O cabeçalho afirma no passado —
 *   "Publicado em Sala X · agora". Não existe "Publicar", "Concluir" nem
 *   "Finalizar" em lugar nenhum desta tela nem nas chaves que ela usa.
 * - **Nenhum "Pular" / "Agora não".** Não há etapa a pular. A única saída além
 *   de "Ver no feed" é um `×` sem rótulo no canto, que é dispensar uma tela
 *   cujo trabalho já acabou — não recusar um passo.
 * - **Nenhuma barra fixa no rodapé.** Tudo mora dentro de um `ScrollView`:
 *   "Ver no feed" rola junto com o conteúdo, 24pt abaixo do card (`§5.10`).
 *   Nada é `position: absolute` no rodapé.
 * - **Sem foco automático no teclado.** Nenhum `autoFocus` e nenhum `focus()`
 *   imperativo — nem aqui nem no `PostCard`. O teclado só sobe se a pessoa
 *   tocar na legenda.
 * - **Card idêntico ao do feed, sem estado "fresco".** O `PostCard` é montado
 *   com a variante padrão, dentro de nenhuma moldura: sem glow, sem borda de
 *   destaque, sem `entering`. A comemoração mora na moldura — o cabeçalho e o
 *   `LevelUpAnimation`, que toca **por cima** do card e termina nele.
 * - **Sem rodapé social.** `PostSocialFooter` não é importado. Num post de dois
 *   segundos as contagens são sempre zero.
 * - **Sem contador de caracteres e sem "(opcional)".** Nenhuma das duas coisas
 *   existe aqui, e a palavra "opcional" não aparece em nenhuma chave desta tela.
 *
 * ## O que o backend ainda não tem — e como esta tela se comporta enquanto isso
 *
 * Probado contra `https://api.tryquibly.com` em 02/08 (401 = a rota existe e
 * pede auth; 404 = a rota não existe), e conferido contra os controllers:
 *
 * | O que falta | Estado |
 * |---|---|
 * | `POST /sessions/:id/end` devolver o post criado | não devolve — ver `lib/published-post.ts` |
 * | `PATCH /feed/:postId` (legenda) | 404 |
 * | `DELETE /feed/:postId` | **existe desde 09/08** |
 * | anexar foto a um post existente | **existe desde 09/08** (`POST /feed/:postId/photo`) |
 *
 * As duas primeiras estão ligadas na forma que o contrato terá quando existir,
 * e falham hoje numa linha discreta em `c.danger` — sem alerta, sem perder o
 * que a pessoa escreveu (`§5.10`, estado "erro ao apagar").
 *
 * O `onAddPhoto` ficou **ausente** por meses pelo motivo certo: o `PostCard`
 * documenta que "ausente = a linha não aparece — a ação só existe quando há
 * quem a atenda", e não havia rota. Agora há, e a linha aparece.
 *
 * O mesmo raciocínio tinha sido aplicado errado ao "Apagar post": ele **era**
 * oferecido sem rota, e falhava em 404 dizendo "não deu para apagar" — que a
 * pessoa lê como culpa dela ou da rede. A ausência do "+ foto" era a decisão
 * correta; a presença do "apagar" era a incoerente.
 */
export default function SessionPublishedScreen() {
  const router = useRouter();
  const { t } = useTranslation('session');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { profile, refreshProfile } = useAuth();
  const resetSession = useSessionStore((s) => s.reset);

  const params = useLocalSearchParams<{
    sessionId?: string;
    minutes?: string;
    xp?: string;
    subjectName?: string;
    subjectColor?: string;
    newLevel?: string;
  }>();

  const sessionId = params.sessionId ?? '';
  const minutes = Number(params.minutes ?? 0);
  const xp = Number(params.xp ?? 0);
  const newLevel = params.newLevel ? Number(params.newLevel) : null;

  const [loading, setLoading] = useState(true);
  const [copies, setCopies] = useState<PublishedCopy[]>([]);
  /** Havia salas, mas nenhuma delas tem o post — o fan-out não chegou. */
  const [roomCount, setRoomCount] = useState<number | null>(null);
  const [captionFailed, setCaptionFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  /**
   * A comemoração toca por cima do card e termina nele (`FLUXO §7.9`). Antes
   * ela chamava `goHome()` de `active.tsx` e **enterrava o post**.
   */
  const [celebrating, setCelebrating] = useState(newLevel !== null);

  // A sessão acabou: o store local não guarda mais nada de vivo, e o perfil
  // (nível, XP) mudou no servidor. As duas coisas moravam no `goHome()` de
  // `active.tsx`, que era quem terminava o fluxo antes desta tela existir.
  useEffect(() => {
    resetSession();
    void refreshProfile();
  }, [resetSession, refreshProfile]);

  /**
   * Procura o post nas salas. É um `GET /rooms` mais um `GET /rooms/:id/feed`
   * por sala, em paralelo, e uma sala que falha não derruba as outras.
   *
   * Isto é literalmente o "spinner procurando no feed o post que acabou de
   * criar" que `FLUXO §7` previu como consequência do `end` não devolver o
   * post. Some inteiro no dia em que a resposta do `end` trouxer `{ post_ids,
   * room_ids }` — ver `lib/published-post.ts`.
   */
  const load = useCallback(async () => {
    if (!sessionId) { setLoading(false); return; }
    setLoading(true);
    try {
      const rooms = await getMyRooms();
      setRoomCount(rooms.length);
      if (rooms.length === 0) { setLoading(false); return; }

      // `feedPagePosts` e não `page.items`: o envelope real de
      // `GET /rooms/:id/feed` é `posts` (ver `services/rooms.ts`). Enquanto
      // isto lia `.items`, cada feed virava `undefined`, `collectSessionCopies`
      // não achava cópia nenhuma e esta tela dizia "ainda não apareceu no feed"
      // sobre um post que existia.
      const feeds = await Promise.all(
        rooms.map((room) => getRoomFeed(room.id)
          .then((page) => feedPagePosts(page))
          .catch((error) => {
            // `null` = esta sala falhou, e `collectSessionCopies` sabe pular
            // uma sala sem derrubar as outras. Mas falhar em silêncio foi o que
            // escondeu a quebra de contrato — então fica registrado.
            console.warn('[publicado] não deu para ler o feed da sala', room.id, error);
            return null;
          })),
      );
      setCopies(collectSessionCopies(rooms, feeds, sessionId));
    } catch (error) {
      console.warn('[publicado] não deu para listar as salas', error);
      setRoomCount(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  const primary = pickPrimaryCopy(copies);

  /**
   * Legenda e foto editam **todas** as cópias (`FLUXO §7.1`): é uma sessão
   * replicada, não N posts independentes.
   *
   * O texto escrito não sai da tela quando o servidor recusa — mesma regra do
   * timer que não some quando o `end` falha (`active.tsx`). Reverter apagaria o
   * que a pessoa acabou de digitar, que é o único lugar onde aquele texto
   * existe.
   */
  const onCaptionChange = useCallback(async (caption: string) => {
    setCaptionFailed(false);
    setCopies((current) => current.map((copy) => ({
      ...copy,
      post: { ...copy.post, caption },
    })));
    try {
      await Promise.all(copies.map((copy) => api.patch(`/feed/${copy.post.id}`, { caption })));
    } catch {
      setCaptionFailed(true);
    }
  }, [copies]);

  /**
   * Um gesto apaga em todas as salas (`FLUXO §7.1`): é uma sessão e um
   * arrependimento só. Sem diálogo de confirmação — a linha já é discreta o
   * bastante, e um `Alert` aqui teria o mesmo defeito do "Cancelar" que saiu do
   * "Encerrar".
   */
  const onDelete = useCallback(async () => {
    setDeleteFailed(false);
    try {
      await Promise.all(copies.map((copy) => api.delete(`/feed/${copy.post.id}`)));
      router.replace('/');
    } catch {
      setDeleteFailed(true);
    }
  }, [copies, router]);

  /**
   * Anexar a foto depois de publicado.
   *
   * A câmera vem **primeiro** na folha de escolha: o post de sessão nasce logo
   * depois de estudar, e a foto que interessa é a do caderno que ainda está
   * aberto na mesa — não uma da galeria.
   *
   * O upload é de um post só. O servidor aplica nas irmãs da mesma sessão, o
   * que evita pagar N envios pelo mesmo arquivo e impede o estado que ninguém
   * sabe explicar: a mesma sessão com foto numa sala e sem foto na outra.
   */
  const escolherFoto = useCallback(async () => {
    if (!primary) return;
    Alert.alert('', t('published.addPhoto'), [
      { text: t('published.takePhoto'), onPress: () => void anexar('camera') },
      { text: t('published.chooseFromLibrary'), onPress: () => void anexar('galeria') },
      { text: t('common:cancel'), style: 'cancel' },
    ]);
  }, [primary, t]);

  const anexar = useCallback(async (origem: 'camera' | 'galeria') => {
    if (!primary) return;
    const permissao = origem === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return;

    const escolha = origem === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.82 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 });
    if (escolha.canceled || !escolha.assets[0]) return;

    const asset = escolha.assets[0];
    // Mesma redução do check-in: é a mesma foto, pelo outro caminho.
    const uri = await comprimirImagem(asset.uri, 'checkin');
    setPhotoFailed(false);
    try {
      const { photo_url } = await anexarFotoAoPost(primary.post.id, {
        uri,
        name: asset.fileName ?? 'foto.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      // Todas as cópias, porque o servidor atualizou todas. Espelhar só a
      // principal deixaria a tela discordando do banco.
      setCopies((current) => current.map((copy) => ({
        ...copy,
        post: { ...copy.post, photo_url, proof_photo_url: photo_url, show_proof_photo: true },
      })));
    } catch {
      setPhotoFailed(true);
    }
  }, [primary]);

  /** O `×` do chip: sai de uma sala e fica nas outras (`FLUXO §7.1`). */
  const onRemoveFromRoom = useCallback(async (copy: PublishedCopy) => {
    setDeleteFailed(false);
    try {
      await api.delete(`/feed/${copy.post.id}`);
      setCopies((current) => current.filter((item) => item.roomId !== copy.roomId));
    } catch {
      setDeleteFailed(true);
    }
  }, []);

  const openFeed = () => {
    if (primary) router.replace(`/league/room/${primary.roomId}`);
  };

  const close = () => router.replace('/');

  // ---- O cabeçalho, sempre no passado ----------------------------------
  const heading = loading
    ? ''
    : roomCount === 0
      ? t('published.noRooms')
      : copies.length === 1
        ? t('published.inRoom', { room: copies[0].roomName })
        : copies.length > 1
          ? t('published.inRooms', { count: copies.length })
          : '';

  /**
   * Zero salas: nenhum `FeedPost` foi criado (não há membership para o fan-out
   * replicar). O card continua, porque **a sessão foi real** (`§5.10`) — mas é
   * montado aqui, do dado local, e por isso não é editável: não há post a que
   * uma legenda pudesse pertencer.
   */
  const localCard: FirebaseFeedPost | null = roomCount === 0 ? {
    id: `session:${sessionId}`,
    kind: 'session',
    league_id: '',
    user_id: profile?.id ?? '',
    username: profile?.username ?? '',
    avatar_url: profile?.avatar_url ?? null,
    session_id: sessionId,
    subject_id: '',
    subject_name: params.subjectName ?? '',
    subject_color: params.subjectColor ?? '',
    show_proof_photo: false,
    proof_photo_url: null,
    total_duration_minutes: minutes,
    points_earned: xp,
    is_verified: false,
    reactions: {},
    comment_count: 0,
    created_at: new Date().toISOString(),
    caption: null,
  } : null;

  const cardPost = primary
    ? roomFeedPostToCardPost(primary.post, primary.roomId, profile?.id ?? '')
    : localCard;

  /** Nem carregando, nem sem sala, e mesmo assim sem post: o fan-out falhou. */
  const missing = !loading && roomCount !== 0 && copies.length === 0;

  const summary = params.subjectName
    ? t('published.summaryWithSubject', { minutes, xp, subject: params.subjectName })
    : t('published.summary', { minutes, xp });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Sem título e sem verbo: só a saída. Um rótulo visível aqui seria o
          único lugar da tela falando de um ato ainda por fazer.

          O rótulo acessível mora no `View` porque `Press` não expõe
          `accessibilityLabel` e `components/**` está fora deste escopo. Com
          `accessible` o leitor de tela lê o conjunto como um botão só. */}
      <View style={styles.topBar}>
        <View accessible accessibilityRole="button" accessibilityLabel={t('published.close')}>
          <Press haptic={false} onPress={close} style={styles.close}>
            <X size={22} color={c.fgMuted} />
          </Press>
        </View>
      </View>

      {/*
        `keyboardShouldPersistTaps="handled"`: tocar fora do campo tira o foco e
        confirma a legenda, em vez de exigir um botão para isso.

        `automaticallyAdjustKeyboardInsets` no lugar de um `KeyboardAvoidingView`:
        ele acrescenta inset ao rolar em vez de espremer o layout, então o card
        não muda de altura quando o teclado sobe. O teclado só sobe por toque —
        não há `autoFocus` em lugar nenhum deste caminho.
      */}
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Bloco 1 — 24pt de altura reservados mesmo vazio, para o card não
            saltar quando o cabeçalho chega. */}
        <View style={[styles.headingRow, copies.length > 1 && styles.headingTight]}>
          <Text style={styles.heading} numberOfLines={1}>{heading}</Text>
        </View>

        {/* Bloco 2 — só com N salas. Informa onde o post caiu **depois** de ele
            já ter caído; em nenhum momento a tela oferece escolher salas. */}
        {copies.length > 1 ? (
          <View style={styles.chipsRow}>
            {copies.map((copy) => (
              <View key={copy.roomId} style={styles.chip}>
                <Press
                  haptic={false}
                  style={styles.chipLabel}
                  onPress={() => router.replace(`/league/room/${copy.roomId}`)}
                >
                  <Text style={styles.chipText} numberOfLines={1}>{copyChipLabel(copy)}</Text>
                </Press>
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('published.removeFromRoom', { room: copy.roomName })}
                >
                  <Press
                    haptic="light"
                    onPress={() => void onRemoveFromRoom(copy)}
                    style={styles.chipRemove}
                  >
                    <X size={14} color={c.fgMuted} />
                  </Press>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Bloco 3 — o card. Nenhuma moldura em volta: nada aqui pode
            reintroduzir salto no toque da legenda. */}
        {missing ? (
          /* O `end` não devolveu post e o feed não tem nenhum com esta sessão.
             Não se monta card fantasma (`§5.10`): mostra-se o que é verdade —
             o resumo da sessão — e uma linha para tentar de novo. */
          <View style={styles.missingBlock}>
            <Text style={styles.summary}>{summary}</Text>
            <Press haptic="light" onPress={() => void load()} style={styles.missingAction}>
              <Text style={styles.link}>{t('published.notInFeedRetry')}</Text>
            </Press>
          </View>
        ) : (
          <PostCard
            post={cardPost ?? undefined}
            loading={loading}
            editable={Boolean(primary)}
            // Só quando há post de verdade a que a legenda possa pertencer.
            onCaptionChange={primary ? onCaptionChange : undefined}
            // A foto vale para todas as cópias, como a legenda: é uma sessão
            // replicada, não N posts independentes. Quem espalha é o servidor,
            // por `sessionId` — ver `FeedService.attachPhoto`.
            onAddPhoto={primary ? () => void escolherFoto() : undefined}
          />
        )}

        {captionFailed ? <Text style={styles.error}>{t('published.captionFailed')}</Text> : null}
        {photoFailed ? <Text style={styles.error}>{t('published.addPhotoFailed')}</Text> : null}

        {/* Bloco 4 — não é barra fixa: rola com o conteúdo, 24pt abaixo do
            card. Só existe quando há feed para onde ir. */}
        {primary ? (
          <Press haptic="medium" scale={0.98} onPress={openFeed} style={styles.viewInFeed}>
            <Text style={styles.viewInFeedText}>{t('published.viewInFeed')}</Text>
          </Press>
        ) : null}

        {/* Zero salas: uma ação, e ela não é sobre o post — é sobre não ter
            grupo. O post não existe para ser visto por ninguém ainda. */}
        {roomCount === 0 ? (
          <Press haptic="light" onPress={() => router.replace('/')} style={styles.noRoomsAction}>
            <Text style={styles.link}>{t('published.noRoomsAction')}</Text>
          </Press>
        ) : null}

        {/* Bloco 5 — a válvula de escape. Destrutiva, discreta, e um `DELETE`;
            nunca um "publicar" invertido. */}
        {primary ? (
          <Press haptic="light" onPress={() => void onDelete()} style={styles.delete}>
            <Text style={styles.deleteText}>{t('published.deletePost')}</Text>
          </Press>
        ) : null}

        {deleteFailed ? <Text style={styles.error}>{t('published.deleteFailed')}</Text> : null}
      </ScrollView>

      {/* A comemoração mora na moldura, nunca no card: ela cobre a tela e
          termina nela, revelando o post por baixo. */}
      {celebrating && newLevel !== null ? (
        <View style={StyleSheet.absoluteFill}>
          <LevelUpAnimation newLevel={newLevel} onComplete={() => setCelebrating(false)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  topBar: { height: 56, justifyContent: 'center', paddingHorizontal: space.sm },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // 16 de padding, como a tela de detalhe do post: é o que dá à foto da prova
  // a largura medida na referência.
  body: { paddingHorizontal: space.lg, paddingBottom: space.xxl, flexGrow: 1 },

  // Bloco 1: 24 de altura, 16 de respiro (`§5.10` pede 4, mas os 4 são o
  // acoplamento do cabeçalho aos chips — sem eles o card precisa do respiro
  // padrão).
  headingRow: { height: 24, justifyContent: 'center', marginBottom: space.lg },
  headingTight: { marginBottom: space.xs },
  heading: { ...text.label, color: c.fgMuted },

  // Bloco 2: chips de 34, respiro 16.
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  chip: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    maxWidth: '100%',
  },
  chipLabel: { flexShrink: 1 },
  chipText: { ...text.caption, color: c.fg },
  chipRemove: { width: 20, height: 34, alignItems: 'center', justifyContent: 'center' },

  // Bloco 4: 54 de altura, respiro 12. Dentro do `ScrollView`, sempre.
  viewInFeed: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
    marginBottom: space.md,
  },
  viewInFeedText: { ...text.bodyStrong, color: c.fgOnAccent },

  // Bloco 5.
  delete: { height: 44, alignItems: 'center', justifyContent: 'center' },
  deleteText: { ...text.label, color: c.danger },

  missingBlock: { gap: space.sm, paddingVertical: space.lg },
  summary: { ...text.body, color: c.fg },
  missingAction: { minHeight: 44, justifyContent: 'center' },
  noRoomsAction: { minHeight: 44, justifyContent: 'center', marginTop: space.xl },
  link: { ...text.body, color: c.accent },

  // Sem alerta: o erro é uma linha, e o que a pessoa escreveu continua na tela.
  error: { ...text.caption, color: c.danger, marginTop: space.sm },
});
