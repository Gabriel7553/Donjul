import { pushKey as syncPushKey } from '../sync';

// localStorage-backed persistence keys.
export const K = {
  settings: 'st:settings',
  daily: 'st:daily',
  totals: 'st:totals',
  body: 'st:body',
  workout: 'st:workout',
  meals: 'st:meals',
  plans: 'st:plans',
  streaks: 'st:streaks',
  weeklyReview: 'st:weeklyReview',
  journal: 'st:journal',
  challengeHistory: 'st:challengeHistory',
  busyPresets: 'st:busyPresets',
  activity: 'st:activity',
  checkins: 'st:checkins',
  backups: 'st:backups',
  achievements: 'st:achievements',
  spending: 'st:spending',
  tax: 'st:tax',
  customChallenges: 'st:customChallenges',
  water: 'st:water',
  exercise: 'st:exercise',
};

// Keys included in a full data snapshot (for auto-backup + export/restore).
export const BACKUP_KEYS = ['settings', 'totals', 'body', 'workout', 'meals', 'plans', 'streaks', 'journal', 'challengeHistory', 'busyPresets', 'activity', 'checkins', 'spending', 'tax', 'customChallenges', 'water', 'exercise'] as const;
export const MAX_BACKUPS = 10;

export async function safeGet(key: string, fallback: any): Promise<any> {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
}
export async function safeSet(key: string, value: any): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    syncPushKey(key, value);
  } catch (e) {
    console.error(e);
  }
}

// Capture all data into a single timestamped backup; keep the most recent MAX_BACKUPS.
export async function createBackup(): Promise<void> {
  try {
    const data: Record<string, any> = {};
    for (const name of BACKUP_KEYS) {
      const raw = localStorage.getItem((K as any)[name]);
      if (raw != null) data[name] = JSON.parse(raw);
    }
    if (Object.keys(data).length === 0) return;
    const list = await safeGet(K.backups, []);
    const next = [{ ts: Date.now(), data }, ...list].slice(0, MAX_BACKUPS);
    await safeSet(K.backups, next);
  } catch (e) {
    console.error(e);
  }
}
