// ─── Database Types ───

export interface Profile {
  id: string;
  email: string;
  username: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  total_xp: number;
  level: number;
  lock_in_score: number;
  verified_hours: number;
  current_streak: number;
  longest_streak: number;
  total_study_minutes: number;
  plan: Plan;
  subscription_status: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  created_at: string;
}

export type TimerMode = 'pomodoro' | 'deep_focus' | 'custom';
export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface StudySession {
  id: string;
  user_id: string;
  subject_id: string;
  league_id: string | null;
  timer_mode: TimerMode;
  work_duration: number; // minutes
  break_duration: number; // minutes
  proof_mode: boolean;
  status: SessionStatus;
  is_verified: boolean;
  started_at: string;
  ended_at: string | null;
  total_duration_minutes: number;
  pomodoro_cycles_completed: number;
  points_earned: number;
  xp_earned: number;
  created_at: string;
}

export type ProofCheckStatus = 'pending' | 'passed' | 'failed' | 'missed';

export interface ProofCheck {
  id: string;
  session_id: string;
  user_id: string;
  triggered_at: string;
  responded_at: string | null;
  photo_url: string | null;
  status: ProofCheckStatus;
  deadline_at: string;
}

export type LeaguePrivacy = 'public' | 'private';
export type LeagueMode = 'easy' | 'competitive' | 'hardcore';
export type LeagueStatus = 'upcoming' | 'active' | 'completed';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface League {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  start_date: string;
  end_date: string;
  privacy: LeaguePrivacy;
  mode: LeagueMode;
  status: LeagueStatus;
  invite_code: string;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string;
  total_sp: number;
  weekly_sp: number;
  monthly_sp: number;
  verified_hours: number;
  joined_at: string;
  // Joined data
  user?: Profile;
  profile?: Profile;
}

export type ReactionEmoji = '🔥' | '🧠' | '💀' | '👑' | '⚡';

export interface FeedPost {
  id: string;
  league_id: string;
  session_id: string;
  user_id: string;
  show_proof_photo: boolean;
  created_at: string;
  // Joined data
  profile?: Profile;
  session?: StudySession;
  subject?: Subject;
  reactions?: FeedReaction[];
  comments?: FeedComment[];
  reaction_counts?: Record<ReactionEmoji, number>;
}

export interface FeedReaction {
  id: string;
  post_id: string;
  user_id: string;
  emoji: ReactionEmoji;
  created_at: string;
}

export interface FeedComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // Joined
  profile?: Profile;
}

export type ChatMessageType = 'text' | 'system';

export interface ChatMessage {
  id: string;
  league_id: string;
  user_id: string | null;
  content: string;
  message_type: ChatMessageType;
  created_at: string;
  // Joined
  profile?: Profile;
  reactions?: ChatReaction[];
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// ─── Plan & AI Content Types ───

export type Plan = 'FREE' | 'PRO';

export interface Document {
  id: string;
  user_id: string;
  title: string;
  subject: string | null;
  s3_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string | null;
  page_count: number | null;
  created_at: string;
}

export interface FlashcardSet {
  id: string;
  user_id: string;
  document_id: string | null;
  title: string;
  language: string;
  created_at: string;
  // Joined
  flashcards?: Flashcard[];
  _count?: { flashcards: number };
}

export interface Flashcard {
  id: string;
  set_id: string;
  front: string;
  back: string;
  explain: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface Quiz {
  id: string;
  user_id: string;
  document_id: string | null;
  title: string;
  language: string;
  score: number | null;
  total_q: number;
  created_at: string;
  // Joined
  questions?: Question[];
  _count?: { questions: number };
}

export interface Question {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_index: number;
  image_url: string | null;
  sort_order: number;
}

export interface DailyUsage {
  id: string;
  user_id: string;
  date: string;
  flashcard_sets: number;
  quizzes: number;
}

// ─── API Request/Response Types ───

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  handle: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: Profile;
}

export interface CreateSubjectRequest {
  name: string;
  color: string;
  icon?: string;
}

export interface StartSessionRequest {
  subject_id: string;
  league_id?: string;
  timer_mode: TimerMode;
  work_duration: number;
  break_duration: number;
  proof_mode: boolean;
}

export interface EndSessionRequest {
  session_id: string;
  pomodoro_cycles_completed: number;
  total_duration_minutes: number;
}

export interface SubmitProofRequest {
  proof_check_id: string;
  // photo is sent as multipart form data
}

export interface CreateLeagueRequest {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  privacy: LeaguePrivacy;
  mode: LeagueMode;
  max_members?: number;
}

export interface JoinLeagueRequest {
  invite_code: string;
}

export interface SendChatMessageRequest {
  league_id: string;
  content: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  handle: string;
  avatar_url: string | null;
  total_sp: number;
  verified_hours: number;
  level: number;
}

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

export type AchievementCategory = 'streak' | 'volume' | 'sessions' | 'proof' | 'social' | 'level';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  threshold: number;
  sort_order: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export interface LeagueEndResult {
  league: League;
  podium: LeaderboardEntry[];
  all_rankings: LeaderboardEntry[];
}
