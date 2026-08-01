import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarCheck, CalendarDays, Clock3, LogOut, Share2, Sunrise, Moon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import RoomTabBar from '../../../components/rooms/RoomTabBar';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import { ordinal } from '../../../lib/ordinal';
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
      if (!current?.active_challenge?.id) throw new Error('No active challenge');
      setDetails(await getRoomDetails(current.id));
    } catch {
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

  if (loading || !room || !details) return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}><Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press></View>
      <View style={styles.center}>
        {loading ? <ActivityIndicator color={c.accent} /> : (
          <>
            <Text style={styles.errorText}>{t('rooms.detailsUnavailable')}</Text>
            <Press onPress={load} style={styles.retry}><Text style={styles.retryText}>{t('rooms.tryAgain')}</Text></Press>
          </>
        )}
      </View>
    </SafeAreaView>
  );

  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' });
  const stats = [
    { Icon: CalendarCheck, value: details.group_stats.total_check_ins, label: t('rooms.totalCheckIns') },
    { Icon: CalendarDays, value: details.group_stats.total_active_days, label: t('rooms.totalDaysActive') },
    { Icon: Clock3, value: details.group_stats.average_check_ins_per_day, label: t('rooms.averageCheckIns') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}><Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{room.name}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, details.challenge.elapsed_fraction * 100)}%` }]} /></View>
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{t('rooms.started', { date: date(details.challenge.starts_at) })}</Text>
          <Text style={styles.dateText}>{t('rooms.finishes', { date: date(details.challenge.ends_at) })}</Text>
        </View>

        <View style={styles.inviteBlock}>
          <Share2 size={22} color={c.fgMuted} />
          <Text style={styles.inviteCode}>{details.invite_code}</Text>
          <Press onPress={() => Share.share({ message: `https://tryquibly.com/join/${details.invite_code}` })}>
            <Text style={styles.inviteLink}>{t('rooms.invite')}</Text>
          </Press>
        </View>

        <Text style={styles.sectionTitle}>{t('rooms.rankingsPreview')}</Text>
        {details.rankings.map((entry) => (
          <View key={entry.user_id} style={styles.rankingRow}>
            <Avatar uri={entry.avatar_url} name={entry.display_name} size={40} />
            <View style={{ flex: 1 }}><Text style={styles.name}>{entry.display_name}</Text><Text style={styles.meta}>{t('rooms.daysActive', { count: entry.active_days })}</Text></View>
            <Text style={styles.position}>{ordinal(entry.rank, i18n.language)}</Text>
          </View>
        ))}
        <Press onPress={() => router.push({ pathname: '/league/challenge/[id]', params: { id: details.challenge.id, roomId: room.id } })} style={styles.allRow}><Text style={styles.allText}>{t('rooms.allRankings')} ›</Text></Press>

        <Text style={styles.sectionTitle}>{t('rooms.groupStats')}</Text>
        {stats.map(({ Icon, value, label }) => (
          <View key={label} style={styles.statRow}><Icon size={22} color={c.fgMuted} /><Text style={styles.statNumber}>{value}</Text><Text style={styles.statText}>{label}</Text></View>
        ))}
        {details.group_stats.most_early_bird ? <Superlative Icon={Sunrise} data={details.group_stats.most_early_bird} label={t('rooms.earlyBird')} styles={styles} color={c.fgMuted} /> : null}
        {details.group_stats.most_night_owl ? <Superlative Icon={Moon} data={details.group_stats.most_night_owl} label={t('rooms.nightOwl')} styles={styles} color={c.fgMuted} /> : null}

        <Press onPress={onLeave} style={styles.leaveRow}>
          <LogOut size={20} color={c.danger} />
          <Text style={styles.leaveText}>{t('leagues:detail.leaveLeague')}</Text>
        </Press>
      </ScrollView>
      <RoomTabBar roomId={room.id} challengeId={details.challenge.id} active="details" />
    </SafeAreaView>
  );
}

function Superlative({ Icon, data, label, styles, color }: any) {
  return <View style={styles.superRow}><Icon size={22} color={color} /><Avatar uri={data.avatar_url} name={data.display_name} size={36} /><View style={{ flex: 1 }}><Text style={styles.name}>{data.display_name}</Text><Text style={styles.meta}>{label} · {data.check_ins}</Text></View></View>;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  errorText: { ...text.body, color: c.fgMuted, textAlign: 'center' },
  retry: { marginTop: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  retryText: { ...text.bodyStrong, color: c.accent },
  nav: { height: 44, paddingHorizontal: space.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  title: { ...text.title1, color: c.fg, marginBottom: space.xl },
  progressTrack: { height: 8, borderRadius: radius.full, backgroundColor: c.surfacePressed, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: c.accent },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  dateText: { ...text.caption, color: c.fgMuted },
  inviteBlock: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  inviteCode: { ...text.title2, color: c.fg, letterSpacing: 3 },
  inviteLink: { ...text.bodyStrong, color: c.accent },
  sectionTitle: { ...text.title3, color: c.fg, marginTop: space.xl, marginBottom: space.md },
  leaveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, paddingVertical: space.md },
  leaveText: { ...text.bodyStrong, color: c.danger },
  rankingRow: { height: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  name: { ...text.bodyStrong, color: c.fg },
  meta: { ...text.caption, color: c.fgMuted, marginTop: 2 },
  position: { ...text.title3, color: c.fg },
  allRow: { height: 48, justifyContent: 'center' },
  allText: { ...text.label, color: c.accent },
  statRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md },
  statNumber: { ...text.title2, color: c.fg, minWidth: 58 },
  statText: { ...text.body, color: c.fgMuted, flex: 1 },
  superRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
