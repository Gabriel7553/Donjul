import { pad, todayStr, diffDays, weekStartStr, dayOfWeek, addMinutes } from './date';

export const SUBJECTS_DEFAULT: Record<string, any> = {
  spanish: { name: 'Spanish', icon: 'languages', accent: '#B8460E', tools: 'Duolingo + Babbel + Input', description: '', trackingMode: 'time', target: 95, weeklyDays: 6, deadline: '2026-12-31', countTotal: null, archived: false, deletedAt: null },
  guitar: { name: 'Guitar', icon: 'music', accent: '#4A6741', tools: 'Simply Guitar', description: '', trackingMode: 'time', target: 30, weeklyDays: 5, deadline: '2026-12-31', countTotal: null, archived: false, deletedAt: null },
  cysa: { name: 'CySA+', icon: 'shield', accent: '#3B5C6B', tools: 'Jason Dion · Udemy', description: '', trackingMode: 'time', target: 45, weeklyDays: 7, deadline: '2026-06-16', countTotal: null, courseHours: 36, archived: false, deletedAt: null },
  running: { name: 'Running', icon: 'activity', accent: '#8E4585', tools: 'Easy pace, 25-30 min', description: '', trackingMode: 'time', target: 28, weeklyDays: 3, deadline: '2026-12-31', countTotal: null, archived: false, deletedAt: null },
};

// Flexible subject model: fill in safe defaults for older saved subjects.
export function normalizeSubject(s: any) {
  return {
    trackingMode: 'time',
    description: '',
    tools: '',
    target: 30,
    weeklyDays: 5,
    deadline: null,
    countTotal: null,
    courseHours: null,
    archived: false,
    deletedAt: null,
    ...s,
  };
}
export function subjectGoalKind(s: any): 'deadline' | 'count' | 'none' {
  if (s.countTotal) return 'count';
  if (s.deadline) return 'deadline';
  return 'none';
}
// Sunday-based week start, matching the app's existing Sunday rest/review convention.
export function doneThisWeek(subjectKey: string, checkins: any) {
  const ws = weekStartStr();
  const list: string[] = checkins?.[subjectKey] || [];
  return list.filter((d) => d >= ws).length;
}
export function doneTotal(subjectKey: string, checkins: any) {
  return (checkins?.[subjectKey] || []).length;
}

export function projectedDate(subjectKey: string, settings: any, totals: any, daily: any) {
  const s = settings.subjects[subjectKey];
  if (!s || !s.deadline) return null;
  // `totals` already includes today's logged minutes, so don't add daily.completed again.
  const totalDone = totals[subjectKey] || 0;
  const target = targetTotalByDeadline(subjectKey, settings);
  const daysElapsed = Math.max(1, diffDays(todayStr(), settings.startDate) + 1);
  const avgPerDay = totalDone / daysElapsed;
  if (avgPerDay <= 0) return { deadline: s.deadline, projected: null, onTime: null };
  const remaining = Math.max(0, target - totalDone);
  const daysNeeded = Math.ceil(remaining / avgPerDay);
  const projDate = new Date(todayStr() + 'T00:00:00');
  projDate.setDate(projDate.getDate() + daysNeeded);
  const proj = `${projDate.getFullYear()}-${pad(projDate.getMonth() + 1)}-${pad(projDate.getDate())}`;
  return { deadline: s.deadline, projected: proj, onTime: proj <= s.deadline };
}

export const CATCHUP_SPREAD_OPTIONS = [
  { value: 'deadline', label: 'To deadline', desc: 'spread evenly across all remaining days' },
  { value: 'tomorrow', label: 'Tomorrow', desc: 'catch up everything tomorrow' },
  { value: '2d', label: '2 days', desc: 'split over the next 2 days' },
  { value: '3d', label: '3 days', desc: 'split over the next 3 days' },
  { value: 'week', label: 'This week', desc: 'spread over remaining days this week' },
  { value: '14d', label: '14 days', desc: 'spread over the next 2 weeks' },
];

export function getRequiredDailyMins(k: string, settings: any, totals: any, daily: any): number {
  const s = settings.subjects[k];
  if (!s || !s.deadline) return s?.target || 0;
  // `totals` already includes today's logged minutes, so don't add daily.completed again.
  const totalDone = totals[k] || 0;
  const target = s.courseHours ? s.courseHours * 60 : targetTotalByDeadline(k, settings);
  const remaining = Math.max(0, target - totalDone);
  const daysLeft = Math.max(1, diffDays(s.deadline, todayStr()));
  // Spread remaining work over the STUDY days left (weeklyDays-aware), not raw calendar
  // days — otherwise a 3×/week subject's daily target is badly understated.
  const studyDaysLeft = Math.max(1, Math.round(daysLeft * ((s.weeklyDays || 7) / 7)));

  const spreadSetting = settings.catchupSpread ?? 'deadline';

  if (spreadSetting === 'deadline') {
    // Current behaviour: remaining content ÷ study days left (optimal gradual spread)
    return Math.ceil(remaining / studyDaysLeft);
  }

  // Windowed catch-up: keep base pace, sprint the deficit over a smaller window
  const base = s.target || 0;
  const elapsed = Math.max(1, diffDays(todayStr(), settings.startDate));
  const expectedByNow = Math.round(elapsed * base * ((s.weeklyDays || 7) / 7));
  const deficit = Math.max(0, expectedByNow - totalDone);

  let spreadWindow: number;
  if (spreadSetting === 'tomorrow') spreadWindow = 1;
  else if (spreadSetting === '2d') spreadWindow = 2;
  else if (spreadSetting === '3d') spreadWindow = 3;
  else if (spreadSetting === 'week') spreadWindow = Math.max(1, daysLeftInWeek());
  else if (spreadSetting === '14d') spreadWindow = 14;
  else spreadWindow = daysLeft;

  const catchWindow = Math.min(Math.max(1, spreadWindow), daysLeft);
  const catchupTarget = base + Math.ceil(deficit / catchWindow);
  // Must still finish all content by deadline, so take the larger of the two
  const minRequired = Math.ceil(remaining / studyDaysLeft);
  return Math.max(catchupTarget, minRequired);
}

export function daysLeftInWeek(): number {
  const d = new Date(todayStr() + 'T00:00:00');
  return 7 - d.getDay(); // days from today through Saturday (inclusive)
}

// Minutes you "should" have logged by the END of today — counts today, and caps at
// the deadline so it equals targetTotalByDeadline on the final day (it previously
// fell one day short of 100%, which skewed every on-pace readout).
export function expectedTotal(subjectKey: string, settings: any) {
  const s = settings.subjects[subjectKey];
  if (!s) return 0;
  if (s.courseHours && s.deadline) {
    const totalMins = s.courseHours * 60;
    const totalDays = Math.max(1, diffDays(s.deadline, settings.startDate) + 1);
    const elapsedDays = Math.max(1, Math.min(totalDays, diffDays(todayStr(), settings.startDate) + 1));
    return Math.round((elapsedDays / totalDays) * totalMins);
  }
  let days = diffDays(todayStr(), settings.startDate) + 1;
  if (s.deadline) days = Math.min(days, diffDays(s.deadline, settings.startDate) + 1);
  return Math.round(Math.max(1, days) * s.target * (s.weeklyDays / 7));
}
export function targetTotalByDeadline(subjectKey: string, settings: any) {
  const s = settings.subjects[subjectKey];
  if (!s || !s.deadline) return 0;
  if (s.courseHours) return Math.round(s.courseHours * 60);
  const totalDays = Math.max(1, diffDays(s.deadline, settings.startDate) + 1);
  return Math.round(totalDays * s.target * (s.weeklyDays / 7));
}

export function buildSchedule(settings: any, daily: any, subjectKeys: string[], checkins: any = {}, totals: any = {}) {
  if (!daily?.scheduleStartTime) return [];
  const breakMin = settings.blockBreakMin ?? 15;
  let cursor = daily.scheduleStartTime;
  const blocks: any[] = [];
  const dow = dayOfWeek();
  const skipped: string[] = daily.skippedToday || [];
  const order = ['cysa', 'running', 'spanish', 'guitar']
    .filter(k => subjectKeys.includes(k))
    .concat(subjectKeys.filter(k => !['cysa', 'running', 'spanish', 'guitar'].includes(k)));

  for (const k of order) {
    const s = settings.subjects[k];
    if (!s || s.archived || s.deletedAt) continue;
    if (s.trackingMode === 'checkoff') continue;
    if (doneThisWeek(k, checkins) >= (s.weeklyDays || 7)) continue;
    if (skipped.includes(k)) continue;
    const isRest = (s.weeklyDays < 7) && (dow === 0);
    if (isRest) continue;

    // For deadline-based subjects, use the dynamically required daily minutes.
    const baseTarget = s.target || 0;
    const reqTarget = s.deadline ? getRequiredDailyMins(k, settings, totals, daily) : baseTarget;
    const effectiveTarget = Math.max(baseTarget, reqTarget);
    const extraMins = effectiveTarget - baseTarget;
    const remaining = Math.max(0, effectiveTarget - (daily.completed[k] || 0));
    if (remaining <= 0) continue;

    const catchNote = extraMins > 0 ? `+${extraMins}m catch-up` : undefined;

    if (k === 'spanish' && remaining >= 60) {
      const segments = splitSpanish(remaining);
      blocks.push({ subject: k, start: cursor, mins: segments[0], note: 'Duolingo' });
      cursor = addMinutes(cursor, segments[0] + breakMin);
      const secondStart = addMinutes(cursor, 75);
      blocks.push({ subject: k, start: secondStart, mins: segments[1], note: 'Babbel' });
      cursor = addMinutes(secondStart, segments[1] + breakMin);
      const thirdStart = addMinutes(cursor, 60);
      blocks.push({ subject: k, start: thirdStart, mins: segments[2], note: 'Input · Dreaming/Easy Spanish' });
      cursor = addMinutes(thirdStart, segments[2] + breakMin);
    } else if (k === 'spanish') {
      blocks.push({ subject: k, start: cursor, mins: remaining });
      cursor = addMinutes(cursor, remaining + breakMin);
    } else if (k === 'guitar') {
      blocks.push({ subject: k, start: '19:00', mins: remaining, note: catchNote });
    } else if (k === 'running') {
      blocks.push({ subject: k, start: cursor, mins: remaining, note: ['Easy pace', catchNote].filter(Boolean).join(' · ') });
      cursor = addMinutes(cursor, remaining + breakMin);
    } else {
      blocks.push({ subject: k, start: cursor, mins: remaining, note: catchNote });
      cursor = addMinutes(cursor, remaining + breakMin);
    }
  }
  return blocks;
}

export function splitSpanish(total: number) {
  const duo = Math.round(total * 0.42);
  const babbel = Math.round(total * 0.37);
  const input = total - duo - babbel;
  return [duo, babbel, input];
}
