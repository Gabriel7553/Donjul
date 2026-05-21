import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sun, Home, Footprints, Check, Plus, Settings as SettingsIcon, X, Music, Languages, Shield,
  Award, Save, Calendar as CalIcon, Activity, Dumbbell, Apple, ListChecks, ChevronRight, ChevronDown, ChevronLeft,
  TrendingUp, TrendingDown, Edit3, Trash2, Flame, ArrowUp, ArrowDown, Minus, Target, BookOpen, Clock, Moon, Coffee,
  Download, Upload, History, Repeat, Zap, Play, AlertTriangle, RotateCcw, MapPin, Building2, TreePine,
  Camera, BookMarked, TrendingUp as Journal, DollarSign, ShoppingCart, Briefcase, Car, ChevronUp, Trophy, Archive, Infinity, Mic
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

function haptic(ms = 12) { try { (navigator as any).vibrate?.(ms); } catch {} }
function celebrate() {
  try { confetti({ particleCount: 90, spread: 72, origin: { y: 0.7 }, colors: ['#B8460E', '#4A6741', '#3B5C6B', '#C8932E', '#8E4585'] }); } catch {}
  haptic(25);
}

// ════════════════════════════════════════════════════════════════════════════════
// STORAGE — localStorage-backed persistence
// ════════════════════════════════════════════════════════════════════════════════
const K = {
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
};

// Keys included in a full data snapshot (for auto-backup + export/restore).
const BACKUP_KEYS = ['settings', 'totals', 'body', 'workout', 'meals', 'plans', 'streaks', 'journal', 'challengeHistory', 'busyPresets', 'activity', 'checkins'] as const;
const MAX_BACKUPS = 10;

async function safeGet(key: string, fallback: any): Promise<any> {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
}
async function safeSet(key: string, value: any): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(e);
  }
}

// Capture all data into a single timestamped backup; keep the most recent MAX_BACKUPS.
async function createBackup(): Promise<void> {
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

// ════════════════════════════════════════════════════════════════════════════════
// TIME UTILS
// ════════════════════════════════════════════════════════════════════════════════
const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const addMonth = (dateStr: string, months = 1) => { const d = new Date(dateStr + 'T00:00:00'); d.setMonth(d.getMonth() + months); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function diffDays(toDate: string, fromDate = todayStr()) {
  const a = new Date(toDate + 'T00:00:00');
  const b = new Date(fromDate + 'T00:00:00');
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor((total / 60) % 24);
  return `${pad(nh)}:${pad(total % 60)}`;
}
// Display-unit prefs, set once from settings on load so pure formatters can read them.
const APP_UNITS = { timeFormat: '12h', weight: 'lb', length: 'in', weekStart: 0 };
function setAppUnits(u: any) { if (u) Object.assign(APP_UNITS, u); }
function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (APP_UNITS.timeFormat === '24h') return `${pad(h)}:${pad(m)}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}
function fmtWeight(lb: number | null | undefined) {
  if (lb == null) return '—';
  return APP_UNITS.weight === 'kg' ? `${Math.round(lb * 0.453592 * 10) / 10}kg` : `${lb}lb`;
}
function fmtLen(inch: number | null | undefined) {
  if (inch == null) return '—';
  return APP_UNITS.length === 'cm' ? `${Math.round(inch * 2.54 * 10) / 10}cm` : `${inch}in`;
}
// Convert a canonical measurement value (lb / in) to the user's display unit and back.
function measureUnit(canonUnit: string) {
  if (canonUnit === 'lb') return APP_UNITS.weight === 'kg' ? 'kg' : 'lb';
  if (canonUnit === 'in') return APP_UNITS.length === 'cm' ? 'cm' : 'in';
  return canonUnit;
}
function toDisplayVal(canonUnit: string, v: any) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (canonUnit === 'lb' && APP_UNITS.weight === 'kg') return Math.round(n * 0.453592 * 10) / 10;
  if (canonUnit === 'in' && APP_UNITS.length === 'cm') return Math.round(n * 2.54 * 10) / 10;
  return Math.round(n * 10) / 10;
}
function fromDisplayVal(canonUnit: string, v: any) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return null;
  if (canonUnit === 'lb' && APP_UNITS.weight === 'kg') return Math.round((n / 0.453592) * 10) / 10;
  if (canonUnit === 'in' && APP_UNITS.length === 'cm') return Math.round((n / 2.54) * 10) / 10;
  return n;
}
function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtShortDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function dayOfWeek() { return new Date(todayStr() + 'T00:00:00').getDay(); }
function isSunday(dateStr = todayStr()) { return new Date(dateStr + 'T00:00:00').getDay() === 0; }
function timeToMins(hhmm: string) { const [h, m] = (hhmm || '00:00').split(':').map(Number); return h * 60 + m; }
function minsToHHMM(mins: number) { const h = Math.floor(mins / 60) % 24; const m = mins % 60; return `${pad(h)}:${pad(m)}`; }

// Sum a day's meal entries into a macro total.
function mealTotalsFromEntries(entries: any[]): any {
  return (entries || []).reduce((acc, e) => ({
    protein: acc.protein + (Number(e.protein) || 0),
    carbs: acc.carbs + (Number(e.carbs) || 0),
    fat: acc.fat + (Number(e.fat) || 0),
    calories: acc.calories + (Number(e.calories) || 0),
  }), { protein: 0, carbs: 0, fat: 0, calories: 0 });
}

// Add a meal entry to a date and keep the cached daily total in sync.
function addMealEntry(meals: any, date: string, entry: any): any {
  const entries = { ...(meals.entries || {}) };
  const dayList = [...(entries[date] || []), { id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6), time: nowHHMM(), ...entry }];
  entries[date] = dayList;
  return { ...meals, entries, log: { ...meals.log, [date]: mealTotalsFromEntries(dayList) } };
}

function removeMealEntry(meals: any, date: string, id: string): any {
  const entries = { ...(meals.entries || {}) };
  const dayList = (entries[date] || []).filter((e: any) => e.id !== id);
  entries[date] = dayList;
  return { ...meals, entries, log: { ...meals.log, [date]: mealTotalsFromEntries(dayList) } };
}

// One-time migration: turn legacy daily totals into a single editable entry.
function migrateMeals(meals: any): any {
  const m = { presets: meals.presets || [], log: meals.log || {}, entries: meals.entries || {} };
  for (const date of Object.keys(m.log)) {
    if (!m.entries[date]) {
      const t = m.log[date];
      if (t && (t.protein || t.carbs || t.fat || t.calories)) {
        m.entries[date] = [{ id: 'legacy_' + date, time: '', name: 'Logged earlier', source: '', qty: 1, ...t }];
      } else {
        m.entries[date] = [];
      }
    }
  }
  return m;
}

// Cloud sync (optional): localStorage stays the source of truth + offline cache,
// and we mirror it to the server so data survives browser/device changes.
let SYNC_AVAILABLE = false;
function snapshotData(): Record<string, any> {
  const data: Record<string, any> = {};
  for (const name of BACKUP_KEYS) {
    const raw = localStorage.getItem((K as any)[name]);
    if (raw != null) { try { data[name] = JSON.parse(raw); } catch {} }
  }
  return data;
}
// On load: pull server state; if it's newer than what we last synced, hydrate localStorage from it.
async function syncPull(): Promise<void> {
  try {
    const resp = await fetch('/api/state');
    if (resp.status === 503) { SYNC_AVAILABLE = false; return; }
    SYNC_AVAILABLE = resp.ok;
    if (!resp.ok) return;
    const { data, updatedAt } = await resp.json();
    if (!data || !updatedAt) return;
    const localTs = await safeGet('st:syncUpdatedAt', null);
    if (localTs && new Date(updatedAt) <= new Date(localTs)) return;
    for (const name of BACKUP_KEYS) {
      if (data[name] !== undefined) localStorage.setItem((K as any)[name], JSON.stringify(data[name]));
    }
    await safeSet('st:syncUpdatedAt', updatedAt);
  } catch { SYNC_AVAILABLE = false; }
}
async function syncPush(): Promise<void> {
  if (!SYNC_AVAILABLE) return;
  try {
    const resp = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: snapshotData() }) });
    if (!resp.ok) return;
    const { updatedAt } = await resp.json();
    if (updatedAt) await safeSet('st:syncUpdatedAt', updatedAt);
  } catch {}
}

// Resize an image client-side so the upload stays small but label text stays legible.
async function fileToResizedBase64(file: File, maxEdge = 1500, quality = 0.9): Promise<{ image: string; mime: string }> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  if (scale >= 1) {
    return { image: dataUrl.split(',')[1], mime: file.type || 'image/jpeg' };
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { image: dataUrl.split(',')[1], mime: file.type || 'image/jpeg' };
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/jpeg', quality);
  return { image: out.split(',')[1], mime: 'image/jpeg' };
}

function useCurrentTime() {
  const [now, setNow] = useState(nowHHMM());
  useEffect(() => {
    const id = setInterval(() => setNow(nowHHMM()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Flexible subject model: fill in safe defaults for older saved subjects.
function normalizeSubject(s: any) {
  return {
    trackingMode: 'time',
    description: '',
    tools: '',
    target: 30,
    weeklyDays: 5,
    deadline: null,
    countTotal: null,
    archived: false,
    deletedAt: null,
    ...s,
  };
}
function subjectGoalKind(s: any): 'deadline' | 'count' | 'none' {
  if (s.countTotal) return 'count';
  if (s.deadline) return 'deadline';
  return 'none';
}
// Sunday-based week start, matching the app's existing Sunday rest/review convention.
function weekStartStr(dateStr = todayStr()) {
  const d = new Date(dateStr + 'T00:00:00');
  const ws = APP_UNITS.weekStart || 0;
  d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function doneThisWeek(subjectKey: string, checkins: any) {
  const ws = weekStartStr();
  const list: string[] = checkins?.[subjectKey] || [];
  return list.filter((d) => d >= ws).length;
}
function doneTotal(subjectKey: string, checkins: any) {
  return (checkins?.[subjectKey] || []).length;
}

// Derive earned/locked achievement badges from existing data (no separate tracking needed).
function computeAchievements(totals: any, streaks: any, workout: any, body: any, meals: any) {
  const totalMins = (Object.values(totals || {}) as any[]).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
  const bestStreak = Math.max(0, ...Object.values(streaks || {}).map((s: any) => s?.longest || s?.current || 0));
  const workoutCount = Object.keys(workout?.logs || {}).length;
  const mealDays = Object.keys(meals?.log || {}).filter((d) => { const t = meals.log[d]; return t && (t.protein || t.calories); }).length;
  const bodyCount = (body?.entries || []).length;
  const defs = [
    { id: 'first_hour', label: 'First Hour', desc: 'Log your first 60 min', earned: totalMins >= 60 },
    { id: 'ten_hours', label: '10 Hours', desc: '10 hours of focused work', earned: totalMins >= 600 },
    { id: 'fifty_hours', label: '50 Hours', desc: '50 hours total', earned: totalMins >= 3000 },
    { id: 'week_streak', label: 'Week Warrior', desc: '7-day streak', earned: bestStreak >= 7 },
    { id: 'month_streak', label: 'Unbreakable', desc: '30-day streak', earned: bestStreak >= 30 },
    { id: 'lift_12', label: 'Consistent', desc: '12 workouts logged', earned: workoutCount >= 12 },
    { id: 'lift_40', label: 'Iron Will', desc: '40 workouts logged', earned: workoutCount >= 40 },
    { id: 'fuel_7', label: 'Dialed In', desc: 'Track meals 7 days', earned: mealDays >= 7 },
    { id: 'measured', label: 'Measured Up', desc: 'Log 2+ body check-ins', earned: bodyCount >= 2 },
  ];
  return defs;
}

// Suggest macro targets from latest bodyweight + goal direction (lb-based heuristic;
// no height/age stored, so we use kcal-per-lb rules of thumb).
function suggestMacros(latestBody: any, bodyGoals: any) {
  const wLb = Number(latestBody?.weight);
  if (!wLb) return null;
  const dir = bodyGoals?.weight?.direction || 'down';
  const calPerLb = dir === 'down' ? 12 : dir === 'up' ? 17 : 15;
  const calories = Math.round((wLb * calPerLb) / 10) * 10;
  const protein = Math.round(wLb);
  const fat = Math.round(wLb * 0.4);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat, calories };
}

function projectedDate(subjectKey: string, settings: any, totals: any, daily: any) {
  const s = settings.subjects[subjectKey];
  if (!s || !s.deadline) return null;
  const totalDone = (totals[subjectKey] || 0) + (daily?.completed[subjectKey] || 0);
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

// ════════════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ════════════════════════════════════════════════════════════════════════════════
const SUBJECTS_DEFAULT: Record<string, any> = {
  spanish: { name: 'Spanish', icon: 'languages', accent: '#B8460E', tools: 'Duolingo + Babbel + Input', description: '', trackingMode: 'time', target: 95, weeklyDays: 6, deadline: '2026-12-31', countTotal: null, archived: false, deletedAt: null },
  guitar: { name: 'Guitar', icon: 'music', accent: '#4A6741', tools: 'Simply Guitar', description: '', trackingMode: 'time', target: 30, weeklyDays: 5, deadline: '2026-12-31', countTotal: null, archived: false, deletedAt: null },
  cysa: { name: 'CySA+', icon: 'shield', accent: '#3B5C6B', tools: 'Jason Dion · Udemy', description: '', trackingMode: 'time', target: 45, weeklyDays: 7, deadline: '2026-06-16', countTotal: null, archived: false, deletedAt: null },
  running: { name: 'Running', icon: 'activity', accent: '#8E4585', tools: 'Easy pace, 25-30 min', description: '', trackingMode: 'time', target: 28, weeklyDays: 3, deadline: '2026-12-31', countTotal: null, archived: false, deletedAt: null },
};

const ICON_MAP: Record<string, any> = { languages: Languages, music: Music, shield: Shield, book: BookOpen, target: Target, dumbbell: Dumbbell, activity: Activity, run: Activity };

const DEFAULT_SETTINGS: Record<string, any> = {
  setupComplete: false,
  wakeTime: '07:00',
  sleepTime: '23:00',
  startDate: todayStr(),
  subjects: SUBJECTS_DEFAULT,
  subjectOrder: ['cysa', 'spanish', 'running', 'guitar'],
  scheduleStartOffsetMin: 30,
  blockBreakMin: 15,
  macroTargets: { protein: 170, carbs: 230, fat: 75, calories: 2300 },
  bodyGoals: {
    weight: { direction: 'down', target: null },
    waist: { direction: 'down', target: null, weight: 2 },
    chest: { direction: 'up', target: null, weight: 1.5 },
    shoulders: { direction: 'up', target: null, weight: 2 },
    biceps_l: { direction: 'up', target: null, weight: 1 },
    biceps_r: { direction: 'up', target: null, weight: 1 },
    thighs_l: { direction: 'up', target: null, weight: 0.5 },
    thighs_r: { direction: 'up', target: null, weight: 0.5 },
    calves_l: { direction: 'up', target: null, weight: 0.3 },
    calves_r: { direction: 'up', target: null, weight: 0.3 },
    neck: { direction: 'up', target: null, weight: 0.2 },
    hips: { direction: 'down', target: null, weight: 0.5 },
    body_fat: { direction: 'down', target: null, weight: 1.5 },
  },
  nextMeasurement: tomorrowStr(),
  measurementIntervalDays: 30,
  units: { timeFormat: '12h', weight: 'lb', length: 'in', weekStart: 0 },
  dashboard: ['schedule', 'progress', 'challenge', 'macros', 'weekly'],
  reminders: { enabled: false },
  challenge: {
    active: false,
    name: '60-Day V-Taper',
    startDate: null,
    days: 60,
    deloadWeek: 5,
  },
};

const MEASUREMENT_FIELDS = [
  { key: 'weight', label: 'Weight', unit: 'lb' },
  { key: 'body_fat', label: 'Body Fat', unit: '%' },
  { key: 'neck', label: 'Neck', unit: 'in' },
  { key: 'shoulders', label: 'Shoulders', unit: 'in' },
  { key: 'chest', label: 'Chest', unit: 'in' },
  { key: 'waist', label: 'Waist', unit: 'in' },
  { key: 'hips', label: 'Hips', unit: 'in' },
  { key: 'biceps_l', label: 'Bicep (L)', unit: 'in' },
  { key: 'biceps_r', label: 'Bicep (R)', unit: 'in' },
  { key: 'thighs_l', label: 'Thigh (L)', unit: 'in' },
  { key: 'thighs_r', label: 'Thigh (R)', unit: 'in' },
  { key: 'calves_l', label: 'Calf (L)', unit: 'in' },
  { key: 'calves_r', label: 'Calf (R)', unit: 'in' },
];

const DEFAULT_WORKOUT_SPLIT = [
  { day: 0, name: 'Rest — Active Recovery', rest: true, exercises: [] },
  { day: 1, name: 'Push A — Shoulder Focus', rest: false, exercises: [
    { name: 'Incline Barbell Press', sets: 4, reps: '6-10', notes: 'RPE 8 — upper chest and shoulder tie-in' },
    { name: 'Seated DB Shoulder Press', sets: 4, reps: '8-10', notes: 'RPE 8 — full range, no locking out' },
    { name: 'Cable Lateral Raises (unilateral)', sets: 4, reps: '15-20', notes: 'RPE 9 — KEY V-taper exercise, strict form' },
    { name: 'Cable Triceps Pushdowns (rope)', sets: 3, reps: '12-15', notes: 'RPE 9 — squeeze fully at bottom' },
    { name: 'Overhead Triceps Extension (cable)', sets: 3, reps: '10-12', notes: 'RPE 9 — long head stretch' },
  ]},
  { day: 2, name: 'Pull A — Width Focus', rest: false, exercises: [
    { name: 'Weighted Pull-Ups (wide grip)', sets: 4, reps: '6-10', notes: 'RPE 8 — #1 lat width builder, full stretch' },
    { name: 'Seated Cable Row (wide, FLARED)', sets: 3, reps: '10-12', notes: 'RPE 8 — elbows flared ~45 deg, upper back' },
    { name: 'Single-Arm DB Row (TUCKED)', sets: 3, reps: '10-12', notes: 'RPE 8 — elbows tucked to ribs, hits lats' },
    { name: 'Rear Delt Fly (pec deck reverse)', sets: 3, reps: '15-20', notes: 'RPE 9 — slow 3s eccentric, shoulder health' },
    { name: 'Incline DB Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — peak bicep stretch at bottom' },
    { name: 'Hammer Curls', sets: 3, reps: '12-15', notes: 'RPE 9 — brachialis and forearm width' },
  ]},
  { day: 3, name: 'Legs A — Quad + HIIT', rest: false, exercises: [
    { name: 'Back Squat', sets: 4, reps: '6-8', notes: 'RPE 8 — controlled descent, drive through heels' },
    { name: 'Leg Press (feet high & wide)', sets: 3, reps: '12-15', notes: 'RPE 9 — builds quad sweep' },
    { name: 'Leg Extension Machine', sets: 3, reps: '12-15', notes: 'RPE 9 — full squeeze at top' },
    { name: 'Seated Hamstring Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — slow 3s eccentric, full contraction' },
    { name: 'Standing Calf Raises', sets: 4, reps: '15-20', notes: 'RPE 9 — pause 1s at top' },
    { name: 'Hanging Leg Raises', sets: 3, reps: '15-20', notes: 'RPE 9 — no swinging, controlled' },
    { name: 'HIIT Finisher (bike/treadmill)', sets: 1, reps: '10 min', notes: '20s max sprint / 40s rest × 10 rounds' },
  ]},
  { day: 4, name: 'Push B — Chest Focus', rest: false, exercises: [
    { name: 'Barbell Bench Press (flat)', sets: 4, reps: '6-10', notes: 'RPE 8 — retract scapula, controlled descent' },
    { name: 'Incline DB Press (30 deg)', sets: 3, reps: '8-10', notes: 'RPE 8 — targets upper chest' },
    { name: 'Cable Lateral Raises (bilateral)', sets: 4, reps: '15-20', notes: 'RPE 9 — different stimulus than Day 1' },
    { name: 'Dips (weighted if possible)', sets: 3, reps: '8-12', notes: 'RPE 9 — lean forward for chest emphasis' },
    { name: 'Triceps Overhead Ext. (EZ bar)', sets: 3, reps: '10-12', notes: 'RPE 9 — full overhead stretch' },
  ]},
  { day: 5, name: 'Pull B — Thickness Focus', rest: false, exercises: [
    { name: 'Pull-Ups AMRAP (bodyweight)', sets: 4, reps: 'AMRAP', notes: 'RPE 9 — log reps each set, beat weekly' },
    { name: 'Barbell Row (TUCKED)', sets: 4, reps: '8-10', notes: 'RPE 8 — elbows tucked, heavy lat thickness' },
    { name: 'Chest-Supported DB Row (FLARED)', sets: 3, reps: '10-12', notes: 'RPE 8 — elbows flared ~45 deg, upper back' },
    { name: 'Straight-Arm Lat Pulldown', sets: 3, reps: '12-15', notes: 'RPE 9 — isolation, squeeze lats at bottom' },
    { name: 'Face Pulls (cable rope)', sets: 3, reps: '15-20', notes: 'RPE 8 — external rotation, shoulder health' },
    { name: 'Preacher Curl or EZ Bar Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — strict form, no body swing' },
    { name: 'Reverse Curls', sets: 2, reps: '12-15', notes: 'RPE 8 — forearm and brachialis' },
  ]},
  { day: 6, name: 'Legs B — Posterior Chain + HIIT', rest: false, exercises: [
    { name: 'Romanian Deadlift (RDL)', sets: 4, reps: '8-10', notes: 'RPE 8 — hinge at hips, big hamstring stretch' },
    { name: 'Hip Thrust — Barbell', sets: 4, reps: '10-12', notes: 'RPE 9 — squeeze glutes hard at top' },
    { name: 'Walking Lunges (DB)', sets: 3, reps: '10/leg', notes: 'RPE 8 — long stride, knee tracks toe' },
    { name: 'Lying Hamstring Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — slow 3s down, full squeeze' },
    { name: 'Seated Calf Raises', sets: 4, reps: '15-20', notes: 'RPE 9 — different angle vs Day 3' },
    { name: 'Ab Wheel Rollouts', sets: 3, reps: '10-12', notes: 'RPE 9 — slow, core braced throughout' },
    { name: 'HIIT Finisher (bike/treadmill)', sets: 1, reps: '12 min', notes: '20s max sprint / 40s rest × 12 rounds' },
  ]},
];

const HOME_WORKOUT_SPLIT = [
  { day: 0, name: 'Rest — Active Recovery', rest: true, exercises: [] },
  { day: 1, name: 'Home Push A — Shoulder Focus', rest: false, exercises: [
    { name: 'Pike Push-Ups', sets: 4, reps: '10-12', notes: 'Hands close, hips high — mimics overhead press' },
    { name: 'Wall Handstand Hold / Kick-Up', sets: 3, reps: '20-30s', notes: 'Build shoulder strength and balance' },
    { name: 'Feet-Elevated Push-Ups', sets: 4, reps: '12-15', notes: 'Feet on chair — upper chest and front delt' },
    { name: 'Prone Y Raises', sets: 3, reps: '20', notes: 'Face down, arms in Y — side/rear delt' },
    { name: 'Diamond Push-Ups', sets: 3, reps: '15-20', notes: 'Tricep emphasis' },
    { name: 'Chair Dips', sets: 3, reps: '12-15', notes: 'Hands on chair behind you, dip down' },
  ]},
  { day: 2, name: 'Home Pull A — Width Focus', rest: false, exercises: [
    { name: 'Table Inverted Rows — Wide (FLARED)', sets: 4, reps: '10-12', notes: 'Elbows flared — upper back/rear delts' },
    { name: 'Table Inverted Rows — Narrow (TUCKED)', sets: 3, reps: '10-12', notes: 'Elbows tucked — lat thickness' },
    { name: 'Prone Superman Hold', sets: 3, reps: '30-45s', notes: 'Arms forward, lift chest and legs off floor' },
    { name: 'Prone Y Raises', sets: 3, reps: '20', notes: 'Face down, arms in Y — upper back width' },
    { name: 'Prone T Raises', sets: 3, reps: '20', notes: 'Arms out like a T — rear delt and rhomboids' },
    { name: 'Prone W Raises', sets: 3, reps: '15', notes: 'Elbows bent 90 deg, pull back — traps' },
    { name: 'Table Edge Isometric Curl', sets: 3, reps: '20s each', notes: 'Palms up under table edge, push up hard' },
  ]},
  { day: 3, name: 'Home Legs A — Quad + HIIT', rest: false, exercises: [
    { name: 'Jump Squats', sets: 4, reps: '15', notes: 'Explosive up, soft controlled landing' },
    { name: 'Bulgarian Split Squats (chair)', sets: 3, reps: '10/leg', notes: 'Long stride, knee stays behind toe' },
    { name: 'Wall Sit', sets: 3, reps: '60 sec', notes: 'Thighs parallel, back flat on wall' },
    { name: 'Step-Ups on Chair', sets: 3, reps: '12/leg', notes: 'Full hip extension at the top' },
    { name: 'Single-Leg Calf Raises', sets: 4, reps: '20', notes: 'Hand on wall for balance' },
    { name: 'Floor Leg Raises', sets: 3, reps: '20', notes: 'Lying flat, legs straight, raise to 90 deg' },
    { name: 'HIIT: High Knees or Burpees', sets: 1, reps: '10 min', notes: '20s max effort / 40s rest × 10 rounds' },
  ]},
  { day: 4, name: 'Home Push B — Chest Focus', rest: false, exercises: [
    { name: 'Standard Push-Ups', sets: 4, reps: '15-20', notes: 'Slow 3s down, explosive push up' },
    { name: 'Wide-Grip Push-Ups', sets: 3, reps: '12-15', notes: 'Hands wide = more chest' },
    { name: 'Decline Push-Ups (feet on chair)', sets: 3, reps: '10-12', notes: 'Targets upper chest heavily' },
    { name: 'Archer Push-Ups', sets: 3, reps: '8-10/side', notes: 'One arm bent, one straight — unilateral' },
    { name: 'Chair Dips', sets: 3, reps: '12-15', notes: 'Full range, lean forward for chest' },
    { name: 'Close-Grip Push-Ups', sets: 3, reps: '12', notes: 'Hands close, tricep isolation' },
  ]},
  { day: 5, name: 'Home Pull B — Thickness Focus', rest: false, exercises: [
    { name: 'Table Inverted Rows — Narrow (TUCKED)', sets: 4, reps: '10-12', notes: 'Elbows tucked — lat thickness focus' },
    { name: 'Table Inverted Rows — Wide (FLARED)', sets: 3, reps: '10-12', notes: 'Elbows flared — upper back/rear delts' },
    { name: 'Table Inverted Rows — Explosive', sets: 3, reps: '8-10', notes: 'Pull fast, lower slow 4s' },
    { name: 'Prone Superman — Alternating', sets: 3, reps: '12/side', notes: 'One arm forward, one back' },
    { name: 'Prone I Raises', sets: 3, reps: '15', notes: 'Arms straight overhead, lift — lower traps' },
    { name: 'Prone W Raises', sets: 3, reps: '15', notes: 'Elbows bent, pull back — mid traps' },
    { name: 'Bodyweight Good Mornings', sets: 3, reps: '15', notes: 'Hands behind head, hinge forward' },
  ]},
  { day: 6, name: 'Home Legs B — Posterior + HIIT', rest: false, exercises: [
    { name: 'Single-Leg RDL (bodyweight)', sets: 3, reps: '10/leg', notes: 'Arms forward for balance, hinge at hips' },
    { name: 'Glute Bridges (bodyweight)', sets: 4, reps: '20', notes: 'Drive hips up, hard squeeze at top' },
    { name: 'Walking Lunges', sets: 3, reps: '12/leg', notes: 'Long stride, control the descent' },
    { name: 'Nordic Hamstring Curl (feet under couch)', sets: 3, reps: '6-8', notes: 'Kneel, hook feet, lower slowly — brutal' },
    { name: 'Single-Leg Calf Raises', sets: 4, reps: '20', notes: 'Slow and controlled both ways' },
    { name: 'Mountain Climbers', sets: 3, reps: '30 sec', notes: 'Core and cardio — drive knees fast' },
    { name: 'HIIT: Burpees or Jump Squats', sets: 1, reps: '12 min', notes: '20s max / 40s rest × 12 rounds' },
  ]},
];

// ════════════════════════════════════════════════════════════════════════════════
// PROGRESS MATH
// ════════════════════════════════════════════════════════════════════════════════
function expectedTotal(subjectKey: string, settings: any) {
  const s = settings.subjects[subjectKey];
  if (!s) return 0;
  const days = Math.max(0, diffDays(todayStr(), settings.startDate));
  return Math.round(days * s.target * (s.weeklyDays / 7));
}
function targetTotalByDeadline(subjectKey: string, settings: any) {
  const s = settings.subjects[subjectKey];
  if (!s || !s.deadline) return 0;
  const totalDays = Math.max(1, diffDays(s.deadline, settings.startDate) + 1);
  return Math.round(totalDays * s.target * (s.weeklyDays / 7));
}

// ════════════════════════════════════════════════════════════════════════════════
// SAMPLE PRESETS
// ════════════════════════════════════════════════════════════════════════════════
const SAMPLE_PRESETS = [
  { id: 'p1', name: '4 eggs + 1 cup oats + banana', protein: 38, carbs: 65, fat: 22, calories: 600, source: 'Breakfast staple' },
  { id: 'p2', name: 'Chicken rice bowl (200g chk)', protein: 50, carbs: 60, fat: 8, calories: 530, source: 'Pre-workout' },
  { id: 'p3', name: 'Protein shake + banana', protein: 30, carbs: 30, fat: 3, calories: 280, source: 'Post-workout' },
  { id: 'p4', name: 'Salmon + sweet potato + greens', protein: 40, carbs: 45, fat: 18, calories: 510, source: 'Dinner' },
  { id: 'p5', name: 'Greek yogurt + berries', protein: 18, carbs: 15, fat: 4, calories: 170, source: 'Snack' },
];

// ════════════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ════════════════════════════════════════════════════════════════════════════════
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { margin: 0; background: #F5F0E6; }
      .app {
        min-height: 100vh; background: #F5F0E6; color: #1A1A2E;
        font-family: 'Fraunces', serif; font-feature-settings: 'ss01' on;
        max-width: 480px; margin: 0 auto; position: relative; padding-bottom: 88px;
      }
      .content { padding: 20px 18px 40px; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      .h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.05; }
      .h2 { font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6B6457; }
      .h3 { font-size: 16px; font-weight: 600; }
      .muted { color: #6B6457; }
      .small { font-size: 12px; }
      .tiny { font-size: 11px; }
      .card { background: #FBF7EE; border: 1px solid #E4DCC8; border-radius: 14px; padding: 18px; margin-bottom: 14px; }
      .card-tight { padding: 14px; }
      .btn { background: #1A1A2E; color: #F5F0E6; border: none; padding: 12px 18px; border-radius: 10px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
      .btn:active { opacity: 0.8; }
      .btn-ghost { background: transparent; color: #1A1A2E; border: 1px solid #D4CCB8; }
      .btn-accent { background: #B8460E; }
      .row { display: flex; gap: 10px; align-items: center; }
      .between { display: flex; justify-content: space-between; align-items: center; }
      .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; letter-spacing: 0.05em; font-family: 'JetBrains Mono', monospace; font-weight: 500; }
      .progress-bar { height: 6px; background: #E4DCC8; border-radius: 3px; overflow: hidden; position: relative; }
      .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
      .progress-marker { position: absolute; top: -3px; width: 2px; height: 12px; background: #1A1A2E; }
      input[type="time"], input[type="date"], input[type="number"], input[type="text"], select, textarea {
        font-family: 'JetBrains Mono', monospace; font-size: 14px; padding: 10px; border: 1px solid #D4CCB8; background: #FBF7EE; border-radius: 8px; color: #1A1A2E; width: 100%;
      }
      input[type="text"] { font-family: 'Fraunces', serif; }
      label { font-size: 12px; color: #6B6457; display: block; margin-bottom: 4px; letter-spacing: 0.05em; }
      .modal-bg { position: fixed; inset: 0; background: rgba(26,26,46,0.55); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
      .modal { background: #F5F0E6; border-radius: 18px; padding: 22px; max-width: 440px; width: 100%; max-height: 92vh; overflow-y: auto; }
      .tap { padding: 9px 14px; border: 1px solid #D4CCB8; border-radius: 8px; background: transparent; font-family: inherit; font-size: 13px; cursor: pointer; color: #1A1A2E; }
      .tap.active { background: #1A1A2E; color: #F5F0E6; border-color: #1A1A2E; }
      .block { padding: 14px 16px; border-radius: 10px; background: #FBF7EE; border: 1px solid #E4DCC8; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
      .block.done { opacity: 0.55; }
      .icon-wrap { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #F5F0E6; flex-shrink: 0; }
      .bottom-nav {
        position: fixed; bottom: 0; left: 0; right: 0; background: #FBF7EE;
        border-top: 1px solid #E4DCC8; padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
        display: flex; justify-content: space-around; max-width: 480px; margin: 0 auto; z-index: 30;
      }
      .nav-btn {
        background: none; border: none; padding: 6px 8px; cursor: pointer; display: flex;
        flex-direction: column; align-items: center; gap: 3px; color: #6B6457; font-family: inherit; font-size: 9.5px;
        border-radius: 8px; transition: all 0.15s; flex: 1;
      }
      .nav-btn.active { color: #1A1A2E; background: #F5F0E6; }
      .sparkline { display: flex; align-items: flex-end; gap: 2px; height: 24px; }
      .sparkline-bar { width: 4px; background: #B8460E; border-radius: 1px; }
      .divider { height: 1px; background: #E4DCC8; margin: 12px 0; border: none; }
      .swatch { width: 8px; height: 8px; border-radius: 2px; display: inline-block; margin-right: 6px; vertical-align: middle; }
      .streak-flame { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #C8932E; }
    `}</style>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// HEADER + BOTTOM NAV
// ════════════════════════════════════════════════════════════════════════════════
function Header({ date, onSettings }: { date: string; onSettings: () => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <div className="mono tiny" style={{ letterSpacing: '0.15em', color: '#6B6457', textTransform: 'uppercase' }}>
          {fmtDate(date)}
        </div>
        <button onClick={onSettings} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#6B6457' }}>
          <SettingsIcon size={18} />
        </button>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const items = [
    { key: 'today', label: 'Today', icon: Sun },
    { key: 'body', label: 'Body', icon: Activity },
    { key: 'workout', label: 'Lift', icon: Dumbbell },
    { key: 'journal', label: 'Journal', icon: BookMarked },
    { key: 'plan', label: 'Plan', icon: CalIcon },
    { key: 'history', label: 'History', icon: History },
  ];
  return (
    <div className="bottom-nav">
      {items.map(it => (
        <button key={it.key} className={`nav-btn ${tab === it.key ? 'active' : ''}`} onClick={() => setTab(it.key)}>
          <it.icon size={18} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TODAY TAB
// ════════════════════════════════════════════════════════════════════════════════
function TodayTab({ settings, daily, totals, streaks, meals, workout, checkins, onWake, onStatus, onLogTime, onBusy, onBack, onSwitch, onLogMeal, onScheduleStart, onResetMacros, onMarkDone, onFocusStart, onFocusStop, onCoach }: any) {
  const now = useCurrentTime();
  const nowMins = timeToMins(now);
  const subjectKeys = settings.subjectOrder.filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived && !settings.subjects[k].deletedAt);
  const todayMacros = meals.log[todayStr()] || { protein: 0, carbs: 0, fat: 0, calories: 0 };
  const sleepMins = timeToMins(settings.sleepTime || '23:00');
  const minsToSleep = sleepMins - nowMins;
  const sleepWarning = minsToSleep > 0 && minsToSleep <= 120 && daily.scheduleStarted;
  const isDoneToday = (k: string) => {
    const s = settings.subjects[k];
    if (doneThisWeek(k, checkins) >= (s.weeklyDays || 7)) return true;
    if (s.trackingMode === 'checkoff') return (checkins[k] || []).includes(todayStr());
    return (daily.completed[k] || 0) >= (s.target || 0) && (s.target || 0) > 0;
  };
  const incompleteCount = subjectKeys.filter((k: string) => !isDoneToday(k)).length;

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 18 }}>A day in your study.</h1>

      {sleepWarning && incompleteCount > 0 && (
        <div className="card" style={{ borderLeft: `3px solid ${minsToSleep <= 60 ? '#B8460E' : '#C8932E'}`, background: minsToSleep <= 60 ? '#FDF1EC' : '#FBF7EE', marginBottom: 14 }}>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <Moon size={16} color={minsToSleep <= 60 ? '#B8460E' : '#C8932E'} />
            <span className="small" style={{ fontWeight: 600, color: minsToSleep <= 60 ? '#B8460E' : '#C8932E' }}>
              Sleep in ~{minsToSleep <= 60 ? '1 hour' : '2 hours'} — {now}
            </span>
          </div>
          <div className="muted tiny" style={{ lineHeight: 1.5 }}>
            {incompleteCount} task{incompleteCount > 1 ? 's' : ''} not done. Push hard or move the minimum to tomorrow.
          </div>
        </div>
      )}

      {!daily.wakeLogged ? (
        <WakeCheckIn plannedWake={daily.plannedWake} onLog={onWake} />
      ) : !daily.scheduleStarted ? (
        <ScheduleStartCard daily={daily} defaultOffset={settings.scheduleStartOffsetMin} onStart={onScheduleStart} />
      ) : (
        <>
          <StatusBar daily={daily} onBusy={onBusy} onBack={onBack} onSwitch={onSwitch} nowMins={nowMins} now={now} sleepTime={settings.sleepTime} />
          {daily.focus && <FocusTimerCard focus={daily.focus} subject={settings.subjects[daily.focus.subject]} onStop={onFocusStop} />}
          {(settings.dashboard || ['schedule', 'progress', 'challenge', 'macros', 'weekly']).map((card: string) => {
            switch (card) {
              case 'schedule': return <Schedule key={card} settings={settings} daily={daily} onLog={onLogTime} subjectKeys={subjectKeys} nowMins={nowMins} checkins={checkins} />;
              case 'progress': return <Progress key={card} settings={settings} totals={totals} daily={daily} streaks={streaks} subjectKeys={subjectKeys} onLogExtra={onLogTime} checkins={checkins} onMarkDone={onMarkDone} onFocusStart={onFocusStart} focus={daily.focus} />;
              case 'challenge': return <ChallengeCard key={card} settings={settings} workout={workout} />;
              case 'macros': return <MacrosCard key={card} targets={settings.macroTargets} totals={todayMacros} onLog={onLogMeal} onReset={onResetMacros} onCoach={onCoach} />;
              case 'weekly': return <WeeklySummary key={card} settings={settings} totals={totals} daily={daily} meals={meals} workout={workout} />;
              default: return null;
            }
          })}
        </>
      )}
    </>
  );
}

function WakeCheckIn({ plannedWake, onLog }: any) {
  const [time, setTime] = useState(plannedWake || nowHHMM());
  return (
    <div className="card" style={{ borderLeft: '3px solid #B8460E' }}>
      <div className="row" style={{ gap: 12, marginBottom: 10 }}>
        <Sun size={20} color="#B8460E" />
        <div className="h2">Morning check-in</div>
      </div>
      <p style={{ fontSize: 16, marginBottom: 14, lineHeight: 1.4 }}>What time did you wake up?</p>
      {plannedWake && (
        <p className="muted tiny" style={{ marginBottom: 8 }}>
          You planned <span className="mono">{fmtTime(plannedWake)}</span> for today. Adjust if it was different.
        </p>
      )}
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ marginBottom: 14 }} />
      <button className="btn btn-accent" onClick={() => onLog(time)} style={{ width: '100%' }}>
        Log wake · {fmtTime(time)}
      </button>
    </div>
  );
}

function ScheduleStartCard({ daily, defaultOffset, onStart }: any) {
  const suggested = addMinutes(daily.actualWake, defaultOffset ?? 30);
  const [time, setTime] = useState(suggested);
  return (
    <div className="card" style={{ borderLeft: '3px solid #B8460E' }}>
      <div className="row" style={{ gap: 12, marginBottom: 10 }}>
        <Play size={20} color="#B8460E" />
        <div className="h2">When do you want to start?</div>
      </div>
      <p style={{ fontSize: 15, marginBottom: 6, lineHeight: 1.4 }}>
        You woke at <span className="mono">{fmtTime(daily.actualWake)}</span>. Is now a good time to start studying?
      </p>
      <p className="muted tiny" style={{ marginBottom: 14 }}>Pick when your first block should begin. You can change it later.</p>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`tap ${time === nowHHMM() ? 'active' : ''}`} onClick={() => setTime(nowHHMM())}>Right now</button>
        <button className={`tap ${time === suggested ? 'active' : ''}`} onClick={() => setTime(suggested)}>In {defaultOffset ?? 30} min</button>
        <button className={`tap ${time === addMinutes(daily.actualWake, 60) ? 'active' : ''}`} onClick={() => setTime(addMinutes(daily.actualWake, 60))}>In 1 hr</button>
        <button className={`tap ${time === addMinutes(daily.actualWake, 120) ? 'active' : ''}`} onClick={() => setTime(addMinutes(daily.actualWake, 120))}>In 2 hr</button>
      </div>
      <label>Or set a specific time</label>
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ marginBottom: 14 }} />
      <button className="btn btn-accent" onClick={() => onStart(time)} style={{ width: '100%' }}>
        Start at {fmtTime(time)}
      </button>
    </div>
  );
}

function StatusBar({ daily, onBusy, onBack, onSwitch, nowMins, now, sleepTime }: any) {
  const isBusy = daily.status === 'busy';
  const seg = daily.busy?.segments?.[daily.busy.segments.length - 1];
  const reason = seg?.reason || daily.busyReason;
  const plannedUntil = daily.busy?.plannedUntil || daily.busyUntil;
  const elapsed = seg?.start ? Math.max(0, nowMins - timeToMins(seg.start)) : 0;
  const sleepMins = timeToMins(sleepTime || '23:00');
  const minsLeft = sleepMins - nowMins;
  const timeColor = minsLeft <= 60 ? '#B8460E' : minsLeft <= 120 ? '#C8932E' : '#6B6457';
  return (
    <div className="card card-tight" style={{ marginBottom: 14 }}>
      <div className="between">
        <div>
          <div className="h2" style={{ marginBottom: 4 }}>Right now</div>
          <div className="row" style={{ gap: 8 }}>
            {isBusy ? <Footprints size={16} color="#C8932E" /> : <Home size={16} color="#4A6741" />}
            <span style={{ fontSize: 15, fontWeight: 500 }}>
              {isBusy ? (reason || 'Busy') : 'Home & available'}
            </span>
          </div>
          {isBusy && (
            <div className="mono tiny muted" style={{ marginTop: 2 }}>
              {elapsed}m so far{plannedUntil ? ` · planned till ${fmtTime(plannedUntil)}` : ' · open-ended'}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono small" style={{ fontWeight: 600, color: '#1A1A2E', fontSize: 18 }}>{fmtTime(now)}</div>
          {minsLeft > 0 && minsLeft < 480 && (
            <div className="mono tiny" style={{ color: timeColor }}>
              {minsLeft <= 60 ? `${minsLeft}m to sleep` : minsLeft <= 120 ? `~${Math.round(minsLeft / 60 * 10) / 10}h to sleep` : ''}
            </div>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid #E4DCC8', marginTop: 10, paddingTop: 10 }}>
        {isBusy ? (
          <div className="row" style={{ gap: 6 }}>
            <button className="tap" onClick={onSwitch} style={{ flex: 1 }}><Repeat size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Switch</button>
            <button className="tap active" onClick={onBack} style={{ flex: 1 }}>I'm back</button>
          </div>
        ) : (
          <button className="tap" onClick={onBusy} style={{ width: '100%' }}>I'm stepping out</button>
        )}
      </div>
    </div>
  );
}

function FocusTimerCard({ focus, subject, onStop }: any) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((t) => t + 1), 1000); return () => clearInterval(id); }, []);
  const elapsedMs = Date.now() - focus.start;
  const mins = Math.floor(elapsedMs / 60000);
  const secs = Math.floor((elapsedMs % 60000) / 1000);
  const Icon = ICON_MAP[subject?.icon] || Target;
  return (
    <div className="card" style={{ borderLeft: `3px solid ${subject?.accent || '#4A6741'}`, marginBottom: 14, background: '#FDF6EE' }}>
      <div className="between">
        <div className="row" style={{ gap: 10 }}>
          <div className="icon-wrap" style={{ background: subject?.accent || '#4A6741', width: 34, height: 34 }}><Icon size={18} /></div>
          <div>
            <div className="small" style={{ fontWeight: 600 }}>Focusing · {subject?.name || 'Session'}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{pad(mins)}:{pad(secs)}</div>
          </div>
        </div>
        <button className="btn" style={{ background: '#B8460E' }} onClick={onStop}>
          <Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Stop & log
        </button>
      </div>
    </div>
  );
}

function buildSchedule(settings: any, daily: any, subjectKeys: string[], checkins: any = {}) {
  if (!daily?.scheduleStartTime) return [];
  const breakMin = settings.blockBreakMin ?? 15;
  let cursor = daily.scheduleStartTime;
  const blocks: any[] = [];
  const dow = dayOfWeek();
  const order = ['cysa', 'running', 'spanish', 'guitar']
    .filter(k => subjectKeys.includes(k))
    .concat(subjectKeys.filter(k => !['cysa', 'running', 'spanish', 'guitar'].includes(k)));

  for (const k of order) {
    const s = settings.subjects[k];
    if (!s || s.archived || s.deletedAt) continue;
    // Check-off habits aren't time-blocked, and weekly-met goals drop off until next week.
    if (s.trackingMode === 'checkoff') continue;
    if (doneThisWeek(k, checkins) >= (s.weeklyDays || 7)) continue;
    const isRest = (s.weeklyDays < 7) && (dow === 0);
    if (isRest) continue;
    const remaining = Math.max(0, (s.target || 0) - (daily.completed[k] || 0));
    if (remaining <= 0) continue;

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
      blocks.push({ subject: k, start: '19:00', mins: remaining });
    } else if (k === 'running') {
      blocks.push({ subject: k, start: cursor, mins: remaining, note: 'Easy pace' });
      cursor = addMinutes(cursor, remaining + breakMin);
    } else {
      blocks.push({ subject: k, start: cursor, mins: remaining });
      cursor = addMinutes(cursor, remaining + breakMin);
    }
  }
  return blocks;
}

function splitSpanish(total: number) {
  const duo = Math.round(total * 0.42);
  const babbel = Math.round(total * 0.37);
  const input = total - duo - babbel;
  return [duo, babbel, input];
}

function Schedule({ settings, daily, onLog, subjectKeys, nowMins, checkins }: any) {
  const blocks = useMemo(() => buildSchedule(settings, daily, subjectKeys, checkins), [settings, daily, subjectKeys, checkins]);

  if (blocks.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="h2" style={{ marginBottom: 10 }}>Today's plan</div>
        <p className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Award size={14} /> All done for today. Anything extra counts as bonus.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="h2" style={{ marginBottom: 10, paddingLeft: 4 }}>Today's schedule</div>
      {blocks.map((b: any, i: number) => {
        const subj = settings.subjects[b.subject];
        const Icon = ICON_MAP[subj.icon] || Languages;
        const done = (daily.completed[b.subject] || 0) >= subj.target;
        const blockStart = timeToMins(b.start);
        const blockEnd = blockStart + b.mins;
        const isActive = !done && nowMins >= blockStart && nowMins < blockEnd;
        const isOverdue = !done && nowMins >= blockEnd;
        const isUpcoming = !done && !isActive && !isOverdue && (blockStart - nowMins) <= 30 && blockStart > nowMins;
        const minsUntil = blockStart - nowMins;

        let blockBg = '#FBF7EE';
        let blockBorder = '1px solid #E4DCC8';
        let statusEl = null;

        if (done) {
          blockBg = '#F0F5ED';
          blockBorder = '1px solid #C8D9C0';
        } else if (isActive) {
          blockBg = '#FDF6EE';
          blockBorder = `2px solid ${subj.accent}`;
          statusEl = <span className="pill" style={{ background: subj.accent, color: '#F5F0E6', fontSize: 10, padding: '2px 8px', letterSpacing: '0.08em' }}>NOW</span>;
        } else if (isOverdue) {
          blockBg = '#FDF1EC';
          blockBorder = '2px solid #B8460E';
          statusEl = <span className="pill" style={{ background: '#F5E1D5', color: '#B8460E', fontSize: 10, padding: '2px 8px' }}>OVERDUE</span>;
        } else if (isUpcoming) {
          statusEl = <span className="mono tiny" style={{ color: '#C8932E' }}>in {minsUntil}m</span>;
        }

        return (
          <div key={i} onClick={() => onLog(b.subject)} style={{
            padding: '14px 16px', borderRadius: 10, background: blockBg, border: blockBorder,
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            opacity: done ? 0.6 : 1, transition: 'all 0.2s',
          }}>
            <div className="icon-wrap" style={{ background: done ? '#A0A898' : subj.accent }}>
              <Icon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="between">
                <div style={{ fontSize: 15, fontWeight: isActive ? 700 : 600 }}>{subj.name}</div>
                <div className="row" style={{ gap: 6 }}>
                  {statusEl}
                  <div className="mono tiny muted">{fmtTime(b.start)}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 2 }}>
                <span className="mono small muted">{b.mins} min</span>
                {b.note && <span className="muted small">· {b.note}</span>}
                {done && <Check size={14} color="#4A6741" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Progress({ settings, totals, daily, streaks, subjectKeys, onLogExtra, checkins, onMarkDone, onFocusStart, focus }: any) {
  return (
    <div className="card">
      <div className="h2" style={{ marginBottom: 14 }}>Progress</div>
      {subjectKeys.map((k: string) => {
        const subj = settings.subjects[k];
        const Icon = ICON_MAP[subj.icon] || Languages;
        const goalKind = subjectGoalKind(subj);
        const isCheckoff = subj.trackingMode === 'checkoff';
        const weeklyDays = subj.weeklyDays || 7;
        const weekDone = doneThisWeek(k, checkins);
        const weeklyMet = weekDone >= weeklyDays;
        const streak = streaks[k]?.current || 0;
        const todayDone = daily.completed[k] || 0;
        const todayBonus = (daily.bonus?.[k]) || 0;
        const checkedToday = (checkins[k] || []).includes(todayStr());
        const isFocusing = focus?.subject === k;
        const sessionsDone = doneTotal(k, checkins);
        const countComplete = goalKind === 'count' && sessionsDone >= (subj.countTotal || 0);

        // On-pace metrics only meaningful for timed subjects with a deadline.
        const totalDone = (totals[k] || 0) + todayDone;
        const expected = expectedTotal(k, settings);
        const target = targetTotalByDeadline(k, settings);
        const pct = Math.min(100, (totalDone / Math.max(target, 1)) * 100);
        const expectedPct = Math.min(100, (expected / Math.max(target, 1)) * 100);
        const diff = totalDone - expected;
        const perDayAvg = (subj.target || 0) * (weeklyDays / 7);
        const daysOff = Math.abs(diff) / Math.max(perDayAvg, 1);
        const proj = projectedDate(k, settings, totals, daily);
        const showPace = goalKind === 'deadline' && !isCheckoff && !weeklyMet;

        let status = '', sColor = '#6B6457', sBg = '#EEEAE0';
        if (weeklyMet) { status = `Done this week · ${weekDone}/${weeklyDays}`; sColor = '#4A6741'; sBg = '#E8EBE0'; }
        else if (countComplete) { status = 'Complete'; sColor = '#4A6741'; sBg = '#E8EBE0'; }
        else if (showPace) {
          if (Math.abs(diff) < perDayAvg * 0.5) { status = 'on pace'; sColor = '#4A6741'; sBg = '#E8EBE0'; }
          else if (diff > 0) { status = `${daysOff.toFixed(1)}d ahead`; sColor = '#4A6741'; sBg = '#E8EBE0'; }
          else { status = `${daysOff.toFixed(1)}d behind`; sColor = '#B8460E'; sBg = '#F5E1D5'; }
        } else { status = `${weekDone}/${weeklyDays} this week`; }

        return (
          <div key={k} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #E4DCC8', opacity: weeklyMet || countComplete ? 0.65 : 1 }}>
            <div className="between" style={{ marginBottom: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <Icon size={14} color={subj.accent} />
                <span className="h3">{subj.name}</span>
                {(weeklyMet || countComplete || checkedToday) && <Check size={14} color="#4A6741" />}
                {streak > 1 && <span className="streak-flame"><Flame size={11} /> {streak}d</span>}
              </div>
              <span className="pill" style={{ background: sBg, color: sColor }}>{status}</span>
            </div>

            {showPace && proj && (
              <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                <CalIcon size={11} color="#6B6457" />
                <span className="mono tiny muted">
                  Goal: {fmtShortDate(proj.deadline)}
                  {proj.projected && (
                    <> · at this pace: <span style={{ color: proj.onTime ? '#4A6741' : '#B8460E', fontWeight: 600 }}>
                      {fmtShortDate(proj.projected)} {proj.onTime ? '✓' : '⚠'}
                    </span></>
                  )}
                </span>
              </div>
            )}

            {showPace ? (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%`, background: subj.accent }} />
                <div className="progress-marker" style={{ left: `${expectedPct}%` }} />
              </div>
            ) : goalKind === 'count' ? (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (sessionsDone / Math.max(subj.countTotal || 1, 1)) * 100)}%`, background: subj.accent }} />
              </div>
            ) : (
              <div className="row" style={{ gap: 4, marginTop: 2 }}>
                {Array.from({ length: weeklyDays }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < weekDone ? subj.accent : '#E4DCC8' }} />
                ))}
              </div>
            )}

            <div className="between" style={{ marginTop: 6 }}>
              <span className="mono muted tiny">
                {goalKind === 'count'
                  ? `${sessionsDone}/${subj.countTotal} sessions`
                  : isCheckoff
                    ? (checkedToday ? 'Done today' : 'Not done today')
                    : <>Today {todayDone}m{todayBonus > 0 && <span style={{ color: '#4A6741' }}> +{todayBonus}m bonus</span>}</>}
              </span>
              <div className="row" style={{ gap: 4 }}>
                {isCheckoff ? (
                  <button onClick={() => onMarkDone(k)} className={`tap ${checkedToday ? 'active' : ''}`} style={{ padding: '3px 12px', fontSize: 11, fontFamily: 'JetBrains Mono', borderColor: subj.accent, color: checkedToday ? '#F5F0E6' : subj.accent, background: checkedToday ? subj.accent : 'transparent' }}>
                    {checkedToday ? <><Check size={11} style={{ verticalAlign: 'middle' }} /> done</> : 'Mark done'}
                  </button>
                ) : (
                  <>
                    <button onClick={() => onFocusStart(k)} disabled={!!focus} className="tap" style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'JetBrains Mono', color: isFocusing ? '#4A6741' : '#6B6457' }} title="Start a focus timer">
                      <Play size={11} />
                    </button>
                    <button onClick={() => onLogExtra(k, 'edit')} className="tap" style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'JetBrains Mono', color: '#6B6457' }} title="Edit/reset today's time">
                      <Edit3 size={11} />
                    </button>
                    <button onClick={() => onLogExtra(k)} className="tap" style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'JetBrains Mono', borderColor: subj.accent, color: subj.accent }}>
                      + log
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="muted tiny" style={{ lineHeight: 1.4, marginTop: 4 }}>
        Play = start a focus timer. Pencil = edit today's time. Habits hide once you hit your weekly count.
      </div>
    </div>
  );
}

function MacrosCard({ targets, totals, onLog, onReset, onCoach }: any) {
  const [confirmReset, setConfirmReset] = useState(false);
  const items = [
    { key: 'protein', label: 'Protein', unit: 'g', primary: true, color: '#B8460E' },
    { key: 'calories', label: 'Calories', unit: '', color: '#3B5C6B' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: '#4A6741' },
    { key: 'fat', label: 'Fat', unit: 'g', color: '#C8932E' },
  ];
  const hasData = (totals.protein || 0) + (totals.calories || 0) > 0;
  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 12 }}>
        <div className="h2">Today's macros</div>
        <div className="row" style={{ gap: 6 }}>
          {hasData && !confirmReset && (
            <button className="tap" onClick={() => setConfirmReset(true)} style={{ padding: '6px 10px', fontSize: 12, color: '#B8460E' }}>
              <RotateCcw size={12} style={{ verticalAlign: 'middle' }} />
            </button>
          )}
          {confirmReset && (
            <>
              <button className="tap" style={{ padding: '6px 10px', fontSize: 11, color: '#B8460E', borderColor: '#B8460E' }} onClick={() => { onReset(); setConfirmReset(false); }}>Reset</button>
              <button className="tap" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => setConfirmReset(false)}>Cancel</button>
            </>
          )}
          <button className="tap" onClick={onLog} style={{ padding: '6px 12px', fontSize: 12 }}>
            <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log meal
          </button>
        </div>
      </div>
      {items.map(it => {
        const t = targets[it.key];
        const c = totals[it.key] || 0;
        const pct = Math.min(100, (c / Math.max(t, 1)) * 100);
        const over = c > t;
        return (
          <div key={it.key} style={{ marginBottom: 10 }}>
            <div className="between" style={{ marginBottom: 4 }}>
              <span className="small" style={{ fontWeight: it.primary ? 600 : 400 }}>{it.label}{it.primary && ' ★'}</span>
              <span className="mono tiny" style={{ color: over && it.primary ? '#4A6741' : over ? '#C8932E' : '#6B6457' }}>
                {Math.round(c)} / {t}{it.unit}
              </span>
            </div>
            <div className="progress-bar" style={{ height: 4 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: over ? (it.primary ? '#4A6741' : '#C8932E') : it.color }} />
            </div>
          </div>
        );
      })}
      <button className="tap" onClick={onCoach} style={{ width: '100%', marginTop: 8, color: '#8E4585', borderColor: '#8E4585' }}>
        <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Ask the nutrition coach
      </button>
      <div className="muted tiny" style={{ lineHeight: 1.4, marginTop: 8 }}>★ Protein is your priority. Hit that first. Rotate arrow to reset.</div>
    </div>
  );
}

function NutritionCoachModal({ settings, meals, body, onLogItem, onClose }: any) {
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const today = meals.log?.[todayStr()] || { protein: 0, carbs: 0, fat: 0, calories: 0 };
        const targets = settings.macroTargets;
        const remaining = { protein: Math.max(0, targets.protein - today.protein), carbs: Math.max(0, targets.carbs - today.carbs), fat: Math.max(0, targets.fat - today.fat), calories: Math.max(0, targets.calories - today.calories) };
        // 7-day averages from the meal log
        const days: string[] = [];
        for (let i = 6; i >= 0; i--) { const d = new Date(todayStr() + 'T00:00:00'); d.setDate(d.getDate() - i); days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); }
        const logged = days.map((d) => meals.log?.[d]).filter((x: any) => x && (x.protein || x.calories));
        const avg = (k: string) => logged.length ? Math.round(logged.reduce((a: number, b: any) => a + (b[k] || 0), 0) / logged.length) : 0;
        const weekAvg = { protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat'), calories: avg('calories') };
        const latest = body.entries?.[body.entries.length - 1] || null;
        const resp = await fetch('/api/nutrition-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ today, targets, remaining, weekAvg, bodyGoal: settings.bodyGoals, latestBody: latest }) });
        if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Coach unavailable.'); }
        setData(await resp.json()); setState('done');
      } catch (e: any) { setErr(e?.message || 'Coach unavailable.'); setState('error'); }
    })();
  }, []);

  const Suggestion = ({ item, label }: any) => (
    <div className="card" style={{ padding: 12, marginBottom: 8 }}>
      <div className="mono tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
      <div className="small" style={{ fontWeight: 600 }}>{item.name}</div>
      <div className="mono tiny muted" style={{ margin: '4px 0' }}>{item.protein}p · {item.carbs}c · {item.fat}f · {item.calories}cal</div>
      {item.why && <div className="muted tiny" style={{ lineHeight: 1.4, marginBottom: 8 }}>{item.why}</div>}
      <button className="tap" style={{ width: '100%' }} onClick={() => onLogItem({ name: item.name, source: 'Coach', protein: item.protein, carbs: item.carbs, fat: item.fat, calories: item.calories })}>
        <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log this
      </button>
    </div>
  );

  return (
    <ModalShell title="Nutrition coach" onClose={onClose} icon={<Zap size={18} color="#8E4585" />}>
      {state === 'loading' && <p className="muted small">Analyzing your day…</p>}
      {state === 'error' && <p className="small" style={{ color: '#B8460E' }}>{err}</p>}
      {state === 'done' && data && (
        <>
          {data.analysis?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="h3" style={{ marginBottom: 6 }}>Where you're at</div>
              {data.analysis.map((a: string, i: number) => <div key={i} className="small" style={{ marginBottom: 4, lineHeight: 1.45 }}>• {a}</div>)}
            </div>
          )}
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            {data.start?.length > 0 && (
              <div style={{ flex: 1 }}>
                <div className="mono tiny" style={{ color: '#4A6741', fontWeight: 600, marginBottom: 4 }}>EAT MORE</div>
                {data.start.map((s: string, i: number) => <div key={i} className="tiny" style={{ marginBottom: 2 }}>+ {s}</div>)}
              </div>
            )}
            {data.stop?.length > 0 && (
              <div style={{ flex: 1 }}>
                <div className="mono tiny" style={{ color: '#B8460E', fontWeight: 600, marginBottom: 4 }}>CUT BACK</div>
                {data.stop.map((s: string, i: number) => <div key={i} className="tiny" style={{ marginBottom: 2 }}>− {s}</div>)}
              </div>
            )}
          </div>
          <div className="h3" style={{ marginBottom: 8 }}>To finish your day</div>
          {data.snack?.name && <Suggestion item={data.snack} label="Snack" />}
          {data.meal?.name && <Suggestion item={data.meal} label="Meal" />}
        </>
      )}
    </ModalShell>
  );
}

function ChallengeCard({ settings, workout }: any) {
  const ch = settings.challenge;
  if (!ch?.active || !ch.startDate) return null;
  const dayNum = diffDays(todayStr(), ch.startDate) + 1;
  if (dayNum < 1 || dayNum > ch.days) return null;
  const weekNum = Math.ceil(dayNum / 7);
  const isDeloadWeek = weekNum === ch.deloadWeek;
  const pct = (dayNum / ch.days) * 100;
  const sessions = Object.keys(workout.logs || {}).filter((d: string) => {
    const dn = diffDays(d, ch.startDate);
    return dn >= 0 && dn < ch.days;
  }).length;

  return (
    <div className="card" style={{ borderLeft: `3px solid #8E4585` }}>
      <div className="between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <Zap size={16} color="#8E4585" />
          <span className="h3">{ch.name}</span>
        </div>
        <span className="mono tiny" style={{ color: '#8E4585' }}>Day {dayNum} / {ch.days}</span>
      </div>
      <div className="progress-bar" style={{ marginBottom: 8 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: '#8E4585' }} />
      </div>
      <div className="between">
        <span className="mono tiny muted">Week {weekNum} {isDeloadWeek && '· DELOAD'}</span>
        <span className="mono tiny muted">{sessions} sessions logged</span>
      </div>
      {isDeloadWeek && (
        <p className="muted tiny" style={{ marginTop: 8, lineHeight: 1.4 }}>
          Deload week: drop weights ~30%, keep form perfect. Recovery is the goal.
        </p>
      )}
    </div>
  );
}

function WeeklySummary({ settings, totals, daily, meals, workout }: any) {
  const week = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStr() + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const dstr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      days.push(dstr);
    }
    return days;
  }, []);

  const workoutsThisWeek = week.filter((d: string) => workout.logs?.[d]).length;
  const proteinDays = week.map((d: string) => meals.log?.[d]?.protein).filter((x: any) => x != null && x > 0);
  const avgProtein = proteinDays.length > 0 ? proteinDays.reduce((a: number, b: number) => a + b, 0) / proteinDays.length : 0;

  return (
    <div className="card">
      <div className="h2" style={{ marginBottom: 12 }}>Last 7 days</div>
      <div className="row" style={{ gap: 4, marginBottom: 14, justifyContent: 'space-between' }}>
        {week.map((d: string) => {
          const dn = new Date(d + 'T00:00:00');
          const dow = ['S','M','T','W','T','F','S'][dn.getDay()];
          const dayNum = dn.getDate();
          const hadWorkout = !!workout.logs?.[d];
          const isToday = d === todayStr();
          return (
            <div key={d} style={{ flex: 1, textAlign: 'center' }}>
              <div className="tiny muted" style={{ marginBottom: 2 }}>{dow}</div>
              <div style={{
                width: 28, height: 28, lineHeight: '28px', textAlign: 'center', borderRadius: 6,
                background: isToday ? '#1A1A2E' : hadWorkout ? '#3B5C6B' : '#FBF7EE',
                color: isToday || hadWorkout ? '#F5F0E6' : '#6B6457',
                fontFamily: 'JetBrains Mono', fontSize: 12, margin: '0 auto',
                border: '1px solid #E4DCC8',
              }}>{dayNum}</div>
            </div>
          );
        })}
      </div>
      <div className="between" style={{ marginBottom: 6 }}>
        <span className="small">Workouts this week</span>
        <span className="mono small" style={{ color: workoutsThisWeek >= 5 ? '#4A6741' : workoutsThisWeek >= 3 ? '#C8932E' : '#B8460E' }}>
          {workoutsThisWeek} / 6
        </span>
      </div>
      <div className="between" style={{ marginBottom: 6 }}>
        <span className="small">Avg protein</span>
        <span className="mono small" style={{ color: avgProtein >= settings.macroTargets.protein * 0.9 ? '#4A6741' : '#B8460E' }}>
          {Math.round(avgProtein)}g
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// BODY TAB
// ════════════════════════════════════════════════════════════════════════════════
function BodyTab({ settings, body, workout, onAddEntry, onEditGoals }: any) {
  const entries = body.entries || [];
  const latest = entries[entries.length - 1];
  const prev = entries[entries.length - 2];
  const daysUntilNext = settings.nextMeasurement ? diffDays(settings.nextMeasurement) : null;
  const isDue = daysUntilNext !== null && daysUntilNext <= 0;

  const recompScore = useMemo(() => {
    if (entries.length < 2 || !latest) return null;
    const baseline = entries[0];
    let totalWeight = 0;
    let progressSum = 0;
    Object.entries(settings.bodyGoals).forEach(([k, g]: [string, any]) => {
      const start = baseline[k]; const cur = latest[k];
      if (start == null || cur == null) return;
      const w = g.weight || 1;
      const delta = cur - start;
      const direction = g.direction === 'down' ? -1 : 1;
      const signed = delta * direction;
      const pct = start === 0 ? 0 : (signed / Math.abs(start)) * 100;
      progressSum += pct * w;
      totalWeight += w;
    });
    return totalWeight > 0 ? progressSum / totalWeight : 0;
  }, [entries, settings.bodyGoals, latest]);

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 18 }}>Body & composition.</h1>

      <div className="card" style={{ borderLeft: `3px solid ${isDue ? '#B8460E' : '#4A6741'}` }}>
        <div className="between">
          <div>
            <div className="h2" style={{ marginBottom: 4 }}>Next measurement</div>
            <div className="h3">
              {isDue ? "Today — let's log it" : settings.nextMeasurement ? `${fmtShortDate(settings.nextMeasurement)} · in ${daysUntilNext}d` : 'Not scheduled'}
            </div>
          </div>
          <button className="btn btn-accent" onClick={onAddEntry} style={{ fontSize: 13, padding: '10px 14px' }}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <div className="h2" style={{ marginBottom: 10 }}>No measurements yet</div>
          <p className="small muted" style={{ lineHeight: 1.5, marginBottom: 12 }}>
            Tap "Log" above to enter your first set. Going forward, monthly on the same date.
          </p>
          <button className="btn btn-ghost" onClick={onEditGoals} style={{ width: '100%' }}>
            <Target size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Set goal targets
          </button>
        </div>
      ) : (
        <>
          {recompScore !== null && (
            <div className="card">
              <div className="between" style={{ marginBottom: 10 }}>
                <div className="h2">Recomp score</div>
                <span className="mono small muted">{entries.length} entries</span>
              </div>
              <div className="row" style={{ gap: 14 }}>
                <div style={{ fontSize: 36, fontWeight: 600, color: recompScore >= 0 ? '#4A6741' : '#B8460E', fontFamily: 'Fraunces' }}>
                  {recompScore >= 0 ? '+' : ''}{recompScore.toFixed(1)}%
                </div>
                <div className="muted small" style={{ lineHeight: 1.4, flex: 1 }}>
                  {recompScore > 2 ? "Solid progress on the recomp signal."
                    : recompScore > 0 ? "Moving in the right direction. Push it."
                    : recompScore > -2 ? "Roughly flat. Tighten diet or push intensity."
                    : "Trending wrong way. See the breakdown below."}
                </div>
              </div>
            </div>
          )}

          {entries.filter((e: any) => e.weight != null).length >= 2 && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Weight trend ({measureUnit('lb')})</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={entries.filter((e: any) => e.weight != null).map((e: any) => ({ date: fmtShortDate(e.date), weight: toDisplayVal('lb', e.weight) }))} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} />
                  <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="weight" stroke="#B8460E" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <div className="between" style={{ marginBottom: 14 }}>
              <div className="h2">Measurement detail</div>
              <button onClick={onEditGoals} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}>
                <Target size={16} />
              </button>
            </div>
            {MEASUREMENT_FIELDS.map(f => {
              const goal = settings.bodyGoals[f.key];
              if (!goal) return null;
              const current = latest?.[f.key];
              const previous = prev?.[f.key];
              const start = entries[0]?.[f.key];
              if (current == null) return null;
              const dir = goal.direction;
              const change = previous != null ? current - previous : null;
              const totalChange = start != null ? current - start : null;
              const isGood = change != null ? (dir === 'down' ? change <= 0 : change >= 0) : null;

              let targetPct = null;
              if (goal.target != null && start != null) {
                const totalNeeded = goal.target - start;
                const progressMade = current - start;
                if (totalNeeded !== 0) targetPct = Math.max(0, Math.min(100, (progressMade / totalNeeded) * 100));
              }

              return (
                <div key={f.key} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #E4DCC8' }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span className="small" style={{ fontWeight: 600 }}>{f.label}</span>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="mono small">{toDisplayVal(f.unit, current)}{measureUnit(f.unit)}</span>
                      {change != null && (
                        <span className="pill" style={{ background: isGood ? '#E8EBE0' : '#F5E1D5', color: isGood ? '#4A6741' : '#B8460E', padding: '2px 8px' }}>
                          {change >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                          {Math.abs(toDisplayVal(f.unit, Math.abs(change)) || 0).toFixed(1)}{measureUnit(f.unit)}
                        </span>
                      )}
                    </div>
                  </div>
                  {totalChange != null && start != null && (
                    <div className="mono tiny muted" style={{ marginBottom: 4 }}>
                      Since start: {totalChange >= 0 ? '+' : ''}{((totalChange < 0 ? -1 : 1) * (toDisplayVal(f.unit, Math.abs(totalChange)) || 0)).toFixed(1)}{measureUnit(f.unit)}
                      {goal.target != null && <> · target {toDisplayVal(f.unit, goal.target)}{measureUnit(f.unit)}</>}
                    </div>
                  )}
                  {targetPct != null && (
                    <div className="progress-bar" style={{ height: 4 }}>
                      <div className="progress-fill" style={{ width: `${targetPct}%`, background: targetPct >= 0 ? '#4A6741' : '#B8460E' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// JOURNAL TAB
// ════════════════════════════════════════════════════════════════════════════════
function JournalTab({ journal, onSave }: any) {
  const today = todayStr();
  const todayEntry = journal[today] || { note: '', trades: [] };
  const [note, setNote] = useState(todayEntry.note || '');
  const [trades, setTrades] = useState<any[]>(todayEntry.trades || []);
  const [view, setView] = useState<'today'|'trades'|'history'>('today');
  const [tradeForm, setTradeForm] = useState({ symbol: '', direction: 'L', entry: '', exit: '', pnl: '', notes: '' });
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveNote = async () => {
    const next = { ...journal, [today]: { ...todayEntry, note, trades } };
    await onSave(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addTrade = async () => {
    const t = { ...tradeForm, id: 't' + Date.now(), date: today };
    const newTrades = [...trades, t];
    setTrades(newTrades);
    await onSave({ ...journal, [today]: { ...todayEntry, note, trades: newTrades } });
    setTradeForm({ symbol: '', direction: 'L', entry: '', exit: '', pnl: '', notes: '' });
    setShowTradeForm(false);
  };

  const removeTrade = async (id: string) => {
    const newTrades = trades.filter((t: any) => t.id !== id);
    setTrades(newTrades);
    await onSave({ ...journal, [today]: { ...todayEntry, note, trades: newTrades } });
  };

  const allDates = Object.keys(journal).sort((a, b) => b.localeCompare(a));
  const allTrades = allDates.flatMap((d: string) => (journal[d]?.trades || []).map((t: any) => ({ ...t, date: t.date || d })));
  const totalPnl = allTrades.reduce((sum: number, t: any) => sum + (parseFloat(t.pnl) || 0), 0);
  const winTrades = allTrades.filter((t: any) => parseFloat(t.pnl) > 0);
  const winRate = allTrades.length > 0 ? Math.round((winTrades.length / allTrades.length) * 100) : 0;

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 6 }}>Journal.</h1>
      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        <button className={`tap ${view === 'today' ? 'active' : ''}`} onClick={() => setView('today')}>Today</button>
        <button className={`tap ${view === 'trades' ? 'active' : ''}`} onClick={() => setView('trades')}>
          <DollarSign size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Trades
        </button>
        <button className={`tap ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>History</button>
      </div>

      {view === 'today' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="h3">Daily notes</span>
              <div className="row" style={{ gap: 6 }}>
                <VoiceButton onResult={(t: string) => setNote((prev: string) => prev ? `${prev} ${t}` : t)} />
                <span className="mono tiny muted">{fmtShortDate(today)}</span>
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on your mind? Progress, setbacks, ideas, reflections…"
              style={{ width: '100%', minHeight: 140, fontFamily: 'Fraunces, serif', fontSize: 15, padding: 10, border: '1px solid #E4DCC8', borderRadius: 8, background: '#FBF7EE', color: '#1A1A2E', resize: 'vertical', lineHeight: 1.6 }}
            />
            <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={saveNote}>
              {saved ? <><Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Saved</> : <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Save note</>}
            </button>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="h3">Today's trades</span>
              <button className="tap" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setShowTradeForm(!showTradeForm)}>
                <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />Add
              </button>
            </div>

            {showTradeForm && (
              <div style={{ padding: 12, background: '#FBF7EE', borderRadius: 8, border: '1px solid #E4DCC8', marginBottom: 12 }}>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 2 }}><label>Symbol</label><input type="text" value={tradeForm.symbol} onChange={e => setTradeForm({ ...tradeForm, symbol: e.target.value.toUpperCase() })} placeholder="AAPL" /></div>
                  <div style={{ flex: 1 }}>
                    <label>Side</label>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <button className={`tap ${tradeForm.direction === 'L' ? 'active' : ''}`} style={{ flex: 1, padding: '6px 0' }} onClick={() => setTradeForm({ ...tradeForm, direction: 'L' })}>Long</button>
                      <button className={`tap ${tradeForm.direction === 'S' ? 'active' : ''}`} style={{ flex: 1, padding: '6px 0' }} onClick={() => setTradeForm({ ...tradeForm, direction: 'S' })}>Short</button>
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}><label>Entry $</label><input type="number" value={tradeForm.entry} onChange={e => setTradeForm({ ...tradeForm, entry: e.target.value })} placeholder="0.00" /></div>
                  <div style={{ flex: 1 }}><label>Exit $</label><input type="number" value={tradeForm.exit} onChange={e => setTradeForm({ ...tradeForm, exit: e.target.value })} placeholder="0.00" /></div>
                  <div style={{ flex: 1 }}><label>P&amp;L $</label><input type="number" value={tradeForm.pnl} onChange={e => setTradeForm({ ...tradeForm, pnl: e.target.value })} placeholder="0.00" /></div>
                </div>
                <label>Notes</label>
                <input type="text" value={tradeForm.notes} onChange={e => setTradeForm({ ...tradeForm, notes: e.target.value })} placeholder="Setup, reason, lesson…" style={{ marginBottom: 10 }} />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowTradeForm(false)}>Cancel</button>
                  <button className="btn" style={{ flex: 1 }} onClick={addTrade} disabled={!tradeForm.symbol}>
                    <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add trade
                  </button>
                </div>
              </div>
            )}

            {trades.length === 0 && <p className="muted small">No trades logged today.</p>}
            {trades.map((t: any) => (
              <div key={t.id} className="card" style={{ padding: 10, marginBottom: 8, borderLeft: `3px solid ${parseFloat(t.pnl) >= 0 ? '#4A6741' : '#B8460E'}` }}>
                <div className="between">
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="small" style={{ fontWeight: 700 }}>{t.symbol}</span>
                      <span className="mono tiny" style={{ color: t.direction === 'L' ? '#4A6741' : '#B8460E', background: t.direction === 'L' ? '#E8F0E6' : '#F5E1D5', padding: '1px 6px', borderRadius: 4 }}>{t.direction === 'L' ? 'LONG' : 'SHORT'}</span>
                      {t.pnl && <span className="mono tiny" style={{ color: parseFloat(t.pnl) >= 0 ? '#4A6741' : '#B8460E', fontWeight: 600 }}>{parseFloat(t.pnl) >= 0 ? '+' : ''}{t.pnl}</span>}
                    </div>
                    {(t.entry || t.exit) && <div className="mono tiny muted" style={{ marginTop: 2 }}>{t.entry && `Entry ${t.entry}`}{t.exit && ` → Exit ${t.exit}`}</div>}
                    {t.notes && <div className="muted tiny" style={{ marginTop: 4, fontStyle: 'italic' }}>{t.notes}</div>}
                  </div>
                  <button onClick={() => removeTrade(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E', padding: 4 }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'trades' && (
        <>
          {allTrades.length > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 12, background: '#EEF8EC', border: '1px solid #C8E4C4' }}>
              <div className="h3" style={{ marginBottom: 10 }}>Summary</div>
              <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
                <div><div className="mono tiny muted">Total P&L</div><div className="mono small" style={{ fontWeight: 700, color: totalPnl >= 0 ? '#4A6741' : '#B8460E' }}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}</div></div>
                <div><div className="mono tiny muted">Win rate</div><div className="mono small" style={{ fontWeight: 700 }}>{winRate}%</div></div>
                <div><div className="mono tiny muted">Trades</div><div className="mono small" style={{ fontWeight: 700 }}>{allTrades.length}</div></div>
                <div><div className="mono tiny muted">W / L</div><div className="mono small" style={{ fontWeight: 700, color: '#4A6741' }}>{winTrades.length}<span style={{ color: '#6B6457' }}>/</span><span style={{ color: '#B8460E' }}>{allTrades.length - winTrades.length}</span></div></div>
              </div>
            </div>
          )}
          {allTrades.length === 0 && <p className="muted small" style={{ marginBottom: 12 }}>No trades logged yet.</p>}
          {allTrades.slice(0, 30).map((t: any, i: number) => (
            <div key={i} className="card" style={{ padding: 10, marginBottom: 8, borderLeft: `3px solid ${parseFloat(t.pnl) >= 0 ? '#4A6741' : '#B8460E'}` }}>
              <div className="between">
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="small" style={{ fontWeight: 700 }}>{t.symbol}</span>
                    <span className="mono tiny" style={{ color: t.direction === 'L' ? '#4A6741' : '#B8460E' }}>{t.direction === 'L' ? 'LONG' : 'SHORT'}</span>
                    {t.pnl && <span className="mono tiny" style={{ color: parseFloat(t.pnl) >= 0 ? '#4A6741' : '#B8460E', fontWeight: 600 }}>{parseFloat(t.pnl) >= 0 ? '+' : ''}{t.pnl}</span>}
                    <span className="mono tiny muted">{fmtShortDate(t.date)}</span>
                  </div>
                  {t.notes && <div className="muted tiny" style={{ marginTop: 4, fontStyle: 'italic' }}>{t.notes}</div>}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {view === 'history' && (
        <>
          {allDates.length === 0 && <p className="muted small">No journal entries yet.</p>}
          {allDates.slice(0, 30).map((d: string) => {
            const entry = journal[d];
            const dayTrades = entry?.trades || [];
            const dayPnl = dayTrades.reduce((s: number, t: any) => s + (parseFloat(t.pnl) || 0), 0);
            return (
              <div key={d} className="card" style={{ padding: 12, marginBottom: 8 }}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>{fmtDate(d)}</span>
                  <div className="row" style={{ gap: 10 }}>
                    {dayTrades.length > 0 && <span className="mono tiny" style={{ color: dayPnl >= 0 ? '#4A6741' : '#B8460E' }}>{dayTrades.length} trades {dayPnl >= 0 ? '+' : ''}{dayPnl.toFixed(0)}</span>}
                    {entry?.note && <BookMarked size={12} color="#6B6457" />}
                  </div>
                </div>
                {entry?.note && <p className="small muted" style={{ lineHeight: 1.5, maxHeight: 60, overflow: 'hidden', WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>{entry.note}</p>}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// WORKOUT TAB
// ════════════════════════════════════════════════════════════════════════════════
function WorkoutTab({ workout, onLogWorkout, onEditSplit, onSaveWorkout, settings }: any) {
  const today = dayOfWeek();
  const mode = workout.mode || 'sequence';
  const location = workout.location || 'gym';
  const activeSplit = location === 'home' ? (workout.homeSplit || HOME_WORKOUT_SPLIT) : (workout.split || DEFAULT_WORKOUT_SPLIT);

  let todayWorkout: any;
  let todayWorkoutIdx: number;
  if (mode === 'calendar') {
    todayWorkout = activeSplit.find((w: any) => w.day === today) || activeSplit[0];
    todayWorkoutIdx = activeSplit.indexOf(todayWorkout);
  } else {
    const nonRestDays = activeSplit.filter((d: any) => !d.rest);
    const seqPos = workout.sequencePosition || 1;
    const seqIdx = ((seqPos - 1) % nonRestDays.length);
    todayWorkout = nonRestDays[seqIdx];
    todayWorkoutIdx = activeSplit.indexOf(todayWorkout);
  }
  const todayLog = workout.logs[todayStr()];

  const recentLogs = Object.entries(workout.logs).sort((a: any, b: any) => b[0].localeCompare(a[0])).slice(0, 5);

  const lastWeights = useMemo(() => {
    const map: Record<string, any> = {};
    const sortedLogs = Object.entries(workout.logs).sort((a: any, b: any) => b[0].localeCompare(a[0]));
    for (const [date, log] of sortedLogs as [string, any][]) {
      if (!log.exercises) continue;
      for (const ex of log.exercises) {
        if (map[ex.name]) continue;
        const lastSet = ex.sets?.filter((s: any) => s.weight).pop();
        if (lastSet) map[ex.name] = { weight: lastSet.weight, reps: lastSet.reps, date };
      }
    }
    return map;
  }, [workout.logs]);

  const toggleMode = async () => {
    const newMode = mode === 'sequence' ? 'calendar' : 'sequence';
    await onSaveWorkout({ ...workout, mode: newMode });
  };

  const toggleLocation = async () => {
    const newLoc = location === 'gym' ? 'home' : 'gym';
    if (newLoc === 'home' && !workout.homeSplit) {
      await onSaveWorkout({ ...workout, location: newLoc, homeSplit: HOME_WORKOUT_SPLIT });
    } else {
      await onSaveWorkout({ ...workout, location: newLoc });
    }
  };

  const advanceSequence = async () => {
    const nonRestDays = activeSplit.filter((d: any) => !d.rest);
    const next = ((workout.sequencePosition || 1) % nonRestDays.length) + 1;
    await onSaveWorkout({ ...workout, sequencePosition: next });
  };

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 6 }}>Today's lift.</h1>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={toggleLocation} className={`tap ${location === 'gym' ? 'active' : ''}`} style={{ padding: '6px 14px', fontSize: 12 }}>
          <Building2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Gym
        </button>
        <button onClick={toggleLocation} className={`tap ${location === 'home' ? 'active' : ''}`} style={{ padding: '6px 14px', fontSize: 12 }}>
          <TreePine size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Home
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={toggleMode} className="tap" style={{ padding: '4px 10px', fontSize: 11 }}>
          <Repeat size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {mode === 'sequence' ? 'Calendar' : 'Sequence'}
        </button>
      </div>

      {todayWorkout.rest ? (
        <div className="card">
          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            <Moon size={20} color="#3B5C6B" />
            <div className="h3">Rest day</div>
          </div>
          <p className="muted small" style={{ lineHeight: 1.5 }}>
            Recovery. Light walking, stretching, or mobility work if you want it. Sleep + protein matter more today.
          </p>
        </div>
      ) : (
        <div className="card" style={{ borderLeft: '3px solid #3B5C6B' }}>
          <div className="between" style={{ marginBottom: 14 }}>
            <div>
              <div className="h2" style={{ marginBottom: 2 }}>
                {mode === 'sequence' ? `Next up` : `Day ${todayWorkout.day}`}
              </div>
              <div className="h3">{todayWorkout.name}</div>
            </div>
            {todayLog && <Check size={20} color="#4A6741" />}
          </div>
          {todayWorkout.exercises.map((ex: any, i: number) => {
            const logged = todayLog?.exercises?.[i];
            const lastW = lastWeights[ex.name];
            return (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < todayWorkout.exercises.length - 1 ? '1px solid #E4DCC8' : 'none' }}>
                <div className="between">
                  <span className="small" style={{ fontWeight: 600 }}>{ex.name}</span>
                  <span className="mono tiny muted">{ex.sets} × {ex.reps}</span>
                </div>
                {lastW && !logged && (
                  <div className="mono tiny" style={{ marginTop: 4, color: '#6B6457' }}>
                    Last: {lastW.weight}×{lastW.reps} ({fmtShortDate(lastW.date)})
                  </div>
                )}
                {logged?.sets?.length > 0 && (
                  <div className="mono tiny muted" style={{ marginTop: 4 }}>
                    {logged.sets.map((s: any, j: number) => `${s.weight || '—'}×${s.reps || '—'}`).join('  ')}
                  </div>
                )}
              </div>
            );
          })}
          <button className="btn" onClick={() => onLogWorkout(todayWorkoutIdx)} style={{ width: '100%', marginTop: 14 }}>
            {todayLog ? <><Edit3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Edit today's log</> : <><Dumbbell size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Log workout</>}
          </button>
          {mode === 'sequence' && (
            <button className="btn btn-ghost" onClick={advanceSequence} style={{ width: '100%', marginTop: 8 }}>
              Skip · go to next workout
            </button>
          )}
        </div>
      )}

      {recentLogs.length > 0 && (
        <div className="card">
          <div className="h2" style={{ marginBottom: 10 }}>Recent sessions</div>
          {recentLogs.map(([date, log]: [string, any]) => (
            <div key={date} className="between" style={{ padding: '8px 0', borderBottom: '1px solid #E4DCC8' }}>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>{log.name || 'Session'}</div>
                <div className="mono tiny muted">{fmtShortDate(date)}</div>
              </div>
              <span className="mono tiny muted">{log.exercises?.length || 0} exercises</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <div className="h2">Weekly split</div>
          <button onClick={onEditSplit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}>
            <Edit3 size={16} />
          </button>
        </div>
        {activeSplit.map((day: any, i: number) => (
          <div key={i} className="between" style={{ padding: '8px 0', borderBottom: i < activeSplit.length - 1 ? '1px solid #E4DCC8' : 'none', opacity: (mode === 'calendar' && day.day === today) || (mode === 'sequence' && day === todayWorkout) ? 1 : 0.7 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="mono tiny muted">
                {mode === 'calendar' ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.day] : day.rest ? 'REST' : `D${activeSplit.filter((d: any) => !d.rest).indexOf(day) + 1}`}
              </span>
              <span className="small" style={{ fontWeight: ((mode === 'calendar' && day.day === today) || (mode === 'sequence' && day === todayWorkout)) ? 600 : 400 }}>{day.name}</span>
            </div>
            {((mode === 'calendar' && day.day === today) || (mode === 'sequence' && day === todayWorkout)) && !day.rest && <span className="mono tiny" style={{ color: '#B8460E' }}>TODAY</span>}
          </div>
        ))}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PLAN TAB
// ════════════════════════════════════════════════════════════════════════════════
function PlanTab({ plans, settings, onPlanDay }: any) {
  const today = todayStr();
  const upcoming = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const dstr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    upcoming.push(dstr);
  }

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 18 }}>Plan ahead.</h1>
      <div className="card" style={{ borderLeft: '3px solid #B8460E' }}>
        <div className="h2" style={{ marginBottom: 6 }}>Tomorrow</div>
        <PlanRow date={tomorrowStr()} plans={plans} onClick={() => onPlanDay(tomorrowStr())} highlight />
      </div>
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>This week</div>
        {upcoming.map(d => (
          <PlanRow key={d} date={d} plans={plans} onClick={() => onPlanDay(d)} />
        ))}
      </div>
    </>
  );
}

function PlanRow({ date, plans, onClick, highlight }: any) {
  const p = plans[date];
  const isToday = date === todayStr();
  const dn = new Date(date + 'T00:00:00');
  const dow = dn.toLocaleDateString('en-US', { weekday: 'short' });
  const day = dn.getDate();

  return (
    <div onClick={onClick} style={{ padding: '12px 4px', borderBottom: '1px solid #E4DCC8', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ width: 40, textAlign: 'center' }}>
        <div className="mono tiny muted" style={{ textTransform: 'uppercase' }}>{dow}</div>
        <div className="h3">{day}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {p ? (
          <>
            {p.wakeTime && <div className="mono tiny muted">Wake {fmtTime(p.wakeTime)}</div>}
            {p.commitments?.length > 0 && (
              <div className="small" style={{ marginTop: 2 }}>
                {p.commitments.map((c: any, i: number) => (
                  <span key={i}>{c.time && `${fmtTime(c.time)} `}{c.title}{i < p.commitments.length - 1 ? ' · ' : ''}</span>
                ))}
              </div>
            )}
            {p.customTasks?.length > 0 && (
              <div className="muted tiny" style={{ marginTop: 2 }}>+{p.customTasks.length} task{p.customTasks.length > 1 ? 's' : ''}</div>
            )}
            {(!p.wakeTime && !p.commitments?.length && !p.customTasks?.length) && <span className="muted small">Tap to add</span>}
          </>
        ) : (
          <span className="muted small">{isToday ? 'No extras logged today' : 'Tap to plan'}</span>
        )}
      </div>
      <ChevronRight size={16} color="#6B6457" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// HISTORY TAB
// ════════════════════════════════════════════════════════════════════════════════
function HistoryTab({ settings, totals, workout, meals, body, activity, streaks, onSelectDay }: any) {
  const [month, setMonth] = useState(() => {
    const d = new Date(todayStr() + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const monthName = new Date(month.year, month.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const firstDOW = new Date(month.year, month.month, 1).getDay();

  const goPrev = () => {
    const m = month.month - 1;
    if (m < 0) setMonth({ year: month.year - 1, month: 11 });
    else setMonth({ year: month.year, month: m });
  };
  const goNext = () => {
    const m = month.month + 1;
    if (m > 11) setMonth({ year: month.year + 1, month: 0 });
    else setMonth({ year: month.year, month: m });
  };

  const monthDays = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dstr = `${month.year}-${pad(month.month + 1)}-${pad(i)}`;
    monthDays.push(dstr);
  }
  const workoutsLogged = monthDays.filter(d => workout.logs?.[d]).length;
  const mealsLogged = monthDays.filter(d => meals.log?.[d]).length;
  const proteinValues = monthDays.map(d => meals.log?.[d]?.protein).filter((x: any) => x != null && x > 0);
  const avgProtein = proteinValues.length > 0 ? Math.round(proteinValues.reduce((a: number, b: number) => a + b, 0) / proteinValues.length) : 0;

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 18 }}>History.</h1>

      <div className="card">
        <div className="between" style={{ marginBottom: 14 }}>
          <button onClick={goPrev} className="tap" style={{ padding: 6 }}><ChevronLeft size={16} /></button>
          <div className="h3">{monthName}</div>
          <button onClick={goNext} className="tap" style={{ padding: 6 }}><ChevronRight size={16} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 14 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="mono tiny muted" style={{ textAlign: 'center', padding: 4 }}>{d}</div>
          ))}
          {Array.from({ length: firstDOW }).map((_, i) => <div key={`empty-${i}`} />)}
          {monthDays.map(d => {
            const dn = parseInt(d.split('-')[2]);
            const hasWorkout = !!workout.logs?.[d];
            const hasMeal = !!meals.log?.[d];
            const hasMeasurement = body.entries?.some((e: any) => e.date === d);
            const hasActivity = !!(activity?.[d]?.length);
            const isToday = d === todayStr();
            const isFuture = diffDays(d) > 0;
            return (
              <button
                key={d}
                onClick={() => !isFuture && onSelectDay(d)}
                disabled={isFuture}
                style={{
                  padding: '6px 0',
                  background: isToday ? '#1A1A2E' : (hasWorkout || hasMeal || hasMeasurement || hasActivity) ? '#FBF7EE' : 'transparent',
                  border: '1px solid #E4DCC8',
                  borderRadius: 6,
                  cursor: isFuture ? 'default' : 'pointer',
                  fontFamily: 'JetBrains Mono', fontSize: 12,
                  color: isToday ? '#F5F0E6' : isFuture ? '#D4CCB8' : '#1A1A2E',
                  opacity: isFuture ? 0.4 : 1,
                }}
              >
                <div>{dn}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 2, minHeight: 6 }}>
                  {hasWorkout && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#3B5C6B' }} />}
                  {hasMeal && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#4A6741' }} />}
                  {hasMeasurement && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#B8460E' }} />}
                  {hasActivity && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#C8932E' }} />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <span className="tiny muted"><span className="swatch" style={{ background: '#3B5C6B' }} />Workout</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#4A6741' }} />Meals</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#B8460E' }} />Measurement</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#C8932E' }} />Activity</span>
        </div>
      </div>

      {(() => {
        const days: any[] = [];
        for (let i = 13; i >= 0; i--) { const d = new Date(todayStr() + 'T00:00:00'); d.setDate(d.getDate() - i); const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, protein: Math.round(meals.log?.[ds]?.protein || 0) }); }
        if (!days.some((d) => d.protein > 0)) return null;
        return (
          <div className="card">
            <div className="h2" style={{ marginBottom: 10 }}>Protein · last 14 days</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={days} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} interval={1} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} />
                <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="protein" fill="#B8460E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mono tiny muted" style={{ textAlign: 'center' }}>Target: {settings.macroTargets.protein}g/day</div>
          </div>
        );
      })()}

      <div className="card">
        <div className="h2" style={{ marginBottom: 12 }}>This month</div>
        <div className="between" style={{ padding: '6px 0' }}>
          <span className="small">Workouts logged</span>
          <span className="mono small">{workoutsLogged}</span>
        </div>
        <div className="between" style={{ padding: '6px 0' }}>
          <span className="small">Days with meals tracked</span>
          <span className="mono small">{mealsLogged}</span>
        </div>
        <div className="between" style={{ padding: '6px 0' }}>
          <span className="small">Avg protein (logged days)</span>
          <span className="mono small">{avgProtein}g</span>
        </div>
      </div>

      {(() => {
        const badges = computeAchievements(totals, streaks, workout, body, meals);
        const earned = badges.filter((b) => b.earned).length;
        return (
          <div className="card">
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="h2">Achievements</div>
              <span className="mono small muted">{earned}/{badges.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {badges.map((b) => (
                <div key={b.id} title={b.desc} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: b.earned ? '#FBF7EE' : '#F2EEE4', border: `1px solid ${b.earned ? '#C8932E' : '#E4DCC8'}`, opacity: b.earned ? 1 : 0.5 }}>
                  <Trophy size={18} color={b.earned ? '#C8932E' : '#A0A898'} />
                  <div className="tiny" style={{ fontWeight: 600, marginTop: 4 }}>{b.label}</div>
                  <div className="tiny muted" style={{ lineHeight: 1.3 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <p className="muted tiny" style={{ textAlign: 'center', marginTop: 8 }}>Tap any past day for the full breakdown.</p>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════════════════════════════════════════
function ModalShell({ title, onClose, children, icon = null, color = '#1A1A2E' }: any) {
  return (
    <motion.div className="modal-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <motion.div className="modal" onClick={(e: any) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
        <div className="between" style={{ marginBottom: 18 }}>
          <div className="row" style={{ gap: 10 }}>
            {icon}
            <div style={{ fontSize: 19, fontWeight: 600, color }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function DayDetailModal({ date, settings, totals, workout, meals, body, activity, onClose }: any) {
  const dayMeals = meals.log?.[date];
  const dayEntries = meals.entries?.[date] || [];
  const dayWorkout = workout.logs?.[date];
  const dayMeasurement = body.entries?.find((e: any) => e.date === date);
  const dayActivities = activity?.[date] || [];

  return (
    <ModalShell title={fmtDate(date)} onClose={onClose} icon={<History size={18} color="#6B6457" />}>
      {dayActivities.length > 0 && (
        <>
          <div className="h2" style={{ marginBottom: 8 }}>Activities</div>
          <div className="card" style={{ padding: 12, marginBottom: 14 }}>
            {dayActivities.map((a: any, i: number) => (
              <div key={i} className="between" style={{ padding: '4px 0' }}>
                <span className="small">{a.reason}</span>
                <span className="mono tiny muted">{fmtTime(a.start)}–{fmtTime(a.end)} · {a.mins}m</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="h2" style={{ marginBottom: 8 }}>Nutrition</div>
      {dayMeals && (dayMeals.protein || dayMeals.calories || dayMeals.carbs || dayMeals.fat) ? (
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div><div className="mono tiny muted">PROTEIN</div><div className="h3" style={{ color: '#B8460E' }}>{Math.round(dayMeals.protein || 0)}g</div></div>
            <div><div className="mono tiny muted">CALORIES</div><div className="h3">{Math.round(dayMeals.calories || 0)}</div></div>
            <div><div className="mono tiny muted">CARBS</div><div className="h3">{Math.round(dayMeals.carbs || 0)}g</div></div>
            <div><div className="mono tiny muted">FAT</div><div className="h3">{Math.round(dayMeals.fat || 0)}g</div></div>
          </div>
          {dayEntries.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid #E4DCC8', paddingTop: 8 }}>
              {dayEntries.map((e: any) => (
                <div key={e.id} className="between" style={{ padding: '3px 0' }}>
                  <span className="small">{e.name}</span>
                  <span className="mono tiny muted">{e.protein}p · {e.carbs}c · {e.fat}f · {e.calories}cal</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="muted small" style={{ marginBottom: 14 }}>No meals logged this day.</p>
      )}

      <div className="h2" style={{ marginBottom: 8 }}>Workout</div>
      {dayWorkout ? (
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <div className="h3" style={{ marginBottom: 8 }}>{dayWorkout.name}</div>
          {dayWorkout.exercises?.map((ex: any, i: number) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: i < dayWorkout.exercises.length - 1 ? '1px solid #E4DCC8' : 'none' }}>
              <div className="small" style={{ fontWeight: 500, marginBottom: 2 }}>{ex.name}</div>
              {ex.sets?.length > 0 && (
                <div className="mono tiny muted">
                  {ex.sets.filter((s: any) => s.weight || s.reps).map((s: any) => `${s.weight || '—'}×${s.reps || '—'}${s.rpe ? ` @${s.rpe}` : ''}`).join('  ·  ')}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small" style={{ marginBottom: 14 }}>No workout logged this day.</p>
      )}

      {dayMeasurement && (
        <>
          <div className="h2" style={{ marginBottom: 8 }}>Measurements</div>
          <div className="card" style={{ padding: 12 }}>
            {MEASUREMENT_FIELDS.map(f => {
              const v = dayMeasurement[f.key];
              if (v == null) return null;
              return (
                <div key={f.key} className="between" style={{ padding: '4px 0' }}>
                  <span className="small">{f.label}</span>
                  <span className="mono small">{v}{f.unit}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ModalShell>
  );
}

function LogTimeModal({ subject, settings, daily, onLog, onSet, onClose, editMode }: any) {
  const s = settings.subjects[subject];
  const Icon = ICON_MAP[s.icon] || Languages;
  const done = daily.completed[subject] || 0;
  const remaining = Math.max(0, s.target - done);
  const [mode, setMode] = useState<'add' | 'set' | 'reset'>(editMode ? 'set' : 'add');
  const [mins, setMins] = useState(editMode ? done : (remaining > 0 ? remaining : s.target));
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <ModalShell title={s.name} onClose={onClose} icon={<div className="icon-wrap" style={{ background: s.accent, width: 32, height: 32 }}><Icon size={16} /></div>}>
      <div className="muted small" style={{ marginBottom: 12 }}>
        {s.tools}
      </div>
      <div className="card" style={{ padding: '10px 14px', marginBottom: 14, background: '#F5F0E6' }}>
        <div className="between">
          <span className="small muted">Today logged</span>
          <span className="mono small" style={{ fontWeight: 600 }}>{done} / {s.target} min</span>
        </div>
        {done > 0 && (
          <div className="progress-bar" style={{ height: 4, marginTop: 8 }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, (done / s.target) * 100)}%`, background: s.accent }} />
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className={`tap ${mode === 'add' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMode('add'); setMins(remaining > 0 ? remaining : s.target); }}>
          <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add
        </button>
        <button className={`tap ${mode === 'set' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMode('set'); setMins(done); }}>
          <Edit3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Set total
        </button>
        {done > 0 && (
          <button className={`tap ${mode === 'reset' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center', color: '#B8460E' }} onClick={() => setMode('reset')}>
            <RotateCcw size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Reset
          </button>
        )}
      </div>

      {mode === 'reset' ? (
        <>
          <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.5 }}>
            This will clear today's logged time for {s.name} and subtract it from your total progress.
          </p>
          <button className="btn" style={{ width: '100%', background: '#B8460E' }} onClick={() => onSet(0)}>
            <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Yes, reset to 0
          </button>
        </>
      ) : (
        <>
          <label>{mode === 'add' ? 'Minutes to add' : 'Set today\'s total to (minutes)'}</label>
          <input type="number" min="0" value={mins} onChange={(e) => setMins(parseInt(e.target.value) || 0)} style={{ marginBottom: 12 }} />
          <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {mode === 'add'
              ? [15, 30, 45, 60].map(m => <button key={m} className={`tap ${mins === m ? 'active' : ''}`} onClick={() => setMins(m)}>{m}m</button>)
              : [s.target, Math.round(s.target * 0.5), Math.round(s.target * 0.75), s.target + 15].map(m => <button key={m} className={`tap ${mins === m ? 'active' : ''}`} onClick={() => setMins(m)}>{m}m</button>)
            }
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={() => mode === 'add' ? onLog(mins) : onSet(mins)}>
            <Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {mode === 'add' ? `Log +${mins} min` : `Set total to ${mins} min`}
          </button>
        </>
      )}
    </ModalShell>
  );
}

const BUSY_PRESET_DEFAULTS = ['Shopping', 'Work', 'Errands', 'Gym', 'Appointment', 'Commute', 'Family'];

function BusyModal({ onConfirm, onClose, busyPresets, onSavePresets, isSwitch }: any) {
  const [reason, setReason] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [timed, setTimed] = useState(false);
  const [mins, setMins] = useState(60);
  const presets: string[] = busyPresets || BUSY_PRESET_DEFAULTS;

  const confirm = async () => {
    if (reason && showSave && !presets.includes(reason)) {
      await onSavePresets([...presets, reason]);
    }
    onConfirm(timed ? mins : null, reason);
  };

  return (
    <ModalShell title={isSwitch ? 'Switch activity' : 'Stepping out'} onClose={onClose} icon={<Footprints size={18} color="#C8932E" />}>
      <p className="muted small" style={{ marginBottom: 14 }}>
        {isSwitch ? 'Stops the current activity timer and starts a new one.' : 'Pick a duration, or leave it open-ended and tap "I\'m back" when you return.'}
      </p>

      <label style={{ marginBottom: 6 }}>What are you doing?</label>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {presets.map((p: string) => (
          <button key={p} className={`tap ${reason === p ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setReason(reason === p ? '' : p)}>{p}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <input type="text" placeholder="Or type something..." value={reason} onChange={(e) => { setReason(e.target.value); setShowSave(true); }} style={{ flex: 1 }} />
        {reason && !presets.includes(reason) && (
          <button className={`tap ${showSave ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => setShowSave(!showSave)} title="Save for next time">
            <Save size={12} />
          </button>
        )}
      </div>

      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <button className={`tap ${!timed ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setTimed(false)}>Open-ended</button>
        <button className={`tap ${timed ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setTimed(true)}>Set a time</button>
      </div>
      {timed && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {[30, 60, 90, 120, 180].map(m => <button key={m} className={`tap ${mins === m ? 'active' : ''}`} onClick={() => setMins(m)}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>)}
          </div>
          <input type="number" value={mins} onChange={(e) => setMins(parseInt(e.target.value) || 0)} style={{ marginBottom: 14 }} />
        </>
      )}
      <button className="btn" style={{ width: '100%' }} onClick={confirm}>
        <Footprints size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        {reason || 'Set busy'}{timed ? ` · ${mins < 60 ? mins + 'm' : mins / 60 + 'h'}` : ''}
      </button>
    </ModalShell>
  );
}

function BusyBackModal({ daily, onConfirm, onClose }: any) {
  const segs = (daily.busy?.segments || []).map((s: any) => ({ ...s, end: s.end || nowHHMM() }));
  return (
    <ModalShell title="Welcome back" onClose={onClose} icon={<Home size={18} color="#4A6741" />}>
      <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>Add what you did to today's log?</p>
      {segs.map((s: any, i: number) => {
        const m = Math.max(0, timeToMins(s.end) - timeToMins(s.start));
        return (
          <div key={i} className="between" style={{ padding: '6px 0' }}>
            <span className="small">{s.reason || 'Busy'}</span>
            <span className="mono tiny muted">{fmtTime(s.start)}–{fmtTime(s.end)} · {m}m</span>
          </div>
        );
      })}
      <button className="btn" style={{ width: '100%', marginTop: 12, marginBottom: 8 }} onClick={() => onConfirm(true)}>
        <Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Yes, log to my day
      </button>
      <button className="tap" style={{ width: '100%' }} onClick={() => onConfirm(false)}>No, just clear</button>
    </ModalShell>
  );
}

function AddMeasurementModal({ onSave, onClose, previous }: any) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    MEASUREMENT_FIELDS.forEach(f => { init[f.key] = previous?.[f.key] != null ? toDisplayVal(f.unit, previous[f.key]) : ''; });
    return init;
  });
  const set = (k: string, v: any) => setValues({ ...values, [k]: v });

  return (
    <ModalShell title="Log measurements" onClose={onClose} icon={<Activity size={18} color="#B8460E" />}>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Leave blank what you don't measure. Use the same scale and tape each time.
      </p>
      {MEASUREMENT_FIELDS.map(f => (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <label>{f.label} ({measureUnit(f.unit)})</label>
          <input type="number" step="0.1" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={previous?.[f.key] != null ? `Previous: ${toDisplayVal(f.unit, previous[f.key])}` : ''} />
        </div>
      ))}
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => {
        const entry: Record<string, any> = { date: todayStr() };
        MEASUREMENT_FIELDS.forEach((f) => { const v = values[f.key]; if (v !== '' && v != null) { const canon = fromDisplayVal(f.unit, v); if (canon != null) entry[f.key] = canon; } });
        onSave(entry);
      }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save measurements
      </button>
    </ModalShell>
  );
}

const VTAPER_PRESET: Record<string, number | null> = {
  weight: 178, body_fat: 14, waist: 33, shoulders: 49, chest: 44,
  biceps_l: 15.5, biceps_r: 15.5, hips: 38, thighs_l: 24, thighs_r: 24,
  calves_l: 15.5, calves_r: 15.5, neck: 15.5,
};

function BodyGoalsModal({ settings, onSave, onClose }: any) {
  const [goals, setGoals] = useState(settings.bodyGoals);
  const [presetLoaded, setPresetLoaded] = useState(false);
  const set = (k: string, patch: any) => setGoals({ ...goals, [k]: { ...goals[k], ...patch } });

  const loadVTaperPreset = () => {
    const next = { ...goals };
    Object.entries(VTAPER_PRESET).forEach(([k, target]) => {
      if (next[k]) next[k] = { ...next[k], target };
    });
    setGoals(next);
    setPresetLoaded(true);
  };

  return (
    <ModalShell title="Body targets" onClose={onClose} icon={<Target size={18} color="#B8460E" />}>
      <p className="muted small" style={{ marginBottom: 10 }}>
        Set target numbers for progress bars. Direction controls trend coloring.
      </p>
      <div className="card" style={{ padding: '12px 14px', marginBottom: 14, background: '#EEF2F8', border: '1px solid #C8D4E4' }}>
        <div className="between" style={{ marginBottom: 4 }}>
          <div className="row" style={{ gap: 8 }}>
            <Target size={14} color="#3B5C6B" />
            <span className="small" style={{ fontWeight: 600, color: '#3B5C6B' }}>V-Taper Recomp Preset</span>
          </div>
          <button className="tap" style={{ padding: '5px 12px', fontSize: 11, borderColor: '#3B5C6B', color: '#3B5C6B' }} onClick={loadVTaperPreset}>
            {presetLoaded ? '✓ Loaded' : 'Load preset'}
          </button>
        </div>
        <p className="muted tiny" style={{ lineHeight: 1.5, marginBottom: 0 }}>
          Tailored for 5'6" / 187 lb V-taper recomp: target 178 lb, 14% BF, 33" waist, 49" shoulders, 44" chest.
        </p>
      </div>
      {MEASUREMENT_FIELDS.map(f => {
        const g = goals[f.key];
        if (!g) return null;
        return (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 6 }}>
              <span className="small" style={{ fontWeight: 600 }}>{f.label}</span>
              <div className="row" style={{ gap: 6 }}>
                <button className={`tap ${g.direction === 'down' ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => set(f.key, { direction: 'down' })}>
                  <ArrowDown size={11} /> down
                </button>
                <button className={`tap ${g.direction === 'up' ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => set(f.key, { direction: 'up' })}>
                  <ArrowUp size={11} /> up
                </button>
              </div>
            </div>
            <input type="number" step="0.1" value={g.target ?? ''} placeholder={`Target ${f.unit} (optional)`} onChange={(e) => set(f.key, { target: e.target.value === '' ? null : parseFloat(e.target.value) })} />
          </div>
        );
      })}
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { onSave({ ...settings, bodyGoals: goals }); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save
      </button>
    </ModalShell>
  );
}

function LogWorkoutModal({ dayIdx, workout, onSave, onClose }: any) {
  const day = workout.split[dayIdx];
  const today = todayStr();
  const initial = workout.logs[today] || { name: day.name, location: 'gym', exercises: day.exercises.map((ex: any) => ({ name: ex.name, sets: Array(ex.sets).fill(0).map(() => ({ weight: '', reps: '', rpe: '' })) })) };
  const [data, setData] = useState(initial);

  const setSet = (exIdx: number, setIdx: number, field: string, value: string) => {
    const next = { ...data, exercises: data.exercises.map((e: any, i: number) => i !== exIdx ? e : { ...e, sets: e.sets.map((s: any, j: number) => j !== setIdx ? s : { ...s, [field]: value }) }) };
    setData(next);
  };

  return (
    <ModalShell title={day.name} onClose={onClose} icon={<Dumbbell size={18} color="#3B5C6B" />}>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button
          className={`tap ${data.location !== 'home' ? 'active' : ''}`}
          style={{ flex: 1, justifyContent: 'center', padding: '8px 12px' }}
          onClick={() => setData({ ...data, location: 'gym' })}
        >
          <Building2 size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Gym
        </button>
        <button
          className={`tap ${data.location === 'home' ? 'active' : ''}`}
          style={{ flex: 1, justifyContent: 'center', padding: '8px 12px' }}
          onClick={() => setData({ ...data, location: 'home' })}
        >
          <TreePine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Home
        </button>
      </div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Log weight × reps per set. Leave RPE blank if you don't track it.
      </p>
      {data.exercises.map((ex: any, i: number) => {
        const target = day.exercises[i];
        return (
          <div key={i} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #E4DCC8' }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="small" style={{ fontWeight: 600 }}>{ex.name}</span>
              <span className="mono tiny muted">target {target?.sets}×{target?.reps}</span>
            </div>
            {ex.sets.map((s: any, j: number) => (
              <div key={j} className="row" style={{ gap: 6, marginBottom: 6 }}>
                <span className="mono tiny muted" style={{ width: 24 }}>S{j + 1}</span>
                <input type="number" placeholder="wt" value={s.weight} onChange={(e) => setSet(i, j, 'weight', e.target.value)} style={{ flex: 1, padding: 6, fontSize: 13 }} />
                <span className="muted tiny">×</span>
                <input type="number" placeholder="reps" value={s.reps} onChange={(e) => setSet(i, j, 'reps', e.target.value)} style={{ flex: 1, padding: 6, fontSize: 13 }} />
                <input type="number" placeholder="rpe" value={s.rpe} onChange={(e) => setSet(i, j, 'rpe', e.target.value)} style={{ width: 50, padding: 6, fontSize: 13 }} />
              </div>
            ))}
          </div>
        );
      })}
      <button className="btn" style={{ width: '100%' }} onClick={async () => {
        const isFirstLog = !workout.logs[today];
        const nextWorkout = { ...workout, logs: { ...workout.logs, [today]: data } };
        if (isFirstLog && (workout.mode || 'sequence') === 'sequence') {
          const nonRestDays = workout.split.filter((d: any) => !d.rest);
          const cur = workout.sequencePosition || 1;
          nextWorkout.sequencePosition = (cur % nonRestDays.length) + 1;
        }
        await onSave(nextWorkout);
        onClose();
      }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save workout
      </button>
    </ModalShell>
  );
}

function EditSplitModal({ workout, onSave, onClose }: any) {
  const [split, setSplit] = useState(workout.split);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const updateDay = (idx: number, patch: any) => setSplit(split.map((d: any, i: number) => i === idx ? { ...d, ...patch } : d));
  const updateExercise = (dayIdx: number, exIdx: number, patch: any) => updateDay(dayIdx, { exercises: split[dayIdx].exercises.map((e: any, i: number) => i === exIdx ? { ...e, ...patch } : e) });
  const addExercise = (dayIdx: number) => updateDay(dayIdx, { exercises: [...split[dayIdx].exercises, { name: 'New exercise', sets: 3, reps: '8-10', weight: '' }] });
  const removeExercise = (dayIdx: number, exIdx: number) => updateDay(dayIdx, { exercises: split[dayIdx].exercises.filter((_: any, i: number) => i !== exIdx) });

  return (
    <ModalShell title="Edit weekly split" onClose={onClose} icon={<Edit3 size={18} color="#3B5C6B" />}>
      {split.map((day: any, i: number) => (
        <div key={i} className="card" style={{ marginBottom: 10, padding: 12 }}>
          <div className="between" onClick={() => setOpenDay(openDay === i ? null : i)} style={{ cursor: 'pointer' }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="mono tiny muted">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.day]}</span>
              <span className="small" style={{ fontWeight: 600 }}>{day.name}</span>
            </div>
            <ChevronDown size={16} style={{ transform: openDay === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openDay === i && (
            <div style={{ marginTop: 12 }}>
              <label>Day name</label>
              <input type="text" value={day.name} onChange={(e) => updateDay(i, { name: e.target.value })} style={{ marginBottom: 10 }} />
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <button className={`tap ${day.rest ? 'active' : ''}`} onClick={() => updateDay(i, { rest: !day.rest })}>
                  {day.rest ? 'Rest day' : 'Workout day'}
                </button>
              </div>
              {!day.rest && (
                <>
                  {day.exercises.map((ex: any, j: number) => (
                    <div key={j} style={{ marginBottom: 10, padding: 10, background: '#FBF7EE', borderRadius: 8, border: '1px solid #E4DCC8' }}>
                      <input type="text" value={ex.name} onChange={(e) => updateExercise(i, j, { name: e.target.value })} style={{ marginBottom: 6 }} />
                      <div className="row" style={{ gap: 6 }}>
                        <input type="number" value={ex.sets} placeholder="sets" onChange={(e) => updateExercise(i, j, { sets: parseInt(e.target.value) || 0 })} style={{ flex: 1, padding: 6 }} />
                        <input type="text" value={ex.reps} placeholder="reps" onChange={(e) => updateExercise(i, j, { reps: e.target.value })} style={{ flex: 1, padding: 6 }} />
                        <button onClick={() => removeExercise(i, j)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="tap" onClick={() => addExercise(i)} style={{ width: '100%' }}>
                    <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add exercise
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={async () => { await onSave({ ...workout, split }); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save split
      </button>
    </ModalShell>
  );
}

function VoiceButton({ onResult, style }: any) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  if (!SR) return null;
  const toggle = () => {
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { onResult(e.results[0][0].transcript); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };
  return (
    <button className={`tap ${listening ? 'active' : ''}`} onClick={toggle} title="Voice input" style={{ padding: '6px 10px', ...style }}>
      <Mic size={14} style={{ verticalAlign: 'middle' }} />{listening ? ' …' : ''}
    </button>
  );
}

function QtyStepper({ qty, setQty }: any) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
      <span className="small" style={{ fontWeight: 600 }}>Servings</span>
      <button className="tap" style={{ padding: '4px 12px' }} onClick={() => setQty(Math.max(0.25, Math.round((qty - 0.5) * 4) / 4))}>−</button>
      <input type="number" step="0.25" min="0.25" value={qty} onChange={(e) => setQty(Math.max(0.25, parseFloat(e.target.value) || 0.25))} style={{ width: 70, textAlign: 'center' }} />
      <button className="tap" style={{ padding: '4px 12px' }} onClick={() => setQty(Math.round((qty + 0.5) * 4) / 4)}>+</button>
    </div>
  );
}

function LogMealModal({ meals, settings, onSave, onClose }: any) {
  const [mode, setMode] = useState('preset');
  const [newPreset, setNewPreset] = useState({ name: '', protein: '', carbs: '', fat: '', calories: '', source: '' });
  const [manual, setManual] = useState({ name: '', protein: '', carbs: '', fat: '', calories: '' });
  const [qty, setQty] = useState(1);
  const [scanState, setScanState] = useState<'idle'|'scanning'|'done'|'error'>('idle');
  const [scanError, setScanError] = useState('');
  const [review, setReview] = useState<any>(null); // parsed item awaiting log/save (scan/type/barcode)
  const [typeText, setTypeText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const today = todayStr();
  const todayEntries = meals.entries?.[today] || [];
  const scaled = (m: any, q: number) => ({ protein: Math.round((m.protein || 0) * q), carbs: Math.round((m.carbs || 0) * q), fat: Math.round((m.fat || 0) * q), calories: Math.round((m.calories || 0) * q) });

  const logItem = async (item: any, q = 1) => {
    const s = scaled(item, q);
    const name = q !== 1 ? `${item.name} ×${q}` : item.name;
    await onSave(addMealEntry(meals, today, { name, source: item.source || '', qty: q, ...s }));
    onClose();
  };
  const removeEntry = async (id: string) => { await onSave(removeMealEntry(meals, today, id)); };

  const scanImage = async (file: File) => {
    setScanState('scanning'); setReview(null); setScanError('');
    try {
      const { image, mime } = await fileToResizedBase64(file);
      const resp = await fetch('/api/scan-food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, mime }) });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || 'Could not read macros.'); }
      const data = await resp.json();
      setReview({ ...data, source: data.serving ? `Scan · ${data.serving}` : 'AI scan' });
      setQty(1); setScanState('done');
    } catch (e: any) { setScanState('error'); setScanError(e?.message || 'Could not read macros.'); }
  };

  const scanBarcode = async (file: File) => {
    setScanState('scanning'); setReview(null); setScanError('');
    try {
      if (!('BarcodeDetector' in window)) throw new Error('Barcode scanning needs a newer phone browser. Use photo scan instead.');
      const bitmap = await createImageBitmap(file);
      // @ts-ignore - BarcodeDetector is not yet in TS DOM lib
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const codes = await detector.detect(bitmap);
      if (!codes.length) throw new Error('No barcode found. Try again, square on the code.');
      const code = codes[0].rawValue;
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments,serving_size`);
      const j = await r.json();
      if (j.status !== 1 || !j.product) throw new Error('Product not found in the food database.');
      const n = j.product.nutriments || {};
      const perServing = n['energy-kcal_serving'] != null;
      const pick = (base: string) => Number(perServing ? n[`${base}_serving`] : n[`${base}_100g`]) || 0;
      setReview({
        name: j.product.product_name || 'Scanned product',
        protein: pick('proteins'), carbs: pick('carbohydrates'), fat: pick('fat'),
        calories: Number(perServing ? n['energy-kcal_serving'] : n['energy-kcal_100g']) || 0,
        source: perServing ? `Barcode · ${j.product.serving_size || 'per serving'}` : 'Barcode · per 100g',
      });
      setQty(1); setScanState('done');
    } catch (e: any) { setScanState('error'); setScanError(e?.message || 'Barcode scan failed.'); }
  };

  const parseTyped = async () => {
    if (!typeText.trim()) return;
    setBusy(true); setScanError(''); setReview(null);
    try {
      const resp = await fetch('/api/parse-food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: typeText }) });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || 'Could not read that.'); }
      const data = await resp.json();
      setReview(data); setQty(1);
    } catch (e: any) { setScanError(e?.message || 'Could not read that.'); }
    finally { setBusy(false); }
  };

  const logManual = async () => {
    await logItem({ name: manual.name || 'Manual entry', source: 'Manual', protein: parseFloat(manual.protein) || 0, carbs: parseFloat(manual.carbs) || 0, fat: parseFloat(manual.fat) || 0, calories: parseFloat(manual.calories) || 0 }, qty);
  };
  const addPreset = async () => {
    const p = { id: 'p' + Date.now(), name: newPreset.name, protein: parseFloat(newPreset.protein) || 0, carbs: parseFloat(newPreset.carbs) || 0, fat: parseFloat(newPreset.fat) || 0, calories: parseFloat(newPreset.calories) || 0, source: newPreset.source };
    await onSave({ ...meals, presets: [...meals.presets, p] });
    setMode('preset');
    setNewPreset({ name: '', protein: '', carbs: '', fat: '', calories: '', source: '' });
  };
  const removePreset = async (id: string) => { await onSave({ ...meals, presets: meals.presets.filter((p: any) => p.id !== id) }); };

  const ReviewPanel = review && (
    <div className="card" style={{ padding: 14, marginBottom: 12, background: '#F0F5ED', border: '1px solid #C8D9C0' }}>
      <div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>{review.name}</div>
      {review.source && <div className="muted tiny" style={{ marginBottom: 8 }}>{review.source}</div>}
      <QtyStepper qty={qty} setQty={setQty} />
      <div className="mono tiny muted" style={{ marginBottom: 10 }}>
        {(() => { const s = scaled(review, qty); return `${s.protein}p · ${s.carbs}c · ${s.fat}f · ${s.calories}cal`; })()}
      </div>
      <button className="btn" style={{ width: '100%', marginBottom: 6 }} onClick={() => logItem(review, qty)}>
        <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Log to today
      </button>
      <button className="tap" style={{ width: '100%' }} onClick={async () => { await onSave({ ...meals, presets: [...meals.presets, { id: 'p' + Date.now(), name: review.name, protein: review.protein || 0, carbs: review.carbs || 0, fat: review.fat || 0, calories: review.calories || 0, source: review.source || '' }] }); setReview(null); setMode('preset'); }}>
        Save as preset
      </button>
    </div>
  );

  return (
    <ModalShell title="Log meal" onClose={onClose} icon={<Apple size={18} color="#4A6741" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className={`tap ${mode === 'preset' ? 'active' : ''}`} onClick={() => setMode('preset')}>Presets</button>
        <button className={`tap ${mode === 'type' ? 'active' : ''}`} onClick={() => { setMode('type'); setReview(null); }}>Type</button>
        <button className={`tap ${mode === 'scan' ? 'active' : ''}`} style={{ color: '#3B5C6B', borderColor: '#3B5C6B' }} onClick={() => { setMode('scan'); setReview(null); setScanState('idle'); }}>
          <Camera size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Scan
        </button>
        <button className={`tap ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>Manual</button>
        <button className={`tap ${mode === 'add' ? 'active' : ''}`} onClick={() => setMode('add')}>+ Save</button>
      </div>

      {mode === 'type' && (
        <>
          <div className="between" style={{ marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Describe what you ate</label>
            <VoiceButton onResult={(t: string) => setTypeText((prev) => prev ? `${prev} ${t}` : t)} />
          </div>
          <textarea value={typeText} onChange={(e) => setTypeText(e.target.value)} placeholder="e.g. 2 scrambled eggs, a slice of buttered toast, and a banana" style={{ height: 70, marginBottom: 10, width: '100%', resize: 'vertical' }} />
          {scanError && <p className="small" style={{ color: '#B8460E', marginBottom: 8 }}>{scanError}</p>}
          {ReviewPanel}
          <button className="btn" style={{ width: '100%' }} onClick={parseTyped} disabled={busy || !typeText.trim()}>
            {busy ? 'Estimating…' : <><Zap size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Estimate with AI</>}
          </button>
        </>
      )}

      {mode === 'scan' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12, background: '#EEF2F8', border: '1px solid #C8D4E4', textAlign: 'center' }}>
            <Camera size={28} color="#3B5C6B" style={{ marginBottom: 8 }} />
            <p className="muted small" style={{ lineHeight: 1.5, marginBottom: 12 }}>Photo a nutrition label, cookbook page, or meal — or scan a product barcode.</p>
            {scanState === 'scanning' && <p className="mono small" style={{ color: '#3B5C6B' }}>Reading…</p>}
            {scanState === 'error' && <p className="small" style={{ color: '#B8460E', marginBottom: 8 }}>{scanError}</p>}
            {scanState !== 'scanning' && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) scanImage(f); }} />
                <input ref={barcodeRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) scanBarcode(f); }} />
                <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => fileRef.current?.click()}>
                  <Camera size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Photo (label / food)
                </button>
                <button className="tap" style={{ width: '100%' }} onClick={() => barcodeRef.current?.click()}>
                  Scan barcode
                </button>
              </>
            )}
          </div>
          {ReviewPanel}
          <p className="muted tiny" style={{ lineHeight: 1.5 }}>Review the values and set servings before logging. AI reads labels well but may estimate portions.</p>
        </>
      )}

      {mode === 'preset' && (
        <>
          <div className="muted tiny" style={{ marginBottom: 10 }}>Set servings, then tap a meal to log it.</div>
          <QtyStepper qty={qty} setQty={setQty} />
          {meals.presets.length === 0 && <p className="muted small" style={{ marginBottom: 10 }}>No presets yet — tap "+ Save" to add some.</p>}
          {meals.presets.map((p: any) => (
            <div key={p.id} className="card" style={{ padding: 12, marginBottom: 8, cursor: 'pointer' }} onClick={() => logItem(p, qty)}>
              <div className="between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600 }}>{p.name}</div>
                  {p.source && <div className="muted tiny">{p.source}</div>}
                  <div className="mono tiny muted" style={{ marginTop: 4 }}>{p.protein}p · {p.carbs}c · {p.fat}f · {p.calories}cal{qty !== 1 ? ` (×${qty})` : ''}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removePreset(p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E', padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {mode === 'manual' && (
        <>
          <label>Name (optional)</label>
          <input type="text" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="e.g. Lunch" style={{ marginBottom: 10 }} />
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={manual.calories} onChange={(e) => setManual({ ...manual, calories: e.target.value })} /></div>
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={logManual}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Add to today
          </button>
        </>
      )}

      {mode === 'add' && (
        <>
          <label>Meal name</label>
          <input type="text" value={newPreset.name} onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })} placeholder="e.g. Skinnytaste turkey chili" style={{ marginBottom: 10 }} />
          <label>Source (optional)</label>
          <input type="text" value={newPreset.source} onChange={(e) => setNewPreset({ ...newPreset, source: e.target.value })} placeholder="e.g. Skinnytaste Meal Prep" style={{ marginBottom: 10 }} />
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><label>Protein</label><input type="number" value={newPreset.protein} onChange={(e) => setNewPreset({ ...newPreset, protein: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Carbs</label><input type="number" value={newPreset.carbs} onChange={(e) => setNewPreset({ ...newPreset, carbs: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1 }}><label>Fat</label><input type="number" value={newPreset.fat} onChange={(e) => setNewPreset({ ...newPreset, fat: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={newPreset.calories} onChange={(e) => setNewPreset({ ...newPreset, calories: e.target.value })} /></div>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={addPreset} disabled={!newPreset.name}>
            <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save preset
          </button>
        </>
      )}

      {todayEntries.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid #E4DCC8', paddingTop: 12 }}>
          <div className="h3" style={{ marginBottom: 8 }}>Today's meals</div>
          {todayEntries.map((e: any) => (
            <div key={e.id} className="between" style={{ padding: '6px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small">{e.name}</div>
                <div className="mono tiny muted">{e.protein}p · {e.carbs}c · {e.fat}f · {e.calories}cal</div>
              </div>
              <button onClick={() => removeEntry(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E', padding: 4 }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

function PlanDayModal({ date, plans, onSave, onClose }: any) {
  const existing = plans[date] || { wakeTime: '', commitments: [], customTasks: [] };
  const [wake, setWake] = useState(existing.wakeTime || '');
  const [commitments, setCommitments] = useState(existing.commitments || []);
  const [tasks, setTasks] = useState(existing.customTasks || []);
  const [newC, setNewC] = useState({ title: '', time: '' });
  const [newT, setNewT] = useState('');

  const addC = () => { if (newC.title) { setCommitments([...commitments, newC]); setNewC({ title: '', time: '' }); } };
  const addT = () => { if (newT) { setTasks([...tasks, { title: newT, done: false }]); setNewT(''); } };

  return (
    <ModalShell title={fmtDate(date)} onClose={onClose} icon={<CalIcon size={18} color="#B8460E" />}>
      <label>Wake time (overrides default)</label>
      <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} style={{ marginBottom: 16 }} />

      <div className="h2" style={{ marginBottom: 8 }}>Commitments</div>
      {commitments.map((c: any, i: number) => (
        <div key={i} className="between" style={{ padding: '8px 10px', background: '#FBF7EE', border: '1px solid #E4DCC8', borderRadius: 8, marginBottom: 6 }}>
          <div className="row" style={{ gap: 8 }}>
            {c.time && <span className="mono tiny muted">{fmtTime(c.time)}</span>}
            <span className="small">{c.title}</span>
          </div>
          <button onClick={() => setCommitments(commitments.filter((_: any, j: number) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E' }}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        <input type="text" placeholder="e.g. Work" value={newC.title} onChange={(e) => setNewC({ ...newC, title: e.target.value })} style={{ flex: 2 }} />
        <input type="time" value={newC.time} onChange={(e) => setNewC({ ...newC, time: e.target.value })} style={{ flex: 1 }} />
        <button className="tap" onClick={addC}><Plus size={14} /></button>
      </div>

      <div className="h2" style={{ marginBottom: 8 }}>Tasks</div>
      {tasks.map((t: any, i: number) => (
        <div key={i} className="between" style={{ padding: '8px 10px', background: '#FBF7EE', border: '1px solid #E4DCC8', borderRadius: 8, marginBottom: 6 }}>
          <span className="small">{t.title}</span>
          <button onClick={() => setTasks(tasks.filter((_: any, j: number) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E' }}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 6, marginBottom: 18 }}>
        <input type="text" placeholder="e.g. Pick up groceries" value={newT} onChange={(e) => setNewT(e.target.value)} style={{ flex: 1 }} />
        <button className="tap" onClick={addT}><Plus size={14} /></button>
      </div>

      <button className="btn" style={{ width: '100%' }} onClick={async () => {
        await onSave({ ...plans, [date]: { wakeTime: wake, commitments, customTasks: tasks } });
        onClose();
      }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save plan
      </button>
    </ModalShell>
  );
}

function SettingsModal({ settings, body, onSave, onClose, onEditSubject, onAddSubject, onChallenge, onExportImport, onResetDay }: any) {
  const [draft, setDraft] = useState(settings);
  const [subTab, setSubTab] = useState<'active' | 'archived' | 'deleted'>('active');
  const latestBody = body?.entries?.[body.entries.length - 1];
  const suggested = suggestMacros(latestBody, draft.bodyGoals);
  const update = (patch: any) => setDraft({ ...draft, ...patch });

  // Subject actions persist immediately (and preserve any in-progress schedule/macro edits).
  const applySubjectChange = (key: string, patch: any) => {
    const nd = { ...draft, subjects: { ...draft.subjects, [key]: { ...draft.subjects[key], ...patch } } };
    setDraft(nd); onSave(nd);
  };
  const fullDelete = (key: string) => {
    if (!confirm('Permanently delete this subject? This cannot be undone.')) return;
    const subjects = { ...draft.subjects }; delete subjects[key];
    const nd = { ...draft, subjects, subjectOrder: draft.subjectOrder.filter((x: string) => x !== key) };
    setDraft(nd); onSave(nd);
  };

  const allKeys: string[] = draft.subjectOrder.filter((k: string) => draft.subjects[k]);
  const activeKeys = allKeys.filter((k) => !draft.subjects[k].archived && !draft.subjects[k].deletedAt);
  const archivedKeys = allKeys.filter((k) => draft.subjects[k].archived && !draft.subjects[k].deletedAt);
  const deletedKeys = allKeys.filter((k) => draft.subjects[k].deletedAt);
  const shownKeys = subTab === 'active' ? activeKeys : subTab === 'archived' ? archivedKeys : deletedKeys;

  return (
    <ModalShell title="Settings" onClose={onClose}>
      <div className="h2" style={{ marginBottom: 8 }}>Schedule</div>
      <div style={{ marginBottom: 12 }}>
        <label>Default wake</label>
        <input type="time" value={draft.wakeTime} onChange={(e) => update({ wakeTime: e.target.value })} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Default sleep</label>
        <input type="time" value={draft.sleepTime} onChange={(e) => update({ sleepTime: e.target.value })} />
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label>Start offset (min after wake)</label>
          <input type="number" value={draft.scheduleStartOffsetMin ?? 30} onChange={(e) => update({ scheduleStartOffsetMin: parseInt(e.target.value) || 30 })} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Break between blocks (min)</label>
          <input type="number" value={draft.blockBreakMin ?? 15} onChange={(e) => update({ blockBreakMin: parseInt(e.target.value) || 15 })} />
        </div>
      </div>

      <div className="h2" style={{ marginBottom: 8, marginTop: 16 }}>Subjects</div>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <button className={`tap ${subTab === 'active' ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setSubTab('active')}>Active ({activeKeys.length})</button>
        <button className={`tap ${subTab === 'archived' ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setSubTab('archived')}>Archived ({archivedKeys.length})</button>
        <button className={`tap ${subTab === 'deleted' ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setSubTab('deleted')}>Deleted ({deletedKeys.length})</button>
      </div>
      {shownKeys.length === 0 && <p className="muted small" style={{ padding: '8px 0' }}>{subTab === 'active' ? 'No active subjects.' : subTab === 'archived' ? 'Nothing archived.' : 'Nothing deleted.'}</p>}
      {shownKeys.map((k: string) => {
        const s = draft.subjects[k];
        const Icon = ICON_MAP[s.icon] || Languages;
        const kind = subjectGoalKind(s);
        const meta = s.trackingMode === 'checkoff' ? `Check-off · ${s.weeklyDays}x/wk` : `${s.target}min/day · ${s.weeklyDays}x/wk`;
        const daysLeft = s.deletedAt ? Math.max(0, 15 - diffDays(todayStr(), s.deletedAt)) : 0;
        return (
          <div key={k} className="between" style={{ padding: '10px 0', borderBottom: '1px solid #E4DCC8' }}>
            <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>
              <div className="icon-wrap" style={{ background: s.accent, width: 28, height: 28 }}><Icon size={14} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600, opacity: subTab === 'active' ? 1 : 0.6 }}>{s.name}</div>
                <div className="mono tiny muted">{meta}{kind === 'deadline' ? ` · ${fmtShortDate(s.deadline)}` : kind === 'count' ? ` · ${s.countTotal} sessions` : ''}{s.deletedAt ? ` · deletes in ${daysLeft}d` : ''}</div>
              </div>
            </div>
            <div className="row" style={{ gap: 4 }}>
              {subTab === 'active' && (
                <>
                  <button onClick={() => onEditSubject(k)} className="tap" style={{ padding: '4px 8px' }} title="Edit"><Edit3 size={13} /></button>
                  <button onClick={() => applySubjectChange(k, { archived: true })} className="tap" style={{ padding: '4px 8px' }} title="Archive"><Archive size={13} /></button>
                </>
              )}
              {subTab === 'archived' && (
                <>
                  <button onClick={() => applySubjectChange(k, { archived: false })} className="tap" style={{ padding: '4px 10px', fontSize: 11 }}>Unarchive</button>
                  <button onClick={() => applySubjectChange(k, { deletedAt: todayStr() })} className="tap" style={{ padding: '4px 8px', color: '#B8460E' }} title="Delete"><Trash2 size={13} /></button>
                </>
              )}
              {subTab === 'deleted' && (
                <>
                  <button onClick={() => applySubjectChange(k, { deletedAt: null })} className="tap" style={{ padding: '4px 10px', fontSize: 11 }}>Restore</button>
                  <button onClick={() => fullDelete(k)} className="tap" style={{ padding: '4px 8px', color: '#B8460E' }} title="Delete now"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {subTab === 'deleted' && deletedKeys.length > 0 && <p className="muted tiny" style={{ marginTop: 8, lineHeight: 1.5 }}>Deleted subjects auto-remove after 15 days. "Delete now" removes permanently.</p>}
      <button className="tap" onClick={onAddSubject} style={{ width: '100%', marginTop: 10, marginBottom: 16 }}>
        <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add subject
      </button>

      <div className="h2" style={{ marginBottom: 8, marginTop: 8 }}>Macros</div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={draft.macroTargets.protein} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, protein: parseInt(e.target.value) || 0 } })} /></div>
        <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={draft.macroTargets.calories} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, calories: parseInt(e.target.value) || 0 } })} /></div>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={draft.macroTargets.carbs} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, carbs: parseInt(e.target.value) || 0 } })} /></div>
        <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={draft.macroTargets.fat} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, fat: parseInt(e.target.value) || 0 } })} /></div>
      </div>
      {suggested ? (
        <button className="tap" style={{ width: '100%', marginBottom: 16, fontSize: 12 }} onClick={() => update({ macroTargets: suggested })}>
          <Zap size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Auto from body + goal ({suggested.protein}p · {suggested.carbs}c · {suggested.fat}f · {suggested.calories}cal)
        </button>
      ) : (
        <p className="muted tiny" style={{ marginBottom: 16, lineHeight: 1.4 }}>Add a body weight entry to auto-calculate macro targets from your goal.</p>
      )}

      {(() => {
        const units = draft.units || { timeFormat: '12h', weight: 'lb', length: 'in', weekStart: 0 };
        const setUnit = (k: string, v: any) => update({ units: { ...units, [k]: v } });
        const ALL_CARDS = ['schedule', 'progress', 'challenge', 'macros', 'weekly'];
        const LABELS: Record<string, string> = { schedule: 'Schedule', progress: 'Progress', challenge: 'Challenge', macros: 'Macros', weekly: 'Weekly summary' };
        const dash: string[] = draft.dashboard || ALL_CARDS;
        const hidden = ALL_CARDS.filter((c) => !dash.includes(c));
        const move = (i: number, d: number) => { const a = [...dash]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; update({ dashboard: a }); };
        const Seg = ({ k, opts }: any) => (
          <div className="row" style={{ gap: 6 }}>
            {opts.map((o: any) => <button key={o.v} className={`tap ${units[k] === o.v ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setUnit(k, o.v)}>{o.label}</button>)}
          </div>
        );
        return (
          <>
            <div className="h2" style={{ marginBottom: 8, marginTop: 8 }}>Preferences</div>
            <label>Time format</label>
            <div style={{ marginBottom: 10 }}><Seg k="timeFormat" opts={[{ v: '12h', label: '12-hour' }, { v: '24h', label: '24-hour' }]} /></div>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}><label>Weight</label><Seg k="weight" opts={[{ v: 'lb', label: 'lb' }, { v: 'kg', label: 'kg' }]} /></div>
              <div style={{ flex: 1 }}><label>Length</label><Seg k="length" opts={[{ v: 'in', label: 'in' }, { v: 'cm', label: 'cm' }]} /></div>
            </div>
            <label>Week starts on</label>
            <div style={{ marginBottom: 14 }}><Seg k="weekStart" opts={[{ v: 0, label: 'Sunday' }, { v: 1, label: 'Monday' }]} /></div>

            <div className="h2" style={{ marginBottom: 8 }}>Today layout</div>
            {dash.map((c, i) => (
              <div key={c} className="between" style={{ padding: '6px 0' }}>
                <span className="small">{LABELS[c]}</span>
                <div className="row" style={{ gap: 4 }}>
                  <button className="tap" style={{ padding: '3px 8px' }} disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={13} /></button>
                  <button className="tap" style={{ padding: '3px 8px' }} disabled={i === dash.length - 1} onClick={() => move(i, 1)}><ChevronDown size={13} /></button>
                  <button className="tap" style={{ padding: '3px 8px', color: '#B8460E' }} onClick={() => update({ dashboard: dash.filter((x) => x !== c) })} title="Hide"><X size={13} /></button>
                </div>
              </div>
            ))}
            {hidden.map((c) => (
              <div key={c} className="between" style={{ padding: '6px 0', opacity: 0.6 }}>
                <span className="small">{LABELS[c]} <span className="muted tiny">· hidden</span></span>
                <button className="tap" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => update({ dashboard: [...dash, c] })}>Show</button>
              </div>
            ))}

            <div className="between" style={{ padding: '12px 0 4px' }}>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>Reminders</div>
                <div className="muted tiny" style={{ lineHeight: 1.4 }}>Nudges to log meals & measurements (while the app is open).</div>
              </div>
              <button className={`tap ${draft.reminders?.enabled ? 'active' : ''}`} style={{ padding: '6px 12px' }} onClick={async () => { const en = !draft.reminders?.enabled; if (en && 'Notification' in window) { try { await Notification.requestPermission(); } catch {} } update({ reminders: { ...(draft.reminders || {}), enabled: en } }); }}>
                {draft.reminders?.enabled ? 'On' : 'Off'}
              </button>
            </div>
          </>
        );
      })()}

      <button className="btn" style={{ width: '100%', marginBottom: 8, marginTop: 14 }} onClick={() => { onSave(draft); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save settings
      </button>

      <button className="tap" onClick={onChallenge} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={14} color="#8E4585" />
        <span style={{ flex: 1 }}>60-day challenge{settings.challenge?.active && <span className="mono tiny muted" style={{ marginLeft: 6 }}>· active</span>}</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
      <button className="tap" onClick={onExportImport} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Download size={14} color="#3B5C6B" />
        <span style={{ flex: 1 }}>Backup / restore data</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
      <button className="tap" onClick={onResetDay} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <RotateCcw size={14} color="#B8460E" />
        <span style={{ flex: 1 }}>Reset today</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
    </ModalShell>
  );
}

function EditSubjectModal({ subjectKey, settings, onSave, onClose }: any) {
  const isNew = !subjectKey;
  const existing = isNew ? null : normalizeSubject(settings.subjects[subjectKey]);
  const [draft, setDraft] = useState<any>(existing || normalizeSubject({ name: '', icon: 'target', accent: '#B8460E', trackingMode: 'time', target: 30, weeklyDays: 5, deadline: null, countTotal: null }));
  const [goalSel, setGoalSel] = useState<'none' | 'deadline' | 'count'>(subjectGoalKind(draft));
  const [showDetails, setShowDetails] = useState(!isNew);
  const set = (patch: any) => setDraft({ ...draft, ...patch });

  const handleSave = () => {
    const clean = { ...draft };
    if (goalSel === 'deadline') { clean.countTotal = null; if (!clean.deadline) clean.deadline = addMonth(todayStr(), 3); }
    else if (goalSel === 'count') { clean.deadline = null; clean.countTotal = Math.max(1, parseInt(clean.countTotal) || 10); }
    else { clean.deadline = null; clean.countTotal = null; }
    if (clean.trackingMode === 'checkoff') clean.target = 0;
    const key = subjectKey || draft.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now().toString(36);
    const next = { ...settings, subjects: { ...settings.subjects, [key]: clean } };
    if (isNew) next.subjectOrder = [...settings.subjectOrder, key];
    onSave(next);
    onClose();
  };

  const ICONS = ['languages', 'music', 'shield', 'book', 'target', 'dumbbell', 'activity'];
  const COLORS = ['#B8460E', '#4A6741', '#3B5C6B', '#C8932E', '#8E4585', '#1A1A2E'];
  const goals: { key: typeof goalSel; label: string }[] = [
    { key: 'none', label: 'No deadline' },
    { key: 'deadline', label: 'Deadline' },
    { key: 'count', label: 'Finish after N' },
  ];

  return (
    <ModalShell title={isNew ? 'New subject' : 'Edit subject'} onClose={onClose}>
      <label>Name</label>
      <input type="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. CompTIA Security+" style={{ marginBottom: 12 }} />

      <label>How do you track it?</label>
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        <button className={`tap ${draft.trackingMode === 'time' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => set({ trackingMode: 'time' })}>
          <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log time
        </button>
        <button className={`tap ${draft.trackingMode === 'checkoff' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => set({ trackingMode: 'checkoff' })}>
          <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Just mark done
        </button>
      </div>

      <label>Icon</label>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {ICONS.map(ic => {
          const I = ICON_MAP[ic];
          return (
            <button key={ic} className={`tap ${draft.icon === ic ? 'active' : ''}`} onClick={() => set({ icon: ic })} style={{ padding: 8 }}>
              <I size={16} />
            </button>
          );
        })}
      </div>
      <label>Color</label>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => set({ accent: c })} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: draft.accent === c ? '3px solid #1A1A2E' : '1px solid #D4CCB8', cursor: 'pointer' }} />
        ))}
      </div>

      {!showDetails ? (
        <button className="tap" style={{ width: '100%', marginBottom: 14 }} onClick={() => setShowDetails(true)}>
          <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add details (deadline, description, days/week…)
        </button>
      ) : (
        <div style={{ marginBottom: 6 }}>
          <label>Description (optional)</label>
          <input type="text" value={draft.tools} onChange={(e) => set({ tools: e.target.value })} placeholder="e.g. Jason Dion · Udemy" style={{ marginBottom: 12 }} />

          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            {draft.trackingMode === 'time' && (
              <div style={{ flex: 1 }}><label>Daily (min)</label><input type="number" value={draft.target} onChange={(e) => set({ target: parseInt(e.target.value) || 0 })} /></div>
            )}
            <div style={{ flex: 1 }}><label>Days/week</label><input type="number" min="1" max="7" value={draft.weeklyDays} onChange={(e) => set({ weeklyDays: Math.min(7, Math.max(1, parseInt(e.target.value) || 1)) })} /></div>
          </div>

          <label>Finish goal</label>
          <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {goals.map(g => (
              <button key={g.key} className={`tap ${goalSel === g.key ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setGoalSel(g.key)}>{g.label}</button>
            ))}
          </div>
          {goalSel === 'deadline' && (
            <input type="date" value={draft.deadline || addMonth(todayStr(), 3)} onChange={(e) => set({ deadline: e.target.value })} style={{ marginBottom: 8 }} />
          )}
          {goalSel === 'count' && (
            <>
              <label>Finish after how many sessions/days?</label>
              <input type="number" min="1" value={draft.countTotal || ''} onChange={(e) => set({ countTotal: parseInt(e.target.value) || 0 })} placeholder="e.g. 20" style={{ marginBottom: 8 }} />
            </>
          )}
          {goalSel === 'none' && <p className="muted tiny" style={{ marginBottom: 8, lineHeight: 1.5 }}>No deadline — just keep doing it. Once you hit your weekly count it hides until next week.</p>}
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={handleSave} disabled={!draft.name}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save subject
      </button>
    </ModalShell>
  );
}

function WeeklyReviewModal({ settings, totals, body, workout, meals, streaks, onAck, onSkip }: any) {
  const subjects = settings.subjectOrder.filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ai, setAi] = useState<any>(null);
  const [aiErr, setAiErr] = useState('');

  const runAiReview = async () => {
    setAiState('loading'); setAiErr('');
    try {
      const week: string[] = [];
      for (let i = 0; i < 7; i++) { const d = new Date(todayStr() + 'T00:00:00'); d.setDate(d.getDate() - i); week.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); }
      const proteinDays = week.map((d) => meals?.log?.[d]?.protein).filter((x: any) => x > 0);
      const avgProtein = proteinDays.length ? Math.round(proteinDays.reduce((a: number, b: number) => a + b, 0) / proteinDays.length) : 0;
      const subjSummary = subjects.map((k: string) => { const s = settings.subjects[k]; const diff = (totals[k] || 0) - expectedTotal(k, settings); return { name: s.name, status: s.deadline ? (diff >= 0 ? 'ahead/on-pace' : 'behind') : 'no deadline', streak: streaks[k]?.current || 0 }; });
      const first = body.entries?.[0], last = body.entries?.[body.entries.length - 1];
      const bodyTrend = first && last && first.weight && last.weight ? { weightChange: Math.round((last.weight - first.weight) * 10) / 10 } : {};
      const resp = await fetch('/api/weekly-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjects: subjSummary, workoutsThisWeek: week.filter((d) => workout.logs[d]).length, avgProtein, proteinTarget: settings.macroTargets.protein, bodyTrend, streaks }) });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Review unavailable.'); }
      setAi(await resp.json()); setAiState('done');
    } catch (e: any) { setAiErr(e?.message || 'Review unavailable.'); setAiState('error'); }
  };

  return (
    <ModalShell title="Sunday review" onClose={onSkip} icon={<ListChecks size={18} color="#4A6741" />}>
      <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Quick weekly checkpoint. Where are you, and what to push next week.
      </p>

      {aiState === 'idle' && (
        <button className="tap" style={{ width: '100%', marginBottom: 14, color: '#8E4585', borderColor: '#8E4585' }} onClick={runAiReview}>
          <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Get AI review of my week
        </button>
      )}
      {aiState === 'loading' && <p className="muted small" style={{ marginBottom: 14 }}>Reviewing your week…</p>}
      {aiState === 'error' && <p className="small" style={{ color: '#B8460E', marginBottom: 14 }}>{aiErr}</p>}
      {aiState === 'done' && ai && (
        <div className="card" style={{ background: '#F3EEF6', border: '1px solid #DCCDE6', marginBottom: 16 }}>
          {ai.summary && <p className="small" style={{ fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>{ai.summary}</p>}
          {ai.wins?.length > 0 && <><div className="mono tiny" style={{ color: '#4A6741', fontWeight: 600, marginBottom: 4 }}>WINS</div>{ai.wins.map((w: string, i: number) => <div key={i} className="small" style={{ marginBottom: 3 }}>• {w}</div>)}</>}
          {ai.focus?.length > 0 && <><div className="mono tiny" style={{ color: '#8E4585', fontWeight: 600, margin: '8px 0 4px' }}>NEXT WEEK</div>{ai.focus.map((w: string, i: number) => <div key={i} className="small" style={{ marginBottom: 3 }}>→ {w}</div>)}</>}
        </div>
      )}
      {subjects.map((k: string) => {
        const s = settings.subjects[k];
        const totalDone = totals[k] || 0;
        const expected = expectedTotal(k, settings);
        const diff = totalDone - expected;
        const perDayAvg = s.target * (s.weeklyDays / 7);
        const daysOff = Math.abs(diff) / Math.max(perDayAvg, 1);
        const Icon = ICON_MAP[s.icon] || Languages;
        const streak = streaks[k]?.current || 0;
        return (
          <div key={k} style={{ marginBottom: 12, padding: 12, background: '#FBF7EE', border: '1px solid #E4DCC8', borderRadius: 10 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <Icon size={14} color={s.accent} />
              <span className="small" style={{ fontWeight: 600 }}>{s.name}</span>
              {streak > 0 && <span className="streak-flame"><Flame size={11} /> {streak}d</span>}
            </div>
            <div className="mono tiny muted">
              {Math.round(totalDone / 60 * 10) / 10}h done · {diff >= 0 ? `${daysOff.toFixed(1)}d ahead` : `${daysOff.toFixed(1)}d behind`}
            </div>
          </div>
        );
      })}
      <div className="h2" style={{ marginTop: 16, marginBottom: 8 }}>Workouts this week</div>
      {(() => {
        const week = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayStr() + 'T00:00:00');
          d.setDate(d.getDate() - i);
          week.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        }
        const logged = week.filter(d => workout.logs[d]).length;
        return (
          <p className="small">
            <span className="mono">{logged}/6</span> sessions logged. {logged >= 5 ? "Solid week." : logged >= 3 ? "Decent, but push for 6." : "Get back on it next week."}
          </p>
        );
      })()}
      <div className="h2" style={{ marginTop: 16, marginBottom: 8 }}>Body</div>
      {body.entries.length === 0 ? (
        <p className="muted small">No measurements yet.</p>
      ) : (
        <p className="small">{body.entries.length} entries logged · next on {fmtShortDate(settings.nextMeasurement)}</p>
      )}
      <button className="btn" style={{ width: '100%', marginTop: 18 }} onClick={onAck}>
        <Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Got it
      </button>
    </ModalShell>
  );
}

const CHALLENGE_PRESETS = [
  { name: '60-Day V-Taper', days: 60, deloadWeek: 5 },
  { name: '90-Day Recomp', days: 90, deloadWeek: 7 },
  { name: '180-Day Transformation', days: 180, deloadWeek: 9 },
  { name: 'Custom', days: 0, deloadWeek: 5 },
];

function ChallengeModal({ settings, challengeHistory, onSave, onSaveHistory, onClose }: any) {
  const ch = settings.challenge || { active: false, name: '60-Day V-Taper', startDate: null, days: 60, deloadWeek: 5 };
  const [draft, setDraft] = useState(ch);
  const [view, setView] = useState<'active'|'archive'>('active');
  const history: any[] = challengeHistory || [];

  const completeCurrent = async () => {
    if (!ch.active || !ch.startDate) return;
    const completed = { ...ch, completedDate: todayStr(), active: false };
    await onSaveHistory([completed, ...history]);
    await onSave({ ...settings, challenge: { active: false, name: '', startDate: null, days: 60, deloadWeek: 5 } });
  };

  const daysDone = ch.startDate ? Math.max(0, diffDays(todayStr(), ch.startDate)) : 0;
  const pct = ch.days > 0 ? Math.min(100, Math.round((daysDone / ch.days) * 100)) : 0;
  const isInfinite = ch.days === 0;

  return (
    <ModalShell title="Challenge" onClose={onClose} icon={<Trophy size={18} color="#8E4585" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className={`tap ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>
          <Zap size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Active
        </button>
        <button className={`tap ${view === 'archive' ? 'active' : ''}`} onClick={() => setView('archive')}>
          <Archive size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Archive ({history.length})
        </button>
      </div>

      {view === 'archive' && (
        <>
          {history.length === 0 && <p className="muted small">No completed challenges yet.</p>}
          {history.map((h: any, i: number) => (
            <div key={i} className="card" style={{ padding: 12, marginBottom: 8, borderLeft: '3px solid #C8932E' }}>
              <div className="between">
                <div>
                  <div className="small" style={{ fontWeight: 600 }}><Trophy size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#C8932E' }} />{h.name}</div>
                  <div className="mono tiny muted">{fmtShortDate(h.startDate)} → {fmtShortDate(h.completedDate)} · {h.days}d</div>
                </div>
                <Award size={20} color="#C8932E" />
              </div>
            </div>
          ))}
        </>
      )}

      {view === 'active' && (
        <>
          {ch.active && (
            <div className="card" style={{ padding: 12, marginBottom: 14, background: '#F0EBF8', borderLeft: '3px solid #8E4585' }}>
              <div className="between" style={{ marginBottom: 8 }}>
                <span className="small" style={{ fontWeight: 600 }}>{ch.name}</span>
                <span className="mono tiny" style={{ color: '#8E4585' }}>{isInfinite ? '∞' : `${pct}%`}</span>
              </div>
              <div className="mono tiny muted" style={{ marginBottom: 8 }}>
                Day {daysDone} {isInfinite ? '· open-ended' : `of ${ch.days} · ${ch.days - daysDone} to go`}
              </div>
              {!isInfinite && (
                <div style={{ height: 4, background: '#E4DCC8', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#8E4585', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
              )}
              <button className="tap" style={{ width: '100%', fontSize: 12 }} onClick={completeCurrent}>
                <Trophy size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Complete & archive
              </button>
            </div>
          )}

          <div className="h3" style={{ marginBottom: 8 }}>Preset</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {CHALLENGE_PRESETS.map(p => (
              <button key={p.name} className={`tap ${draft.name === p.name ? 'active' : ''}`} style={{ fontSize: 11 }}
                onClick={() => setDraft({ ...draft, name: p.name, days: p.days || draft.days, deloadWeek: p.deloadWeek })}>
                {p.name}
              </button>
            ))}
            <button className={`tap ${draft.days === 0 ? 'active' : ''}`} style={{ fontSize: 11 }} onClick={() => setDraft({ ...draft, days: 0 })}>
              <Infinity size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Open
            </button>
          </div>

          <label>Challenge name</label>
          <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ marginBottom: 12 }} />
          <label>Start date</label>
          <input type="date" value={draft.startDate || todayStr()} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} style={{ marginBottom: 12 }} />
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label>Duration (0 = open)</label>
              <input type="number" value={draft.days} onChange={(e) => setDraft({ ...draft, days: parseInt(e.target.value) || 0 })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Deload week #</label>
              <input type="number" min="1" max="20" value={draft.deloadWeek} onChange={(e) => setDraft({ ...draft, deloadWeek: parseInt(e.target.value) || 5 })} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { onSave({ ...settings, challenge: { ...draft, active: false } }); onClose(); }}>
              {draft.active ? 'Pause' : 'Save (inactive)'}
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => { onSave({ ...settings, challenge: { ...draft, active: true, startDate: draft.startDate || todayStr() } }); onClose(); }}>
              <Play size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Activate
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function ResetDayModal({ onReset, onClose }: any) {
  const [opts, setOpts] = useState({ subjects: true, macros: true, workout: false, status: false });
  const [confirm, setConfirm] = useState(false);
  const rows: { key: keyof typeof opts; label: string; desc: string }[] = [
    { key: 'subjects', label: 'Study / subject time', desc: "Clears today's logged minutes and removes them from your totals." },
    { key: 'macros', label: 'Macros / meals', desc: "Resets today's food log to zero." },
    { key: 'workout', label: "Today's workout log", desc: 'Deletes the workout you logged today.' },
    { key: 'status', label: 'Status (busy / wake / start)', desc: 'Resets back to a fresh morning.' },
  ];
  const any = Object.values(opts).some(Boolean);
  return (
    <ModalShell title="Reset today" onClose={onClose} icon={<RotateCcw size={18} color="#B8460E" />}>
      <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.5 }}>Pick what to clear for today. Past days are untouched, and you can Undo right after.</p>
      {rows.map((r) => (
        <div key={r.key} className="between" style={{ padding: '10px 0', borderBottom: '1px solid #E4DCC8', cursor: 'pointer' }} onClick={() => setOpts({ ...opts, [r.key]: !opts[r.key] })}>
          <div style={{ flex: 1, paddingRight: 10 }}>
            <div className="small" style={{ fontWeight: 600 }}>{r.label}</div>
            <div className="muted tiny" style={{ lineHeight: 1.4 }}>{r.desc}</div>
          </div>
          <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${opts[r.key] ? '#B8460E' : '#D4CCB8'}`, background: opts[r.key] ? '#B8460E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {opts[r.key] && <Check size={13} color="#F5F0E6" />}
          </div>
        </div>
      ))}
      {!confirm ? (
        <button className="btn" style={{ width: '100%', marginTop: 14, background: '#B8460E' }} disabled={!any} onClick={() => setConfirm(true)}>
          <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Reset selected
        </button>
      ) : (
        <>
          <p className="small" style={{ margin: '14px 0 8px', color: '#B8460E', fontWeight: 600 }}>Reset the selected items for today?</p>
          <button className="btn" style={{ width: '100%', background: '#B8460E' }} onClick={async () => { await onReset(opts); onClose(); }}>Yes, reset</button>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setConfirm(false)}>Cancel</button>
        </>
      )}
    </ModalShell>
  );
}

function ExportImportModal({ data, onImport, onClose }: any) {
  const [mode, setMode] = useState('export');
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const exportJson = JSON.stringify(data, null, 2);

  useEffect(() => { (async () => setBackups(await safeGet(K.backups, [])))(); }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      onImport(parsed);
    } catch (e) {
      alert('Invalid JSON. Paste only what you copied from Export.');
    }
  };

  return (
    <ModalShell title="Backup data" onClose={onClose} icon={<Download size={18} color="#3B5C6B" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className={`tap ${mode === 'export' ? 'active' : ''}`} onClick={() => setMode('export')}>
          <Download size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Export
        </button>
        <button className={`tap ${mode === 'import' ? 'active' : ''}`} onClick={() => setMode('import')}>
          <Upload size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Import
        </button>
        <button className={`tap ${mode === 'backups' ? 'active' : ''}`} onClick={() => setMode('backups')}>
          <RotateCcw size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Auto-backups
        </button>
      </div>

      {SYNC_AVAILABLE ? (
        <p className="muted tiny" style={{ marginBottom: 12, lineHeight: 1.5, color: '#4A6741' }}>
          Cloud sync is on — your data is saved to the server and restores automatically on other devices. Exports are still a good extra backup.
        </p>
      ) : (
        <p className="muted tiny" style={{ marginBottom: 12, lineHeight: 1.5, color: '#B8460E' }}>
          Heads up: your data lives only in this browser. Export it somewhere safe, or it can be lost if you clear the browser or switch devices.
        </p>
      )}

      {mode === 'backups' && (
        <>
          <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Automatic snapshots taken while you use the app. Restore one to roll back. This <strong>replaces</strong> current data.
          </p>
          {backups.length === 0 && <p className="muted small">No backups yet — they're created automatically as you use the app.</p>}
          {backups.map((b: any) => (
            <div key={b.ts} className="between" style={{ padding: '10px 0', borderBottom: '1px solid #E4DCC8' }}>
              <span className="small">{new Date(b.ts).toLocaleString()}</span>
              <button className="tap" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { if (confirm('Restore this backup? Current data will be replaced.')) onImport(b.data); }}>Restore</button>
            </div>
          ))}
        </>
      )}

      {mode === 'export' && (
        <>
          <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Copy this and save it anywhere. If you ever clear local storage, paste it back to restore everything.
          </p>
          <textarea readOnly value={exportJson} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, padding: 10, height: 200, marginBottom: 12, resize: 'vertical', width: '100%' }} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
          <button className="btn" style={{ width: '100%' }} onClick={handleCopy}>
            {copied ? <><Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Copied!</> : 'Copy to clipboard'}
          </button>
        </>
      )}
      {mode === 'import' && (
        <>
          <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Paste a previously exported backup here. This <strong>replaces</strong> all current data.
          </p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste your backup JSON here..." style={{ fontFamily: 'JetBrains Mono', fontSize: 11, padding: 10, height: 200, marginBottom: 12, resize: 'vertical', width: '100%' }} />
          <button className="btn btn-accent" style={{ width: '100%' }} onClick={handleImport} disabled={!importText.trim()}>
            <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Restore from backup
          </button>
        </>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SETUP FLOW (first launch)
// ════════════════════════════════════════════════════════════════════════════════
function Setup({ onComplete, onImport }: any) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<any>({ ...DEFAULT_SETTINGS, startDate: todayStr() });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const update = (patch: any) => setDraft({ ...draft, ...patch });
  const updateSubject = (k: string, patch: any) => update({ subjects: { ...draft.subjects, [k]: { ...draft.subjects[k], ...patch } } });

  const handleImport = async () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.settings) {
        setImportError('Backup is missing settings. Paste the full export.');
        return;
      }
      await onImport(parsed);
    } catch (e) {
      setImportError('Invalid JSON. Paste exactly what you copied from Export.');
    }
  };

  const steps = [
    { title: 'Welcome.', body: "Let's set up your daily system. Six quick questions.", content: null, next: 'Begin' },
    {
      title: 'Wake & sleep window',
      content: (
        <>
          <label>Typical wake time</label>
          <input type="time" value={draft.wakeTime} onChange={(e) => update({ wakeTime: e.target.value })} style={{ marginBottom: 14 }} />
          <label>Typical sleep time</label>
          <input type="time" value={draft.sleepTime} onChange={(e) => update({ sleepTime: e.target.value })} />
        </>
      ), next: 'Next',
    },
    {
      title: 'Spanish goal',
      content: (
        <>
          <label>Conversational by</label>
          <input type="date" value={draft.subjects.spanish.deadline} onChange={(e) => updateSubject('spanish', { deadline: e.target.value })} style={{ marginBottom: 14 }} />
          <label>Daily target (minutes)</label>
          <input type="number" value={draft.subjects.spanish.target} onChange={(e) => updateSubject('spanish', { target: parseInt(e.target.value) || 0 })} />
        </>
      ), next: 'Next',
    },
    {
      title: 'CySA+ deadline',
      content: (
        <>
          <label>Finish course by</label>
          <input type="date" value={draft.subjects.cysa.deadline} onChange={(e) => updateSubject('cysa', { deadline: e.target.value })} />
          <div className="muted tiny" style={{ marginTop: 10, lineHeight: 1.4 }}>
            Default: 4 weeks from today. Video-only.
          </div>
        </>
      ), next: 'Next',
    },
    {
      title: 'Macro targets',
      content: (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={draft.macroTargets.protein} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, protein: parseInt(e.target.value) || 0 } })} /></div>
            <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={draft.macroTargets.calories} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, calories: parseInt(e.target.value) || 0 } })} /></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={draft.macroTargets.carbs} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, carbs: parseInt(e.target.value) || 0 } })} /></div>
            <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={draft.macroTargets.fat} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, fat: parseInt(e.target.value) || 0 } })} /></div>
          </div>
          <div className="muted tiny" style={{ marginTop: 10, lineHeight: 1.4 }}>
            Defaults: 170p / 2300cal for recomp. Edit anytime.
          </div>
        </>
      ), next: 'Next',
    },
    {
      title: 'Body measurements',
      content: (
        <>
          <label>First measurement date</label>
          <input type="date" value={draft.nextMeasurement} onChange={(e) => update({ nextMeasurement: e.target.value })} />
          <div className="muted tiny" style={{ marginTop: 10, lineHeight: 1.4 }}>
            After your first entry, the next is auto-scheduled monthly. Default is tomorrow.
          </div>
        </>
      ), next: 'Finish',
    },
  ];

  const current = steps[step];
  return (
    <div className="app">
      <GlobalStyles />
      <div className="content" style={{ paddingTop: 40 }}>
        <div className="mono tiny" style={{ letterSpacing: '0.2em', color: '#6B6457', marginBottom: 24, textTransform: 'uppercase' }}>
          Step {step + 1} of {steps.length}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 12, fontFamily: 'Fraunces, serif' }}>{current.title}</h1>
        {current.body && <p style={{ fontSize: 16, color: '#6B6457', marginBottom: 28, lineHeight: 1.5, fontFamily: 'Fraunces, serif' }}>{current.body}</p>}
        {current.content && <div style={{ marginBottom: 28 }}>{current.content}</div>}
        <div className="row" style={{ gap: 10 }}>
          {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn" style={{ flex: 1 }} onClick={() => step === steps.length - 1 ? onComplete(draft) : setStep(step + 1)}>{current.next}</button>
        </div>

        {step === 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '36px 0 18px' }}>
              <div style={{ flex: 1, height: 1, background: '#E4DCC8' }} />
              <span className="mono tiny muted" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>Returning?</span>
              <div style={{ flex: 1, height: 1, background: '#E4DCC8' }} />
            </div>
            {!showImport ? (
              <button className="btn btn-ghost" onClick={() => setShowImport(true)} style={{ width: '100%' }}>
                <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Restore from backup
              </button>
            ) : (
              <div className="card" style={{ borderLeft: '3px solid #3B5C6B' }}>
                <div className="between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Upload size={16} color="#3B5C6B" />
                    <span className="h3">Restore data</span>
                  </div>
                  <button onClick={() => { setShowImport(false); setImportText(''); setImportError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}>
                    <X size={18} />
                  </button>
                </div>
                <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                  Paste your backup JSON below. This will restore everything and skip setup.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                  placeholder="Paste your backup JSON here..."
                  style={{ fontFamily: 'JetBrains Mono', fontSize: 11, padding: 10, height: 180, marginBottom: 10, resize: 'vertical', width: '100%' }}
                />
                {importError && (
                  <div className="small" style={{ color: '#B8460E', marginBottom: 10, padding: 8, background: '#F5E1D5', borderRadius: 6 }}>
                    {importError}
                  </div>
                )}
                <button className="btn btn-accent" onClick={handleImport} disabled={!importText.trim()} style={{ width: '100%' }}>
                  <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Restore everything
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('today');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [daily, setDaily] = useState<any>(null);
  const [totals, setTotals] = useState<any>({});
  const [body, setBody] = useState<any>({ entries: [] });
  const [workout, setWorkout] = useState<any>({ split: DEFAULT_WORKOUT_SPLIT, logs: {}, mode: 'sequence', sequencePosition: 1 });
  const [meals, setMeals] = useState<any>({ presets: [], log: {} });
  const [plans, setPlans] = useState<any>({});
  const [streaks, setStreaks] = useState<any>({});
  const [weeklyAck, setWeeklyAck] = useState<any>({ lastAck: null });
  const [journal, setJournal] = useState<any>({});
  const [challengeHistory, setChallengeHistory] = useState<any[]>([]);
  const [busyPresets, setBusyPresets] = useState<string[]>(BUSY_PRESET_DEFAULTS);
  const [checkins, setCheckins] = useState<any>({});
  const [activity, setActivity] = useState<any>({});
  const [modal, setModal] = useState<any>(null);

  useEffect(() => {
    (async () => {
      await syncPull(); // hydrate from server if it has newer data (survives device/browser changes)
      const s = await safeGet(K.settings, DEFAULT_SETTINGS);
      const merged = { ...DEFAULT_SETTINGS, ...s, subjects: { ...DEFAULT_SETTINGS.subjects, ...(s.subjects || {}) }, macroTargets: { ...DEFAULT_SETTINGS.macroTargets, ...(s.macroTargets || {}) } };
      // Normalize subjects to the flexible model and purge soft-deletes older than 15 days.
      for (const k of Object.keys(merged.subjects)) {
        const sub = normalizeSubject(merged.subjects[k]);
        if (sub.deletedAt && diffDays(todayStr(), sub.deletedAt) > 15) {
          delete merged.subjects[k];
          merged.subjectOrder = (merged.subjectOrder || []).filter((x: string) => x !== k);
        } else {
          merged.subjects[k] = sub;
        }
      }
      const t = await safeGet(K.totals, {});
      const b = await safeGet(K.body, { entries: [] });
      const w = await safeGet(K.workout, { split: DEFAULT_WORKOUT_SPLIT, logs: {}, mode: 'sequence', sequencePosition: 1 });
      if (!w.mode) w.mode = 'sequence';
      if (w.sequencePosition == null) w.sequencePosition = 1;
      const m = migrateMeals(await safeGet(K.meals, { presets: SAMPLE_PRESETS, log: {}, entries: {} }));
      const p = await safeGet(K.plans, {});
      const st = await safeGet(K.streaks, {});
      const wa = await safeGet(K.weeklyReview, { lastAck: null });
      const jn = await safeGet(K.journal, {});
      const ch = await safeGet(K.challengeHistory, []);
      const bp = await safeGet(K.busyPresets, BUSY_PRESET_DEFAULTS);
      const ci = await safeGet(K.checkins, {});
      const ac = await safeGet(K.activity, {});
      let d = await safeGet(K.daily, null);
      if (!d || d.date !== todayStr()) {
        const plan = p[todayStr()];
        d = {
          date: todayStr(),
          wakeLogged: false,
          actualWake: null,
          plannedWake: plan?.wakeTime || null,
          scheduleStarted: false,
          scheduleStartTime: null,
          status: 'home',
          busyUntil: null,
          completed: Object.fromEntries(Object.keys(merged.subjects).map((k: string) => [k, 0])),
          bonus: Object.fromEntries(Object.keys(merged.subjects).map((k: string) => [k, 0])),
        };
        await safeSet(K.daily, d);
      }
      if (d.scheduleStarted == null) d.scheduleStarted = false;
      if (!d.bonus) d.bonus = Object.fromEntries(Object.keys(merged.subjects).map((k: string) => [k, 0]));
      setAppUnits(merged.units);
      setSettings(merged);
      setDaily(d);
      setTotals(t);
      setBody(b);
      setWorkout(w);
      setMeals(m);
      setPlans(p);
      setStreaks(st);
      setWeeklyAck(wa);
      setJournal(jn);
      setChallengeHistory(ch);
      setBusyPresets(bp);
      setCheckins(ci);
      setActivity(ac);
      setLoaded(true);
    })();
  }, []);

  // Auto-backup: snapshot once after load, then periodically, so data survives accidental loss.
  useEffect(() => {
    if (!loaded) return;
    void createBackup();
    const id = setInterval(() => { void createBackup(); }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [loaded]);

  // Cloud sync: debounce-push the full snapshot to the server after any change.
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => { void syncPush(); }, 2500);
    return () => clearTimeout(id);
  }, [loaded, settings, totals, body, workout, meals, plans, streaks, journal, challengeHistory, busyPresets, activity, checkins]);

  // Opt-in reminders (fire while the app is open; permission-gated).
  useEffect(() => {
    if (!loaded || !settings.reminders?.enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const fired = new Set<string>();
    const check = () => {
      try {
        if (settings.nextMeasurement && diffDays(settings.nextMeasurement) <= 0 && !fired.has('measure') && !body.entries?.some((e: any) => e.date === todayStr())) {
          new Notification('Body measurement due', { body: 'Time to log your measurements.' });
          fired.add('measure');
        }
      } catch {}
    };
    const t = setTimeout(check, 4000);
    const id = setInterval(check, 30 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [loaded, settings.reminders?.enabled, settings.nextMeasurement]);

  // Celebrate newly-earned achievements (silent on first load so we don't dump them all at once).
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const badges = computeAchievements(totals, streaks, workout, body, meals);
      const earnedIds = badges.filter((b) => b.earned).map((b) => b.id);
      const seen = await safeGet(K.achievements, null);
      if (seen === null) { await safeSet(K.achievements, earnedIds); return; }
      const fresh = badges.filter((b) => b.earned && !seen.includes(b.id));
      if (fresh.length) {
        fresh.forEach((b) => toast(`Achievement unlocked: ${b.label}`, { icon: <Trophy size={16} color="#C8932E" /> }));
        celebrate();
        await safeSet(K.achievements, earnedIds);
      }
    })();
  }, [loaded, totals, streaks, workout, body, meals]);

  const saveSettings = async (next: any) => { setAppUnits(next.units); setSettings(next); await safeSet(K.settings, next); };
  const saveDaily = async (next: any) => { setDaily(next); await safeSet(K.daily, next); };
  const saveTotals = async (next: any) => { setTotals(next); await safeSet(K.totals, next); };
  const saveBody = async (next: any) => { setBody(next); await safeSet(K.body, next); };
  const saveWorkout = async (next: any) => { setWorkout(next); await safeSet(K.workout, next); };
  const saveMeals = async (next: any) => { setMeals(next); await safeSet(K.meals, next); };
  const savePlans = async (next: any) => { setPlans(next); await safeSet(K.plans, next); };
  const saveStreaks = async (next: any) => { setStreaks(next); await safeSet(K.streaks, next); };
  const saveJournal = async (next: any) => { setJournal(next); await safeSet(K.journal, next); };
  const saveChallengeHistory = async (next: any[]) => { setChallengeHistory(next); await safeSet(K.challengeHistory, next); };
  const saveBusyPresets = async (next: string[]) => { setBusyPresets(next); await safeSet(K.busyPresets, next); };
  const saveCheckins = async (next: any) => { setCheckins(next); await safeSet(K.checkins, next); };
  const saveActivity = async (next: any) => { setActivity(next); await safeSet(K.activity, next); };

  const undoToast = (label: string, restore: () => void | Promise<void>) => {
    toast(label, { action: { label: 'Undo', onClick: () => { void restore(); } }, duration: 6000 });
  };

  // Record (or remove) a "done today" check-in for a subject's weekly/count goals.
  const recordCheckin = async (subject: string, doneToday: boolean) => {
    const today = todayStr();
    const list: string[] = checkins[subject] || [];
    const has = list.includes(today);
    if (doneToday === has) return;
    const nextList = doneToday ? [...list, today] : list.filter((d) => d !== today);
    await saveCheckins({ ...checkins, [subject]: nextList });
  };

  // Check-off subjects: toggle today's completion.
  const markDone = async (subject: string) => {
    const prev = checkins;
    const today = todayStr();
    const list: string[] = checkins[subject] || [];
    const has = list.includes(today);
    const nextList = has ? list.filter((d) => d !== today) : [...list, today];
    await saveCheckins({ ...checkins, [subject]: nextList });
    if (!has) {
      const weeklyDays = settings.subjects[subject]?.weeklyDays || 7;
      if (doneThisWeek(subject, { [subject]: nextList }) >= weeklyDays) celebrate(); else haptic();
    }
    const name = settings.subjects[subject]?.name || 'task';
    undoToast(has ? `${name} unmarked` : `${name} done`, () => saveCheckins(prev));
  };

  const setSubjectTime = async (subject: string, newMins: number) => {
    const prevDaily = daily, prevTotals = totals, prevStreaks = streaks;
    const oldMins = daily.completed[subject] || 0;
    const diff = newMins - oldMins;
    const newTotals = { ...totals, [subject]: Math.max(0, (totals[subject] || 0) + diff) };
    const target = settings.subjects[subject]?.target || 0;
    const newBonus = Math.max(0, newMins - target);
    const newDaily = {
      ...daily,
      completed: { ...daily.completed, [subject]: Math.max(0, newMins) },
      bonus: { ...(daily.bonus || {}), [subject]: newBonus },
    };
    await saveDaily(newDaily);
    await saveTotals(newTotals);
    if (newMins >= target && target > 0 && newMins > oldMins) {
      const today = todayStr();
      const cur = streaks[subject] || { current: 0, longest: 0, lastDate: null };
      if (cur.lastDate !== today) {
        const yest = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
        const continuing = cur.lastDate === yest || diffDays(today, cur.lastDate) <= 2;
        const newCurrent = continuing ? cur.current + 1 : 1;
        await saveStreaks({ ...streaks, [subject]: { current: newCurrent, longest: Math.max(cur.longest, newCurrent), lastDate: today } });
      }
    }
    await recordCheckin(subject, newMins >= target && target > 0);
    const name = settings.subjects[subject]?.name || 'time';
    undoToast(`${name} set to ${Math.max(0, newMins)}m`, async () => { await saveDaily(prevDaily); await saveTotals(prevTotals); await saveStreaks(prevStreaks); });
  };

  const resetMacros = async () => {
    const prevMeals = meals;
    const today = todayStr();
    const next = { ...meals, entries: { ...(meals.entries || {}), [today]: [] }, log: { ...meals.log, [today]: { protein: 0, carbs: 0, fat: 0, calories: 0 } } };
    await saveMeals(next);
    undoToast('Macros reset', () => saveMeals(prevMeals));
  };

  const logTime = async (subject: string, minutes: number) => {
    const prevDaily = daily, prevTotals = totals, prevStreaks = streaks;
    const target = settings.subjects[subject]?.target || 0;
    const wasUnderTarget = (daily.completed[subject] || 0) < target;
    const newCompleted = (daily.completed[subject] || 0) + minutes;
    const overage = Math.max(0, newCompleted - target);
    const newBonus = (daily.bonus?.[subject] || 0) + (wasUnderTarget ? Math.max(0, overage) : minutes);
    const newDaily = {
      ...daily,
      completed: { ...daily.completed, [subject]: newCompleted },
      bonus: { ...(daily.bonus || {}), [subject]: newBonus },
    };
    const newTotals = { ...totals, [subject]: (totals[subject] || 0) + minutes };
    await saveDaily(newDaily);
    await saveTotals(newTotals);
    if (newCompleted >= target && target > 0) {
      const today = todayStr();
      const cur = streaks[subject] || { current: 0, longest: 0, lastDate: null };
      if (cur.lastDate !== today) {
        const yest = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
        const continuing = cur.lastDate === yest || diffDays(today, cur.lastDate) <= 2;
        const newCurrent = continuing ? cur.current + 1 : 1;
        const next = { ...streaks, [subject]: { current: newCurrent, longest: Math.max(cur.longest, newCurrent), lastDate: today } };
        await saveStreaks(next);
      }
    }
    if (newCompleted >= target && target > 0) await recordCheckin(subject, true);
    if (target > 0 && (daily.completed[subject] || 0) < target && newCompleted >= target) celebrate();
    else haptic();
    const name = settings.subjects[subject]?.name || 'time';
    undoToast(`Logged ${minutes}m of ${name}`, async () => { await saveDaily(prevDaily); await saveTotals(prevTotals); await saveStreaks(prevStreaks); });
  };

  const resetDay = async (opts: { subjects?: boolean; macros?: boolean; workout?: boolean; status?: boolean }) => {
    const prevDaily = daily, prevTotals = totals, prevMeals = meals, prevWorkout = workout;
    const today = todayStr();
    let newDaily = { ...daily };
    let newTotals = totals;
    let newMeals = meals;
    let newWorkout = workout;

    if (opts.subjects) {
      newTotals = { ...totals };
      for (const k of Object.keys(daily.completed || {})) {
        newTotals[k] = Math.max(0, (newTotals[k] || 0) - (daily.completed[k] || 0));
      }
      newDaily = {
        ...newDaily,
        completed: Object.fromEntries(Object.keys(daily.completed || {}).map((k) => [k, 0])),
        bonus: Object.fromEntries(Object.keys(daily.bonus || {}).map((k) => [k, 0])),
      };
    }
    if (opts.macros) {
      newMeals = { ...meals, log: { ...meals.log, [today]: { protein: 0, carbs: 0, fat: 0, calories: 0 } } };
      if (meals.entries) newMeals.entries = { ...meals.entries, [today]: [] };
    }
    if (opts.workout && workout.logs?.[today]) {
      const logs = { ...workout.logs };
      delete logs[today];
      newWorkout = { ...workout, logs };
    }
    if (opts.status) {
      newDaily = { ...newDaily, status: 'home', busyUntil: null, busyReason: null, busy: null, wakeLogged: false, actualWake: null, scheduleStarted: false, scheduleStartTime: null };
    }

    if (opts.subjects) await saveTotals(newTotals);
    if (opts.macros) await saveMeals(newMeals);
    if (opts.workout) await saveWorkout(newWorkout);
    if (opts.subjects || opts.status) await saveDaily(newDaily);

    undoToast('Day reset', async () => {
      await saveDaily(prevDaily); await saveTotals(prevTotals); await saveMeals(prevMeals); await saveWorkout(prevWorkout);
    });
  };

  const startFocus = async (subject: string) => {
    if (daily.focus) return;
    await saveDaily({ ...daily, focus: { subject, start: Date.now() } });
  };
  const stopFocus = async () => {
    if (!daily?.focus) return;
    const { subject, start } = daily.focus;
    const mins = Math.max(1, Math.round((Date.now() - start) / 60000));
    await logTime(subject, mins);
    // Functional update reads the latest daily (post-log) so we don't reintroduce focus.
    setDaily((d: any) => { const nd = { ...d, focus: null }; void safeSet(K.daily, nd); return nd; });
  };

  const startBusy = async (mins: number | null, reason: string) => {
    const now = nowHHMM();
    const plannedUntil = mins ? addMinutes(now, mins) : null;
    await saveDaily({ ...daily, status: 'busy', busyUntil: plannedUntil, busyReason: reason, busy: { segments: [{ reason: reason || 'Busy', start: now, end: null }], plannedUntil } });
  };
  const switchBusy = async (mins: number | null, reason: string) => {
    const now = nowHHMM();
    const segs = (daily.busy?.segments || []).map((s: any, i: number, arr: any[]) => (i === arr.length - 1 && !s.end ? { ...s, end: now } : s));
    segs.push({ reason: reason || 'Busy', start: now, end: null });
    const plannedUntil = mins ? addMinutes(now, mins) : (daily.busy?.plannedUntil || null);
    await saveDaily({ ...daily, status: 'busy', busyUntil: plannedUntil, busyReason: reason, busy: { segments: segs, plannedUntil } });
  };
  const endBusy = async (shouldLog: boolean) => {
    const now = nowHHMM();
    const segs = (daily.busy?.segments || []).map((s: any) => {
      const end = s.end || now;
      return { reason: s.reason || 'Busy', start: s.start, end, mins: Math.max(0, timeToMins(end) - timeToMins(s.start)) };
    });
    if (shouldLog && segs.length) {
      const today = todayStr();
      await saveActivity({ ...activity, [today]: [...(activity[today] || []), ...segs] });
    }
    await saveDaily({ ...daily, status: 'home', busyUntil: null, busyReason: null, busy: null });
  };

  if (!loaded) {
    return (
      <div className="app">
        <GlobalStyles />
        <div className="content">
          <div style={{ height: 14, width: 120, background: '#E4DCC8', borderRadius: 6, marginBottom: 20, opacity: 0.7 }} />
          <div style={{ height: 30, width: '70%', background: '#E4DCC8', borderRadius: 8, marginBottom: 22, opacity: 0.6 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ height: 90 + i * 10 }}>
              <div style={{ height: 12, width: '40%', background: '#E4DCC8', borderRadius: 6, marginBottom: 12, opacity: 0.6 }} />
              <div style={{ height: 8, width: '90%', background: '#EFE9DB', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ height: 8, width: '75%', background: '#EFE9DB', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!settings.setupComplete) {
    return <Setup onComplete={(s: any) => saveSettings({ ...s, setupComplete: true })} onImport={async (d: any) => {
      if (d.settings) { setSettings(d.settings); await safeSet(K.settings, d.settings); }
      if (d.totals) { setTotals(d.totals); await safeSet(K.totals, d.totals); }
      if (d.body) { setBody(d.body); await safeSet(K.body, d.body); }
      if (d.workout) { setWorkout(d.workout); await safeSet(K.workout, d.workout); }
      if (d.meals) { setMeals(d.meals); await safeSet(K.meals, d.meals); }
      if (d.plans) { setPlans(d.plans); await safeSet(K.plans, d.plans); }
      if (d.streaks) { setStreaks(d.streaks); await safeSet(K.streaks, d.streaks); }
    }} />;
  }

  const showWeekly = isSunday() && weeklyAck.lastAck !== todayStr() && !modal;

  return (
    <div className="app">
      <GlobalStyles />
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'inherit' } }} />
      <div className="content">
        <Header date={todayStr()} onSettings={() => setModal({ type: 'settings' })} />

        {tab === 'today' && (
          <TodayTab
            settings={settings} daily={daily} totals={totals} streaks={streaks} meals={meals} workout={workout} checkins={checkins}
            onWake={(time: string) => saveDaily({ ...daily, wakeLogged: true, actualWake: time })}
            onScheduleStart={(time: string) => saveDaily({ ...daily, scheduleStarted: true, scheduleStartTime: time })}
            onStatus={(status: string, busyUntil: string) => saveDaily({ ...daily, status, busyUntil })}
            onLogTime={(s: string, mode?: string) => setModal({ type: 'logTime', subject: s, editMode: mode === 'edit' })}
            onBusy={() => setModal({ type: 'busy' })}
            onBack={() => setModal({ type: 'busyBack' })}
            onSwitch={() => setModal({ type: 'busy', mode: 'switch' })}
            onLogMeal={() => setModal({ type: 'logMeal' })}
            onResetMacros={resetMacros}
            onMarkDone={markDone}
            onFocusStart={startFocus}
            onFocusStop={stopFocus}
            onCoach={() => setModal({ type: 'nutritionCoach' })}
          />
        )}
        {tab === 'body' && (
          <BodyTab
            settings={settings} body={body} workout={workout}
            onAddEntry={() => setModal({ type: 'addMeasurement' })}
            onEditGoals={() => setModal({ type: 'bodyGoals' })}
          />
        )}
        {tab === 'workout' && (
          <WorkoutTab
            workout={workout} settings={settings}
            onLogWorkout={(idx: number) => setModal({ type: 'logWorkout', dayIdx: idx })}
            onEditSplit={() => setModal({ type: 'editSplit' })}
            onSaveWorkout={saveWorkout}
          />
        )}
        {tab === 'plan' && (
          <PlanTab
            plans={plans} settings={settings}
            onPlanDay={(date: string) => setModal({ type: 'planDay', date })}
          />
        )}
        {tab === 'journal' && (
          <JournalTab journal={journal} onSave={saveJournal} />
        )}
        {tab === 'history' && (
          <HistoryTab
            settings={settings} totals={totals} workout={workout} meals={meals} body={body}
            activity={activity} streaks={streaks}
            onSelectDay={(date: string) => setModal({ type: 'dayDetail', date })}
          />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      {modal?.type === 'settings' && <SettingsModal settings={settings} body={body} onSave={saveSettings} onClose={() => setModal(null)} onEditSubject={(k: string) => setModal({ type: 'editSubject', key: k })} onAddSubject={() => setModal({ type: 'editSubject', key: null })} onChallenge={() => setModal({ type: 'challenge' })} onExportImport={() => setModal({ type: 'exportImport' })} onResetDay={() => setModal({ type: 'resetDay' })} />}
      {modal?.type === 'resetDay' && <ResetDayModal onReset={resetDay} onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'editSubject' && <EditSubjectModal subjectKey={modal.key} settings={settings} onSave={saveSettings} onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'logTime' && <LogTimeModal subject={modal.subject} settings={settings} daily={daily} editMode={modal.editMode} onLog={(m: number) => { logTime(modal.subject, m); setModal(null); }} onSet={(m: number) => { setSubjectTime(modal.subject, m); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'busy' && <BusyModal isSwitch={modal.mode === 'switch'} busyPresets={busyPresets} onSavePresets={saveBusyPresets} onConfirm={(m: number | null, reason: string) => { if (modal.mode === 'switch') switchBusy(m, reason); else startBusy(m, reason); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'busyBack' && <BusyBackModal daily={daily} onConfirm={(log: boolean) => { endBusy(log); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'addMeasurement' && <AddMeasurementModal onSave={async (entry: any) => { const next = { ...body, entries: [...body.entries, entry] }; const nextSettings = { ...settings, nextMeasurement: addMonth(todayStr(), 1) }; await saveBody(next); await saveSettings(nextSettings); setModal(null); }} onClose={() => setModal(null)} previous={body.entries[body.entries.length - 1]} />}
      {modal?.type === 'bodyGoals' && <BodyGoalsModal settings={settings} onSave={saveSettings} onClose={() => setModal(null)} />}
      {modal?.type === 'logWorkout' && <LogWorkoutModal dayIdx={modal.dayIdx} workout={workout} onSave={saveWorkout} onClose={() => setModal(null)} />}
      {modal?.type === 'editSplit' && <EditSplitModal workout={workout} onSave={saveWorkout} onClose={() => setModal(null)} />}
      {modal?.type === 'challenge' && <ChallengeModal settings={settings} challengeHistory={challengeHistory} onSave={saveSettings} onSaveHistory={saveChallengeHistory} onClose={() => setModal(null)} />}
      {modal?.type === 'logMeal' && <LogMealModal meals={meals} settings={settings} onSave={saveMeals} onClose={() => setModal(null)} />}
      {modal?.type === 'nutritionCoach' && <NutritionCoachModal settings={settings} meals={meals} body={body} onLogItem={async (item: any) => { await saveMeals(addMealEntry(meals, todayStr(), { qty: 1, ...item })); toast(`Logged ${item.name}`); }} onClose={() => setModal(null)} />}
      {modal?.type === 'planDay' && <PlanDayModal date={modal.date} plans={plans} onSave={savePlans} onClose={() => setModal(null)} />}
      {modal?.type === 'dayDetail' && <DayDetailModal date={modal.date} settings={settings} totals={totals} workout={workout} meals={meals} body={body} activity={activity} onClose={() => setModal(null)} />}
      {modal?.type === 'exportImport' && <ExportImportModal data={{ settings, totals, body, workout, meals, plans, streaks, journal, challengeHistory, busyPresets, weeklyAck }} onImport={async (d: any) => {
        if (d.settings) { setSettings(d.settings); await safeSet(K.settings, d.settings); }
        if (d.totals) { setTotals(d.totals); await safeSet(K.totals, d.totals); }
        if (d.body) { setBody(d.body); await safeSet(K.body, d.body); }
        if (d.workout) { setWorkout(d.workout); await safeSet(K.workout, d.workout); }
        if (d.meals) { setMeals(d.meals); await safeSet(K.meals, d.meals); }
        if (d.plans) { setPlans(d.plans); await safeSet(K.plans, d.plans); }
        if (d.streaks) { setStreaks(d.streaks); await safeSet(K.streaks, d.streaks); }
        if (d.journal) { setJournal(d.journal); await safeSet(K.journal, d.journal); }
        if (d.challengeHistory) { setChallengeHistory(d.challengeHistory); await safeSet(K.challengeHistory, d.challengeHistory); }
        if (d.busyPresets) { setBusyPresets(d.busyPresets); await safeSet(K.busyPresets, d.busyPresets); }
        if (d.activity) { await safeSet(K.activity, d.activity); }
        if (d.checkins) { await safeSet(K.checkins, d.checkins); }
        setModal(null);
      }} onClose={() => setModal(null)} />}
      {showWeekly && <WeeklyReviewModal settings={settings} totals={totals} body={body} workout={workout} meals={meals} streaks={streaks} onAck={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} onSkip={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} />}
    </div>
  );
}
