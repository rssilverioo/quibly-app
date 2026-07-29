import { describe, it, expect } from 'vitest';
import { calculateScore, calculateLockInScore, generateProofCheckSchedule } from './scoring';
import { SCORING } from './constants';

describe('calculateScore', () => {
  it('awards nothing for a zero-length, zero-cycle session', () => {
    const result = calculateScore({
      durationMinutes: 0,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 0,
      currentStreakDays: 0,
    });

    expect(result.participationSP).toBe(0);
    expect(result.baseSP).toBe(0);
    expect(result.totalSP).toBe(0);
    expect(result.xpEarned).toBe(0);
  });

  it('pays participation SP only once at least one pomodoro cycle completed', () => {
    const noCycles = calculateScore({
      durationMinutes: 30,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 0,
      currentStreakDays: 0,
    });
    expect(noCycles.participationSP).toBe(0);

    const oneCycle = calculateScore({
      durationMinutes: 30,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 1,
      currentStreakDays: 0,
    });
    expect(oneCycle.participationSP).toBe(SCORING.PARTICIPATION_SP);
  });

  it('base SP is 1 per full minute, floored', () => {
    const result = calculateScore({
      durationMinutes: 42.9,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 0,
      currentStreakDays: 0,
    });
    expect(result.baseSP).toBe(42);
  });

  it('applies the proof mode bonus (+30% of base) independent of verification', () => {
    const result = calculateScore({
      durationMinutes: 60,
      proofModeEnabled: true,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 0,
      currentStreakDays: 0,
    });
    expect(result.baseSP).toBe(60);
    expect(result.proofModeBonus).toBe(18); // floor(60 * 0.3)
    expect(result.proofVerifiedBonus).toBe(0); // not verified
  });

  it('applies the proof verified bonus (+50% of base) only when all checks passed', () => {
    const result = calculateScore({
      durationMinutes: 60,
      proofModeEnabled: true,
      allProofChecksPassed: true,
      pomodorosCyclesCompleted: 0,
      currentStreakDays: 0,
    });
    expect(result.proofVerifiedBonus).toBe(30); // floor(60 * 0.5)
  });

  it('never applies the verified bonus when proof mode itself is off, even if allProofChecksPassed is true', () => {
    const result = calculateScore({
      durationMinutes: 60,
      proofModeEnabled: false,
      allProofChecksPassed: true,
      pomodorosCyclesCompleted: 0,
      currentStreakDays: 0,
    });
    expect(result.proofModeBonus).toBe(0);
    expect(result.proofVerifiedBonus).toBe(0);
  });

  it('pays a flat bonus per completed pomodoro cycle', () => {
    const result = calculateScore({
      durationMinutes: 0,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 3,
      currentStreakDays: 0,
    });
    expect(result.pomodoroBonus).toBe(3 * SCORING.POMODORO_CYCLE_BONUS);
  });

  it('computes the streak multiplier at +5%/day on the running subtotal', () => {
    const result = calculateScore({
      durationMinutes: 60,
      proofModeEnabled: true,
      allProofChecksPassed: true,
      pomodorosCyclesCompleted: 2,
      currentStreakDays: 10,
    });

    // subtotal = participation(5) + base(60) + proofMode(18) + proofVerified(30) + pomodoro(10) = 123
    const subtotal = 5 + 60 + 18 + 30 + 10;
    expect(result.baseSP + result.participationSP + result.proofModeBonus + result.proofVerifiedBonus + result.pomodoroBonus).toBe(subtotal);

    // multiplier = 1 + 10*5% = 1.5 -> streakBonus = floor(123 * 0.5) = 61
    expect(result.streakBonus).toBe(61);
    // 10-day streak crosses the 5-day and 10-day milestones -> highest is 25
    expect(result.streakMilestoneBonus).toBe(25);
    expect(result.totalSP).toBe(subtotal + 61 + 25);
  });

  describe('streak multiplier cap', () => {
    it('caps the multiplier at 2x starting exactly at the day count that reaches it', () => {
      // multiplier reaches 2.0 exactly at streak day 20: 1 + 20*0.05 = 2.0
      const atCap = calculateScore({
        durationMinutes: 100,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 0,
        currentStreakDays: 20,
      });
      // subtotal = 100, multiplier = 2.0 -> streakBonus = floor(100 * 1.0) = 100
      expect(atCap.streakBonus).toBe(100);
    });

    it('does not exceed the 2x cap for streaks longer than the cap threshold', () => {
      const wayOverCap = calculateScore({
        durationMinutes: 100,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 0,
        currentStreakDays: 400,
      });
      // Uncapped multiplier would be 1 + 400*0.05 = 21x; must clamp to 2x same as the 20-day case.
      expect(wayOverCap.streakBonus).toBe(100);
    });

    it('is strictly below the cap for a streak one day short of it', () => {
      const belowCap = calculateScore({
        durationMinutes: 100,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 0,
        currentStreakDays: 19,
      });
      // multiplier = 1 + 19*0.05 = 1.95 -> streakBonus = floor(100 * 0.95) = 95
      expect(belowCap.streakBonus).toBe(95);
    });
  });

  describe('streak milestone bonus', () => {
    it('awards no milestone bonus below the first threshold', () => {
      const result = calculateScore({
        durationMinutes: 0,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 0,
        currentStreakDays: 4,
      });
      expect(result.streakMilestoneBonus).toBe(0);
    });

    it('awards only the highest tier reached, not the sum of all tiers crossed', () => {
      const result = calculateScore({
        durationMinutes: 0,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 0,
        currentStreakDays: 30,
      });
      // Crosses 5, 10, 20 and 30-day milestones (10+25+50+100 if summed) — only the
      // 30-day flat bonus (100) should apply.
      expect(result.streakMilestoneBonus).toBe(100);
    });
  });

  describe('hardcore mode early exit penalty', () => {
    it('applies no penalty outside hardcore mode, even when ended early', () => {
      const easy = calculateScore({
        durationMinutes: 60,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 1,
        currentStreakDays: 0,
        leagueMode: 'easy',
        endedEarly: true,
      });
      expect(easy.earlyExitPenalty).toBe(0);

      const competitive = calculateScore({
        durationMinutes: 60,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 1,
        currentStreakDays: 0,
        leagueMode: 'competitive',
        endedEarly: true,
      });
      expect(competitive.earlyExitPenalty).toBe(0);
    });

    it('applies no penalty in hardcore mode when the session was not ended early', () => {
      const result = calculateScore({
        durationMinutes: 60,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 1,
        currentStreakDays: 0,
        leagueMode: 'hardcore',
        endedEarly: false,
      });
      expect(result.earlyExitPenalty).toBe(0);
    });

    it('deducts 25% of the pre-penalty total in hardcore mode when ended early', () => {
      const result = calculateScore({
        durationMinutes: 60,
        proofModeEnabled: false,
        allProofChecksPassed: false,
        pomodorosCyclesCompleted: 1,
        currentStreakDays: 0,
        leagueMode: 'hardcore',
        endedEarly: true,
      });
      // subtotal = participation(5) + base(60) + pomodoro(5) = 70, streak/milestone = 0
      const preDeduction = 5 + 60 + 5;
      expect(result.earlyExitPenalty).toBe(Math.floor(preDeduction * 0.25));
      expect(result.totalSP).toBe(preDeduction - result.earlyExitPenalty);
    });
  });

  it('derives XP as totalSP * SP_TO_XP_MULTIPLIER', () => {
    const result = calculateScore({
      durationMinutes: 60,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 1,
      currentStreakDays: 0,
    });
    expect(result.xpEarned).toBe(result.totalSP * 5);
  });

  it('never returns a negative total SP', () => {
    const result = calculateScore({
      durationMinutes: 0,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 0,
      currentStreakDays: 0,
      leagueMode: 'hardcore',
      endedEarly: true,
    });
    expect(result.totalSP).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateLockInScore', () => {
  it('returns 0 for a user with no history', () => {
    expect(calculateLockInScore(0, 0, 0, 0)).toBe(0);
  });

  it('caps at 100 even when every input is maxed out beyond targets', () => {
    const score = calculateLockInScore(1000, 1000, 1000, 1000);
    expect(score).toBe(100);
  });

  it('is monotonic: more consistency, more verified ratio, or more streak never lowers the score', () => {
    const base = calculateLockInScore(5, 2, 10, 3);
    const moreConsistency = calculateLockInScore(10, 2, 10, 3);
    const moreVerified = calculateLockInScore(5, 5, 10, 3);
    const moreStreak = calculateLockInScore(5, 2, 10, 10);

    expect(moreConsistency).toBeGreaterThanOrEqual(base);
    expect(moreVerified).toBeGreaterThanOrEqual(base);
    expect(moreStreak).toBeGreaterThanOrEqual(base);
  });
});

describe('generateProofCheckSchedule', () => {
  it('returns no checks when the window is too short or none are requested', () => {
    expect(generateProofCheckSchedule(8, 2)).toEqual([]); // window (5..3) is inverted
    expect(generateProofCheckSchedule(60, 0)).toEqual([]);
  });

  it('returns the requested number of checks, sorted, within the session window', () => {
    for (let i = 0; i < 25; i++) {
      const checks = generateProofCheckSchedule(60, 3);
      expect(checks).toHaveLength(3);
      expect(checks).toEqual([...checks].sort((a, b) => a - b));
      for (const offset of checks) {
        expect(offset).toBeGreaterThanOrEqual(5); // MIN_DELAY_MINUTES
        expect(offset).toBeLessThanOrEqual(55); // 60 - END_BUFFER_MINUTES
      }
    }
  });
});
