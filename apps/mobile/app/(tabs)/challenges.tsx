import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '@quibly/shared/constants';
import { useAuth } from '../../contexts/AuthContext';
import { getMyLeagues, joinLeague } from '../../services/leagues';
import { Trophy } from 'lucide-react-native';
import type { League, LeagueStatus } from '@quibly/shared';

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
}

export default function LeaguesScreen() {
  const { t } = useTranslation('leagues');
  const { user, profile } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchLeagues = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyLeagues(user.uid);
      setLeagues(data);
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { setLoading(true); fetchLeagues(); }, [fetchLeagues]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchLeagues(); }, [fetchLeagues]);

  const handleJoinLeague = async () => {
    if (!inviteCode.trim() || !joinDisplayName.trim() || !user) return;
    setJoining(true);
    try {
      const result = await joinLeague(user.uid, inviteCode.trim(), joinDisplayName.trim());
      setJoinModalVisible(false);
      setInviteCode('');
      setJoinDisplayName('');
      Alert.alert(t('joinModal.joinedTitle'), t('joinModal.joinedMessage', { name: result.name }));
      fetchLeagues();
    } catch (err: any) {
      Alert.alert(t('common:error'), err?.message ?? t('joinModal.error'));
    } finally { setJoining(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('title')}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/league/create')} activeOpacity={0.7}>
            <Text style={styles.actionButtonText}>{t('createLeague')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={() => setJoinModalVisible(true)} activeOpacity={0.7}>
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>{t('joinLeague')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={leagues}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/league/${item.id}`)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <Text style={styles.leagueName} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? COLORS.success + '22' : COLORS.textMuted + '22' }]}>
                    <Text style={[styles.statusBadgeText, { color: item.status === 'active' ? COLORS.success : COLORS.textMuted }]}>
                      {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>{formatDateRange(item.start_date, item.end_date)}</Text>
                  <Text style={styles.metaDot}>{'  '}|{'  '}</Text>
                  <Text style={styles.metaText}>{item.member_count ?? '?'} {t('common:members')}</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Trophy size={48} color={COLORS.primary} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>{t('noLeaguesTitle')}</Text>
                <Text style={styles.emptySubtitle}>{t('noLeaguesSubtitle')}</Text>
              </View>
            }
          />
        )}

        <Modal visible={joinModalVisible} transparent animationType="fade" onRequestClose={() => setJoinModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('joinModal.title')}</Text>
              <Text style={styles.modalSubtitle}>{t('joinModal.subtitle')}</Text>
              <TextInput style={styles.modalInput} placeholder={t('joinModal.inviteCodePlaceholder')} placeholderTextColor={COLORS.textMuted}
                value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" autoCorrect={false} />
              <TextInput style={[styles.modalInput, { letterSpacing: 0, textAlign: 'left', marginBottom: 20 }]}
                placeholder={t('joinModal.displayNamePlaceholder')} placeholderTextColor={COLORS.textMuted}
                value={joinDisplayName} onChangeText={setJoinDisplayName} autoCorrect={false} maxLength={30} />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setJoinModalVisible(false); setInviteCode(''); setJoinDisplayName(''); }}>
                  <Text style={styles.modalCancelText}>{t('common:cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalJoin, (!inviteCode.trim() || !joinDisplayName.trim()) && { opacity: 0.5 }]}
                  onPress={handleJoinLeague} disabled={!inviteCode.trim() || !joinDisplayName.trim() || joining}>
                  {joining ? <ActivityIndicator size="small" color={COLORS.text} /> : <Text style={styles.modalJoinText}>{t('joinModal.joinButton')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  actionButton: { flex: 1, height: 44, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionButtonSecondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  actionButtonText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  actionButtonTextSecondary: { color: COLORS.primaryLight },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  leagueName: { color: COLORS.text, fontSize: 17, fontWeight: '700', flex: 1, marginRight: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { color: COLORS.textSecondary, fontSize: 13 },
  metaDot: { color: COLORS.textMuted, fontSize: 13 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySubtitle: { color: COLORS.textSecondary, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  modalInput: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.text, fontSize: 16, letterSpacing: 2, textAlign: 'center', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, height: 44, backgroundColor: COLORS.surfaceLight, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  modalJoin: { flex: 1, height: 44, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalJoinText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
