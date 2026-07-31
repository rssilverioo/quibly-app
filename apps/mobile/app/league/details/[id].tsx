import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarCheck, CalendarDays, Clock3, Share2, Sunrise, Moon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import RoomTabBar from '../../../components/rooms/RoomTabBar';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import { getMyRooms, getRoomDetails, type ChallengeDetails, type RoomSummary } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

function ordinal(rank: number, locale: string) {
  if (locale.startsWith('pt')) return `${rank}º`;
  const mod100 = rank % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th'
    : rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th';
  return `${rank}${suffix}`;
}

export default function RoomDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [details, setDetails] = useState<ChallengeDetails | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const rooms = await getMyRooms();
    const current = rooms.find((candidate) => candidate.id === id) ?? null;
    setRoom(current);
    if (current?.active_challenge?.id) setDetails(await getRoomDetails(current.id));
  }, [id]);
  useEffect(() => { void load().catch(() => {}); }, [load]);

  if (!room || !details) return <View style={styles.center}><ActivityIndicator color={c.accent} /></View>;

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
        <Press onPress={() => router.push(`/league/challenge/${details.challenge.id}`)} style={styles.allRow}><Text style={styles.allText}>{t('rooms.allRankings')} ›</Text></Press>

        <Text style={styles.sectionTitle}>{t('rooms.groupStats')}</Text>
        {stats.map(({ Icon, value, label }) => (
          <View key={label} style={styles.statRow}><Icon size={22} color={c.fgMuted} /><Text style={styles.statNumber}>{value}</Text><Text style={styles.statText}>{label}</Text></View>
        ))}
        {details.group_stats.most_early_bird ? <Superlative Icon={Sunrise} data={details.group_stats.most_early_bird} label={t('rooms.earlyBird')} styles={styles} color={c.fgMuted} /> : null}
        {details.group_stats.most_night_owl ? <Superlative Icon={Moon} data={details.group_stats.most_night_owl} label={t('rooms.nightOwl')} styles={styles} color={c.fgMuted} /> : null}
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
