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
import type { ChatMessage } from '@quibly/shared';

import { Mascot } from '../../../components/mascot';
import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import RoomTabBar from '../../../components/rooms/RoomTabBar';
import { useAuth } from '../../../contexts/AuthContext';
import { subscribeToMessages, sendMessage as sendChatMessage } from '../../../services/chat';
import { autorDaMensagem, type ChatMessageComAutor } from '../../../lib/chat-messages';
import { getMyRooms } from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = MIN_INPUT_HEIGHT + 20 * 3;
/** Um carimbo de hora a cada bloco de conversa, não a cada bolha. */
const TIME_BLOCK_MS = 60 * 60 * 1000;

/** Mensagem que não chegou ao servidor. Fica na tela, apagada, com um ↻. */
interface FailedMessage {
  localId: string;
  content: string;
}

export default function RoomChatScreen() {
  const { t, i18n } = useTranslation('common');
  const { id: roomId, challengeId } = useLocalSearchParams<{ id: string; challengeId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [messages, setMessages] = useState<ChatMessageComAutor[]>([]);
  const [failed, setFailed] = useState<FailedMessage[]>([]);
  const [roomName, setRoomName] = useState('');
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [loading, setLoading] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const listRef = useRef<FlatList<ChatMessageComAutor>>(null);

  useEffect(() => {
    if (!roomId) return;
    /**
     * A API já entrega da mais nova para a mais velha, que é a ordem que a
     * `FlatList inverted` quer — índice 0 desenha embaixo. O `.reverse()` que
     * havia aqui foi escrito supondo o contrário, e nunca chegou a rodar: a
     * chamada estourava antes, porque a resposta é `{ messages }` e não um
     * array. Ver `lib/chat-messages.ts`.
     */
    const unsubscribe = subscribeToMessages(
      roomId,
      (all) => {
        setMessages(all);
        setFalhou(false);
        setLoading(false);
      },
      (erro) => {
        // O spinner tem que acabar mesmo quando dá errado. Sem isto o chat fica
        // carregando para sempre, que é como ele estava.
        console.warn('[chat] não deu para carregar as mensagens', erro);
        setFalhou(true);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    void getMyRooms()
      .then((rooms) => setRoomName(rooms.find((room) => room.id === roomId)?.name ?? ''))
      .catch(() => {});
  }, [roomId]);

  const deliver = useCallback(async (content: string, localId?: string) => {
    if (!roomId || !user) return;
    try {
      await sendChatMessage(roomId, user.uid, content);
      if (localId) setFailed((current) => current.filter((item) => item.localId !== localId));
    } catch {
      // Nunca `Alert.alert`: a bolha fica na tela, apagada, com um ↻.
      setFailed((current) => localId
        ? current
        : [...current, { localId: `local:${Date.now()}`, content }]);
    }
  }, [roomId, user]);

  const onSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    setInputHeight(MIN_INPUT_HEIGHT);
    void deliver(trimmed);
  }, [deliver, inputText]);

  const timeStamp = useCallback((iso: string) => new Date(iso).toLocaleTimeString(i18n.language, {
    hour: '2-digit', minute: '2-digit',
  }), [i18n.language]);

  const renderMessage = useCallback(({ item, index }: { item: ChatMessageComAutor; index: number }) => {
    if (item.message_type === 'system') {
      return <Text style={styles.stamp}>{item.content}</Text>;
    }

    // `index + 1` é a mensagem ANTERIOR no tempo, porque a lista é invertida.
    const previous = messages[index + 1];
    const startsBlock = !previous
      || new Date(item.created_at).getTime() - new Date(previous.created_at).getTime() > TIME_BLOCK_MS;
    const mine = item.user_id === user?.uid;
    // O autor vem em `user`, não em `profile` — os dois casts que havia aqui
    // liam campos que a resposta nunca teve, e o nome saía sempre vazio.
    const { nome: author, avatar } = autorDaMensagem(item);

    return (
      <View>
        {startsBlock ? <Text style={styles.stamp}>{timeStamp(item.created_at)}</Text> : null}
        <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
          {/* Avatar alinhado ao PÉ da bolha, como na referência. */}
          {!mine ? <View style={styles.avatar}><Avatar uri={avatar} name={author} size={28} /></View> : null}
          <View style={styles.column}>
            {/* A referência repete o nome em toda bolha, mesmo em sequência. */}
            {!mine && author ? <Text style={styles.author}>{author}</Text> : null}
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={mine ? styles.textMine : styles.textOther}>{item.content}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }, [messages, styles, timeStamp, user?.uid]);

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

        {/* Sem isto, uma busca que falha desenha a tela de "nenhuma mensagem
            ainda" — o chat afirmaria que a sala está vazia quando na verdade
            não conseguiu perguntar. O `subscribeToMessages` continua tentando a
            cada 3s, então o aviso some sozinho quando a rede voltar; não há
            botão de repetir porque não há nada para o dedo acelerar. */}
        {falhou ? (
          <View style={styles.offline}>
            <Text style={styles.offlineText}>{t('rooms.chatOffline')}</Text>
          </View>
        ) : null}

        {/* As que não chegaram vivem fora da lista invertida, logo acima da
            barra de composição: são as mais novas e a lista não as conhece. */}
        {failed.map((item) => (
          <View key={item.localId} style={[styles.row, styles.rowMine, styles.rowFailed, styles.failedRow]}>
            <View style={[styles.bubble, styles.bubbleMine]}>
              <Text style={styles.textMine}>{item.content}</Text>
            </View>
            <Press onPress={() => void deliver(item.content, item.localId)} style={styles.retry}>
              <RotateCcw size={16} color={c.danger} />
            </Press>
          </View>
        ))}

        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { height: inputHeight }]}
              value={inputText}
              onChangeText={setInputText}
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginVertical: 3 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  rowFailed: { opacity: 0.4 },
  failedRow: { paddingHorizontal: space.lg },
  avatar: { alignSelf: 'flex-end' },
  column: { maxWidth: '78%' },
  author: { ...text.caption, color: c.fgMuted, marginBottom: 4 },
  // 34 com uma linha, +20 por linha extra — o `minHeight` mais o padding
  // vertical produzem os dois números sozinhos. REF 33,4 / 52,8.
  bubble: { minHeight: 34, paddingVertical: space.sm, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: 'center' },
  bubbleMine: { backgroundColor: c.accent },
  bubbleOther: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  textMine: { ...text.body, color: c.fgOnAccent },
  textOther: { ...text.body, color: c.fg },
  retry: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  // Faixa fina acima da barra de composição, e não um bloco no meio da conversa:
  // é um estado da conexão, não uma mensagem.
  offline: { paddingHorizontal: space.lg, paddingVertical: space.xs, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  offlineText: { ...text.caption, color: c.fgMuted, textAlign: 'center' },
  emptyBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scaleY: -1 }] },
  emptyTitle: { ...text.title2, color: c.fg, textAlign: 'center', marginTop: space.lg },
  emptyBody: { ...text.body, color: c.fgMuted, textAlign: 'center', marginTop: space.sm },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
  inputWrapper: { flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.lg, justifyContent: 'center' },
  input: { ...text.body, color: c.fg, maxHeight: MAX_INPUT_HEIGHT, textAlignVertical: 'center' },
  send: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
});
