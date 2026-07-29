import { describe, expect, it } from 'vitest';
import {
  SESSION_MILESTONES,
  mascotForSession,
  milestoneForMinutes,
  minutesToNextMilestone,
} from './session-milestones';

describe('milestoneForMinutes', () => {
  it('starts focused', () => {
    expect(milestoneForMinutes(0).mascot).toBe('focused');
    expect(milestoneForMinutes(14).mascot).toBe('focused');
  });

  it('advances on each boundary', () => {
    expect(milestoneForMinutes(15).mascot).toBe('reading');
    expect(milestoneForMinutes(30).mascot).toBe('working');
    expect(milestoneForMinutes(45).mascot).toBe('cool');
    expect(milestoneForMinutes(60).mascot).toBe('streak');
    expect(milestoneForMinutes(90).mascot).toBe('star');
    expect(milestoneForMinutes(120).mascot).toBe('medal');
    expect(milestoneForMinutes(180).mascot).toBe('crowned');
  });

  it('is inclusive at the boundary — 15 minutes has earned the 15-minute state', () => {
    expect(milestoneForMinutes(14.99).mascot).toBe('focused');
    expect(milestoneForMinutes(15).mascot).toBe('reading');
  });

  it('stays at the top of the ladder for very long sessions', () => {
    expect(milestoneForMinutes(600).mascot).toBe('crowned');
  });

  it('never returns undefined for junk input', () => {
    expect(milestoneForMinutes(-5).mascot).toBe('focused');
    expect(milestoneForMinutes(NaN).mascot).toBe('focused');
    expect(milestoneForMinutes(Infinity).mascot).toBe('crowned');
  });

  it('is ordered descending, which is what makes the lookup correct', () => {
    const from = SESSION_MILESTONES.map((m) => m.fromMinutes);
    expect(from).toEqual([...from].sort((a, b) => b - a));
    expect(from[from.length - 1]).toBe(0);
  });
});

describe('mascotForSession', () => {
  it('shows the milestone while running', () => {
    expect(mascotForSession(95, true)).toBe('star');
  });

  it('pause wins over the milestone — two hours in and on a break looks like a break', () => {
    expect(mascotForSession(125, false)).toBe('break');
  });
});

describe('minutesToNextMilestone', () => {
  it('counts down to the next step', () => {
    expect(minutesToNextMilestone(0)).toBe(15);
    expect(minutesToNextMilestone(12)).toBe(3);
    expect(minutesToNextMilestone(47)).toBe(13);
  });

  it('is null once the ladder is topped out', () => {
    expect(minutesToNextMilestone(180)).toBeNull();
    expect(minutesToNextMilestone(400)).toBeNull();
  });

  it('reports the full gap when standing exactly on a boundary', () => {
    // At 60 the user just earned `streak`; the next one is 90.
    expect(minutesToNextMilestone(60)).toBe(30);
  });
});
