// ─── Scoring Constants ───

export const SCORING = {
  /** 1 minute = 1 Study Point */
  SP_PER_MINUTE: 1,

  /** +30% when proof mode is enabled */
  PROOF_MODE_MULTIPLIER: 1.3,

  /** +50% when all proof checks pass */
  PROOF_VERIFIED_MULTIPLIER: 1.5,

  /** Bonus SP per completed pomodoro cycle */
  POMODORO_CYCLE_BONUS: 5,

  /** +5% per streak day */
  STREAK_BONUS_PERCENT: 5,

  /** Max streak multiplier cap */
  MAX_STREAK_MULTIPLIER: 2.0,

  /** Hardcore mode: penalty for ending session early (% of earned SP) */
  EARLY_EXIT_PENALTY_PERCENT: 25,

  /** Flat SP just for starting a session (showing up) */
  PARTICIPATION_SP: 5,

  /** Minimum study minutes in a calendar day to count toward streak */
  MIN_DAILY_MINUTES: 25,

  /** Streak milestone flat bonuses: [minDays, bonusSP] */
  STREAK_MILESTONES: [
    { minDays: 5, bonus: 10 },
    { minDays: 10, bonus: 25 },
    { minDays: 20, bonus: 50 },
    { minDays: 30, bonus: 100 },
  ] as readonly { minDays: number; bonus: number }[],
} as const;

// ─── XP & Levels ───

export const XP = {
  /** XP = totalSP * SP_TO_XP_MULTIPLIER */
  SP_TO_XP_MULTIPLIER: 5,

  /** XP needed for level N = BASE * N^EXPONENT */
  LEVEL_BASE: 100,
  LEVEL_EXPONENT: 1.5,
} as const;

export function xpForLevel(level: number): number {
  return Math.floor(XP.LEVEL_BASE * Math.pow(level, XP.LEVEL_EXPONENT));
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  let xpNeeded = xpForLevel(level + 1);
  while (totalXp >= xpNeeded) {
    level++;
    xpNeeded = xpForLevel(level + 1);
  }
  return level;
}

// ─── Usage Limits ───

export const USAGE_LIMITS = {
  FREE: { flashcard_sets: 3, quizzes: 3 },
  PRO: { flashcard_sets: Infinity, quizzes: Infinity },
} as const;

// ─── XP Rewards (AI Content) ───

export const XP_REWARDS = {
  flashcard_review: 10,
  quiz_correct: 20,
  quiz_wrong: 5,
} as const;

// ─── Timer Presets ───

export const TIMER_PRESETS = {
  pomodoro: { work: 25, break: 5, label: "Pomodoro" },
  deep_focus: { work: 50, break: 10, label: "Deep Focus" },
} as const;

// ─── Proof Check Rules ───

export const PROOF_CHECK = {
  /** Min minutes before first check can trigger */
  MIN_DELAY_MINUTES: 5,

  /** Min minutes before session end (no checks in last N minutes) */
  END_BUFFER_MINUTES: 5,

  /** Max seconds to respond to a proof check */
  RESPONSE_DEADLINE_SECONDS: 120,

  /** Min checks per session */
  MIN_CHECKS: 1,

  /** Max checks per session */
  MAX_CHECKS: 3,

  /** Sessions shorter than this (minutes) get MIN_CHECKS */
  SHORT_SESSION_THRESHOLD: 30,

  /** Sessions longer than this (minutes) get MAX_CHECKS */
  LONG_SESSION_THRESHOLD: 90,
} as const;

/**
 * Calculate number of proof checks based on session duration
 */
export function proofChecksForDuration(durationMinutes: number): number {
  if (durationMinutes < PROOF_CHECK.SHORT_SESSION_THRESHOLD) {
    return PROOF_CHECK.MIN_CHECKS;
  }
  if (durationMinutes >= PROOF_CHECK.LONG_SESSION_THRESHOLD) {
    return PROOF_CHECK.MAX_CHECKS;
  }
  return 2;
}

// ─── Lock-In Score ───

export const LOCK_IN = {
  /** Weight: consistency (study frequency) */
  CONSISTENCY_WEIGHT: 0.4,

  /** Weight: verified session ratio */
  VERIFIED_WEIGHT: 0.4,

  /** Weight: streak length */
  STREAK_WEIGHT: 0.2,

  /** Max streak days for full score */
  MAX_STREAK_DAYS: 30,

  /** Min sessions in last 30 days for full consistency */
  TARGET_SESSIONS_30D: 20,
} as const;

// ─── Reactions ───

export const REACTION_EMOJIS = ["🔥", "🧠", "💀", "👑", "⚡"] as const;

// ─── League Defaults ───

export const LEAGUE_DEFAULTS = {
  MAX_MEMBERS: 50,
  INVITE_CODE_LENGTH: 8,
} as const;

// ─── App URLs ───

export const APP_URLS = {
  /** Base URL for invite links (update after deploying web app) */
  WEB_BASE: "https://tryquibly.com",
  /** Deep link scheme */
  DEEP_LINK_SCHEME: "quibly",
} as const;

export function inviteUrl(inviteCode: string): string {
  return `${APP_URLS.WEB_BASE}/join/${inviteCode}`;
}

// ─── Colors (Dark Theme) ───

export const COLORS = {
  background: "#0A0A0F",
  surface: "#141420",
  surfaceLight: "#1E1E2E",
  border: "#2A2A3E",
  primary: "#1E40AF",
  primaryLight: "#2B53D8",
  secondary: "#00D4AA",
  accent: "#FF6B6B",
  warning: "#FFB84D",
  success: "#00D4AA",
  error: "#FF4757",
  text: "#FFFFFF",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",

  // Rank colors
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
} as const;

// ─── Achievements ───

export const ACHIEVEMENTS = [
  // Streaks
  {
    id: "streak_3",
    name: "Getting Started",
    description: "3-day study streak",
    icon: "Flame",
    category: "streak" as const,
    threshold: 3,
    sortOrder: 1,
  },
  {
    id: "streak_7",
    name: "On Fire",
    description: "7-day study streak",
    icon: "Flame",
    category: "streak" as const,
    threshold: 7,
    sortOrder: 2,
  },
  {
    id: "streak_14",
    name: "Unstoppable",
    description: "14-day study streak",
    icon: "Flame",
    category: "streak" as const,
    threshold: 14,
    sortOrder: 3,
  },
  {
    id: "streak_30",
    name: "Lock In Legend",
    description: "30-day study streak",
    icon: "Crown",
    category: "streak" as const,
    threshold: 30,
    sortOrder: 4,
  },

  // Volume (total study minutes)
  {
    id: "hours_1",
    name: "First Hour",
    description: "Study for 1 hour total",
    icon: "Clock",
    category: "volume" as const,
    threshold: 60,
    sortOrder: 5,
  },
  {
    id: "hours_10",
    name: "Grinder",
    description: "Study for 10 hours total",
    icon: "Clock",
    category: "volume" as const,
    threshold: 600,
    sortOrder: 6,
  },
  {
    id: "hours_50",
    name: "Scholar",
    description: "Study for 50 hours total",
    icon: "GraduationCap",
    category: "volume" as const,
    threshold: 3000,
    sortOrder: 7,
  },
  {
    id: "hours_100",
    name: "Centurion",
    description: "Study for 100 hours total",
    icon: "GraduationCap",
    category: "volume" as const,
    threshold: 6000,
    sortOrder: 8,
  },
  {
    id: "hours_500",
    name: "No Life",
    description: "Study for 500 hours total",
    icon: "Skull",
    category: "volume" as const,
    threshold: 30000,
    sortOrder: 9,
  },

  // Sessions completed
  {
    id: "sessions_1",
    name: "Baby Steps",
    description: "Complete your first session",
    icon: "BookOpen",
    category: "sessions" as const,
    threshold: 1,
    sortOrder: 10,
  },
  {
    id: "sessions_10",
    name: "Consistent",
    description: "Complete 10 sessions",
    icon: "BookOpen",
    category: "sessions" as const,
    threshold: 10,
    sortOrder: 11,
  },
  {
    id: "sessions_50",
    name: "Dedicated",
    description: "Complete 50 sessions",
    icon: "Target",
    category: "sessions" as const,
    threshold: 50,
    sortOrder: 12,
  },
  {
    id: "sessions_100",
    name: "Machine",
    description: "Complete 100 sessions",
    icon: "Zap",
    category: "sessions" as const,
    threshold: 100,
    sortOrder: 13,
  },

  // Proof mode
  {
    id: "verified_1",
    name: "Nothing to Hide",
    description: "Complete 1 verified session",
    icon: "ShieldCheck",
    category: "proof" as const,
    threshold: 1,
    sortOrder: 14,
  },
  {
    id: "verified_10",
    name: "Trustworthy",
    description: "Complete 10 verified sessions",
    icon: "ShieldCheck",
    category: "proof" as const,
    threshold: 10,
    sortOrder: 15,
  },
  {
    id: "verified_50",
    name: "Proof Master",
    description: "Complete 50 verified sessions",
    icon: "Shield",
    category: "proof" as const,
    threshold: 50,
    sortOrder: 16,
  },

  // Social
  {
    id: "league_join",
    name: "Team Player",
    description: "Join your first league",
    icon: "Users",
    category: "social" as const,
    threshold: 1,
    sortOrder: 17,
  },
  {
    id: "league_create",
    name: "Leader",
    description: "Create a league",
    icon: "Crown",
    category: "social" as const,
    threshold: 1,
    sortOrder: 18,
  },

  // Levels
  {
    id: "level_5",
    name: "Rising Star",
    description: "Reach level 5",
    icon: "Star",
    category: "level" as const,
    threshold: 5,
    sortOrder: 19,
  },
  {
    id: "level_10",
    name: "Veteran",
    description: "Reach level 10",
    icon: "Star",
    category: "level" as const,
    threshold: 10,
    sortOrder: 20,
  },
  {
    id: "level_25",
    name: "Elite",
    description: "Reach level 25",
    icon: "Award",
    category: "level" as const,
    threshold: 25,
    sortOrder: 21,
  },
];

// ─── Dynamic Titles ───

export interface TitleDefinition {
  id: string;
  color: string;
}

interface TitleInput {
  current_streak: number;
  level: number;
  total_study_minutes: number;
  lock_in_score: number;
  verified_hours: number;
}

const TITLE_RULES: Array<TitleDefinition & { condition: (p: TitleInput & { totalHours: number }) => boolean }> = [
  { id: 'legend',      color: '#FFD700', condition: (p) => p.current_streak >= 30 && p.level >= 25 },
  { id: 'elite',       color: '#FFD700', condition: (p) => p.level >= 25 },
  { id: 'unstoppable', color: '#FF6B6B', condition: (p) => p.current_streak >= 14 },
  { id: 'machine',     color: '#00D4AA', condition: (p) => p.totalHours >= 100 },
  { id: 'locked_in',   color: '#1E40AF', condition: (p) => p.lock_in_score >= 80 },
  { id: 'dedicated',   color: '#2B53D8', condition: (p) => p.totalHours >= 50 },
  { id: 'consistent',  color: '#00D4AA', condition: (p) => p.current_streak >= 7 },
  { id: 'trustworthy', color: '#00D4AA', condition: (p) => p.verified_hours >= 10 },
  { id: 'grinder',     color: '#FFB84D', condition: (p) => p.totalHours >= 10 },
  { id: 'student',     color: '#9CA3AF', condition: (p) => p.totalHours >= 1 },
  { id: 'rookie',      color: '#6B7280', condition: () => true },
];

export function calculateTitle(profile: TitleInput): TitleDefinition {
  const totalHours = Math.floor(profile.total_study_minutes / 60);
  const enriched = { ...profile, totalHours };
  for (const rule of TITLE_RULES) {
    if (rule.condition(enriched)) {
      return { id: rule.id, color: rule.color };
    }
  }
  return { id: 'rookie', color: '#6B7280' };
}

// ─── Typography ───

export const FONTS = {
  bold: "Inter_700Bold",
  semiBold: "Inter_600SemiBold",
  medium: "Inter_500Medium",
  regular: "Inter_400Regular",
} as const;
