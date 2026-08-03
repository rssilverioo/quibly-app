import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, KeyRound, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { roomCoverThumbForId, ROOM_ROW_THUMB } from '../../assets/room-covers';
import { MascotBlock } from '../../components/mascot';
import Press from '../../components/ui/Press';
import { challengeTimeLeft } from '../../lib/rooms-home';
import { getMyRooms, type RoomSummary } from '../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { useTabBarClearance } from './_layout';

export default function RoomsScreen() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tabClearance = useTabBarClearance();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [code, setCode] = useState('');
  /** Fechada, escolhendo entre as duas ações, ou digitando o código. */
  const [sheet, setSheet] = useState<'closed' | 'choose' | 'code'>('closed');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRooms(await getMyRooms());
    setFailed(false);
  }, []);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void load().catch(() => alive && setFailed(true)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [load]));

  const retry = () => {
    setLoading(true);
    void load().catch(() => setFailed(true)).finally(() => setLoading(false));
  };
  const refresh = async () => {
    setRefreshing(true);
    await load().catch(() => setFailed(true));
    setRefreshing(false);
  };
  const join = () => {
    const normalized = code.trim();
    if (!normalized) return;
    setSheet('closed');
    router.push(`/league/join/${encodeURIComponent(normalized)}`);
  };

  /**
   * A folha do `+`: criar uma sala, ou entrar numa que já existe.
   *
   * Fica em dois passos em vez de mostrar o campo de código de cara porque as
   * duas ações não têm o mesmo peso — criar é o caminho comum, entrar por
   * código é o raro, e quem chega com um convite sabe que veio por ele. O
   * fundo escuro fecha ao toque: folha sem saída óbvia é armadilha.
   */
  const addSheet = (
    <Modal
      visible={sheet !== 'closed'}
      transparent
      animationType="slide"
      onRequestClose={() => setSheet('closed')}
    >
      <Press haptic={false} onPress={() => setSheet('closed')} scale={1} style={styles.backdrop}>
        <View />
      </Press>
      <View style={[styles.sheet, { paddingBottom: space.xl + tabClearance / 2 }]}>
        <View style={styles.sheetGrip} />
        <Text style={styles.sheetTitle}>{t('rooms.addTitle')}</Text>

        {sheet === 'choose' ? (
          <>
            <Press
              haptic="medium"
              onPress={() => { setSheet('closed'); router.push('/league/create'); }}
              style={styles.sheetRow}
            >
              <View style={styles.sheetIcon}><Plus size={20} color={c.fgOnAccent} /></View>
              <Text style={styles.sheetLabel}>{t('rooms.create')}</Text>
              <ChevronRight size={18} color={c.fgSubtle} />
            </Press>
            <Press onPress={() => setSheet('code')} style={styles.sheetRow}>
              <View style={[styles.sheetIcon, styles.sheetIconMuted]}><KeyRound size={20} color={c.fg} /></View>
              <Text style={styles.sheetLabel}>{t('rooms.joinWithCode')}</Text>
              <ChevronRight size={18} color={c.fgSubtle} />
            </Press>
          </>
        ) : (
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              onSubmitEditing={join}
              autoCapitalize="characters"
              autoFocus
              placeholder={t('rooms.code')}
              placeholderTextColor={c.fgSubtle}
              style={styles.input}
            />
            <Press onPress={join} style={styles.joinButton}><Text style={styles.joinText}>{t('rooms.join')}</Text></Press>
          </View>
        )}
      </View>
    </Modal>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

  // Um erro de carregamento deixava a lista vazia sem dizer nada — o vazio
  // ("crie a sua primeira sala") mentia sobre o que aconteceu. §4.4.
  if (failed && rooms.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <MascotBlock state="worried" size={96} />
          <Text style={[styles.emptySubtitle, { marginTop: space.lg }]}>{t('rooms.loadFailed')}</Text>
          <Press haptic="light" onPress={retry} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('rooms.tryAgain')}</Text>
          </Press>
        </View>
      </SafeAreaView>
    );
  }

  if (rooms.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <MascotBlock state="wave" size={150} />
          <Text style={styles.emptyTitle}>{t('rooms.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('rooms.emptySubtitle')}</Text>
          <Press haptic="medium" onPress={() => router.push('/league/create')} style={styles.createButton}>
            <Plus size={18} color={c.fgOnAccent} />
            <Text style={styles.createText}>{t('rooms.create')}</Text>
          </Press>
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              onSubmitEditing={join}
              autoCapitalize="characters"
              placeholder={t('rooms.code')}
              placeholderTextColor={c.fgSubtle}
              style={styles.input}
            />
            <Press onPress={join} style={styles.joinButton}><Text style={styles.joinText}>{t('rooms.join')}</Text></Press>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rooms}
        keyExtractor={(room) => room.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.fgMuted} />}
        contentContainerStyle={[styles.list, { paddingBottom: tabClearance }]}
        /**
         * O `+` existe porque, sem ele, **a primeira sala fechava a porta**:
         * criar e entrar por convite só apareciam no estado vazio, e a partir
         * da sala número 1 nenhuma rota levava a `/league/create` ou a
         * `/league/join`. Não era limite de plano — na API todo entitlement
         * nasce em `Infinity`. Era a tela.
         *
         * O spec (`DESIGN-GYMRATS §5.11`) descreve a lista e os três estados e
         * não previa nenhum dos dois aqui, então o buraco nasce antes do
         * código. §5.11 foi corrigido junto.
         *
         * Uma porta só, que pergunta: a lista não carrega campo de código
         * solto no rodapé. Quem tem sala quase nunca vai entrar noutra, e um
         * input permanente para a ação rara rouba a atenção da lista, que é o
         * conteúdo da tela.
         */
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('rooms.listTitle')}</Text>
            <Press
              haptic="medium"
              onPress={() => setSheet('choose')}
              style={styles.titleAction}
              accessibilityLabel={t('rooms.addTitle')}
            >
              <Plus size={22} color={c.fgOnAccent} />
            </Press>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        renderItem={({ item }) => (
          <Press onPress={() => router.push(`/league/room/${item.id}`)} style={styles.roomRow}>
            <Image
              source={item.cover_url ? { uri: item.cover_url } : roomCoverThumbForId(item.id)}
              style={styles.cover}
              resizeMode="cover"
            />
            <View style={styles.roomText}>
              <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.roomMeta} numberOfLines={1}>{subtitleFor(item, t)}</Text>
            </View>
            <ChevronRight size={18} color={c.fgSubtle} />
          </Press>
        )}
      />
      {addSheet}
    </SafeAreaView>
  );
}

/**
 * A sublinha da linha de sala: quantas pessoas e quanto falta.
 *
 * As duas perguntas que fazem alguém entrar numa sala (`DESIGN-GYMRATS §5.11`).
 * A referência nunca tem linha de uma informação só — a nossa tinha, e o vazio
 * embaixo dela era a tela inteira. Sem desafio ativo, sobra só a contagem de
 * gente: é honesto, e é melhor que inventar prazo.
 */
function subtitleFor(room: RoomSummary, t: (key: string, opts: { count: number }) => string): string {
  const people = t('members', { count: room.member_count });
  const challenge = room.active_challenge;
  if (!challenge) return people;
  const left = challengeTimeLeft(challenge.ends_at, challenge.server_time);
  return `${people} · ${t('rooms.daysLeft', { count: left.days })}`;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  list: { paddingHorizontal: space.lg, paddingTop: space.md },
  // 28, não 40: na captura de hoje o título ocupava mais altura que a única
  // linha de conteúdo da tela. A referência abre em ~23pt (§3.2.1).
  // O título mantém o bloco de 38 + 16 do §5.11; a margem saiu dele e foi
  // para a linha, senão o `+` desalinha em 16pt do texto que ele acompanha.
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  title: { ...text.title2, color: c.fg },
  // 44×44 é o alvo mínimo de toque da Apple. O círculo tem 40 e o resto é
  // área invisível: encolher o alvo ao desenho é o erro clássico aqui.
  titleAction: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  // Card, não faixa nua sobre o fundo. A borda de 1px é a mesma linha nos dois
  // modos: no claro ela desenha a aresta, no escuro ela some (§3.2.4).
  roomRow: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.sm,
    paddingRight: space.md,
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  gap: { height: space.md },
  // A banner, not an avatar: 16:9 like the room hero it previews. Square-cropping
  // the cover turned the artwork into a sticker and cut the rabbit off-centre.
  // A borda existe porque a arte é quase branca e sem ela a onda flutua sem
  // aresta sobre o card branco (§3.2.6).
  cover: {
    ...ROOM_ROW_THUMB,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  roomText: { flex: 1, gap: 2 },
  roomName: { ...text.bodyStrong, color: c.fg },
  roomMeta: { ...text.caption, color: c.fgMuted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: 80 },
  emptyTitle: { ...text.title2, color: c.fg, marginBottom: space.sm },
  emptySubtitle: { ...text.body, color: c.fgMuted, textAlign: 'center', lineHeight: 22 },
  createButton: { marginTop: space.xl, height: 54, width: '100%', borderRadius: radius.lg, backgroundColor: c.accent, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  retryButton: { marginTop: space.xl, height: 54, paddingHorizontal: space.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...text.bodyStrong, color: c.accent },
  createText: { ...text.bodyStrong, color: c.fgOnAccent },
  joinRow: { flexDirection: 'row', gap: space.sm, width: '100%', marginTop: space.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: c.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.lg, paddingTop: space.md },
  sheetGrip: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full, backgroundColor: c.border, marginBottom: space.lg },
  sheetTitle: { ...text.bodyStrong, color: c.fgMuted, marginBottom: space.md },
  // 64 de altura dá o mesmo respiro da linha de sala (72) sem competir com ela.
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 64, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: space.md, marginBottom: space.sm },
  sheetIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  sheetIconMuted: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border },
  sheetLabel: { ...text.bodyStrong, color: c.fg, flex: 1 },
  // Na lista o campo vem depois das salas, e precisa de mais respiro que no
  // estado vazio: ali ele segue um botão, aqui ele segue um card.
  input: { flex: 1, height: 50, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: space.lg, color: c.fg, backgroundColor: c.surface, ...text.body },
  joinButton: { height: 50, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  joinText: { ...text.label, color: c.fg },
});
