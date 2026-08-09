import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RotateCcw, Send } from 'lucide-react-native';

import { Mascot } from '../../../components/mascot';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import RoomTabBar from '../../../components/rooms/RoomTabBar';
import TypingDots from '../../../components/chat/TypingDots';
import { useAuth } from '../../../contexts/AuthContext';
import { getMessages, sendMessage as sendChatMessage } from '../../../services/chat';
import {
  conectarAoChat,
  TYPING_PING_MS,
  TYPING_TTL_MS,
  type ConexaoDoChat,
} from '../../../services/chat-realtime';
import { getMyRooms } from '../../../services/rooms';
import { autorDaMensagem } from '../../../lib/chat-messages';
import SeloVerificado from '../../../components/ui/SeloVerificado';
import { abreDia, rotuloDoDia } from '../../../lib/chat-day';
import {
  bolhaOtimista,
  confirmar,
  inserir,
  marcarApagada,
  marcarFalha,
  reconciliar,
  type MensagemNaTela,
} from '../../../lib/chat-list';
import { useTheme, type Palette, radius, space, text } from '../../../theme';
import FolhaDeDenuncia from '../../../components/moderation/FolhaDeDenuncia';

const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = MIN_INPUT_HEIGHT + 20 * 3;
/** Um carimbo de hora a cada bloco de conversa, não a cada bolha. */
const TIME_BLOCK_MS = 60 * 60 * 1000;

/**
 * Rede de segurança: só roda enquanto o socket está caído.
 *
 * Existe porque WebSocket é bloqueado em algumas redes corporativas e de hotel,
 * e ali o chat não pode simplesmente deixar de funcionar. Dez segundos são
 * lentos de propósito — é fallback, não o caminho normal, e competir com o
 * socket seria pagar as duas contas.
 */
const FALLBACK_MS = 10_000;

export default function RoomChatScreen() {
  const { t, i18n } = useTranslation('common');
  const { id: roomId, challengeId } = useLocalSearchParams<{ id: string; challengeId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [messages, setMessages] = useState<MensagemNaTela[]>([]);
  const [roomName, setRoomName] = useState('');
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [loading, setLoading] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [conectado, setConectado] = useState(false);
  /** userId → instante em que o "digitando" vence. */
  const [digitando, setDigitando] = useState<Record<string, number>>({});
  /** A mensagem que a pessoa segurou, ou `null`. */
  const [denunciando, setDenunciando] = useState<MensagemNaTela | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const listRef = useRef<FlatList<MensagemNaTela>>(null);
  const conexao = useRef<ConexaoDoChat | null>(null);
  const ultimoPing = useRef(0);
  const meuId = user?.uid;

  /** A busca inicial, e a de recuperação quando o socket está fora. */
  const buscar = useCallback(async () => {
    if (!roomId) return;
    try {
      const doServidor = await getMessages(roomId);
      // `reconciliar` porque a busca não conhece as bolhas pendentes: escrever
      // o resultado cru faria a mensagem recém-digitada sumir e voltar.
      setMessages((atual) => reconciliar(doServidor, atual));
      setFalhou(false);
    } catch (erro) {
      console.warn('[chat] não deu para carregar as mensagens', erro);
      setFalhou(true);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { void buscar(); }, [buscar]);

  // ─── Tempo real ───
  useEffect(() => {
    if (!roomId) return;

    conexao.current = conectarAoChat(roomId, {
      onMensagem: (nova) => setMessages((atual) => inserir(atual, nova, meuId)),
      onApagada: (id) => setMessages((atual) => marcarApagada(atual, id)),
      onDigitando: (userId, ativo) =>
        setDigitando((atual) => {
          if (!ativo) {
            const { [userId]: _, ...resto } = atual;
            return resto;
          }
          return { ...atual, [userId]: Date.now() + TYPING_TTL_MS };
        }),
      onConectado: setConectado,
    });

    return () => {
      conexao.current?.desconectar();
      conexao.current = null;
    };
  }, [roomId, meuId]);

  /**
   * Só busca quando o socket está fora. Com ele de pé, a mensagem chega sozinha
   * e uma busca periódica seria trabalho puro.
   */
  useEffect(() => {
    if (conectado) return;
    const id = setInterval(() => void buscar(), FALLBACK_MS);
    return () => clearInterval(id);
  }, [conectado, buscar]);

  /**
   * Um tique de um segundo só quando há alguém digitando.
   *
   * O "está digitando" vence sozinho: se o socket de quem digitava cair sem
   * avisar, o aviso tem que sumir. Sem este tique o componente não teria motivo
   * para redesenhar e o texto ficaria congelado na tela.
   */
  const alguemDigitando = Object.keys(digitando).length > 0;
  useEffect(() => {
    if (!alguemDigitando) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [alguemDigitando]);

  useEffect(() => {
    if (!roomId) return;
    void getMyRooms()
      .then((rooms) => setRoomName(rooms.find((room) => room.id === roomId)?.name ?? ''))
      .catch(() => {});
  }, [roomId]);

  /** Quem ainda está digitando agora, sem mim e sem os vencidos. */
  const digitandoAgora = useMemo(
    () => Object.entries(digitando)
      .filter(([id, vence]) => vence > agora && id !== meuId)
      .map(([id]) => id),
    [digitando, agora, meuId],
  );

  const nomeDe = useCallback((userId: string) => {
    const dele = messages.find((m) => m.user_id === userId);
    return dele ? autorDaMensagem(dele).nome : '';
  }, [messages]);

  const avisoDeDigitacao = useMemo(() => {
    if (digitandoAgora.length === 0) return null;
    const nomes = digitandoAgora.map(nomeDe).filter(Boolean);
    // Sem nome conhecido — quem digita ainda não falou nesta sala — o aviso
    // vira impessoal em vez de sumir: a informação útil é que ALGUÉM digita.
    if (nomes.length === 0) return t('rooms.someoneTyping');
    if (nomes.length === 1) return t('rooms.oneTyping', { name: nomes[0] });
    return t('rooms.manyTyping', { count: nomes.length });
  }, [digitandoAgora, nomeDe, t]);

  // ─── Envio ───
  const entregar = useCallback(async (conteudo: string, bolha: MensagemNaTela) => {
    if (!roomId || !meuId) return;
    try {
      const real = await sendChatMessage(roomId, meuId, conteudo);
      setMessages((atual) => confirmar(atual, bolha.id, real as MensagemNaTela));
    } catch {
      // Nunca `Alert.alert`: a bolha fica na tela, apagada, com um ↻ — e com o
      // texto, que é o que não pode se perder.
      setMessages((atual) => marcarFalha(atual, bolha.id));
    }
  }, [roomId, meuId]);

  const onSend = useCallback(() => {
    const conteudo = inputText.trim();
    if (!conteudo || !roomId || !meuId) return;

    setInputText('');
    setInputHeight(MIN_INPUT_HEIGHT);
    conexao.current?.digitando(false);

    // A bolha entra ANTES da ida ao servidor. É isto que faz o chat parecer
    // instantâneo mesmo numa rede ruim — o texto nunca fica preso no campo
    // esperando resposta.
    const bolha = bolhaOtimista(conteudo, meuId, roomId);
    setMessages((atual) => inserir(atual, bolha, meuId));
    void entregar(conteudo, bolha);
  }, [entregar, inputText, meuId, roomId]);

  const reenviar = useCallback((bolha: MensagemNaTela) => {
    setMessages((atual) => atual.map((m) =>
      m.id === bolha.id ? { ...m, falhou: false, pendente: true } : m,
    ));
    void entregar(bolha.content, bolha);
  }, [entregar]);

  const aoDigitar = useCallback((texto: string) => {
    setInputText(texto);
    // Reenviado a cada 1,5s enquanto se digita, e não a cada tecla: o TTL do
    // aviso é de 4s, então um ping por tecla seria dezenas de eventos para
    // dizer a mesma coisa.
    const agoraMs = Date.now();
    if (texto.length > 0 && agoraMs - ultimoPing.current > TYPING_PING_MS) {
      ultimoPing.current = agoraMs;
      conexao.current?.digitando(true);
    }
    if (texto.length === 0) conexao.current?.digitando(false);
  }, []);

  const hora = useCallback((iso: string) => new Date(iso).toLocaleTimeString(i18n.language, {
    hour: '2-digit', minute: '2-digit',
  }), [i18n.language]);

  const rotulosDeDia = useMemo(() => ({
    hoje: t('rooms.today'),
    ontem: t('rooms.yesterday'),
    formatarData: (iso: string) => new Date(iso).toLocaleDateString(i18n.language, {
      day: 'numeric', month: 'long',
    }),
  }), [i18n.language, t]);

  const renderMessage = useCallback(({ item, index }: { item: MensagemNaTela; index: number }) => {
    // `index + 1` é a mensagem ANTERIOR no tempo, porque a lista é invertida.
    const anterior = messages[index + 1];
    const separador = abreDia(item, anterior) ? rotuloDoDia(item.created_at, rotulosDeDia) : null;

    if (item.message_type === 'system') {
      return (
        <View>
          {separador ? <Text style={styles.diaSeparador}>{separador}</Text> : null}
          <Text style={styles.stamp}>{item.content}</Text>
        </View>
      );
    }

    const abreBloco = !anterior
      || new Date(item.created_at).getTime() - new Date(anterior.created_at).getTime() > TIME_BLOCK_MS;
    const mine = item.user_id === meuId;
    const { nome: author, avatar, selo } = autorDaMensagem(item);
    const apagada = Boolean(item.deleted_at);

    return (
      <View>
        {separador ? <Text style={styles.diaSeparador}>{separador}</Text> : null}
        {abreBloco && !separador ? <Text style={styles.stamp}>{hora(item.created_at)}</Text> : null}

        <Press
          haptic={false}
          scale={1}
          // Só nas mensagens dos outros, e só nas vivas: denunciar a própria
          // fala, ou uma lápide sem texto, não leva a lugar nenhum.
          onLongPress={mine || apagada ? undefined : () => setDenunciando(item)}
          style={[styles.row, mine ? styles.rowMine : styles.rowOther, item.falhou && styles.rowFailed]}
        >
          {!mine ? <View style={styles.avatar}><Avatar uri={avatar} name={author} size={28} /></View> : null}
          <View style={styles.column}>
            {!mine && author ? (
              <View style={styles.autorLinha}>
                <Text style={styles.author}>{author}</Text>
                {/* Só nas mensagens dos outros: o selo responde "quem é essa
                    pessoa?", e ninguém precisa disso sobre si mesmo. */}
                <SeloVerificado selo={selo} size={12} />
              </View>
            ) : null}
            <View style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleOther,
              apagada && styles.bubbleApagada,
              // A bolha pendente é a mesma, um pouco apagada: trocar a cor faria
              // a mensagem "piscar" de aparência ao ser confirmada.
              item.pendente && styles.bubblePendente,
            ]}>
              {apagada ? (
                <Text style={styles.textoApagado}>{t('rooms.messageDeleted')}</Text>
              ) : (
                <Text style={mine ? styles.textMine : styles.textOther}>{item.content}</Text>
              )}
            </View>
          </View>
          {item.falhou ? (
            <Press onPress={() => reenviar(item)} style={styles.retry}>
              <RotateCcw size={16} color={c.danger} />
            </Press>
          ) : null}
        </Press>
      </View>
    );
  }, [c.danger, hora, meuId, messages, reenviar, rotulosDeDia, styles, t]);

  const canSend = inputText.trim().length > 0;

  const header = (
    <View style={styles.header}>
      <Press onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={c.fg} /></Press>
      <Text style={styles.headerTitle} numberOfLines={1}>{roomName}</Text>
      <View style={styles.back} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
        <RoomTabBar roomId={roomId!} challengeId={challengeId || null} active="chat" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FolhaDeDenuncia
          visivel={denunciando !== null}
          alvo="chat_message"
          alvoId={denunciando?.id ?? ''}
          autorId={denunciando?.user_id}
          autorNome={denunciando ? autorDaMensagem(denunciando).nome : undefined}
          aoFechar={() => setDenunciando(null)}
          // Some da lista na hora: o servidor já parou de mandar as mensagens
          // de quem foi bloqueado, e deixar as antigas na tela contradiz isso.
          aoConcluir={() => setMessages((atuais) =>
            denunciando ? atuais.filter((m) => m.user_id !== denunciando.user_id) : atuais,
          )}
        />
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.emptyBlock}>
              <Mascot state="wave" size={120} animate={false} />
              <Text style={styles.emptyTitle}>{t('rooms.chatEmpty')}</Text>
              <Text style={styles.emptyBody}>{t('rooms.chatEmptySubtitle')}</Text>
            </View>
          )}
        />

        {/* Fica ACIMA da barra de composição e fora da lista: dentro dela, numa
            `inverted`, o aviso apareceria de cabeça para baixo e rolaria junto
            com a conversa. */}
        {avisoDeDigitacao ? (
          <View style={styles.digitando}>
            <TypingDots color={c.fgMuted} />
            <Text style={styles.digitandoTexto}>{avisoDeDigitacao}</Text>
          </View>
        ) : null}

        {/* Só quando a busca falhou. A queda do socket sozinha não vira aviso:
            o fallback de 10s assume, a conversa continua andando, e alarmar
            seria mentir sobre o que o usuário perde. */}
        {falhou ? (
          <View style={styles.offline}>
            <Text style={styles.offlineText}>{t('rooms.chatOffline')}</Text>
          </View>
        ) : null}

        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { height: inputHeight }]}
              value={inputText}
              onChangeText={aoDigitar}
              placeholder={t('rooms.chatPlaceholder')}
              placeholderTextColor={c.fgSubtle}
              multiline
              maxLength={2000}
              onContentSizeChange={(e) => setInputHeight(
                Math.min(Math.max(e.nativeEvent.contentSize.height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT),
              )}
              blurOnSubmit={false}
            />
          </View>
          <Press onPress={onSend} disabled={!canSend} style={[styles.send, !canSend && styles.sendDisabled]}>
            <Send size={18} color={c.fgOnAccent} />
          </Press>
        </View>
      </KeyboardAvoidingView>
      <RoomTabBar roomId={roomId!} challengeId={challengeId || null} active="chat" />
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.bodyStrong, color: c.fg, flex: 1, textAlign: 'center' },
  list: { paddingHorizontal: space.lg, paddingVertical: space.sm, flexGrow: 1 },
  stamp: { ...text.caption, color: c.fgMuted, textAlign: 'center', height: 32, lineHeight: 32 },
  // O separador de dia pesa mais que o carimbo de hora: ele divide a conversa,
  // e o de hora só a pontua.
  diaSeparador: { ...text.caption, color: c.fgMuted, fontWeight: '600', textAlign: 'center', marginVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginVertical: 3 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  rowFailed: { opacity: 0.4 },
  avatar: { alignSelf: 'flex-end' },
  column: { maxWidth: '78%' },
  // A linha do autor virou `row` por causa do selo; a margem que era do texto
  // passou para ela, senão o selo empurra a bolha para baixo.
  autorLinha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  author: { ...text.caption, color: c.fgMuted },
  bubble: { minHeight: 34, paddingVertical: space.sm, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: 'center' },
  bubbleMine: { backgroundColor: c.accent },
  bubbleOther: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  bubblePendente: { opacity: 0.6 },
  // A lápide não usa a cor da marca: ela não é mais uma fala, é a ausência de uma.
  bubbleApagada: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  textMine: { ...text.body, color: c.fgOnAccent },
  textOther: { ...text.body, color: c.fg },
  textoApagado: { ...text.body, color: c.fgMuted, fontStyle: 'italic' },
  retry: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  emptyBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scaleY: -1 }] },
  emptyTitle: { ...text.title2, color: c.fg, textAlign: 'center', marginTop: space.lg },
  emptyBody: { ...text.body, color: c.fgMuted, textAlign: 'center', marginTop: space.sm },
  digitando: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xs },
  digitandoTexto: { ...text.caption, color: c.fgMuted },
  offline: { paddingHorizontal: space.lg, paddingVertical: space.xs, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  offlineText: { ...text.caption, color: c.fgMuted, textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
  inputWrapper: { flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.lg, justifyContent: 'center' },
  input: { ...text.body, color: c.fg, maxHeight: MAX_INPUT_HEIGHT, textAlignVertical: 'center' },
  send: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
});
