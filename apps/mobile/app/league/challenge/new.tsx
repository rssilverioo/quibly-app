import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Timer, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import Press from '../../../components/ui/Press';
import { createChallenge } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

type ParticipationMode = 'photo' | 'study';

const isoAfterDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export default function NewChallengeScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<ParticipationMode>('photo');
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!roomId || title.trim().length < 2 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createChallenge(roomId, {
        title: title.trim(),
        metric: 'minutes',
        ends_on: isoAfterDays(days),
        participation_mode: mode,
      });
      router.back();
    } catch (err) {
      // §5.7: erro vira linha abaixo do formulário. Alerta é para ação
      // destrutiva, não para "não deu certo".
      setError((err as Error)?.message ?? t('rooms.createChallengeError'));
      setSaving(false);
    }
  };

  const modes = [
    { id: 'photo' as const, Icon: Camera, title: t('rooms.photoMode'), subtitle: t('rooms.photoModeSubtitle') },
    { id: 'study' as const, Icon: Timer, title: t('rooms.studyMode'), subtitle: t('rooms.studyModeSubtitle') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Press onPress={() => router.back()} style={styles.close}><X size={22} color={c.fg} /></Press>
        <Text style={styles.headerTitle}>{t('rooms.newChallenge')}</Text>
        <View style={styles.close} />
      </View>
      <View style={styles.body}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('rooms.challengeName')}
          placeholderTextColor={c.fgSubtle}
          style={styles.input}
          maxLength={80}
        />
        <Text style={styles.label}>{t('rooms.challengeMode')}</Text>
        <View style={styles.modeRow}>
          {modes.map(({ id, Icon, title, subtitle }) => {
            const selected = mode === id;
            return (
              <Press key={id} onPress={() => setMode(id)} style={[styles.modeCard, selected && styles.selected]}>
                <Icon size={22} color={selected ? c.accent : c.fgMuted} />
                <Text style={styles.modeTitle}>{title}</Text>
                <Text style={styles.modeSubtitle}>{subtitle}</Text>
              </Press>
            );
          })}
        </View>
        <Text style={styles.label}>{t('rooms.duration')}</Text>
        <View style={styles.daysRow}>
          {[7, 14, 30].map((value) => (
            <Press key={value} onPress={() => setDays(value)} style={[styles.day, days === value && styles.selected]}>
              <Text style={styles.dayText}>{t('rooms.durationDays', { count: value })}</Text>
            </Press>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Press disabled={title.trim().length < 2 || saving} onPress={save} style={[styles.save, (title.trim().length < 2 || saving) && styles.disabled]}>
        {saving ? <ActivityIndicator color={c.fgOnAccent} /> : <Text style={styles.saveText}>{t('rooms.createChallengeAction')}</Text>}
      </Press>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { height: 56, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.bodyStrong, color: c.fg },
  body: { flex: 1, padding: space.lg, gap: space.lg },
  input: { height: 54, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, paddingHorizontal: space.lg, color: c.fg, backgroundColor: c.surface, ...text.body },
  label: { ...text.overline, color: c.fgMuted, marginTop: space.sm },
  modeRow: { flexDirection: 'row', gap: space.md },
  modeCard: { flex: 1, minHeight: 136, padding: space.lg, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.surface, gap: space.sm },
  selected: { borderColor: c.accent, backgroundColor: c.accentSoft },
  modeTitle: { ...text.bodyStrong, color: c.fg },
  modeSubtitle: { ...text.caption, color: c.fgMuted },
  daysRow: { flexDirection: 'row', gap: space.sm },
  day: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface },
  dayText: { ...text.label, color: c.fg },
  save: { height: 54, margin: space.lg, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...text.bodyStrong, color: c.fgOnAccent },
  error: { ...text.caption, color: c.danger },
  disabled: { opacity: 0.4 },
});
