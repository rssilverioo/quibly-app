import { api } from '../lib/api';

export interface ActiveChallenge {
  id: string;
  title: string;
  metric_unit: string;
  ends_at: string;
  participant_count: number;
  me: { rank: number | null; metric_value: number };
}

export interface RoomSummary {
  id: string;
  name: string;
  member_count: number;
  total_sp: number;
  last_post_at: string | null;
  unread_posts: number;
  active_challenge: ActiveChallenge | null;
}

export interface RoomFeedPost {
  id: string;
  created_at: string;
  author: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  };
  caption: string | null;
  photo_url: string | null;
  show_proof_photo: boolean;
  session: null | {
    id: string;
    minutes: number;
    xp_earned: number;
    is_verified: boolean;
    subject: { name: string; color: string };
  };
  challenge: null | { id: string; title: string; counted: boolean };
  reactions: Record<string, number>;
  user_reactions: string[];
  comment_count: number;
}

export interface RoomFeedPage {
  items: RoomFeedPost[];
  total: number;
  page: number;
  limit: number;
}

export const getMyRooms = (): Promise<RoomSummary[]> => api.get('/rooms');

export const getRoomFeed = (roomId: string): Promise<RoomFeedPage> =>
  api.get(`/rooms/${roomId}/feed?page=1&limit=20`);

export interface PostPhotoFile {
  uri: string;
  name: string;
  type: string;
}

export function createRoomPost(roomId: string, photo: PostPhotoFile, caption: string) {
  const formData = new FormData();
  formData.append('photo', photo as any);
  if (caption.trim()) formData.append('caption', caption.trim());
  return api.upload<RoomFeedPost>(`/rooms/${roomId}/posts`, formData);
}
