import { api } from '../lib/api';
import type { ChatMessage } from '@quibly/shared';

export async function sendMessage(
  leagueId: string,
  _userId: string,
  content: string
): Promise<ChatMessage> {
  return api.post<ChatMessage>(`/chat/${leagueId}`, { content });
}

export async function getMessages(
  leagueId: string,
  limitCount = 50
): Promise<ChatMessage[]> {
  return api.get<ChatMessage[]>(`/chat/${leagueId}?limit=${limitCount}`);
}

// Polling-based replacement for real-time Firestore listener
let pollingIntervals: Record<string, ReturnType<typeof setInterval>> = {};

export function subscribeToMessages(
  leagueId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  // Initial fetch
  getMessages(leagueId).then(callback).catch(() => {});

  // Poll every 3 seconds
  const interval = setInterval(async () => {
    try {
      const messages = await getMessages(leagueId);
      callback(messages);
    } catch {
      // Silently fail on polling errors
    }
  }, 3000);

  pollingIntervals[leagueId] = interval;

  // Return unsubscribe function
  return () => {
    clearInterval(interval);
    delete pollingIntervals[leagueId];
  };
}
