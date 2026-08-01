/**
 * Ordinal suffix for a leaderboard position.
 *
 * Lived inline in `league/details/[id].tsx` while `league/challenge/[id].tsx`
 * concatenated a hardcoded "º" — so the full rankings screen read "1º" in
 * English while the preview above it read "1st". One list, two answers.
 */
export function ordinal(rank: number, locale: string): string {
  if (locale.startsWith('pt')) return `${rank}º`;
  const mod100 = rank % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th'
    : rank % 10 === 1 ? 'st'
    : rank % 10 === 2 ? 'nd'
    : rank % 10 === 3 ? 'rd'
    : 'th';
  return `${rank}${suffix}`;
}
