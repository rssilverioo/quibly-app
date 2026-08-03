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
import { X } from 'lucide-react-native';

import Press from '../../components/ui/Press';
import { useAuth } from '../../contexts/AuthContext';
import { createRoom, type CreatedRoom } from '../../services/rooms';
import { inviteUrl } from '@quibly/shared/constants';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { track } from '../../lib/analytics';

/**
 * Criar sala — dois campos, e só.
 *
 * `FLUXO §5` e `DESIGN-GYMRATS §5.6`: prazo, modo, tamanho do grupo e
 * público/privado são propriedades do **desafio**, não da sala, e moram em
 * `challenge/new.tsx`. Isto aqui saiu de 840 linhas para o que a tela realmente
 * pergunta: como a sala se chama e como você aparece nela.
 *
 * A tela manda os dois campos e nada mais. Datas, modo, privacidade e teto de
 * membros são preenchidos pelo `POST /rooms` no servidor — este cliente já os
 * inventou por um tempo, contra `POST /leagues`, e não precisa mais.
 */

export default function CreateRoomScreen() {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRoom | null>(null);

  const canSubmit = name.trim().length > 0 && displayName.trim().length > 0 && !creating;

  const onCreate = async () => {
    if (!canSubmit) return;
    if (!user) {
      setError(t('rooms.loginRequired'));
      return;
    }
    setError(null);
    setCreating(true);
    try {
      setCreated(await createRoom(name.trim(), displayName.trim()));
      track('room_created');
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
  code: { ...text.title3, color: c.fg, letterSpacing: 3, marginTop: space.xs },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  link: { ...text.bodyStrong, color: c.accent },
  footer: { padding: space.lg },
  button: { height: 54, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...text.bodyStrong, color: c.fgOnAccent },
});
