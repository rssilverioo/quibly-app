import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
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
    if (normalized) router.push(`/league/join/${encodeURIComponent(normalized)}`);
  };

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
         * O `+` no título e o campo de código no rodapé existem porque, sem
         * eles, **a primeira sala fechava a porta**: criar e entrar por
         * convite só apareciam no estado vazio, e a partir da sala número 1
         * nenhuma rota levava a `/league/create` ou a `/league/join`. Não era
         * limite de plano — na API todo entitlement nasce em `Infinity`. Era
         * a tela.
         *
         * O spec (`DESIGN-GYMRATS §5.11`) descreve a lista e os três estados e
         * não prevê nenhum dos dois aqui, então o buraco nasce antes do
         * código. §5.11 foi corrigido junto.
         */
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('rooms.listTitle')}</Text>
            <Press
              haptic="medium"
              onPress={() => router.push('/league/create')}
              style={styles.titleAction}
              accessibilityLabel={t('rooms.create')}
            >
              <Plus size={22} color={c.fgOnAccent} />
            </Press>
          </View>
        }
        ListFooterComponent={
          <View style={[styles.joinRow, styles.joinRowInList]}>
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
  // Na lista o campo vem depois das salas, e precisa de mais respiro que no
  // estado vazio: ali ele segue um botão, aqui ele segue um card.
  joinRowInList: { marginTop: space.lg },
  input: { flex: 1, height: 50, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: space.lg, color: c.fg, backgroundColor: c.surface, ...text.body },
  joinButton: { height: 50, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  joinText: { ...text.label, color: c.fg },
});
