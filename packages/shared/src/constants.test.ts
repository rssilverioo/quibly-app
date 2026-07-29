import { describe, it, expect } from 'vitest';
import {
  xpForLevel,
  levelFromXp,
  calculateTitle,
  proofChecksForDuration,
  PROOF_CHECK,
} from './constants';

describe('xpForLevel / levelFromXp round trip', () => {
  it('levelFromXp(0) is level 1 (the floor)', () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it('recovers the exact level for the XP threshold of every level from 1 to 60', () => {
    for (let level = 1; level <= 60; level++) {
      const xp = xpForLevel(level);
      expect(levelFromXp(xp)).toBe(level);
    }
  });

  it('is exactly one level lower just below a level threshold', () => {
    for (let level = 2; level <= 60; level++) {
      const xp = xpForLevel(level);
      expect(levelFromXp(xp - 1)).toBe(level - 1);
    }
  });

  it('levelFromXp never decreases as XP increases (monotonic)', () => {
    let previousLevel = levelFromXp(0);
    for (let xp = 0; xp <= 50000; xp += 137) {
      const level = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(previousLevel);
      previousLevel = level;
    }
  });
});

describe('calculateTitle', () => {
  const base = {
    current_streak: 0,
    level: 1,
    total_study_minutes: 0,
    lock_in_score: 0,
    verified_hours: 0,
  };

  it('defaults to rookie for a brand-new profile', () => {
    expect(calculateTitle(base).id).toBe('rookie');
  });

  it('picks student once the user crosses 1 hour of study, before any other rule fires', () => {
    expect(calculateTitle({ ...base, total_study_minutes: 60 }).id).toBe('student');
  });

  it('rule order: legend beats elite when both conditions are true', () => {
    const profile = { ...base, current_streak: 30, level: 25 };
    // Both `legend` (streak>=30 && level>=25) and `elite` (level>=25) match;
    // legend is listed first and must win.
    expect(calculateTitle(profile).id).toBe('legend');
  });

  it('falls back to elite when only the level condition is met, not the streak', () => {
    const profile = { ...base, current_streak: 5, level: 25 };
    expect(calculateTitle(profile).id).toBe('elite');
  });

  it('rule order: unstoppable (streak>=14) is checked before machine (hours>=100)', () => {
    const profile = { ...base, current_streak: 14, total_study_minutes: 100 * 60 };
    expect(calculateTitle(profile).id).toBe('unstoppable');
  });

  it('rule order: dedicated (hours>=50) is checked before consistent (streak>=7) and trustworthy (verified>=10)', () => {
    const profile = {
      ...base,
      total_study_minutes: 50 * 60,
      current_streak: 7,
      verified_hours: 10,
      lock_in_score: 50, // below locked_in's 80 threshold so it doesn't preempt dedicated
    };
    expect(calculateTitle(profile).id).toBe('dedicated');
  });

  it('rule order: locked_in (lockInScore>=80) is checked before dedicated (hours>=50)', () => {
    const profile = { ...base, lock_in_score: 80, total_study_minutes: 50 * 60 };
    expect(calculateTitle(profile).id).toBe('locked_in');
  });

  it('grinder applies at 10 hours without qualifying for any higher tier', () => {
    const profile = { ...base, total_study_minutes: 10 * 60 };
    expect(calculateTitle(profile).id).toBe('grinder');
  });
});

describe('proofChecksForDuration', () => {
  it('returns the minimum check count for sessions shorter than the short threshold', () => {
    expect(proofChecksForDuration(0)).toBe(PROOF_CHECK.MIN_CHECKS);
    expect(proofChecksForDuration(PROOF_CHECK.SHORT_SESSION_THRESHOLD - 1)).toBe(PROOF_CHECK.MIN_CHECKS);
  });

  it('returns 2 checks for sessions in the middle band', () => {
    expect(proofChecksForDuration(PROOF_CHECK.SHORT_SESSION_THRESHOLD)).toBe(2);
    expect(proofChecksForDuration(PROOF_CHECK.LONG_SESSION_THRESHOLD - 1)).toBe(2);
  });

  it('returns the maximum check count at and beyond the long threshold', () => {
    expect(proofChecksForDuration(PROOF_CHECK.LONG_SESSION_THRESHOLD)).toBe(PROOF_CHECK.MAX_CHECKS);
    expect(proofChecksForDuration(1000)).toBe(PROOF_CHECK.MAX_CHECKS);
  });
});
