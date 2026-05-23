import { pad, todayStr } from './date';

export const CUSTOM_CHALLENGE_EMOJIS = ['📖','🏋️','🧘','🚴','🥗','💧','💤','✍️','🎯','🎨','🎸','🧠','🔥','⚡','🌟'];
export function getCustomStreak(ch: any): number {
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = `${yd.getFullYear()}-${pad(yd.getMonth()+1)}-${pad(yd.getDate())}`;
  const last = ch.lastActionDate;
  if (!last) return 0;
  if (last < yesterday && !(ch.restDates || []).includes(yesterday)) return 0;
  return ch.streak || 0;
}
// Advance any active custom challenges that track the given subject — call when target is hit.
export function tickChallengesForSubject(challenges: any[], subjectKey: string): any[] {
  const today = todayStr();
  const yd = new Date(today + 'T00:00:00'); yd.setDate(yd.getDate() - 1);
  const yesterday = `${yd.getFullYear()}-${pad(yd.getMonth()+1)}-${pad(yd.getDate())}`;
  return challenges.map((ch: any) => {
    if (!ch.active || ch.paused || ch.subjectKey !== subjectKey || ch.lastActionDate === today) return ch;
    const continuing = !ch.lastActionDate || ch.lastActionDate === yesterday || (ch.restDates || []).includes(yesterday);
    const streak = continuing ? (ch.streak || 0) + 1 : 1;
    return { ...ch, streak, longestStreak: Math.max(ch.longestStreak || 0, streak), lastActionDate: today };
  });
}

// Pause any active challenge whose last action was before yesterday (and yesterday wasn't a rest day).
// Returns { next, paused: [...] } where paused is the list of newly-paused challenges (for prompting).
export function pauseStaleChallenges(challenges: any[]): { next: any[]; paused: any[] } {
  const today = todayStr();
  const yd = new Date(today + 'T00:00:00'); yd.setDate(yd.getDate() - 1);
  const yesterday = `${yd.getFullYear()}-${pad(yd.getMonth()+1)}-${pad(yd.getDate())}`;
  const paused: any[] = [];
  const next = challenges.map((ch: any) => {
    if (!ch.active || ch.paused) return ch;
    if (!ch.lastActionDate) return ch; // never started — don't pause
    if (ch.lastActionDate === today || ch.lastActionDate === yesterday) return ch;
    if ((ch.restDates || []).includes(yesterday)) return ch;
    const updated = { ...ch, paused: true, pausedReason: 'missed', pausedAt: today, pausedStreak: ch.streak || 0 };
    paused.push(updated);
    return updated;
  });
  return { next, paused };
}
