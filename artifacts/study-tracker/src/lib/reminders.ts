// Lightweight, offline reminders. Notifications fire while the app is open
// (foreground or a live background tab) — there is no push server, so this
// can't wake a fully-closed app, especially on iOS. Times are local "HH:MM".

export type Reminder = { id: string; label: string; time: string; enabled: boolean };

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'meals', label: 'Log your meals', time: '12:30', enabled: true },
  { id: 'water', label: 'Drink some water', time: '15:00', enabled: true },
  { id: 'study', label: 'Time to study', time: '18:00', enabled: true },
  { id: 'weigh', label: 'Weigh-in / measurements', time: '08:00', enabled: false },
];

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

// Per-day fired tracking so a reminder fires at most once a day even across
// reloads. Stored directly in localStorage (sync) and pruned to today.
const FIRED_KEY = 'st:reminderFired';

export function alreadyFired(key: string): boolean {
  try {
    return !!JSON.parse(localStorage.getItem(FIRED_KEY) || '{}')[key];
  } catch {
    return false;
  }
}

export function markFired(key: string, today: string) {
  let map: Record<string, number> = {};
  try { map = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); } catch { map = {}; }
  // Drop entries from earlier days, then record this one.
  const pruned: Record<string, number> = {};
  for (const k of Object.keys(map)) if (k.startsWith(today + ':')) pruned[k] = map[k];
  pruned[key] = 1;
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(pruned)); } catch { /* quota — ignore */ }
}

export function fireDueReminders(list: Reminder[], nowHHMM: string, today: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  for (const r of list || []) {
    if (!r.enabled || r.time !== nowHHMM) continue;
    const key = `${today}:${r.id}`;
    if (alreadyFired(key)) continue;
    try { new Notification('Donjul', { body: r.label, tag: r.id }); } catch { /* ignore */ }
    markFired(key, today);
  }
}
