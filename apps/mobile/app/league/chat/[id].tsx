import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@quibly/shared/constants';
import { legacyColors as COLORS } from '../../../theme';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { subscribeToMessages, sendMessage as sendChatMessage } from '../../../services/chat';
import type { ChatMessage } from '@quibly/shared';

// ─── Constants ───

const MAX_INPUT_LINES = 4;
const INPUT_LINE_HEIGHT = 20;
const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = MIN_INPUT_HEIGHT + INPUT_LINE_HEIGHT * (MAX_INPUT_LINES - 1);

// ─── Helpers ───

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Components ───

function Avatar({ uri, name, size = 32 }: { uri: string | null; name: string | null; size?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarFallbackText, { fontSize: size * 0.38 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <View style={styles.systemMessageContainer}>
      <View style={styles.systemDivider} />
      <Text style={styles.systemMessageText}>{message.content}</Text>
      <View style={styles.systemDivider} />
    </View>
  );
}

function MessageBubble({
  message,
  isMine,
}: {
  message: ChatMessage;
  isMine: boolean;
}) {
  return (
    <View style={[styles.messageRow, isMine ? styles.messageRowRight : styles.messageRowLeft]}>
      {/* Avatar for other users */}
      {!isMine && (
        <View style={styles.messageAvatarContainer}>
          <Avatar uri={(message as any).avatar_url} name={(message as any).username} size={28} />
        </View>
      )}

      <View style={[styles.messageBubbleWrapper, isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
        {/* Username for other users */}
        {!isMine && (
          <Text style={styles.messageUsername}>{(message as any).username ?? 'Unknown'}</Text>
        )}

        {/* Message bubble */}
        <View style={[styles.messageBubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
            {message.content}
          </Text>
          <Text style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeOther]}>
            {formatTimestamp(message.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ───

export default function LeagueChatScreen() {
  const { t } = useTranslation('leagues');
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [isLoading, setIsLoading] = useState(true);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // ─── Real-time subscription ───

  useEffect(() => {
    if (!leagueId) return;

    const unsubscribe = subscribeToMessages(leagueId, (allMessages) => {
      // Messages come in ascending order, reverse for inverted FlatList
      setMessages([...allMessages].reverse());
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [leagueId]);

  // ─── Send message ───

  const handleSendMessage = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !leagueId || !user) return;

    // Clear input immediately
    setInputText('');
    setInputHeight(MIN_INPUT_HEIGHT);

    try {
      await sendChatMessage(leagueId, user.uid, trimmed);
    } catch {
      // Message will not appear since real-time subscription handles it
    }
  }, [inputText, leagueId, user]);

  // ─── Input handling ───

  const handleContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const newHeight = Math.min(
        Math.max(e.nativeEvent.contentSize.height, MIN_INPUT_HEIGHT),
        MAX_INPUT_HEIGHT
      );
      setInputHeight(newHeight);
    },
    []
  );

  // ─── Render ───

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.message_type === 'system') {
        return <SystemMessage message={item} />;
      }

      const isMine = item.user_id === user?.uid;

      return (
        <MessageBubble
          message={item}
          isMine={isMine}
        />
      );
    },
    [user?.uid]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('noMessages')}</Text>
        <Text style={styles.emptySubtext}>{t('noMessagesSub')}</Text>
      </View>
    );
  }, [isLoading]);

  const canSend = inputText.trim().length > 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('chatTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('chatTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          inverted
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          ListEmptyComponent={ListEmptyComponent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInput, { height: inputHeight }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={2000}
              onContentSizeChange={handleContentSizeChange}
              onSubmitEditing={handleSendMessage}
              blurOnSubmit={false}
              returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Send size={18} color={canSend ? COLORS.text : COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 28,
    fontFamily: FONTS.medium,
    marginTop: -2,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontFamily: FONTS.semiBold,
  },
  headerSpacer: {
    width: 36,
  },

  // ─── Loading ───
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Empty State ───
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    // Inverted FlatList flips this, so we need to flip text back
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    marginBottom: 4,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },

  // ─── Message List ───
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // ─── Message Row ───
  messageRow: {
    flexDirection: 'row',
    marginVertical: 3,
    paddingHorizontal: 4,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },

  // ─── Avatar ───
  messageAvatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  avatar: {
    backgroundColor: COLORS.surfaceLight,
  },
  avatarFallback: {
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.semiBold,
  },

  // ─── Bubble ───
  messageBubbleWrapper: {
    maxWidth: '75%',
  },
  bubbleWrapperLeft: {
    alignItems: 'flex-start',
  },
  bubbleWrapperRight: {
    alignItems: 'flex-end',
  },
  messageUsername: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginBottom: 2,
    marginLeft: 12,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    minWidth: 48,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  messageTextMine: {
    color: COLORS.text,
  },
  messageTextOther: {
    color: COLORS.text,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    marginTop: 3,
  },
  messageTimeMine: {
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'right',
  },
  messageTimeOther: {
    color: COLORS.textMuted,
    textAlign: 'left',
  },

  // ─── System Message ───
  systemMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
  },
  systemDivider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  systemMessageText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.medium,
    textAlign: 'center',
    flexShrink: 1,
    maxWidth: '70%',
  },

  // ─── Input Bar ───
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    justifyContent: 'center',
  },
  textInput: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: FONTS.regular,
    maxHeight: MAX_INPUT_HEIGHT,
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  sendButtonText: {
    color: COLORS.onPrimary,
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },
  sendButtonTextDisabled: {
    color: COLORS.textMuted,
  },
});
