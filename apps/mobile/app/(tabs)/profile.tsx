import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import {
  Clock, Flame, LogOut, ChevronRight, Camera, Trophy, BookOpen, Crown, Users,
  Award, GraduationCap, Skull, Shield, ShieldCheck, Target, Zap, Star, Lock,
  Pencil, Globe, Trash2, Moon,
} from 'lucide-react-native';

import { useAuth } from '../../contexts/AuthContext';
import { logout as firebaseLogout, deleteAccount } from '../../services/auth';
import { COMPRAS_NO_APP_ATIVAS } from '../../services/iap';
import { uploadAvatar } from '../../services/storage';
import { getAllAchievements, seedAchievements, type AchievementWithStatus } from '../../services/achievements';
import { xpForLevel, calculateTitle } from '@quibly/shared/constants';
import Press from '../../components/ui/Press';
import { MascotBlock } from '../../components/mascot';
import { useTheme, type Palette, text, space, radius } from '../../theme';
import i18n from '../../lib/i18n';
import { formatarTempoDeEstudo } from '../../lib/study-time';
import { useTabBarClearance } from './_layout';
import StreakCalendarModal from '../../components/StreakCalendarModal';
import StudyHeatmap from '../../components/StudyHeatmap';
import SeloVerificado from '../../components/ui/SeloVerificado';

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const ACHIEVEMENT_ICONS: Record<string, any> = {
  Flame, Clock, GraduationCap, Skull, BookOpen, Target, Zap,
  ShieldCheck, Shield, Users, Crown, Star, Award, Trophy,
};

export default function ProfileScreen() {
  const { t } = useTranslation('profile');
  const { c, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tabBarClearance = useTabBarClearance();
  const { user, profile, refreshProfile, setProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  /** A URL do avatar pode existir e não carregar — ver `avatarBroken` abaixo. */
  const [avatarBroken, setAvatarBroken] = useState(false);

  const achievementsFetched = useRef(false);

  const fetchAchievements = useCallback(async () => {
    try {
      const data = await getAllAchievements();
      setAchievements(data);
      achievementsFetched.current = true;
    } catch {
      // Achievements endpoint may not be seeded yet - fail silently
      // Don't cascade into seedAchievements on every load
      if (!achievementsFetched.current) {
        try {
          await seedAchievements();
          const data = await getAllAchievements();
          setAchievements(data);
          achievementsFetched.current = true;
        } catch {
          // API not available - just show profile without achievements
        }
      }
    }
  }, []);

  useEffect(() => {
    if (profile && !achievementsFetched.current) fetchAchievements();
  }, [profile, fetchAchievements]);

  useEffect(() => { setAvatarBroken(false); }, [profile?.avatar_url]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchAchievements()]);
    setRefreshing(false);
  }, [refreshProfile, fetchAchievements]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('permissionRequired'), t('allowPhotoAccess')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0] && user) {
      try {
        // Uma chamada só: o upload já grava e devolve o perfil. Ver a nota em
        // `uploadAvatar` sobre o `PATCH` que existia aqui e dava 400.
        setProfile(await uploadAvatar(user.uid, result.assets[0].uri));
      } catch (err) {
        // A mensagem do servidor, quando há. O `catch` vazio que estava aqui
        // descartava a causa: um 400 de validação, um 413 de arquivo grande e
        // uma queda de rede viravam a mesma frase, e não havia como saber qual
        // tinha sido — foi o que fez este defeito durar.
        Alert.alert(t('common:error'), (err as Error)?.message || t('avatarUploadError'));
      }
    }
  };

  // Alerta continua aqui, e só aqui: `§4.4` proíbe alerta para erro de
  // carregamento, não para ação destrutiva — que é exatamente o que estas duas
  // são.
  const handleLogout = () => {
    Alert.alert(t('logOutConfirmTitle'), t('logOutConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('logOut'), style: 'destructive', onPress: async () => {
        await firebaseLogout();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('deleteAccountConfirmTitle'), t('deleteAccountConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('deleteAccount'), style: 'destructive', onPress: async () => {
        try {
          await deleteAccount();
          router.replace('/(auth)/login');
        } catch (err) {
          /*
           A causa importa mais aqui do que em qualquer outro lugar da tela.

           O Firebase recusa apagar a conta de quem não fez login há pouco
           (`auth/requires-recent-login`) — e a saída é sair e entrar de novo,
           que é uma instrução que a pessoa consegue seguir. A frase genérica
           escondia isso, e quem batia nela só podia tentar de novo e falhar
           igual.

           E esta é a porta que a Apple exige existir dentro do app desde 2022.
           Ela precisa funcionar, e quando não funcionar precisa dizer por quê.
          */
          Alert.alert(t('common:error'), (err as Error)?.message || t('deleteAccountError'));
        }
      }},
    ]);
  };

  // Esqueleto no lugar do spinner: a forma do conteúdo é conhecida (§4.4).
  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.skeletonWrap}>
          <Text style={styles.title}>{t('title')}</Text>
          <View style={styles.header}>
            <View style={styles.skeletonAvatar} />
            <View style={{ flex: 1, gap: space.sm }}>
              <View style={[styles.skeletonBar, { width: '55%' }]} />
              <View style={[styles.skeletonBar, { width: '35%', height: 12 }]} />
            </View>
          </View>
          <View style={styles.skeletonCard} />
          <Press haptic="light" onPress={refreshProfile} style={styles.retryRow}>
            <ActivityIndicator size="small" color={c.accent} />
            <Text style={styles.retryText}>{t('common:loading')}</Text>
          </Press>
        </View>
      </SafeAreaView>
    );
  }

  const currentLevel = profile.level;
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpInCurrentLevel = profile.total_xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  const xpProgress = xpNeeded > 0 ? Math.min(Math.max(xpInCurrentLevel / xpNeeded, 0), 1) : 0;
  const title = calculateTitle(profile);
  const showAvatarImage = !!profile.avatar_url && !avatarBroken;

  /**
   * Três números, e só três (`§5.12` bloco 3).
   *
   * A grade anterior tinha seis mosaicos com seis ícones em seis cores — relógio
   * azul, escudo verde, chama vermelha, raio laranja, alvo azul, estrela
   * amarela. `§2.3` gasta cor em três lugares no app inteiro; um semáforo de
   * seis não é um deles. Sem ícone, sem cor: valor em cima, rótulo embaixo.
   */
  const numbers = [
    { key: 'streak', value: String(profile.current_streak), label: t('streakShort'), onPress: () => setShowStreakCalendar(true) },
    // `formatNumber` fazia 1017 minutos virarem "1.0K Minutes" — a unidade que
    // menos informa, na escala que menos informa. A mesma regra do resto do app:
    // minuto até fechar a hora, hora depois. Ver `lib/study-time.ts`.
    { key: 'minutes', value: formatarTempoDeEstudo(profile.total_study_minutes), label: t('studyTimeShort') },
    { key: 'level', value: String(currentLevel), label: t('levelShort') },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.fgMuted} />}>

        <Text style={styles.title}>{t('title')}</Text>

        {/* 2 — cabeçalho: avatar 72 + nome + sublinha */}
        <View style={styles.header}>
          <Press haptic="light" scale={0.94} onPress={pickAvatar} style={styles.avatarWrap}>
            {showAvatarImage ? (
              <Image
                source={{ uri: profile.avatar_url! }}
                style={styles.avatar}
                // Sem isto, uma URL quebrada desenhava um anel vazio que lia
                // como carregamento travado. Foto que não vem vira inicial.
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{getInitials(profile.username)}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}><Camera size={13} color={c.fgMuted} strokeWidth={2.2} /></View>
          </Press>
          <View style={styles.headerText}>
            <View style={styles.nomeLinha}>
              <Text style={styles.name} numberOfLines={1}>{profile.username}</Text>
              <SeloVerificado selo={profile.verification} size={16} />
            </View>
            <Text style={styles.handle} numberOfLines={1}>
              @{profile.handle} · {t(`titles.${title.id}`)}
            </Text>
            {/*
              A bio era escrita e nunca aparecia.

              O campo existe no banco desde sempre e a tela de editar já pedia
              por ele — só que nenhuma tela o mostrava. Quem escrevia uma via o
              texto sumir, o que é pior do que não ter o campo: o app pediu uma
              informação e a jogou fora.
            */}
            {profile.bio ? (
              <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text>
            ) : null}
          </View>
        </View>

        {/* 3 — card de números: valor sobre rótulo, três colunas */}
        <View style={styles.numbersCard}>
          <View style={styles.numbersRow}>
            {numbers.map((n) => {
              const inner = (
                <>
                  <Text style={styles.numberValue}>{n.value}</Text>
                  <Text style={styles.numberLabel} numberOfLines={1}>{n.label}</Text>
                </>
              );
              return n.onPress ? (
                <Press key={n.key} haptic={false} scale={0.96} onPress={n.onPress} style={styles.numberCell}>
                  {inner}
                </Press>
              ) : (
                <View key={n.key} style={styles.numberCell}>{inner}</View>
              );
            })}
          </View>
          {/* Barra de progresso — um dos três lugares em que o accent pode
              ocupar área (§2.3). 6pt, como o card do desafio no feed (§3.2.5). */}
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.max(xpProgress * 100, 2)}%` }]} />
          </View>
          <Text style={styles.xpText}>
            {formatNumber(Math.max(0, xpInCurrentLevel))} / {formatNumber(xpNeeded)} {t('common:xp')}
          </Text>
        </View>

        {achievements.length > 0 && (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('achievements')}</Text>
              <Text style={styles.sectionCount}>
                {achievements.filter((a) => a.unlocked).length}/{achievements.length}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRailOuter}
              contentContainerStyle={styles.chipRail}
            >
              {achievements
                .slice()
                .sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0))
                .map((a) => {
                  const IconComponent = ACHIEVEMENT_ICONS[a.icon] || Trophy;
                  return (
                    <View key={a.id} style={[styles.chip, !a.unlocked && styles.chipLocked]}>
                      <View style={styles.chipIcon}>
                        {a.unlocked
                          ? <IconComponent size={15} color={c.fg} strokeWidth={2.2} />
                          : <Lock size={12} color={c.fgSubtle} />}
                      </View>
                      <Text style={styles.chipName} numberOfLines={1}>{a.name}</Text>
                    </View>
                  );
                })}
            </ScrollView>
          </>
        )}

        {/* O mapa de constância vem depois das conquistas e antes dos ajustes:
            é leitura do que você fez, e ajuste é o que você muda. Conta sem
            estudo nenhum desenha a grade cinza — quem some é só a falha de
            rede, e ela avisa antes de sumir (ver `StudyHeatmap`). */}
        <StudyHeatmap />

        <Text style={styles.sectionTitle}>{t('settings')}</Text>

        {/* Conta. "Minhas Ligas" saiu daqui: era a única porta para
            `app/league/index.tsx`, que `FLUXO §10` já matou (§3.4). */}
        <View style={styles.group}>
          {/* "Meu plano" só aparece quando há plano a comprar. Compra no app
              está desligada desde 06/08 (`services/iap.ts`), e uma porta para
              um paywall que não vende é pior que porta nenhuma. */}
          {COMPRAS_NO_APP_ATIVAS ? (
            <SettingsRow styles={styles} c={c} Icon={Crown} label={t('pricing:myPlan')} onPress={() => router.push('/pricing')} divider />
          ) : null}
          <SettingsRow styles={styles} c={c} Icon={Pencil} label={t('editProfile')} onPress={() => router.push('/profile/edit')} divider />
          {/* O escuro não sumiu — está a um toque (`theme/index.ts`). */}
          <SettingsRow
            styles={styles}
            c={c}
            Icon={Moon}
            label={t('appearance')}
            value={mode === 'dark' ? t('themeDark') : t('themeLight')}
            onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          />
        </View>

        <View style={styles.group}>
          <View style={styles.settingsRow}>
            <View style={styles.settingsIcon}><Globe size={17} color={c.fgMuted} strokeWidth={2.2} /></View>
            <Text style={styles.settingsLabel}>{t('language')}</Text>
          </View>
          <View style={styles.segmented}>
            {([['en', 'English'], ['pt-BR', 'Português (BR)']] as const).map(([code, label]) => {
              const active = i18n.language === code;
              return (
                <Press
                  key={code}
                  haptic={false}
                  scale={0.97}
                  onPress={() => i18n.changeLanguage(code)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                </Press>
              );
            })}
          </View>
        </View>

        <View style={styles.group}>
          <SettingsRow styles={styles} c={c} Icon={LogOut} label={t('logOut')} onPress={handleLogout} destructive divider />
          <SettingsRow styles={styles} c={c} Icon={Trash2} label={t('deleteAccount')} onPress={handleDeleteAccount} destructive />
        </View>
      </ScrollView>

      <StreakCalendarModal
        visible={showStreakCalendar}
        onClose={() => setShowStreakCalendar(false)}
        currentStreak={profile.current_streak}
        longestStreak={profile.longest_streak}
      />
    </SafeAreaView>
  );
}

/** Linha de ajuste: 56 de altura, ícone neutro, chevron 18 em `c.fgSubtle`. */
function SettingsRow({
  styles, c, Icon, label, value, onPress, destructive, divider,
}: {
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  Icon: typeof Crown;
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  divider?: boolean;
}) {
  return (
    <Press
      haptic="light"
      scale={0.99}
      onPress={onPress}
      style={[styles.settingsRow, divider && styles.settingsRowDivider]}
    >
      <View style={styles.settingsIcon}>
        <Icon size={17} color={destructive ? c.danger : c.fgMuted} strokeWidth={2.2} />
      </View>
      <Text style={[styles.settingsLabel, destructive && { color: c.danger }]}>{label}</Text>
      {value ? <Text style={styles.settingsValue}>{value}</Text> : null}
      {!destructive && <ChevronRight size={18} color={c.fgSubtle} />}
    </Press>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.bg },
  scrollContent: { paddingHorizontal: space.lg, paddingTop: space.md },
  skeletonWrap: { paddingHorizontal: space.lg, paddingTop: space.md },

  title: { ...text.title2, color: c.fg, marginBottom: space.lg },

  header: { height: 72, flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.xl },
  avatarWrap: { width: 72, height: 72 },
  avatar: { width: 72, height: 72, borderRadius: radius.full, backgroundColor: c.surfaceRaised },
  // Sem foto: iniciais em `c.fgMuted` sobre `c.surfaceRaised` (§5.12).
  // O anel de accent saiu — o accent não decora identidade (§2.3).
  avatarFallback: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { ...text.title3, color: c.fgMuted },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 26, height: 26,
    borderRadius: radius.full, backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  nomeLinha: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // `flexShrink` no nome, nunca no selo: um selo cortado é pior que nenhum.
  name: { ...text.title3, color: c.fg, flexShrink: 1 },
  handle: { ...text.caption, color: c.fgMuted },
  bio: { ...text.caption, color: c.fgMuted, marginTop: space.xs, lineHeight: 18 },

  numbersCard: {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    marginBottom: space.xl,
  },
  numbersRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  numberCell: { flex: 1, alignItems: 'center', gap: 2 },
  numberValue: { ...text.bodyStrong, color: c.fg },
  numberLabel: { ...text.caption, color: c.fgMuted },
  xpTrack: { height: 6, borderRadius: radius.full, backgroundColor: c.surfacePressed, overflow: 'hidden', marginTop: space.lg },
  xpFill: { height: '100%', borderRadius: radius.full, backgroundColor: c.accent },
  xpText: { ...text.caption, color: c.fgMuted, marginTop: space.sm },

  sectionTitle: { ...text.bodyStrong, color: c.fg, marginBottom: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCount: { ...text.caption, color: c.fgMuted, marginBottom: space.md },

  // 24 abaixo do trilho, como entre qualquer par de blocos (§5.12). Vai no
  // `style` e não no `contentContainerStyle` porque margem em container de
  // conteúdo de ScrollView horizontal não empurra o que vem depois.
  chipRailOuter: { marginBottom: space.xl },
  chipRail: { gap: space.sm, paddingRight: space.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: c.surface, borderRadius: radius.full,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: 1, borderColor: c.border,
  },
  chipLocked: { opacity: 0.45 },
  chipIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  chipName: { ...text.caption, color: c.fg },

  group: {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  settingsRow: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.md },
  settingsRowDivider: { borderBottomWidth: 1, borderBottomColor: c.border },
  settingsIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { ...text.body, color: c.fg, flex: 1 },
  settingsValue: { ...text.label, color: c.fgMuted },

  segmented: {
    flexDirection: 'row', gap: space.xs,
    marginHorizontal: space.lg, marginBottom: space.lg,
    backgroundColor: c.surfaceRaised, borderRadius: radius.sm, padding: space.xs,
  },
  segment: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  segmentText: { ...text.label, color: c.fgMuted },
  segmentTextActive: { color: c.fg },

  skeletonAvatar: { width: 72, height: 72, borderRadius: radius.full, backgroundColor: c.skeleton },
  skeletonBar: { height: 16, borderRadius: radius.sm, backgroundColor: c.skeleton },
  skeletonCard: { height: 96, borderRadius: radius.sm, backgroundColor: c.skeleton },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, alignSelf: 'flex-start' },
  retryText: { ...text.label, color: c.fgMuted },
});
