import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Plus, Minus } from 'lucide-react-native';
import type { Subject, TimerMode } from '@quibly/shared';
import { TIMER_PRESETS } from '@quibly/shared/constants';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../../stores/session.store';
import { useAuth } from '../../contexts/AuthContext';
import { getSubjects, createSubject as createSubjectService } from '../../services/subjects';
import { SessionAlreadyLiveError } from '../../services/sessions';
import { getBatteryWarning, openBatterySettings } from '../../services/study-timer';
import Press from '../../components/ui/Press';
import { useTheme, text as t, space, radius, SUBJECT_COLORS } from '../../theme';
import { track } from '../../lib/analytics';
import { voltar } from '../../lib/navegacao';

/** One prompt per install, not per session. */
const BATTERY_PROMPT_KEY = '@quibly/battery-optimization-prompted';

export default function SessionSetupScreen() {
  const { t: tr } = useTranslation('session');
  const router = useRouter();
  const { c } = useTheme();
  const { user, profile } = useAuth();
  const store = useSessionStore();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState<string>(SUBJECT_COLORS[0]);
  const [creatingSubject, setCreatingSubject] = useState(false);

  // Cronômetro vem primeiro de propósito: é o modo padrão do YPT e o mais usado
  // por quem estuda horas, para quem um bloco fixo de 25 minutos é atrito, não
  // estrutura.
  //
  // **São dois modos, e só dois.** `deep_focus` e `custom` eram o mesmo modo que
  // o pomodoro com números diferentes — viraram os atalhos abaixo (50/10) e a
  // própria configuração do pomodoro. O `TimerMode` continua com quatro membros
  // porque o servidor guarda esse valor em sessões que já existem: o union é o
  // histórico, esta tela é o presente. Ver `session.store.ts:setTimerMode`.
  const timerModes = useMemo(() => [
    { mode: 'stopwatch' as TimerMode, label: tr('setup.stopwatch'), subtitle: tr('setup.stopwatchSubtitle') },
    { mode: 'pomodoro' as TimerMode, label: tr('setup.pomodoro'), subtitle: tr('setup.pomodoroSubtitle') },
  ], [tr]);

  // Os presets deixaram de ser modos e viraram atalhos de duração. Perder o
  // acesso de um toque ao 50/10 seria regressão.
  // Números vêm de `TIMER_PRESETS`, não escritos aqui: a pastilha tem que dizer
  // exatamente o que `applyTimerPreset` aplica.
  const durationPresets = useMemo(
    () => (['pomodoro', 'deep_focus'] as const).map((key) => ({ key, ...TIMER_PRESETS[key] })),
    [],
  );

  // Uma sessão gravada antes desta tela pode voltar do servidor como
  // `deep_focus` ou `custom`. Os dois são pomodoro com outras durações — então
  // colapsam para `pomodoro` mantendo `workDuration`/`breakDuration` intactos,
  // que é exatamente o que o usuário tinha. Nenhum card ficaria selecionado sem
  // isso, e `startSession` mandaria um modo que a tela não oferece mais.
  const isPomodoro = store.timerMode !== 'stopwatch';
  useEffect(() => {
    if (isPomodoro && store.timerMode !== 'pomodoro') store.setTimerMode('pomodoro');
  }, [store.timerMode]);

  useEffect(() => {
    if (user) {
      store.setUserId(user.uid);
      store.setStreakDays(profile?.current_streak ?? 0);
    }
  }, [user, profile]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!user) return;
    try {
      const data = await getSubjects(user.uid);
      setSubjects(data);
      if (data.length > 0 && !store.subjectId) {
        store.setSubjectId(data[0].id);
        store.setSubjectName(data[0].name);
        store.setSubjectColor(data[0].color);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim() || !user) return;
    setCreatingSubject(true);
    try {
      const subject = await createSubjectService(user.uid, newSubjectName.trim(), newSubjectColor);
      setSubjects((prev) => [...prev, subject]);
      store.setSubjectId(subject.id);
      store.setSubjectName(subject.name);
      store.setSubjectColor(subject.color);
      setShowNewSubject(false);
      setNewSubjectName('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {} finally { setCreatingSubject(false); }
  };

  /**
   * Ask once, before the first session, whether the user wants to exempt the app
   * from battery optimisation.
   *
   * On Xiaomi, Samsung and friends the system stops foreground services
   * regardless of the documented contract, which means the heartbeat dies and
   * the server credits only up to the last beat. The user experiences that as
   * "the app lost my three hours" — so it is worth one prompt.
   *
   * Deliberately not blocking: they can decline and still study. And it fires
   * before `startSession`, not after, so the dialog never lands on top of a
   * timer that is already running.
   */
  const maybeWarnAboutBattery = async () => {
    const warning = getBatteryWarning();
    if (!warning) return;

    const alreadyAsked = await AsyncStorage.getItem(BATTERY_PROMPT_KEY);
    if (alreadyAsked) return;
    await AsyncStorage.setItem(BATTERY_PROMPT_KEY, '1');

    await new Promise<void>((resolve) => {
      Alert.alert(
        tr('setup.batteryTitle'),
        warning.isAggressive
          ? tr('setup.batteryBodyAggressive', { manufacturer: warning.manufacturer })
          : tr('setup.batteryBody'),
        [
          { text: tr('common:notNow'), style: 'cancel', onPress: () => resolve() },
          {
            text: tr('setup.batteryOpenSettings'),
            onPress: () => { void openBatterySettings(); resolve(); },
          },
        ],
      );
    });
  };

  const handleStart = async () => {
    if (!store.subjectId) return;
    setStarting(true);
    try {
      await maybeWarnAboutBattery();
      const isFirstSession = (profile?.total_study_minutes ?? 0) === 0;
      store.setIsFirstSession(isFirstSession);
      await store.startSession();
      track('session_started', {
        timer_mode: store.timerMode,
        work_minutes: store.workDuration,
      });
      if (isFirstSession) {
        track('first_session_started', { subject_id: store.subjectId ?? undefined });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/session/active');
    } catch (err) {
      // A live session already exists. This is not an error the user caused —
      // it is what "the app was killed mid-session and reopened" looks like now
      // that the server refuses overlapping sessions instead of silently
      // killing the first. Pick the old one back up.
      if (err instanceof SessionAlreadyLiveError) {
        const restored = await store.restoreFromServer();
        if (restored) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace('/session/active');
          return;
        }
      }
      console.error('[StartSession]', err);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Press haptic={false} scale={0.9} onPress={() => voltar()} style={styles.iconBtn}>
            <ArrowLeft size={22} color={c.fgMuted} />
          </Press>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(320)}>
            <Text style={{ ...t.title2, color: c.fg }}>{tr('setup.title')}</Text>
          </Animated.View>

          {/* Subject */}
          <Animated.View entering={FadeInDown.duration(320).delay(50)} style={styles.section}>
            <Text style={{ ...t.overline, color: c.fgSubtle, marginBottom: space.md }}>
              {tr('setup.subject')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {subjects.map((subject) => {
                const selected = store.subjectId === subject.id;
                return (
                  <Press
                    key={subject.id}
                    scale={0.95}
                    onPress={() => {
                      store.setSubjectId(subject.id);
                      store.setSubjectName(subject.name);
                      store.setSubjectColor(subject.color);
                    }}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: selected ? c.accentSoft : c.surface,
                        borderColor: selected ? c.accent : c.border,
                      },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: subject.color }]} />
                    <Text style={{ ...t.label, color: selected ? c.fg : c.fgMuted }}>
                      {subject.name}
                    </Text>
                  </Press>
                );
              })}
              <Press
                scale={0.92}
                onPress={() => setShowNewSubject(true)}
                style={[styles.addPill, { borderColor: c.borderStrong }]}
              >
                <Plus size={18} color={c.fgMuted} />
              </Press>
            </ScrollView>
          </Animated.View>

          {/* Timer mode */}
          <Animated.View entering={FadeInDown.duration(320).delay(100)} style={styles.section}>
            <Text style={{ ...t.overline, color: c.fgSubtle, marginBottom: space.md }}>
              {tr('setup.timerMode')}
            </Text>
            <View style={styles.modeRow}>
              {timerModes.map((option) => {
                // `isPomodoro` e não igualdade estrita: no primeiro quadro depois
                // de retomar uma sessão `deep_focus`, o efeito acima ainda não
                // rodou e nenhum card apareceria selecionado.
                const selected = option.mode === 'stopwatch' ? !isPomodoro : isPomodoro;
                return (
                  <Press
                    key={option.mode}
                    scale={0.96}
                    onPress={() => store.setTimerMode(option.mode)}
                    style={[
                      styles.modeCard,
                      {
                        backgroundColor: selected ? c.accent : c.surface,
                        borderColor: selected ? c.accent : c.border,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{ ...t.label, color: selected ? c.fgOnAccent : c.fg }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        ...t.caption,
                        color: selected ? c.fgOnAccent : c.fgSubtle,
                        opacity: selected ? 0.75 : 1,
                        marginTop: 2,
                      }}
                    >
                      {option.subtitle}
                    </Text>
                  </Press>
                );
              })}
            </View>
          </Animated.View>

          {/* Durações do pomodoro — sempre visíveis quando o modo é pomodoro.
              Era isto que o `custom` fazia; agora é o pomodoro em si, com 25/5
              de padrão e os presets como atalhos. */}
          {isPomodoro && (
            <Animated.View
              entering={FadeInDown.duration(280)}
              style={[styles.customCard, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <View style={styles.presetRow}>
                {durationPresets.map((preset) => {
                  const active =
                    store.workDuration === preset.work && store.breakDuration === preset.break;
                  return (
                    <Press
                      key={preset.key}
                      scale={0.94}
                      onPress={() => store.applyTimerPreset(preset.key)}
                      style={[
                        styles.presetPill,
                        {
                          backgroundColor: active ? c.accentSoft : c.surfaceRaised,
                          borderColor: active ? c.accent : 'transparent',
                        },
                      ]}
                    >
                      <Text style={{ ...t.label, color: active ? c.fg : c.fgMuted }}>
                        {tr('setup.presetPill', { work: preset.work, break: preset.break })}
                      </Text>
                    </Press>
                  );
                })}
              </View>

              {[
                {
                  label: tr('setup.workDuration'),
                  value: store.workDuration,
                  dec: () => store.setWorkDuration(Math.max(5, store.workDuration - 5)),
                  inc: () => store.setWorkDuration(Math.min(120, store.workDuration + 5)),
                },
                {
                  label: tr('setup.breakDuration'),
                  value: store.breakDuration,
                  dec: () => store.setBreakDuration(Math.max(1, store.breakDuration - 1)),
                  inc: () => store.setBreakDuration(Math.min(30, store.breakDuration + 1)),
                },
              ].map((row) => (
                <View key={row.label} style={styles.durationRow}>
                  <Text style={{ ...t.label, color: c.fgMuted }}>{row.label}</Text>
                  <View style={styles.durationControls}>
                    <Press
                      scale={0.88}
                      onPress={row.dec}
                      style={[styles.stepBtn, { backgroundColor: c.surfaceRaised }]}
                    >
                      <Minus size={16} color={c.fg} />
                    </Press>
                    <Text style={{ ...t.bodyStrong, color: c.fg, minWidth: 62, textAlign: 'center' }}>
                      {tr('setup.minUnit', { value: row.value })}
                    </Text>
                    <Press
                      scale={0.88}
                      onPress={row.inc}
                      style={[styles.stepBtn, { backgroundColor: c.surfaceRaised }]}
                    >
                      <Plus size={16} color={c.fg} />
                    </Press>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={[styles.ctaWrap, { backgroundColor: c.bg }]}>
          <Press
            haptic="medium"
            scale={0.985}
            onPress={handleStart}
            disabled={!store.subjectId || starting}
            style={[
              styles.cta,
              { backgroundColor: c.accent, opacity: !store.subjectId || starting ? 0.4 : 1 },
            ]}
          >
            {starting ? (
              <ActivityIndicator color={c.fgOnAccent} />
            ) : (
              <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>
                {tr('setup.startSession')}
              </Text>
            )}
          </Press>
        </View>
      </SafeAreaView>

      {/* New subject */}
      <Modal visible={showNewSubject} animationType="slide" transparent onRequestClose={() => setShowNewSubject(false)}>
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: c.scrim }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent, { backgroundColor: c.surface }]}>
            <Text style={{ ...t.title3, color: c.fg, marginBottom: space.lg }}>
              {tr('setup.newSubject')}
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                { ...t.body, backgroundColor: c.surfaceRaised, color: c.fg, borderColor: c.border },
              ]}
              placeholder={tr('setup.subjectNamePlaceholder')}
              placeholderTextColor={c.fgSubtle}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              autoFocus
              maxLength={30}
            />

            <Text style={{ ...t.overline, color: c.fgSubtle, marginTop: space.lg, marginBottom: space.md }}>
              {tr('setup.color')}
            </Text>
            <View style={styles.colorGrid}>
              {SUBJECT_COLORS.map((color) => (
                <Press
                  key={color}
                  scale={0.88}
                  onPress={() => setNewSubjectColor(color)}
                  style={[
                    styles.colorOption,
                    {
                      backgroundColor: color,
                      borderColor: newSubjectColor === color ? c.fg : 'transparent',
                    },
                  ]}
                >
                  <View />
                </Press>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Press
                onPress={() => setShowNewSubject(false)}
                style={[styles.modalBtn, { backgroundColor: c.surfaceRaised }]}
              >
                <Text style={{ ...t.bodyStrong, color: c.fgMuted }}>{tr('common:cancel')}</Text>
              </Press>
              <Press
                haptic="medium"
                onPress={handleCreateSubject}
                disabled={!newSubjectName.trim() || creatingSubject}
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: c.accent,
                    opacity: !newSubjectName.trim() || creatingSubject ? 0.4 : 1,
                  },
                ]}
              >
                {creatingSubject ? (
                  <ActivityIndicator size="small" color={c.fgOnAccent} />
                ) : (
                  <Text style={{ ...t.bodyStrong, color: c.fgOnAccent }}>{tr('common:create')}</Text>
                )}
              </Press>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: space.lg, paddingTop: space.xs },
  iconBtn: { padding: space.sm },
  scroll: { paddingHorizontal: space.lg, paddingTop: space.md },
  section: { marginTop: space.xxl },
  rail: { gap: space.sm, paddingRight: space.lg },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  addPill: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeRow: { flexDirection: 'row', gap: space.sm },
  modeCard: {
    flex: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },

  customCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space.lg,
    marginTop: space.lg,
  },
  presetRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  presetPill: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  durationControls: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.lg,
    paddingBottom: 36,
    paddingTop: space.lg,
  },
  cta: {
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xl,
    paddingBottom: 40,
  },
  modalInput: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: 1,
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  colorOption: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 2 },
  modalActions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  modalBtn: {
    flex: 1,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
