import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarCheck, CalendarDays, Clock3, LogOut, Share2, Sunrise, Moon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Mascot } from '../../../components/mascot';
import RoomTabBar from '../../../components/rooms/RoomTabBar';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import { ordinal } from '../../../lib/ordinal';
import { challengeTimeLeft } from '../../../lib/rooms-home';
import { leaveLeague } from '../../../services/leagues';
import { getMyRooms, getRoomDetails, type ChallengeDetails, type RoomSummary } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

export default function RoomDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [details, setDetails] = useState<ChallengeDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const rooms = await getMyRooms();
      const current = rooms.find((candidate) => candidate.id === id) ?? null;
      setRoom(current);
      // Sala sem desafio não é erro: é um estado. Os detalhes do desafio só são
      // buscados quando existe um, e a tela se encurta em vez de reprovar.
      setDetails(current?.active_challenge?.id ? await getRoomDetails(current.id) : null);
    } catch {
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  // Leaving lived only on the legacy `league/[id]` screen. That screen is no
  // longer navigated to, so the action moves here rather than becoming
  // unreachable — Details is where GymRats keeps room-level actions too.
  const onLeave = useCallback(() => {
    Alert.alert(t('leagues:detail.leaveConfirmTitle'), t('leagues:detail.leaveConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('leagues:detail.leave'),
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await leaveLeague(id);
            router.replace('/(tabs)');
          } catch (err) {
            Alert.alert(t('common:error'), (err as Error)?.message ?? t('leagues:detail.leaveError'));
          }
        },
      },
    ]);
  }, [id, router, t]);

  const nav = (
    <View style={styles.nav}>
      <Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
    </View>
  );

  if (loading || !room) return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {nav}
      <View style={styles.center}>
        {loading ? <ActivityIndicator color={c.accent} /> : (
          <>
            <Mascot state="worried" size={96} animate={false} />
            <Text style={styles.stateBody}>{t('rooms.detailsUnavailable')}</Text>
            <Press onPress={load} style={styles.stateAction}><Text style={styles.link}>{t('rooms.tryAgain')}</Text></Press>
          </>
        )}
      </View>
    </SafeAreaView>
  );

  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeLeft = details ? challengeTimeLeft(details.challenge.ends_at, details.challenge.server_time) : null;
  const stats = details ? [
    { Icon: CalendarCheck, value: details.group_stats.total_check_ins, label: t('rooms.totalCheckIns') },
    { Icon: CalendarDays, value: details.group_stats.total_days_active, label: t('rooms.totalDaysActive') },
    { Icon: Clock3, value: details.group_stats.average_check_ins_per_day, label: t('rooms.averageCheckIns') },
  ] : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {nav}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{room.name}</Text>

        {details ? (
          <>
            {/* 18pt, largura total — o segundo elemento da tela e o único lugar
                onde o accent ocupa área fora do FAB. REF 18,2. */}
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.max(0, details.challenge.elapsed_fraction * 100))}%` },
                timeLeft?.urgent && styles.progressUrgent,
              ]} />
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{t('rooms.started', { date: date(details.challenge.starts_at) })}</Text>
              <Text style={styles.dateText}>{t('rooms.finishes', { date: date(details.challenge.ends_at) })}</Text>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardPad}>
              <Text style={styles.overline}>{t('rooms.noChallenge')}</Text>
              <Press onPress={() => router.push(`/league/challenge/new?roomId=${room.id}`)} style={styles.stateAction}>
                <Text style={styles.link}>{t('rooms.createChallenge')}</Text>
              </Press>
            </View>
          </View>
        )}

        {details ? (
          <>
            {/* Ícone e código na mesma linha, alinhados à esquerda; o link vem
                na linha de baixo. A referência não centraliza nada fora de
                estado vazio. */}
            <View style={styles.inviteBlock}>
              <View style={styles.inviteRow}>
                <Share2 size={22} color={c.fgMuted} />
                <Text style={styles.inviteCode}>{details.room.invite_code}</Text>
              </View>
              <Press
                onPress={() => Share.share({ message: `https://tryquibly.com/join/${details.room.invite_code}` })}
                style={styles.stateAction}
              >
                <Text style={styles.link}>{t('rooms.invite')}</Text>
              </Press>
            </View>

            <Text style={styles.sectionTitle}>{t('rooms.rankingsTitle')}</Text>
            <View style={styles.card}>
              {details.rankings.map((entry) => {
                const digits = String(entry.rank);
                const suffix = ordinal(entry.rank, i18n.language).slice(digits.length);
                return (
                  <View key={entry.user_id} style={styles.row}>
                    <Avatar uri={entry.avatar_url} name={entry.display_name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{entry.display_name}</Text>
                      <Text style={styles.meta}>{t('rooms.daysActive', { count: entry.active_days })}</Text>
                    </View>
                    <Text style={styles.position}>{digits}<Text style={styles.positionSuffix}>{suffix}</Text></Text>
                    {/* Toda linha leva divisória: a de baixo é a "Ver tudo ›",
                        que também é uma linha do mesmo card. */}
                    <View style={styles.divider} />
                  </View>
                );
              })}
              <Press
                onPress={() => router.push({ pathname: '/league/challenge/[id]', params: { id: details.challenge.id, roomId: room.id } })}
                style={styles.allRow}
              >
                <Text style={styles.link}>{t('rooms.allRankings')} ›</Text>
              </Press>
            </View>

            <Text style={styles.sectionTitle}>{t('rooms.groupStats')}</Text>
            <View style={styles.card}>
              {stats.map(({ Icon, value, label }, index) => (
                <View key={label} style={styles.row}>
                  <Icon size={22} color={c.fgMuted} />
                  {/* Valor ACIMA do rótulo, 16 sobre 12 — não 28 ao lado de 16.
                      §2.2: não existe número grande em tela de sala. */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.meta}>{label}</Text>
                  </View>
                  {index < stats.length - 1 ? <View style={styles.dividerFull} /> : null}
                </View>
              ))}
            </View>

            {details.group_stats.early_bird || details.group_stats.night_owl ? (
              <View style={[styles.card, styles.cardSpaced]}>
                {details.group_stats.early_bird ? (
                  <Superlative
                    Icon={Sunrise}
                    data={details.group_stats.early_bird}
                    label={t('rooms.earlyBird')}
                    styles={styles}
                    color={c.fgMuted}
                    divided={!!details.group_stats.night_owl}
                  />
                ) : null}
                {details.group_stats.night_owl ? (
                  <Superlative
                    Icon={Moon}
                    data={details.group_stats.night_owl}
                    label={t('rooms.nightOwl')}
                    styles={styles}
                    color={c.fgMuted}
                    divided={false}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <Press onPress={onLeave} style={styles.leaveRow}>
          <LogOut size={20} color={c.danger} />
          <Text style={styles.leaveText}>{t('leagues:detail.leaveLeague')}</Text>
        </Press>
      </ScrollView>
      <RoomTabBar roomId={room.id} challengeId={details?.challenge.id} active="details" />
    </SafeAreaView>
  );
}

function Superlative({ Icon, data, label, styles, color, divided }: any) {
  return (
    <View style={styles.row}>
      <Icon size={22} color={color} />
      <Avatar uri={data.avatar_url} name={data.display_name} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{data.display_name}</Text>
        <Text style={styles.meta}>{label} · {data.check_ins}</Text>
      </View>
      {divided ? <View style={styles.dividerFull} /> : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, paddingHorizontal: space.lg },
  stateBody: { ...text.body, color: c.fgMuted, textAlign: 'center', marginTop: space.md },
  stateAction: { minHeight: 44, justifyContent: 'center' },
  link: { ...text.bodyStrong, color: c.accent },
  nav: { height: 44, paddingHorizontal: space.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  title: { ...text.title2, color: c.fg, marginBottom: space.md },
  progressTrack: { height: 18, borderRadius: radius.full, backgroundColor: c.surfacePressed, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: c.accent },
  progressUrgent: { backgroundColor: c.deadline },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  dateText: { ...text.caption, color: c.fgMuted },
  overline: { ...text.overline, color: c.fgMuted },
  inviteBlock: { marginTop: space.xl },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  inviteCode: { ...text.title3, color: c.fg, letterSpacing: 3 },
  sectionTitle: { ...text.bodyStrong, color: c.fg, marginTop: space.xl, marginBottom: space.md },
  card: { backgroundColor: c.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  cardSpaced: { marginTop: space.md },
  cardPad: { padding: space.lg },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.sm, paddingRight: space.lg },
  // Recuada até a coluna do nome (8 + 40 + 12), como a referência.
  divider: { position: 'absolute', left: 60, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  dividerFull: { position: 'absolute', left: space.lg, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  name: { ...text.bodyStrong, color: c.fg },
  meta: { ...text.caption, color: c.fgMuted, marginTop: 2 },
  statValue: { ...text.bodyStrong, color: c.fg },
  position: { ...text.title3, color: c.fg },
  positionSuffix: { ...text.label, color: c.fg },
  allRow: { height: 48, justifyContent: 'center', paddingHorizontal: space.lg },
  leaveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, minHeight: 48 },
  leaveText: { ...text.bodyStrong, color: c.danger },
});
