import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import DateTimePicker from '@react-native-community/datetimepicker';

import Press from '../../components/ui/Press';
import { useAuth } from '../../contexts/AuthContext';
import { createRoom, type CreatedRoom } from '../../services/rooms';
import { inviteUrl } from '@quibly/shared/constants';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { ApiError } from '../../lib/http-errors';
import { track } from '../../lib/analytics';
import { diasAte, emDias } from '../../lib/prazo-desafio';
import FolhaDoPro from '../../components/plano/FolhaDoPro';
import { voltar } from '../../lib/navegacao';

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
  const { t, i18n } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [days, setDays] = useState(7);
  /**
   * Prazo por **data final**, e não por número de dias digitado.
   *
   * Quem cria a sala pensa em data — "vai até a prova, dia 12" —, não em "45
   * dias". A régua de 7/14/30 cobre o caso comum; o calendário cobre o resto sem
   * obrigar ninguém a fazer a conta de cabeça.
   *
   * O contrato do servidor não muda: `duration_days` continua sendo o que sobe,
   * e a conversão acontece aqui. Um campo `ends_on` no `POST /rooms` seria mais
   * direto de ler, mas duplicaria o que `duration_days` já expressa e obrigaria
   * a decidir fuso horário na fronteira — que é onde erro de data nasce.
   */
  const [prazoCustom, setPrazoCustom] = useState(false);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [dataFinal, setDataFinal] = useState(() => emDias(30));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRoom | null>(null);
  /**
   * Quantas salas o plano grátis inclui, quando o servidor recusa por limite.
   *
   * O número vem dele e não de uma constante daqui: ele mora em
   * `quibly_entitlements` e muda por escrita no banco, sem deploy. Repetir o
   * `3` no app significaria que mudá-lo em produção passaria a exigir um build.
   */
  const [limiteDeSalas, setLimiteDeSalas] = useState<number | null>(null);

  // O que sobe é sempre `duration_days` — a data escolhida vira dias aqui.
  const prazoEmDias = prazoCustom ? diasAte(dataFinal) : days;
  const dataCurta = dataFinal.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });

  /**
   * O calendário mora numa folha, não na tela.
   *
   * Ele chegou desenhado no meio do formulário e ficou pesado: ~330pt de
   * calendário permanente entre o prazo e o botão, empurrando "Criar sala" para
   * fora e competindo com os campos que ainda faltavam preencher. Um seletor é
   * um desvio momentâneo, não um bloco do formulário.
   *
   * Mesma folha do `+` da lista de salas (`(tabs)/index.tsx`), incluindo o fundo
   * escuro que fecha ao toque — folha sem saída óbvia é armadilha.
   */
  const folhaDoCalendario = (
    <Modal
      visible={calendarioAberto}
      transparent
      animationType="slide"
      onRequestClose={() => setCalendarioAberto(false)}
    >
      <Press haptic={false} onPress={() => setCalendarioAberto(false)} scale={1} style={styles.backdrop}>
        <View />
      </Press>
      <View style={styles.sheet}>
        <View style={styles.sheetGrip} />
        <Text style={styles.sheetTitle}>{t('rooms.durationEndsOn', { date: dataCurta })}</Text>
        <DateTimePicker
          value={dataFinal}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          // Amanhã é o primeiro fim possível: desafio que acaba hoje nasce
          // encerrado.
          minimumDate={emDias(1)}
          maximumDate={emDias(365)}
          locale={i18n.language}
          onChange={(_evento, escolhida) => {
            if (escolhida) {
              setDataFinal(escolhida);
              setPrazoCustom(true);
            }
            // No Android o diálogo é do sistema e se fecha sozinho ao escolher;
            // no iOS o calendário é desenhado aqui dentro e quem fecha é o
            // botão abaixo, para dar espaço a trocar de mês antes de decidir.
            if (Platform.OS !== 'ios') setCalendarioAberto(false);
          }}
        />
        {Platform.OS === 'ios' ? (
          <Press onPress={() => { setPrazoCustom(true); setCalendarioAberto(false); }} style={styles.button}>
            <Text style={styles.buttonText}>{t('done')}</Text>
          </Press>
        ) : null}
      </View>
    </Modal>
  );

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
      setCreated(await createRoom(name.trim(), displayName.trim(), prazoEmDias));
      track('room_created', { duration_days: prazoEmDias });
    } catch (err) {
      /*
       Bater no limite do plano não é erro, é oferta.

       A primeira versão pintava esta recusa como a mesma linha vermelha de
       "faltou preencher o nome". Quem lê vermelho conclui que quebrou alguma
       coisa, tenta de novo, e desiste sem descobrir que existe um plano — foi
       exatamente o que aconteceu quando o dono do produto bateu no limite.
       Agora quem responde é `FolhaDoPro`.

       O desvio olha o `code`, não a mensagem. A API manda `ROOM_LIMIT_REACHED`
       justamente para o app distinguir este 403 de "você não tem permissão", e
       casar o texto quebraria na primeira tradução.
      */
      if (err instanceof ApiError && err.body?.code === 'ROOM_LIMIT_REACHED') {
        setLimiteDeSalas(err.body.limit ?? 3);
        return;
      }
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
      <Press onPress={() => voltar()} style={styles.close}><X size={22} color={c.fg} /></Press>
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
      {folhaDoCalendario}
      {/*
        Bater no limite não é erro, é oferta. Antes isto era a mesma linha
        vermelha de "faltou preencher o nome", e quem lia vermelho concluía que
        tinha quebrado alguma coisa.
      */}
      <FolhaDoPro
        visivel={limiteDeSalas !== null}
        limite={limiteDeSalas ?? 3}
        aoFechar={() => setLimiteDeSalas(null)}
      />
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

          <Text style={styles.sectionLabel}>{t('rooms.duration')}</Text>
          <View style={styles.daysRow}>
            {[7, 14, 30].map((value) => (
              <Press
                key={value}
                onPress={() => { setPrazoCustom(false); setDays(value); }}
                accessibilityLabel={t('rooms.durationDays', { count: value })}
                style={[styles.day, !prazoCustom && days === value && styles.selected]}
              >
                <Text style={styles.dayText}>{t('rooms.durationDays', { count: value })}</Text>
              </Press>
            ))}
            {/* O chip vira a data depois de escolhida: "Outro" é um convite,
                não uma resposta, e deixar o rótulo genérico obrigaria a linha
                extra abaixo só para dizer o que foi escolhido. */}
            <Press
              onPress={() => setCalendarioAberto(true)}
              // O rótulo acompanha o que o chip mostra. Ele já foi fixo em
              // "Outro", e aí o VoiceOver anunciava um convite onde a tela já
              // exibia uma resposta — além de deixar a data invisível para a
              // automação por acessibilidade, que é como esta tela é conferida.
              accessibilityLabel={
                prazoCustom
                  ? t('rooms.durationEndsOn', { date: dataCurta })
                  : t('rooms.durationCustom')
              }
              style={[styles.day, prazoCustom && styles.selected]}
            >
              <Text style={styles.dayText} numberOfLines={1}>
                {prazoCustom ? dataCurta : t('rooms.durationCustom')}
              </Text>
            </Press>
          </View>

          {prazoCustom ? (
            <Text style={styles.prazoResumo}>
              {t('rooms.durationDays', { count: prazoEmDias })}
            </Text>
          ) : null}

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
  prazoResumo: { ...text.caption, color: c.fgMuted, marginTop: space.sm },
  // Os mesmos valores da folha do `+` em `(tabs)/index.tsx`: duas folhas que se
  // parecem são uma linguagem; duas que quase se parecem são um descuido.
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: c.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl },
  sheetGrip: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full, backgroundColor: c.border, marginBottom: space.lg },
  sheetTitle: { ...text.bodyStrong, color: c.fgMuted, marginBottom: space.md },
  code: { ...text.title3, color: c.fg, letterSpacing: 3, marginTop: space.xs },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  link: { ...text.bodyStrong, color: c.accent },
  footer: { padding: space.lg },
  button: { height: 54, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...text.bodyStrong, color: c.fgOnAccent },
});
