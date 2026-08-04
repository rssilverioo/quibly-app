import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Camera, Timer, X } from 'lucide-react-native';

import Press from '../../components/ui/Press';
import { useAuth } from '../../contexts/AuthContext';
import { createRoom, type CreatedRoom } from '../../services/rooms';
import { inviteUrl } from '@quibly/shared/constants';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { track } from '../../lib/analytics';

/**
 * Criar sala — e, com ela, o desafio.
 *
 * ~~"Criar sala — dois campos, e só. `FLUXO §5` e `DESIGN-GYMRATS §5.6`: prazo,
 * modo, tamanho do grupo e público/privado são propriedades do **desafio**, não
 * da sala, e moram em `challenge/new.tsx`."~~ **Revogado em 04/08/2026 pelo dono
 * do produto, depois de usar o app.**
 *
 * A separação era coerente no papel e furada na mão: a sala nascia sem desafio,
 * e como `isStudyChallenge(null)` é falso, ela nascia **sem o botão do timer e
 * sem a faixa de "estudando agora"**. Tudo que nos separa do GymRats ficava
 * atrás de um segundo passo que nenhuma tela pedia — e quem criasse a primeira
 * sala recebia um GymRats pior, sem a parte que é nossa.
 *
 * O modo e a duração continuam sendo propriedades do desafio. O que mudou é
 * **onde se pergunta**: aqui, uma vez, como o GymRats faz ao criar o grupo.
 * `DIRECAO-PRODUTO` já dizia "a escolha acontece uma vez"; só tinha suposto que
 * a porta era a tela de desafio.
 *
 * `challenge/new.tsx` continua existindo e não foi tocada: é por onde passa o
 * **próximo** desafio, quando o primeiro termina. Os controles daqui são os
 * mesmos de lá, de propósito — mesmas chaves de tradução, mesma régua de dias.
 */

export default function CreateRoomScreen() {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  // Foto é o padrão porque é o GymRats puro: quem não souber o que escolher
  // recebe a prestação de contas por foto, que é o produto de referência. Modo
  // estudo é a adição deliberada, e quem a quer sabe que a quer.
  const [mode, setMode] = useState<'photo' | 'study'>('photo');
  const [days, setDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRoom | null>(null);

  const canSubmit = name.trim().length > 0 && displayName.trim().length > 0 && !creating;

  // Os mesmos dois cartões de `challenge/new.tsx`, com as mesmas chaves: se um
  // dia o texto do modo mudar, muda nos dois lugares de uma vez.
  const modes = [
    { id: 'photo' as const, Icon: Camera, title: t('rooms.photoMode'), subtitle: t('rooms.photoModeSubtitle') },
    { id: 'study' as const, Icon: Timer, title: t('rooms.studyMode'), subtitle: t('rooms.studyModeSubtitle') },
  ];

  const onCreate = async () => {
    if (!canSubmit) return;
    if (!user) {
      setError(t('rooms.loginRequired'));
      return;
    }
    setError(null);
    setCreating(true);
    try {
      setCreated(await createRoom(name.trim(), displayName.trim(), mode, days));
      track('room_created', { participation_mode: mode, duration_days: days });
    } catch (err) {
      // §5.6: erro é uma linha abaixo do campo, nunca `Alert.alert` — alerta é
      // para ação destrutiva, não para "não deu certo".
      setError((err as Error)?.message ?? t('rooms.createRoomError'));
    } finally {
      setCreating(false);
    }
  };

  const onShare = async () => {
    if (!created) return;
    try {
      const result = await Share.share({ message: inviteUrl(created.invite_code) });
      if (result.action === Share.sharedAction) track('invite_shared', { room_id: created.id });
    } catch {
      // O usuário cancelou a folha de compartilhamento.
    }
  };

  const header = (
    <View style={styles.header}>
      <Press onPress={() => router.back()} style={styles.close}><X size={22} color={c.fg} /></Press>
      <Text style={styles.headerTitle}>{created ? created.name : t('rooms.newRoom')}</Text>
      <View style={styles.close} />
    </View>
  );

  // Depois de criar, a MESMA tela vira o convite. Sem alerta de parabéns: o que
  // a pessoa precisa agora é do código na mão.
  if (created) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {header}
        <View style={styles.content}>
          <Text style={styles.label}>{t('rooms.code')}</Text>
          <Text style={styles.code}>{created.invite_code}</Text>
          <Press onPress={onShare} style={styles.linkRow}>
            <Text style={styles.link}>{t('rooms.shareInvite')}</Text>
          </Press>
        </View>
        <View style={styles.footer}>
          <Press onPress={() => router.replace(`/league/room/${created.id}`)} style={styles.button}>
            <Text style={styles.buttonText}>{t('rooms.openRoom')}</Text>
          </Press>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.field}
            value={name}
            onChangeText={setName}
            placeholder={t('rooms.roomNamePlaceholder')}
            placeholderTextColor={c.fgSubtle}
            maxLength={60}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.field, styles.fieldSpaced]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('rooms.displayNamePlaceholder')}
            placeholderTextColor={c.fgSubtle}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={onCreate}
          />

          <Text style={styles.sectionLabel}>{t('rooms.challengeMode')}</Text>
          <View style={styles.modeRow}>
            {modes.map(({ id, Icon, title, subtitle }) => {
              const selected = mode === id;
              return (
                <Press
                  key={id}
                  onPress={() => setMode(id)}
                  accessibilityLabel={title}
                  style={[styles.modeCard, selected && styles.selected]}
                >
                  <Icon size={22} color={selected ? c.accent : c.fgMuted} />
                  <Text style={styles.modeTitle}>{title}</Text>
                  <Text style={styles.modeSubtitle}>{subtitle}</Text>
                </Press>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>{t('rooms.duration')}</Text>
          <View style={styles.daysRow}>
            {[7, 14, 30].map((value) => (
              <Press
                key={value}
                onPress={() => setDays(value)}
                accessibilityLabel={t('rooms.durationDays', { count: value })}
                style={[styles.day, days === value && styles.selected]}
              >
                <Text style={styles.dayText}>{t('rooms.durationDays', { count: value })}</Text>
              </Press>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.footer}>
          <Press onPress={onCreate} disabled={!canSubmit} style={[styles.button, !canSubmit && styles.buttonDisabled]}>
            {creating
              ? <ActivityIndicator color={c.fgOnAccent} />
              : <Text style={styles.buttonText}>{t('rooms.create')}</Text>}
          </Press>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.bodyStrong, color: c.fg },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg },
  field: {
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: space.lg,
    ...text.body,
    color: c.fg,
  },
  fieldSpaced: { marginTop: space.lg },
  error: { ...text.caption, color: c.danger, marginTop: space.sm },
  label: { ...text.caption, color: c.fgMuted },
  // Daqui para baixo, os mesmos valores de `challenge/new.tsx`. Não é
  // duplicação por descuido: são duas telas que precisam parecer a mesma
  // pergunta, e o dia em que divergirem visualmente é o dia em que a escolha
  // do modo parece duas coisas diferentes.
  sectionLabel: { ...text.overline, color: c.fgMuted, marginTop: space.xl },
  modeRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  modeCard: {
    flex: 1,
    minHeight: 136,
    padding: space.lg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    gap: space.sm,
  },
  selected: { borderColor: c.accent, backgroundColor: c.accentSoft },
  modeTitle: { ...text.bodyStrong, color: c.fg },
  modeSubtitle: { ...text.caption, color: c.fgMuted },
  daysRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  day: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    backgroundColor: c.surface,
  },
  dayText: { ...text.label, color: c.fg },
  code: { ...text.title3, color: c.fg, letterSpacing: 3, marginTop: space.xs },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  link: { ...text.bodyStrong, color: c.accent },
  footer: { padding: space.lg },
  button: { height: 54, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...text.bodyStrong, color: c.fgOnAccent },
});
