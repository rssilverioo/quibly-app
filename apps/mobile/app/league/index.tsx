import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@quibly/shared/constants';
import { useAuth } from '../../contexts/AuthContext';
import { getMyLeagues, type LeagueWithStanding } from '../../services/leagues';
import { Trophy, Users, Calendar, ArrowLeft } from 'lucide-react-native';
import { staticDark as c } from '../../theme';

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
}

export default function LeaguesListScreen() {
  const { t } = useTranslation('leagues');
  const router = useRouter();
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<LeagueWithStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    try { setLeagues(await getMyLeagues(user.uid)); } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetch(); }, [fetch]);

  const statusColor = (s: string) => {
    if (s === 'active') return { bg: c.surfaceRaised, text: c.success };
    if (s === 'upcoming') return { bg: c.accentSoft, text: c.accent };
    return { bg: c.surfaceRaised, text: c.fgMuted };
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/league/create')} activeOpacity={0.85}>
          <Text style={styles.createText}>{t('createLeague')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/league/join' as any)} activeOpacity={0.85}>
          <Text style={styles.joinText}>{t('joinLeague')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={c.accent} /></View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const sc = statusColor(item.status);
            return (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/league/room/${item.id}`)} activeOpacity={0.85}>
                <View style={styles.cardLeft}>
                  <View style={styles.trophyCircle}>
                    <Trophy size={22} color={c.warning} />
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.leagueName} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>
                        {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Calendar size={13} color={c.fgSubtle} />
                    <Text style={styles.metaText}>{formatDateRange(item.start_date, item.end_date)}</Text>
                    <Users size={13} color={c.fgSubtle} style={{ marginLeft: 12 }} />
                    <Text style={styles.metaText}>{item.member_count ?? '?'} {t('common:members')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Trophy size={40} color={c.accent} /></View>
              <Text style={styles.emptyTitle}>{t('noLeaguesTitle')}</Text>
              <Text style={styles.emptySub}>{t('noLeaguesSubtitle')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontFamily: FONTS.bold, color: c.fg, textAlign: 'center' },

  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  createBtn: { flex: 1, height: 48, backgroundColor: c.accent, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  createText: { color: c.fgOnAccent, fontSize: 15, fontFamily: FONTS.bold },
  joinBtn: { flex: 1, height: 48, backgroundColor: c.surface, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.accent },
  joinText: { color: c.accent, fontSize: 15, fontFamily: FONTS.bold },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardLeft: { marginRight: 14 },
  trophyCircle: { width: 48, height: 48, borderRadius: 14, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  leagueName: { fontSize: 16, fontFamily: FONTS.bold, color: c.fg, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: FONTS.semiBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, fontFamily: FONTS.medium, color: c.fgSubtle, marginLeft: 4 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.bold, color: c.fg, marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: FONTS.regular, color: c.fgSubtle, textAlign: 'center', paddingHorizontal: 40 },
});
