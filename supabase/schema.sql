-- ╔══════════════════════════════════════════════════════════════╗
-- ║                    QUIBLY DATABASE SCHEMA                    ║
-- ║              "Gymrats for Studying" - Full MVP               ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────────

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  lock_in_score INTEGER NOT NULL DEFAULT 0,
  verified_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_study_minutes INTEGER NOT NULL DEFAULT 0,
  last_study_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_profiles_handle ON profiles(handle);
CREATE INDEX idx_profiles_level ON profiles(level DESC);
CREATE INDEX idx_profiles_total_xp ON profiles(total_xp DESC);

-- ─── SUBJECTS ───────────────────────────────────────────────────

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7C5CFC',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_subjects_user ON subjects(user_id);

-- ─── STUDY SESSIONS ────────────────────────────────────────────

CREATE TYPE timer_mode AS ENUM ('pomodoro', 'deep_focus', 'custom');
CREATE TYPE session_status AS ENUM ('active', 'paused', 'completed', 'abandoned');

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  league_id UUID, -- FK added after leagues table
  timer_mode timer_mode NOT NULL DEFAULT 'pomodoro',
  work_duration INTEGER NOT NULL DEFAULT 25,
  break_duration INTEGER NOT NULL DEFAULT 5,
  proof_mode BOOLEAN NOT NULL DEFAULT false,
  status session_status NOT NULL DEFAULT 'active',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_duration_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  pomodoro_cycles_completed INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_sessions_user_date ON study_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_league ON study_sessions(league_id) WHERE league_id IS NOT NULL;
CREATE INDEX idx_sessions_status ON study_sessions(status) WHERE status = 'active';

-- ─── PROOF CHECKS ──────────────────────────────────────────────

CREATE TYPE proof_check_status AS ENUM ('pending', 'passed', 'failed', 'missed');

CREATE TABLE proof_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  photo_url TEXT,
  status proof_check_status NOT NULL DEFAULT 'pending',
  deadline_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proof_checks_session ON proof_checks(session_id);
CREATE INDEX idx_proof_checks_status ON proof_checks(status) WHERE status = 'pending';

-- ─── LEAGUES ───────────────────────────────────────────────────

CREATE TYPE league_privacy AS ENUM ('public', 'private');
CREATE TYPE league_mode AS ENUM ('easy', 'competitive', 'hardcore');
CREATE TYPE league_status AS ENUM ('upcoming', 'active', 'completed');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  privacy league_privacy NOT NULL DEFAULT 'private',
  mode league_mode NOT NULL DEFAULT 'competitive',
  status league_status NOT NULL DEFAULT 'upcoming',
  invite_code TEXT NOT NULL UNIQUE,
  max_members INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX idx_leagues_invite_code ON leagues(invite_code);
CREATE INDEX idx_leagues_status ON leagues(status);
CREATE INDEX idx_leagues_owner ON leagues(owner_id);

-- Add FK from study_sessions to leagues
ALTER TABLE study_sessions
  ADD CONSTRAINT fk_sessions_league
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;

-- ─── LEAGUE MEMBERS ────────────────────────────────────────────

CREATE TABLE league_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  total_sp INTEGER NOT NULL DEFAULT 0,
  weekly_sp INTEGER NOT NULL DEFAULT 0,
  monthly_sp INTEGER NOT NULL DEFAULT 0,
  verified_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE INDEX idx_league_members_league ON league_members(league_id);
CREATE INDEX idx_league_members_user ON league_members(user_id);
CREATE INDEX idx_league_members_leaderboard ON league_members(league_id, total_sp DESC);

-- ─── FEED POSTS ────────────────────────────────────────────────

CREATE TABLE feed_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  show_proof_photo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_posts_league ON feed_posts(league_id, created_at DESC);

-- ─── FEED REACTIONS ────────────────────────────────────────────

CREATE TABLE feed_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('🔥', '🧠', '💀', '👑', '⚡')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id, emoji)
);

CREATE INDEX idx_feed_reactions_post ON feed_reactions(post_id);

-- ─── FEED COMMENTS ─────────────────────────────────────────────

CREATE TABLE feed_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_comments_post ON feed_comments(post_id, created_at ASC);

-- ─── LEAGUE CHAT MESSAGES ──────────────────────────────────────

CREATE TYPE chat_message_type AS ENUM ('text', 'system');

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  message_type chat_message_type NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_league ON chat_messages(league_id, created_at DESC);

-- ─── CHAT REACTIONS ────────────────────────────────────────────

CREATE TABLE chat_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_chat_reactions_message ON chat_reactions(message_id);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║                     ROW LEVEL SECURITY                       ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read any profile, update own
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Subjects: users manage their own
CREATE POLICY "Users can view own subjects"
  ON subjects FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subjects"
  ON subjects FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subjects"
  ON subjects FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subjects"
  ON subjects FOR DELETE USING (auth.uid() = user_id);

-- Sessions: users manage own, league members can view league sessions
CREATE POLICY "Users can view own sessions"
  ON study_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view league member sessions"
  ON study_sessions FOR SELECT USING (
    league_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = study_sessions.league_id
      AND league_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own sessions"
  ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Proof checks: users manage own
CREATE POLICY "Users can view own proof checks"
  ON proof_checks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own proof checks"
  ON proof_checks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own proof checks"
  ON proof_checks FOR UPDATE USING (auth.uid() = user_id);

-- Leagues: public viewable, members can see private
CREATE POLICY "Public leagues are viewable"
  ON leagues FOR SELECT USING (privacy = 'public');

CREATE POLICY "League members can view private leagues"
  ON leagues FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = leagues.id
      AND league_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create leagues"
  ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "League owners can update"
  ON leagues FOR UPDATE USING (auth.uid() = owner_id);

-- League members
CREATE POLICY "League members can view members"
  ON league_members FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members lm
      WHERE lm.league_id = league_members.league_id
      AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join leagues"
  ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave leagues"
  ON league_members FOR DELETE USING (auth.uid() = user_id);

-- Feed posts: league members can view/create
CREATE POLICY "League members can view feed"
  ON feed_posts FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = feed_posts.league_id
      AND league_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create feed posts"
  ON feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Feed reactions
CREATE POLICY "League members can view reactions"
  ON feed_reactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feed_posts fp
      JOIN league_members lm ON lm.league_id = fp.league_id
      WHERE fp.id = feed_reactions.post_id
      AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can react"
  ON feed_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON feed_reactions FOR DELETE USING (auth.uid() = user_id);

-- Feed comments
CREATE POLICY "League members can view comments"
  ON feed_comments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feed_posts fp
      JOIN league_members lm ON lm.league_id = fp.league_id
      WHERE fp.id = feed_comments.post_id
      AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can comment"
  ON feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON feed_comments FOR DELETE USING (auth.uid() = user_id);

-- Chat messages: league members
CREATE POLICY "League members can view chat"
  ON chat_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = chat_messages.league_id
      AND league_members.user_id = auth.uid()
    )
  );

CREATE POLICY "League members can send messages"
  ON chat_messages FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = chat_messages.league_id
      AND league_members.user_id = auth.uid()
    )
  );

-- Chat reactions
CREATE POLICY "League members can view chat reactions"
  ON chat_reactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      JOIN league_members lm ON lm.league_id = cm.league_id
      WHERE cm.id = chat_reactions.message_id
      AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can react to chat"
  ON chat_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own chat reactions"
  ON chat_reactions FOR DELETE USING (auth.uid() = user_id);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║                       STORAGE BUCKETS                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Proof photos bucket (private by default)
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-photos', 'proof-photos', false);

-- Avatar images bucket (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for proof photos
CREATE POLICY "Users can upload own proof photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'proof-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own proof photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'proof-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ╔══════════════════════════════════════════════════════════════╗
-- ║                    DATABASE FUNCTIONS                         ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Function: Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, username, handle)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'handle', 'user_' || substr(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: Update league status based on dates
CREATE OR REPLACE FUNCTION update_league_statuses()
RETURNS void AS $$
BEGIN
  UPDATE leagues SET status = 'active'
  WHERE status = 'upcoming' AND start_date <= CURRENT_DATE;

  UPDATE leagues SET status = 'completed'
  WHERE status = 'active' AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function: Reset weekly SP (call via cron)
CREATE OR REPLACE FUNCTION reset_weekly_sp()
RETURNS void AS $$
BEGIN
  UPDATE league_members SET weekly_sp = 0;
END;
$$ LANGUAGE plpgsql;

-- Function: Reset monthly SP (call via cron)
CREATE OR REPLACE FUNCTION reset_monthly_sp()
RETURNS void AS $$
BEGIN
  UPDATE league_members SET monthly_sp = 0;
END;
$$ LANGUAGE plpgsql;

-- Function: Get leaderboard for a league
CREATE OR REPLACE FUNCTION get_league_leaderboard(
  p_league_id UUID,
  p_period TEXT DEFAULT 'all_time'
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  handle TEXT,
  avatar_url TEXT,
  total_sp INTEGER,
  verified_hours NUMERIC,
  level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY
      CASE p_period
        WHEN 'weekly' THEN lm.weekly_sp
        WHEN 'monthly' THEN lm.monthly_sp
        ELSE lm.total_sp
      END DESC
    ) AS rank,
    p.id AS user_id,
    p.username,
    p.handle,
    p.avatar_url,
    CASE p_period
      WHEN 'weekly' THEN lm.weekly_sp
      WHEN 'monthly' THEN lm.monthly_sp
      ELSE lm.total_sp
    END AS total_sp,
    lm.verified_hours,
    p.level
  FROM league_members lm
  JOIN profiles p ON p.id = lm.user_id
  WHERE lm.league_id = p_league_id
  ORDER BY total_sp DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Update user streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT last_study_date INTO v_last_date FROM profiles WHERE id = p_user_id;

  IF v_last_date IS NULL OR v_last_date < v_today - INTERVAL '1 day' THEN
    -- Streak broken or first session
    UPDATE profiles SET
      current_streak = 1,
      last_study_date = v_today,
      updated_at = NOW()
    WHERE id = p_user_id;
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    -- Continue streak
    UPDATE profiles SET
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_study_date = v_today,
      updated_at = NOW()
    WHERE id = p_user_id;
  END IF;
  -- If last_study_date = today, do nothing (already studied today)
END;
$$ LANGUAGE plpgsql;

-- Function: Insert system chat message (for leaderboard changes etc.)
CREATE OR REPLACE FUNCTION send_system_chat(
  p_league_id UUID,
  p_content TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO chat_messages (league_id, user_id, content, message_type)
  VALUES (p_league_id, NULL, p_content, 'system');
END;
$$ LANGUAGE plpgsql;
