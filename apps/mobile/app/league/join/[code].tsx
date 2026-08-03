import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarDays, Users } from 'lucide-react-native';

import { Mascot } from '../../../components/mascot';
import Press from '../../../components/ui/Press';
import { roomCoverForId, ROOM_COVER_ASPECT_RATIO } from '../../../assets/room-covers';
import { useAuth } from '../../../contexts/AuthContext';
import { getLeaguePreview, joinLeague, type LeaguePreview } from '../../../services/leagues';
import { useTheme, type Palette, radius, space, text } from '../../../theme';
import { track } from '../../../lib/analytics';

/** Distinguir "convite não existe" de "a rede caiu" muda o coelho e a saída. */
type Failure = 'invalid' | 'offline';

function daysLeft(endDate: string): number {
  const remaining = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

export default function JoinRoomScreen() {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();

  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setFailure(null);
    try {
      const data = await getLeaguePreview(code);
      setPreview(data);
      track('invite_opened', { is_member: data.is_member });
    } catch (err) {
      // 404 é convite morto; qualquer outra falha é a rede.
      const message = (err as Error)?.message ?? '';
      setFailure(/404|not found|não encontrad/i.test(message) ? 'invalid' : 'offline');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (user && code) void fetchPreview();
  }, [user, code, fetchPreview]);

  // Já é membro: o convite não tem nada a perguntar, então ele abre a sala.
  useEffect(() => {
    if (preview?.is_member) router.replace(`/league/room/${preview.id}`);
  }, [preview]);

  const onJoin = async () => {
    if (!code || !user || !displayName.trim() || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const league = await joinLeague(user.uid, code, displayName.trim());
      track('room_joined', { mode: preview?.mode ?? 'unknown' });
      // Sem alerta de parabéns: quem acabou de aceitar um convite entra na
      // sala, não numa caixa de diálogo (`FLUXO §2`).
      router.replace(`/league/room/${league.id}`);
    } catch (err) {
      setJoinError((err as Error)?.message ?? t('rooms.joinError'));
    } finally {
      setJoining(false);
    }
  };

  const nav = (
    <View style={styles.nav}>
      <Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {nav}
        <View style={styles.content}>
          {/* A forma do card é conhecida: capa 144 + faixa 56. Esperar com a
              forma certa é melhor que um spinner (§4.4). */}
          <View style={styles.card}>
            <View style={styles.coverSkeleton} />
            <View style={styles.strip} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (failure || !preview) {
    const invalid = failure !== 'offline';
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {nav}
        <View style={styles.center}>
          <Mascot state={invalid ? 'worried' : 'offline'} size={96} animate={false} />
          <Text style={styles.stateBody}>{invalid ? t('rooms.inviteInvalid') : t('rooms.loadFailed')}</Text>
          <Press onPress={invalid ? () => router.replace('/(tabs)') : fetchPreview} style={styles.stateAction}>
            <Text style={styles.link}>{invalid ? t('rooms.inviteAnotherCode') : t('rooms.tryAgain')}</Text>
          </Press>
        </View>
      </SafeAreaView>
    );
  }

  if (preview.is_member) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
      </SafeAreaView>
    );
  }

  const ended = preview.status === 'completed';
  const blocked = preview.is_full || ended;
  const canSubmit = displayName.trim().length > 0 && !joining && !blocked;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {nav}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('rooms.invited')}</Text>

          {/* É o mesmo bloco da §5.1 de propósito: quem chega por convite vê
              exatamente a sala que vai encontrar. */}
          <View style={styles.card}>
            <Image source={roomCoverForId(preview.id)} style={styles.cover} resizeMode="cover" />
            <View style={styles.strip}>
              <View style={styles.statColumn}>
                <Users size={22} color={c.fgMuted} />
                <View>
                  <Text style={styles.statValue}>{preview.member_count}</Text>
                  <Text style={styles.statLabel}>{t('members')}</Text>
                </View>
              </View>
              <View style={styles.statColumn}>
                <CalendarDays size={22} color={c.fgMuted} />
                <View>
                  <Text style={styles.statValue}>{daysLeft(preview.end_date)}</Text>
                  <Text style={styles.statLabel}>{t('rooms.daysLeftLabel')}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.roomName} numberOfLines={2}>{preview.name}</Text>

          {!blocked ? (
            <TextInput
              style={styles.field}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('rooms.displayNamePlaceholder')}
              placeholderTextColor={c.fgSubtle}
              autoCorrect={false}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={onJoin}
            />
          ) : null}

          {joinError ? <Text style={styles.error}>{joinError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {blocked ? (
            <Text style={styles.warning}>{ended ? t('rooms.roomEnded') : t('rooms.roomFull')}</Text>
          ) : null}
          <Press onPress={onJoin} disabled={!canSubmit} style={[styles.button, !canSubmit && styles.buttonDisabled]}>
            {joining
              ? <ActivityIndicator color={c.fgOnAccent} />
              : <Text style={styles.buttonText}>{t('rooms.join')}</Text>}
          </Press>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  nav: { height: 44, paddingHorizontal: space.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  title: { ...text.title2, color: c.fg, marginBottom: space.lg },
  card: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: ROOM_COVER_ASPECT_RATIO, maxHeight: 150, backgroundColor: c.skeleton },
  coverSkeleton: { width: '100%', aspectRatio: ROOM_COVER_ASPECT_RATIO, maxHeight: 150, backgroundColor: c.skeleton },
  strip: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  statColumn: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statValue: { ...text.bodyStrong, color: c.fg },
  statLabel: { ...text.caption, color: c.fgMuted },
  roomName: { ...text.title3, color: c.fg, marginTop: space.xl },
  field: {
    height: 54,
    marginTop: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: space.lg,
    ...text.body,
    color: c.fg,
  },
  error: { ...text.caption, color: c.danger, marginTop: space.sm },
  warning: { ...text.caption, color: c.warning, marginBottom: space.md },
  stateBody: { ...text.body, color: c.fgMuted, textAlign: 'center', marginTop: space.md },
  stateAction: { minHeight: 44, justifyContent: 'center' },
  link: { ...text.bodyStrong, color: c.accent },
  footer: { padding: space.lg },
  button: { height: 54, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...text.bodyStrong, color: c.fgOnAccent },
});
