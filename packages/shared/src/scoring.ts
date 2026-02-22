import { SCORING, XP, PROOF_CHECK, LOCK_IN, xpForLevel, levelFromXp } from './constants';
import type { LeagueMode, StudySession } from './types';

export interface ScoreInput {
  durationMinutes: number;
  proofModeEnabled: boolean;
  allProofChecksPassed: boolean;
  pomodorosCyclesCompleted: number;
  currentStreakDays: number;
  leagueMode?: LeagueMode;
  endedEarly?: boolean;
}

export interface ScoreResult {
  participationSP: number;
  baseSP: number;
  proofModeBonus: number;
  proofVerifiedBonus: number;
  pomodoroBonus: number;
  streakBonus: number;
  streakMilestoneBonus: number;
  earlyExitPenalty: number;
  totalSP: number;
  xpEarned: number;
}

/**
 * Calculate study points and XP earned from a session
 */
export function calculateScore(input: ScoreInput): ScoreResult {
  const {
    durationMinutes,
    proofModeEnabled,
    allProofChecksPassed,
    pomodorosCyclesCompleted,
    currentStreakDays,
    leagueMode,
    endedEarly,
  } = input;

  // Participation SP: only if at least 1 pomodoro cycle completed
  const participationSP = pomodorosCyclesCompleted > 0 ? SCORING.PARTICIPATION_SP : 0;

  // Base SP: 1 per minute of actual work
  const baseSP = Math.floor(durationMinutes) * SCORING.SP_PER_MINUTE;

  // Proof mode bonus (+30%)
  const proofModeBonus = proofModeEnabled ? Math.floor(baseSP * 0.3) : 0;

  // Proof verified bonus (+50% of base)
  const proofVerifiedBonus =
    proofModeEnabled && allProofChecksPassed ? Math.floor(baseSP * 0.5) : 0;

  // Pomodoro cycle bonus
  const pomodoroBonus = pomodorosCyclesCompleted * SCORING.POMODORO_CYCLE_BONUS;

  // Streak bonus: +5% per day, capped at 2x
  const streakMultiplier = Math.min(
    1 + (currentStreakDays * SCORING.STREAK_BONUS_PERCENT) / 100,
    SCORING.MAX_STREAK_MULTIPLIER
  );
  const subtotal = participationSP + baseSP + proofModeBonus + proofVerifiedBonus + pomodoroBonus;
  const streakBonus = Math.floor(subtotal * (streakMultiplier - 1));

  // Streak milestone bonus: flat bonus for maintaining long streaks (highest tier only)
  let streakMilestoneBonus = 0;
  for (const milestone of SCORING.STREAK_MILESTONES) {
    if (currentStreakDays >= milestone.minDays) {
      streakMilestoneBonus = milestone.bonus;
    }
  }

  // Early exit penalty (hardcore mode only)
  let earlyExitPenalty = 0;
  if (leagueMode === 'hardcore' && endedEarly) {
    earlyExitPenalty = Math.floor(
      (subtotal + streakBonus + streakMilestoneBonus) * (SCORING.EARLY_EXIT_PENALTY_PERCENT / 100)
    );
  }

  const totalSP = subtotal + streakBonus + streakMilestoneBonus - earlyExitPenalty;

  // XP calculation: derived from total SP
  const xpEarned = Math.max(0, totalSP) * XP.SP_TO_XP_MULTIPLIER;

  return {
    participationSP,
    baseSP,
    proofModeBonus,
    proofVerifiedBonus,
    pomodoroBonus,
    streakBonus,
    streakMilestoneBonus,
    earlyExitPenalty,
    totalSP: Math.max(0, totalSP),
    xpEarned,
  };
}

/**
 * Calculate Lock-In Score (0-100)
 */
export function calculateLockInScore(
  sessionsLast30Days: number,
  verifiedSessionsTotal: number,
  totalSessionsTotal: number,
  currentStreakDays: number
): number {
  // Consistency: how many days they studied in last 30
  const consistencyScore = Math.min(
    sessionsLast30Days / LOCK_IN.TARGET_SESSIONS_30D,
    1.0
  );

  // Verified ratio
  const verifiedRatio =
    totalSessionsTotal > 0 ? verifiedSessionsTotal / totalSessionsTotal : 0;

  // Streak score
  const streakScore = Math.min(
    currentStreakDays / LOCK_IN.MAX_STREAK_DAYS,
    1.0
  );

  const score =
    consistencyScore * LOCK_IN.CONSISTENCY_WEIGHT * 100 +
    verifiedRatio * LOCK_IN.VERIFIED_WEIGHT * 100 +
    streakScore * LOCK_IN.STREAK_WEIGHT * 100;

  return Math.round(Math.min(score, 100));
}

/**
 * Generate random proof check timestamps for a session.
 * Returns offsets in minutes from session start.
 */
export function generateProofCheckSchedule(
  totalDurationMinutes: number,
  numChecks: number
): number[] {
  const earliest = PROOF_CHECK.MIN_DELAY_MINUTES;
  const latest = totalDurationMinutes - PROOF_CHECK.END_BUFFER_MINUTES;

  if (latest <= earliest || numChecks === 0) return [];

  const window = latest - earliest;
  const checks: number[] = [];

  // Divide the available window into segments, then pick random time in each
  const segmentSize = window / numChecks;

  for (let i = 0; i < numChecks; i++) {
    const segStart = earliest + i * segmentSize;
    const segEnd = segStart + segmentSize;
    const randomOffset = segStart + Math.random() * (segEnd - segStart);
    checks.push(Math.round(randomOffset * 10) / 10);
  }

  return checks.sort((a, b) => a - b);
}

export { xpForLevel, levelFromXp };
