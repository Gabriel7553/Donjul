import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sun, Home, Footprints, Check, Plus, Settings as SettingsIcon, X, Music, Languages, Shield,
  Award, Save, Calendar as CalIcon, Activity, Dumbbell, Apple, ListChecks, ChevronRight, ChevronDown, ChevronLeft,
  TrendingUp, TrendingDown, Edit3, Trash2, Flame, ArrowUp, ArrowDown, Minus, Target, BookOpen, Clock, Moon, Coffee,
  Download, Upload, History, Repeat, Zap, Play, AlertTriangle, RotateCcw, MapPin, Building2, TreePine,
  Camera, BookMarked, TrendingUp as Journal, DollarSign, ShoppingCart, Briefcase, Car, ChevronUp, Trophy, Archive, Infinity, Mic,
  Wallet, PiggyBank, CreditCard, PieChart, Receipt, Pencil, ArrowUpRight, ArrowDownRight, Sparkles,
  ArrowRightLeft, Users, Banknote, BadgeAlert, CircleDollarSign, HandCoins, GripVertical
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { pushKey as syncPushKey, getSyncId, setSyncId, getStoredUsername, setStoredUsername, clearStoredUsername, clearLocalSyncData, pushAllLocalData } from './sync';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  spending: 'st:spending',
  tax: 'st:tax',
  customChallenges: 'st:customChallenges',
};

// Keys included in a full data snapshot (for auto-backup + export/restore).
const BACKUP_KEYS = ['settings', 'totals', 'body', 'workout', 'meals', 'plans', 'streaks', 'journal', 'challengeHistory', 'busyPresets', 'activity', 'checkins', 'spending', 'tax', 'customChallenges'] as const;
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
    syncPushKey(key, value);
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
function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
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

// Keys we sum across a day's meal entries (macros + micros).
const MICRO_KEYS = [
  'fiber', 'sugar', 'sodium', 'potassium', 'calcium', 'iron',
  'magnesium', 'zinc', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminB12',
  'saturatedFat', 'cholesterol',
] as const;

// Sum a day's meal entries into a macro + micro total.
function mealTotalsFromEntries(entries: any[]): any {
  const base: any = { protein: 0, carbs: 0, fat: 0, calories: 0 };
  for (const k of MICRO_KEYS) base[k] = 0;
  return (entries || []).reduce((acc: any, e: any) => {
    acc.protein += Number(e.protein) || 0;
    acc.carbs += Number(e.carbs) || 0;
    acc.fat += Number(e.fat) || 0;
    acc.calories += Number(e.calories) || 0;
    for (const k of MICRO_KEYS) acc[k] += Number(e[k]) || 0;
    return acc;
  }, base);
}

// Display config for micros: label, unit, target type, color
type MicroDef = { key: string; label: string; unit: string; defaultTarget: number; limit?: boolean; color: string; group: 'fiber' | 'minerals' | 'vitamins' | 'limits' };
const MICRO_DEFS: MicroDef[] = [
  { key: 'fiber',       label: 'Fiber',       unit: 'g',   defaultTarget: 30,   color: '#4A6741', group: 'fiber' },
  { key: 'potassium',   label: 'Potassium',   unit: 'mg',  defaultTarget: 3500, color: '#3B5C6B', group: 'minerals' },
  { key: 'calcium',     label: 'Calcium',     unit: 'mg',  defaultTarget: 1000, color: '#3B5C6B', group: 'minerals' },
  { key: 'iron',        label: 'Iron',        unit: 'mg',  defaultTarget: 18,   color: '#B8460E', group: 'minerals' },
  { key: 'magnesium',   label: 'Magnesium',   unit: 'mg',  defaultTarget: 400,  color: '#3B5C6B', group: 'minerals' },
  { key: 'zinc',        label: 'Zinc',        unit: 'mg',  defaultTarget: 11,   color: '#3B5C6B', group: 'minerals' },
  { key: 'vitaminA',    label: 'Vitamin A',   unit: 'µg',  defaultTarget: 900,  color: '#C8932E', group: 'vitamins' },
  { key: 'vitaminC',    label: 'Vitamin C',   unit: 'mg',  defaultTarget: 90,   color: '#C8932E', group: 'vitamins' },
  { key: 'vitaminD',    label: 'Vitamin D',   unit: 'µg',  defaultTarget: 20,   color: '#C8932E', group: 'vitamins' },
  { key: 'vitaminB12',  label: 'Vitamin B12', unit: 'µg',  defaultTarget: 2.4,  color: '#C8932E', group: 'vitamins' },
  { key: 'sodium',      label: 'Sodium',      unit: 'mg',  defaultTarget: 2300, limit: true, color: '#B8460E', group: 'limits' },
  { key: 'sugar',       label: 'Sugar',       unit: 'g',   defaultTarget: 50,   limit: true, color: '#B8460E', group: 'limits' },
  { key: 'saturatedFat',label: 'Sat fat',     unit: 'g',   defaultTarget: 22,   limit: true, color: '#B8460E', group: 'limits' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg',  defaultTarget: 300,  limit: true, color: '#B8460E', group: 'limits' },
];
const DEFAULT_MICRO_TARGETS: Record<string, number> = Object.fromEntries(MICRO_DEFS.map(d => [d.key, d.defaultTarget]));

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
// Also runs a ONE-TIME purge of macro-only presets (tracked via presetsMicrosMigrated)
// so the user can re-add them via AI which now grabs micros. After that, manually-created
// macro-only presets are preserved — we don't want to silently delete fresh user data.
function migrateMeals(meals: any): any {
  const already = !!meals.presetsMicrosMigrated;
  const rawPresets = already ? (meals.presets || []) : (meals.presets || []).filter(isCompletePreset);
  const m = {
    presets: rawPresets,
    log: meals.log || {},
    entries: meals.entries || {},
    presetsMicrosMigrated: true,
  };
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
    courseHours: null,
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
  d.setDate(d.getDate() - d.getDay());
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

// Suggest micro targets based on body weight + goal direction. Essentials scale modestly
// with size; limits tighten on a cut, loosen slightly on a bulk.
function suggestMicros(latestBody: any, bodyGoals: any) {
  const wLb = Number(latestBody?.weight);
  if (!wLb) return null;
  const dir = bodyGoals?.weight?.direction || 'maintain';
  const scale = Math.min(1.4, Math.max(0.7, wLb / 175));
  const limitScale = dir === 'down' ? 0.85 : dir === 'up' ? 1.1 : 1.0;
  const out: Record<string, number> = {};
  for (const d of MICRO_DEFS) {
    const base = d.defaultTarget;
    const v = d.limit ? base * limitScale : base * scale;
    out[d.key] = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  }
  return out;
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
  cysa: { name: 'CySA+', icon: 'shield', accent: '#3B5C6B', tools: 'Jason Dion · Udemy', description: '', trackingMode: 'time', target: 45, weeklyDays: 7, deadline: '2026-06-16', countTotal: null, courseHours: 36, archived: false, deletedAt: null },
  running: { name: 'Running', icon: 'activity', accent: '#8E4585', tools: 'Easy pace, 25-30 min', description: '', trackingMode: 'time', target: 28, weeklyDays: 3, deadline: '2026-12-31', countTotal: null, archived: false, deletedAt: null },
};

const ICON_MAP: Record<string, any> = { languages: Languages, music: Music, shield: Shield, book: BookOpen, target: Target, dumbbell: Dumbbell, activity: Activity, run: Activity };

const DEFAULT_SETTINGS: Record<string, any> = {
  setupComplete: false,
  wakeTime: '07:00',
  sleepTime: '23:00',
  startDate: todayStr(),
  timeFormat: '12h',
  weightUnit: 'lb',
  lengthUnit: 'in',
  weekStart: 'sun',
  reminders: false,
  theme: 'light',
  todayLayout: ['schedule', 'progress', 'nutrition', 'challenges'],
  subjects: SUBJECTS_DEFAULT,
  subjectOrder: ['cysa', 'spanish', 'running', 'guitar'],
  scheduleStartOffsetMin: 30,
  blockBreakMin: 15,
  macroTargets: { protein: 170, carbs: 230, fat: 75, calories: 2300 },
  microTargets: DEFAULT_MICRO_TARGETS,
  microsEnabled: true,
  journal: {
    tradesEnabled: true,
    tradesLabel: 'Trades',
    notesPlaceholder: "What's on your mind? Progress, setbacks, ideas, reflections…",
  },
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

// Backup plan from Lean & Strong Playbook — 4-round AMRAP circuit for days you can't make the gym.
const HOME_CIRCUIT_EXERCISES = [
  { name: 'Push-Ups', sets: 4, reps: 'AMRAP', weight: '' },
  { name: 'Bodyweight Squats', sets: 4, reps: 'AMRAP', weight: '' },
  { name: 'Sit-Ups', sets: 4, reps: 'AMRAP', weight: '' },
  { name: 'Reverse Lunges (each leg)', sets: 4, reps: '15/leg', weight: '' },
  { name: 'Plank Hold', sets: 4, reps: '45-60s', weight: '' },
  { name: 'Jumping Jacks / Mountain Climbers', sets: 4, reps: '60 sec', weight: '' },
];
const HOME_WORKOUT_SPLIT = [
  { day: 0, name: 'Rest', rest: true, exercises: [] },
  { day: 1, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 2, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 3, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 4, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 5, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 6, name: 'Rest', rest: true, exercises: [] },
];

// ════════════════════════════════════════════════════════════════════════════════
// PROGRESS MATH
// ════════════════════════════════════════════════════════════════════════════════
function getRequiredDailyMins(k: string, settings: any, totals: any, daily: any): number {
  const s = settings.subjects[k];
  if (!s || !s.deadline) return s?.target || 0;
  const totalDone = (totals[k] || 0) + (daily?.completed[k] || 0);
  const target = s.courseHours ? s.courseHours * 60 : targetTotalByDeadline(k, settings);
  const remaining = Math.max(0, target - totalDone);
  const daysLeft = Math.max(1, diffDays(s.deadline, todayStr()));
  return Math.ceil(remaining / daysLeft);
}

function daysLeftInWeek(): number {
  const d = new Date(todayStr() + 'T00:00:00');
  return 7 - d.getDay(); // days from today through Saturday (inclusive)
}

function expectedTotal(subjectKey: string, settings: any) {
  const s = settings.subjects[subjectKey];
  if (!s) return 0;
  if (s.courseHours && s.deadline) {
    const totalMins = s.courseHours * 60;
    const totalDays = Math.max(1, diffDays(s.deadline, settings.startDate) + 1);
    const elapsedDays = Math.max(0, diffDays(todayStr(), settings.startDate));
    return Math.round((elapsedDays / totalDays) * totalMins);
  }
  const days = Math.max(0, diffDays(todayStr(), settings.startDate));
  return Math.round(days * s.target * (s.weeklyDays / 7));
}
function targetTotalByDeadline(subjectKey: string, settings: any) {
  const s = settings.subjects[subjectKey];
  if (!s || !s.deadline) return 0;
  if (s.courseHours) return Math.round(s.courseHours * 60);
  const totalDays = Math.max(1, diffDays(s.deadline, settings.startDate) + 1);
  return Math.round(totalDays * s.target * (s.weeklyDays / 7));
}

// ════════════════════════════════════════════════════════════════════════════════
// SAMPLE PRESETS
// ════════════════════════════════════════════════════════════════════════════════
// Presets start empty so the user re-adds them via AI scan/type — that path captures full micros.
const SAMPLE_PRESETS: any[] = [];

// A preset is "complete" if it carries micro data. Older presets (macros-only) are dropped so
// the user can recapture them with full nutrition via the AI scan/type flow.
function isCompletePreset(p: any): boolean {
  return p && typeof p === 'object' && MICRO_KEYS.some((k) => Number(p[k]) > 0);
}

// ════════════════════════════════════════════════════════════════════════════════
// SPENDING — defaults + helpers
// ════════════════════════════════════════════════════════════════════════════════
const DEFAULT_SPEND_CATEGORIES = [
  // Income
  { id: 'c_salary',     name: 'Salary',         kind: 'in',  color: '#3F7A4F' },
  { id: 'c_freelance',  name: 'Freelance',      kind: 'in',  color: '#2F6E5F' },
  { id: 'c_invest',     name: 'Investments',    kind: 'in',  color: '#5C8E4F' },
  { id: 'c_other_in',   name: 'Other income',   kind: 'in',  color: '#7A9A4E' },
  // Expenses
  { id: 'c_rent',       name: 'Rent / Housing', kind: 'out', color: '#8E4585' },
  { id: 'c_food',       name: 'Food & Groceries', kind: 'out', color: '#B8460E' },
  { id: 'c_dining',     name: 'Dining out',     kind: 'out', color: '#C8932E' },
  { id: 'c_transport',  name: 'Transport',      kind: 'out', color: '#3B5C6B' },
  { id: 'c_bills',      name: 'Bills & Utilities', kind: 'out', color: '#6E5C8E' },
  { id: 'c_subs',       name: 'Subscriptions',  kind: 'out', color: '#5C6E8E' },
  { id: 'c_shopping',   name: 'Shopping',       kind: 'out', color: '#A65E8E' },
  { id: 'c_health',     name: 'Health',         kind: 'out', color: '#8E5C5C' },
  { id: 'c_fun',        name: 'Entertainment',  kind: 'out', color: '#C87A2E' },
  { id: 'c_other_out',  name: 'Other',          kind: 'out', color: '#6B6457' },
];

const DEFAULT_SPENDING = {
  entries: [] as any[],
  categories: DEFAULT_SPEND_CATEGORIES,
  accounts: [] as any[],
  debts: [] as any[],
  owed: [] as any[],
  monthlyBudget: 0,
  savingsGoal: 0,
  income: { w2Monthly: 0, w2Employer: '', expectedTrading: 0, w2YTD: 0 } as any,
  sectionOrder: [] as string[],
};

function migrateSpending(s: any): any {
  const base = { ...DEFAULT_SPENDING, ...(s || {}) };
  base.entries = Array.isArray(base.entries) ? base.entries : [];
  base.categories = Array.isArray(base.categories) && base.categories.length > 0 ? base.categories : DEFAULT_SPEND_CATEGORIES;
  base.accounts = Array.isArray(base.accounts)
    ? base.accounts.map((a: any) => a.type === 'credit' ? { accruedInterest: 0, lastAccrualDate: null, ...a } : a)
    : [];
  base.debts = Array.isArray(base.debts)
    ? base.debts.map((d: any) => ({ accruedInterest: 0, lastAccrualDate: null, ...d }))
    : [];
  base.owed = Array.isArray(base.owed) ? base.owed : [];
  base.monthlyBudget = Number(base.monthlyBudget) || 0;
  base.savingsGoal = Number(base.savingsGoal) || 0;
  if (!base.income || typeof base.income !== 'object') base.income = { w2Monthly: 0, w2Employer: '', expectedTrading: 0 };
  if (!Array.isArray(base.sectionOrder)) base.sectionOrder = [];
  return base;
}

const ACCOUNT_COLORS = ['#1A1A2E', '#3B5C6B', '#8E4585', '#3F7A4F', '#B8460E', '#C8932E', '#5C6E8E', '#6B6457'];
const DEBT_TYPES = [
  { id: 'student_loan', label: 'Student Loan' },
  { id: 'car_loan', label: 'Car Loan' },
  { id: 'personal_loan', label: 'Personal Loan' },
  { id: 'mortgage', label: 'Mortgage' },
  { id: 'credit_card', label: 'Credit Card (debt)' },
  { id: 'other', label: 'Other' },
];

function calcDailyInterest(balance: number, apr: number): number {
  if (!balance || !apr || balance <= 0 || apr <= 0) return 0;
  return (balance * (apr / 100)) / 365;
}
function calcMonthlyInterest(balance: number, apr: number): number {
  if (!balance || !apr || balance <= 0 || apr <= 0) return 0;
  return (balance * (apr / 100)) / 12;
}
function calcPayoffMonths(balance: number, apr: number, minPayment: number): number {
  if (!balance || balance <= 0) return 0;
  if (!minPayment || minPayment <= 0) return Number.POSITIVE_INFINITY;
  if (!apr || apr <= 0) return Math.ceil(balance / minPayment);
  const r = (apr / 100) / 12;
  const monthlyInterest = balance * r;
  if (minPayment <= monthlyInterest) return Number.POSITIVE_INFINITY;
  return Math.ceil(-Math.log(1 - (r * balance) / minPayment) / Math.log(1 + r));
}
function calcTotalInterestAtMin(balance: number, apr: number, minPayment: number): number {
  const months = calcPayoffMonths(balance, apr, minPayment);
  if (!isFinite(months) || months <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, months * minPayment - balance);
}
function fmtPayoff(months: number): string {
  if (!isFinite(months) || months <= 0) return '—';
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}yr ${rem}mo` : `${years}yr`;
}

// ────── TAX ENGINE (multi-year: California + Federal, Single filer) ──────────
const CURRENT_TAX_YEAR = new Date().getFullYear();

const FED_BRACKETS: Record<number, [number, number][]> = {
  2024: [[11600,0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[609350,0.35],[9_999_999,0.37]],
  2025: [[11925,0.10],[48475,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[626350,0.35],[9_999_999,0.37]],
  2026: [[12200,0.10],[49650,0.12],[105800,0.22],[202050,0.24],[256550,0.32],[641850,0.35],[9_999_999,0.37]],
};
const CA_BRACKETS: [number, number][] = [
  [10756,0.01],[25499,0.02],[40245,0.04],[55866,0.06],
  [70606,0.08],[360659,0.093],[432787,0.103],[721314,0.113],[9_999_999,0.123],
];
const STD_DEDUCTION: Record<number, number> = { 2024: 14600, 2025: 15000, 2026: 15350 };
const SS_WAGE_BASE: Record<number, number> = { 2024: 168600, 2025: 176100, 2026: 176100 };
const CA_STD_DEDUCT = 5202;

function applyBrackets(income: number, brackets: [number, number][]): number {
  let tax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    if (income <= prev) break;
    tax += (Math.min(income, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}

// Preset 1099 payers the user works with
const PAYER_PRESETS = [
  { id: 'vsolvit_w2', label: 'Vsolvit (W-2)', type: 'w2' },
  { id: 'tpt', label: 'TPT (1099)', type: '1099' },
  { id: 'mffu', label: 'MFFU (1099)', type: '1099' },
  { id: 'apex', label: 'Apex Trader (1099)', type: '1099' },
  { id: 'topstep', label: 'Topstep (1099)', type: '1099' },
  { id: 'tradeday', label: 'TradeDay (1099)', type: '1099' },
  { id: 'other_1099', label: 'Other (1099)', type: '1099' },
  { id: 'other_w2', label: 'Other (W-2)', type: 'w2' },
];

const makeYearData = () => ({
  w2GrossAnnual: 0, w2Employer: 'Vsolvit', w2YTDActual: 0,
  w2WithheldFed: 0, w2WithheldCA: 0, w2WithheldSS: 0, w2WithheldMedicare: 0,
  tradingExpenses: 0,
  deductions: { homeOffice: 0, equipment: 0, software: 0, internet: 0, other: 0 } as Record<string, number>,
  entries1099: [] as any[],
  payments: [] as any[],
});

const DEFAULT_TAX = {
  activeYear: CURRENT_TAX_YEAR,
  years: { [CURRENT_TAX_YEAR]: makeYearData() } as Record<number, any>,
};

function migrateTax(t: any): any {
  if (!t) return DEFAULT_TAX;
  if (t.years && typeof t.years === 'object') {
    const years: Record<number, any> = {};
    for (const yr of Object.keys(t.years)) {
      const y = t.years[yr];
      years[Number(yr)] = { ...makeYearData(), ...y,
        entries1099: Array.isArray(y.entries1099) ? y.entries1099 : [],
        payments: Array.isArray(y.payments) ? y.payments : [],
        deductions: { ...makeYearData().deductions, ...(y.deductions || {}) },
      };
    }
    if (!years[CURRENT_TAX_YEAR]) years[CURRENT_TAX_YEAR] = makeYearData();
    return { activeYear: t.activeYear || CURRENT_TAX_YEAR, years };
  }
  // Migrate old flat format → treat as 2025 data
  const old: any = { ...makeYearData(),
    w2GrossAnnual: t.w2GrossAnnual || 0, w2Employer: t.w2Employer || 'Vsolvit',
    w2WithheldFed: t.w2WithheldFed || 0, w2WithheldCA: t.w2WithheldCA || 0,
    tradingExpenses: t.tradingExpenses || 0,
    entries1099: Array.isArray(t.entries1099) ? t.entries1099 : [],
    payments: Array.isArray(t.payments) ? t.payments : [],
  };
  const years: Record<number, any> = { 2025: old };
  if (CURRENT_TAX_YEAR !== 2025) years[CURRENT_TAX_YEAR] = makeYearData();
  return { activeYear: CURRENT_TAX_YEAR, years };
}

function calcTaxEstimate(yd: any, year: number = CURRENT_TAX_YEAR, w2YTDOverride = 0) {
  const fedBrackets = FED_BRACKETS[year] || FED_BRACKETS[2025];
  const stdDeduct = STD_DEDUCTION[year] || 15000;
  const ssWageBase = SS_WAGE_BASE[year] || 176100;

  const income1099 = ((yd.entries1099 as any[]) || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const w2Gross = w2YTDOverride > 0 ? w2YTDOverride : (Number(yd.w2GrossAnnual) || 0);
  const dedTotal = (Object.values(yd.deductions || {}) as number[]).reduce((s, v) => s + (Number(v) || 0), 0)
    + (Number(yd.tradingExpenses) || 0);
  const netTrading = Math.max(0, income1099 - dedTotal);

  // Self-employment tax (both employer + employee halves)
  const seBase = netTrading * 0.9235;
  const seSS = Math.min(seBase, ssWageBase) * 0.124;
  const seMed = seBase * 0.029;
  const seTax = seSS + seMed;
  const halfSE = seTax / 2;

  // W-2 payroll taxes (employee share shown for awareness)
  const w2SS = Math.min(w2Gross, ssWageBase) * 0.062;
  const w2Med = w2Gross * 0.0145 + Math.max(0, w2Gross - 200000) * 0.009;

  const totalGross = w2Gross + netTrading;
  const fedAGI = Math.max(0, totalGross - halfSE - stdDeduct);
  const caAGI = Math.max(0, totalGross - halfSE - CA_STD_DEDUCT);
  const fedIncome = applyBrackets(fedAGI, fedBrackets);
  const caIncome = applyBrackets(caAGI, CA_BRACKETS);
  const caSDI = totalGross * 0.011;

  const w2WithheldFed = Number(yd.w2WithheldFed) || 0;
  const w2WithheldCA = Number(yd.w2WithheldCA) || 0;
  const w2WithheldSS = Number(yd.w2WithheldSS) || 0;
  const w2WithheldMed = Number(yd.w2WithheldMedicare) || 0;
  const qPaid = ((yd.payments as any[]) || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const totalWithheld = w2WithheldFed + w2WithheldCA + w2WithheldSS + w2WithheldMed + qPaid;

  const totalTax = fedIncome + seTax + caIncome + caSDI;
  const netOwed = Math.max(0, totalTax - totalWithheld);
  const effectiveRate = totalGross > 0 ? (totalTax / totalGross) * 100 : 0;

  return {
    income1099, w2Gross, netTrading, dedTotal,
    seBase, seSS, seMed, seTax, halfSE,
    w2SS, w2Med,
    totalGross, fedAGI, caAGI, stdDeduct,
    fedIncome, caIncome, caSDI,
    totalTax, totalWithheld, netOwed, effectiveRate,
    quarterly: netOwed / 4,
  };
}

const CUSTOM_CHALLENGE_EMOJIS = ['📖','🏋️','🧘','🚴','🥗','💧','💤','✍️','🎯','🎨','🎸','🧠','🔥','⚡','🌟'];
function getCustomStreak(ch: any): number {
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = `${yd.getFullYear()}-${pad(yd.getMonth()+1)}-${pad(yd.getDate())}`;
  const last = ch.lastActionDate;
  if (!last) return 0;
  if (last < yesterday && !(ch.restDates || []).includes(yesterday)) return 0;
  return ch.streak || 0;
}
// Advance any active custom challenges that track the given subject — call when target is hit.
function tickChallengesForSubject(challenges: any[], subjectKey: string): any[] {
  const today = todayStr();
  const yd = new Date(today + 'T00:00:00'); yd.setDate(yd.getDate() - 1);
  const yesterday = `${yd.getFullYear()}-${pad(yd.getMonth()+1)}-${pad(yd.getDate())}`;
  return challenges.map((ch: any) => {
    if (!ch.active || ch.subjectKey !== subjectKey || ch.lastActionDate === today) return ch;
    const continuing = !ch.lastActionDate || ch.lastActionDate === yesterday;
    const streak = continuing ? (ch.streak || 0) + 1 : 1;
    return { ...ch, streak, longestStreak: Math.max(ch.longestStreak || 0, streak), lastActionDate: today };
  });
}

function fmtMoney(n: number, opts: { signed?: boolean } = {}): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const s = abs >= 1000 ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 }) : abs.toFixed(2);
  if (opts.signed) return `${v < 0 ? '−' : '+'}$${s}`;
  return `${v < 0 ? '−' : ''}$${s}`;
}

function monthKey(date: string): string { return date.slice(0, 7); }
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}
function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function spendingByMonth(entries: any[], ym: string) {
  let income = 0, spent = 0;
  const byCat: Record<string, number> = {};
  for (const e of entries) {
    if (!e?.date || monthKey(e.date) !== ym) continue;
    const amt = Number(e.amount) || 0;
    if (e.type === 'in') income += amt;
    else { spent += amt; byCat[e.categoryId] = (byCat[e.categoryId] || 0) + amt; }
  }
  return { income, spent, net: income - spent, byCat };
}

// ════════════════════════════════════════════════════════════════════════════════
// DND — REUSABLE SORTABLE ROW
// ════════════════════════════════════════════════════════════════════════════════
function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, position: 'relative', zIndex: isDragging ? 20 : undefined }}>
      <span {...attributes} {...listeners} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', cursor: 'grab', color: '#C0B8A8', padding: '4px 2px', touchAction: 'none', display: 'flex', alignItems: 'center' }}>
        <GripVertical size={15} />
      </span>
      {children}
    </div>
  );
}

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

// ── Money section constants ──────────────────────────────────────────────────
const MONEY_DEFAULT_ORDER = [
  'ytd','accounts','budget','savings','trend','daily',
  'debt','income_payoff','tax','categories','recurring','owed','transactions',
];
const MONEY_LABELS: Record<string, string> = {
  ytd: '💰 YTD Income',
  accounts: '🏦 Accounts',
  budget: '📊 Budget',
  savings: '🐷 Savings Goal',
  trend: '📈 6-Month Trend',
  daily: '📅 Daily Spending',
  debt: '💳 Debt Tracker',
  income_payoff: '💼 Income & Payoff',
  tax: '🧾 Tax Tracker',
  categories: '🥧 Where It Went',
  recurring: '🔁 Recurring',
  owed: '🤝 People Owe Me',
  transactions: '🧾 Transactions',
};

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

      /* ── DARK THEME ─────────────────────────────────────────────── */
      .dark, .dark body { background: #14141C !important; color: #E8E4DC !important; }
      .dark .app { background: #14141C; color: #E8E4DC; }
      .dark .card { background: #1C1C28; border-color: #2C2C3E; }
      .dark .block { background: #1C1C28; border-color: #2C2C3E; }
      .dark .modal { background: #1C1C28; }
      .dark .modal-bg { background: rgba(0,0,0,0.72); }
      .dark .btn { background: #E8E4DC; color: #14141C; }
      .dark .btn-ghost { background: transparent; color: #E8E4DC; border-color: #3A3A50; }
      .dark .tap { border-color: #3A3A50; color: #E8E4DC; background: transparent; }
      .dark .tap.active { background: #E8E4DC; color: #14141C; border-color: #E8E4DC; }
      .dark .bottom-nav { background: #1C1C28; border-color: #2C2C3E; }
      .dark .nav-btn { color: #7A7570; }
      .dark .nav-btn.active { color: #E8E4DC; background: #2C2C3E; }
      .dark .muted, .dark .h2 { color: #7A7570 !important; }
      .dark label { color: #7A7570; }
      .dark .divider { background: #2C2C3E; }
      .dark .progress-bar { background: #2C2C3E; }
      .dark input[type="time"], .dark input[type="date"], .dark input[type="number"],
      .dark input[type="text"], .dark select, .dark textarea {
        background: #1A1A26; border-color: #3A3A50; color: #E8E4DC;
      }
      .dark .swatch { opacity: 0.9; }
      /* CSS custom properties for dark-mode-aware inline styles */
      :root {
        --text: #1A1A2E; --text-muted: #6B6457; --text-sub: #3B3B55;
        --bg: #F5F0E6; --bg-card: #FBF7EE; --bg-inset: #F0EAD8;
        --bg-inset2: #F9F5EC; --border: #E4DCC8; --border-muted: #D4CCB8;
      }
      .dark {
        --text: #E8E4DC; --text-muted: #9A9590; --text-sub: #C0BAB0;
        --bg: #14141C; --bg-card: #1C1C28; --bg-inset: #20202E;
        --bg-inset2: #252535; --border: #2C2C3E; --border-muted: #3A3A50;
      }
      .dark .h1, .dark .h3 { color: #E8E4DC !important; }
      .dark .small { color: #D8D4CC; }
      .dark .tiny { color: #B0A9A0; }
      .dark .mono { color: #E8E4DC; }
      .dark .streak-flame { color: #E8A838; }
      .dark .progress-marker { background: #E8E4DC; }
      .dark .sparkline-bar { background: #C8603E; }
      .dark .pill { border-color: #3A3A50; }
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
    { key: 'money', label: 'Money', icon: Wallet },
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
function TodayTab({ settings, daily, totals, streaks, meals, workout, checkins, customChallenges, onWake, onStatus, onLogTime, onBusy, onBack, onSwitch, onLogMeal, onScheduleStart, onResetMacros, onMarkDone, onFocusStart, onFocusStop, onCoach, onRestDay, onManageChallenges }: any) {
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
          <Schedule settings={settings} daily={daily} onLog={onLogTime} subjectKeys={subjectKeys} nowMins={nowMins} checkins={checkins} />
          <CatchUpBanner settings={settings} totals={totals} daily={daily} subjectKeys={subjectKeys} />
          <Progress settings={settings} totals={totals} daily={daily} streaks={streaks} subjectKeys={subjectKeys} onLogExtra={onLogTime} checkins={checkins} onMarkDone={onMarkDone} onFocusStart={onFocusStart} focus={daily.focus} />
          <ChallengeCard settings={settings} workout={workout} />
          <CustomChallengesCard challenges={customChallenges} settings={settings} onRestDay={onRestDay} onManage={onManageChallenges} />
          <MacrosCard targets={settings.macroTargets} totals={todayMacros} onLog={onLogMeal} onReset={onResetMacros} onCoach={onCoach} />
          {settings.microsEnabled !== false && (
            <MicrosCard targets={settings.microTargets} totals={todayMacros} />
          )}
          <WeeklySummary settings={settings} totals={totals} daily={daily} meals={meals} workout={workout} />
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
        const isBusy = daily.status === 'busy';
        const busySegs = daily.busy?.segments;
        const busyStartMins = isBusy && busySegs?.length
          ? timeToMins(busySegs[busySegs.length - 1].start)
          : Number.POSITIVE_INFINITY;
        const isActive = !done && !isBusy && nowMins >= blockStart && nowMins < blockEnd;
        const isOverdue = !done && nowMins >= blockEnd && (!isBusy || busyStartMins >= blockEnd);
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

function CatchUpBanner({ settings, totals, daily, subjectKeys }: any) {
  const today = todayStr();
  const weekDaysLeft = daysLeftInWeek();

  const items = (subjectKeys as string[]).flatMap((k: string) => {
    const s = settings.subjects[k];
    if (!s || s.archived || s.deletedAt || s.trackingMode === 'checkoff' || !s.deadline) return [];
    const totalDone = (totals[k] || 0) + (daily.completed[k] || 0);
    const deficit = expectedTotal(k, settings) - totalDone;
    const daysLeft = Math.max(1, diffDays(s.deadline, today));
    const reqDaily = getRequiredDailyMins(k, settings, totals, daily);
    const originalTarget = s.target || 0;
    const extraPerDay = Math.max(0, reqDaily - originalTarget);
    // Show entry when meaningfully behind OR required daily is higher than original
    if (deficit < 5 && extraPerDay < 3) return [];
    // Spread: extra mins/day this week to absorb the deficit
    const weeklyExtra = weekDaysLeft > 0 ? Math.ceil(deficit / weekDaysLeft) : 0;
    return [{ key: k, name: s.name, accent: s.accent, reqDaily, originalTarget, extraPerDay, daysLeft, deficit: Math.round(deficit), weeklyExtra, deadline: s.deadline }];
  });

  if (items.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid #B8460E', padding: '12px 14px' }}>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <AlertTriangle size={14} color="#B8460E" />
        <span className="h2" style={{ color: '#B8460E' }}>Daily targets (auto-adjusted)</span>
      </div>
      {items.map((b: any) => (
        <div key={b.key} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F0EAD8' }}>
          <div className="between" style={{ marginBottom: 4 }}>
            <div className="row" style={{ gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.accent, flexShrink: 0, marginTop: 1 }} />
              <span className="small" style={{ fontWeight: 600 }}>{b.name}</span>
            </div>
            <span className="mono small" style={{ color: '#B8460E', fontWeight: 700 }}>{b.reqDaily}m/day</span>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {b.extraPerDay > 0 && (
              <span className="mono tiny" style={{ color: '#B8460E' }}>↑ +{b.extraPerDay}m vs plan</span>
            )}
            {b.weeklyExtra > 0 && weekDaysLeft > 1 && (
              <span className="mono tiny muted">· spread +{b.weeklyExtra}m/day × {weekDaysLeft} days this week</span>
            )}
            <span className="mono tiny muted">· {b.daysLeft}d to {fmtShortDate(b.deadline)}</span>
          </div>
        </div>
      ))}
      <p className="muted tiny" style={{ lineHeight: 1.4 }}>Required time updates daily as you log progress.</p>
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
              <>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: subj.accent }} />
                  <div className="progress-marker" style={{ left: `${expectedPct}%` }} />
                </div>
                {(() => {
                  const reqDaily = getRequiredDailyMins(k, settings, totals, daily);
                  const daysLeft = subj.deadline ? Math.max(1, diffDays(subj.deadline, todayStr())) : null;
                  const isBehind = diff < 0;
                  const extraPerDay = Math.max(0, reqDaily - (subj.target || 0));
                  return (
                    <div className="between" style={{ marginTop: 5 }}>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {subj.courseHours && (
                          <span className="mono tiny muted">
                            {(() => { const th = Math.floor(totalDone / 60); const tm = totalDone % 60; return th > 0 ? `${th}h${tm > 0 ? ` ${tm}m` : ''}` : `${tm}m`; })()} / {subj.courseHours}h
                          </span>
                        )}
                        {daysLeft && <span className="mono tiny muted">· {daysLeft}d left</span>}
                      </div>
                      <span className="mono tiny" style={{ color: isBehind ? '#B8460E' : '#4A6741', fontWeight: 600 }}>
                        {isBehind && <AlertTriangle size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                        {reqDaily}m/day{extraPerDay > 0 ? ` (+${extraPerDay})` : ''}
                      </span>
                    </div>
                  );
                })()}
              </>
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

function MicrosCard({ targets, totals }: any) {
  const [open, setOpen] = useState(false);
  const t = { ...DEFAULT_MICRO_TARGETS, ...(targets || {}) };
  const groups: Array<{ title: string; group: MicroDef['group'] }> = [
    { title: 'Fiber', group: 'fiber' },
    { title: 'Minerals', group: 'minerals' },
    { title: 'Vitamins', group: 'vitamins' },
    { title: 'Limits', group: 'limits' },
  ];
  const fmtVal = (v: number) => v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  // Headline coverage = avg % of essential micros hit (excluding limits).
  const essentials = MICRO_DEFS.filter(d => !d.limit);
  const coverage = Math.round(
    essentials.reduce((acc, d) => acc + Math.min(100, ((totals[d.key] || 0) / Math.max(t[d.key] || 1, 1)) * 100), 0) / essentials.length
  );
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)} className="between" style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <Apple size={16} color="#4A6741" />
          <div style={{ textAlign: 'left' }}>
            <div className="h2" style={{ marginBottom: 2 }}>Today's micros</div>
            <div className="mono tiny muted">{coverage}% essentials covered · tap to {open ? 'hide' : 'see'} details</div>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="#6B6457" /> : <ChevronDown size={16} color="#6B6457" />}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {groups.map(g => {
            const defs = MICRO_DEFS.filter(d => d.group === g.group);
            return (
              <div key={g.group} style={{ marginBottom: 12 }}>
                <div className="mono tiny muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.title}</div>
                {defs.map(d => {
                  const tgt = t[d.key] || d.defaultTarget;
                  const c = totals[d.key] || 0;
                  const pct = Math.min(100, (c / Math.max(tgt, 1)) * 100);
                  const over = c > tgt;
                  // For limits: green when under, orange when over. For essentials: gray when low, green when hit.
                  const barColor = d.limit
                    ? (over ? '#B8460E' : '#4A6741')
                    : (pct >= 100 ? '#4A6741' : d.color);
                  return (
                    <div key={d.key} style={{ marginBottom: 8 }}>
                      <div className="between" style={{ marginBottom: 3 }}>
                        <span className="small">{d.label}{d.limit && <span className="muted tiny" style={{ marginLeft: 6 }}>(limit)</span>}</span>
                        <span className="mono tiny" style={{ color: d.limit ? (over ? '#B8460E' : '#6B6457') : (pct >= 100 ? '#4A6741' : '#6B6457') }}>
                          {fmtVal(c)} / {fmtVal(tgt)} {d.unit}
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 3 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <p className="muted tiny" style={{ lineHeight: 1.4, marginTop: 4 }}>
            Micros are estimated from your logged foods. Use the AI scan or "type food" for the most accurate readings — they include vitamins, minerals, and limits.
          </p>
        </div>
      )}
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

function CustomChallengesCard({ challenges, settings, onRestDay, onManage }: any) {
  const today = todayStr();
  const active = (challenges || []).filter((c: any) => c.active);
  if (active.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 6 }}><Trophy size={14} color="#8E4585" /><span className="h2">Your challenges</span></div>
        <button className="tap" onClick={onManage} style={{ fontSize: 11, padding: '3px 8px' }}>Manage</button>
      </div>
      {active.map((ch: any) => {
        const sub = settings.subjects?.[ch.subjectKey];
        const doneToday = ch.lastActionDate === today;
        const isRest = doneToday && (ch.restDates || []).includes(today);
        const isLogged = doneToday && !isRest;
        const isOpen = !ch.days || ch.days === 0;
        const daysDone = ch.startDate ? Math.max(0, diffDays(today, ch.startDate)) : 0;
        const pct = isOpen ? 0 : Math.min(100, Math.round((daysDone / ch.days) * 100));
        return (
          <div key={ch.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #F0EAD8' }}>
            <div className="between" style={{ marginBottom: 4 }}>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>{ch.name}</div>
                <div className="tiny muted">🔥 {ch.streak} streak · {sub?.name || ch.subjectKey} · {isOpen ? `Day ${daysDone + 1}` : `${daysDone}/${ch.days}`}</div>
              </div>
              {!isOpen && <span className="mono tiny muted">{pct}%</span>}
            </div>
            {!isOpen && <div style={{ height: 3, background: '#F0EAD8', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}><div style={{ height: '100%', width: `${pct}%`, background: '#8E4585', borderRadius: 2 }} /></div>}
            {isLogged ? (
              <div className="tiny" style={{ color: '#3F7A4F', fontWeight: 600 }}>✓ Counted today</div>
            ) : isRest ? (
              <div className="tiny" style={{ color: '#6B6457' }}>😴 Rest day · streak protected</div>
            ) : (
              <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
                <div className="tiny muted" style={{ flex: 1 }}>Log {sub?.name || 'subject'} to count today</div>
                <button className="tap" onClick={() => onRestDay(ch.id)} style={{ fontSize: 10, padding: '3px 8px', whiteSpace: 'nowrap' }}>😴 Rest day</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
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
              <div className="h2" style={{ marginBottom: 10 }}>Weight trend</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={entries.filter((e: any) => e.weight != null).map((e: any) => ({ date: fmtShortDate(e.date), weight: e.weight }))} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
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
                      <span className="mono small">{current}{f.unit}</span>
                      {change != null && (
                        <span className="pill" style={{ background: isGood ? '#E8EBE0' : '#F5E1D5', color: isGood ? '#4A6741' : '#B8460E', padding: '2px 8px' }}>
                          {change >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                          {Math.abs(change).toFixed(1)}{f.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  {totalChange != null && start != null && (
                    <div className="mono tiny muted" style={{ marginBottom: 4 }}>
                      Since start: {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(1)}{f.unit}
                      {goal.target != null && <> · target {goal.target}{f.unit}</>}
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
const MOOD_OPTIONS = [
  { value: 1, emoji: '😔', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'OK' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

function JournalTab({ journal, onSave, settings }: any) {
  const today = todayStr();
  const cfg = settings?.journal || { tradesEnabled: true, tradesLabel: 'Trades', notesPlaceholder: "What's on your mind? Progress, setbacks, ideas, reflections…" };
  const todayEntry = journal[today] || { note: '', trades: [] };
  const [note, setNote] = useState(todayEntry.note || '');
  const [mood, setMood] = useState<number | null>(todayEntry.mood ?? null);
  const [trades, setTrades] = useState<any[]>(todayEntry.trades || []);
  const [view, setView] = useState<'today'|'trades'|'history'>('today');
  const [tradeForm, setTradeForm] = useState({ symbol: '', direction: 'L', entry: '', exit: '', pnl: '', notes: '' });
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveNote = async () => {
    const next = { ...journal, [today]: { ...todayEntry, note, trades, mood } };
    await onSave(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const selectMood = async (val: number) => {
    const newMood = mood === val ? null : val;
    setMood(newMood);
    await onSave({ ...journal, [today]: { ...todayEntry, note, trades, mood: newMood } });
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
        {cfg.tradesEnabled && (
          <button className={`tap ${view === 'trades' ? 'active' : ''}`} onClick={() => setView('trades')}>
            {cfg.tradesLabel || 'Trades'}
          </button>
        )}
        <button className={`tap ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>History</button>
      </div>

      {view === 'today' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="h3">Daily notes</span>
              <div className="row" style={{ gap: 6 }}>
                <VoiceButton onResult={(t: string) => setNote((prev: string) => prev ? `${prev} ${t}` : t)} />
                <span className="mono tiny muted">{fmtShortDate(today)}</span>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div className="h2" style={{ marginBottom: 6 }}>How's today?</div>
              <div className="row" style={{ gap: 6, justifyContent: 'space-between' }}>
                {MOOD_OPTIONS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => selectMood(m.value)}
                    title={m.label}
                    style={{
                      flex: 1, padding: '6px 4px', border: `1px solid ${mood === m.value ? '#8E4585' : '#E4DCC8'}`,
                      borderRadius: 8, background: mood === m.value ? '#F3EEF6' : 'transparent',
                      cursor: 'pointer', textAlign: 'center', fontSize: 20, lineHeight: 1.3,
                    }}
                  >
                    <div>{m.emoji}</div>
                    <div className="tiny muted" style={{ fontSize: 9, marginTop: 2 }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={cfg.notesPlaceholder || "What's on your mind? Progress, setbacks, ideas, reflections…"}
              style={{ width: '100%', minHeight: 120, fontFamily: 'Fraunces, serif', fontSize: 15, padding: 10, border: '1px solid #E4DCC8', borderRadius: 8, background: '#FBF7EE', color: '#1A1A2E', resize: 'vertical', lineHeight: 1.6 }}
            />
            <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={saveNote}>
              {saved ? <><Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Saved</> : <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Save note</>}
            </button>
          </div>

          {cfg.tradesEnabled && (
          <div className="card" style={{ padding: 14 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="h3">Today's {(cfg.tradesLabel || 'trades').toLowerCase()}</span>
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

            {trades.length === 0 && <p className="muted small">No {(cfg.tradesLabel || 'trades').toLowerCase()} logged today.</p>}
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
          )}
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
                  <div className="row" style={{ gap: 8 }}>
                    <span className="small" style={{ fontWeight: 600 }}>{fmtDate(d)}</span>
                    {entry?.mood != null && (
                      <span title={MOOD_OPTIONS.find(m => m.value === entry.mood)?.label} style={{ fontSize: 16 }}>
                        {MOOD_OPTIONS.find(m => m.value === entry.mood)?.emoji}
                      </span>
                    )}
                  </div>
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
function HistoryTab({ settings, totals, workout, meals, body, activity, streaks, checkins, spending, onSelectDay }: any) {
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

  const activeSubjectKeys = settings.subjectOrder.filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived && !settings.subjects[k].deletedAt);
  const studyDaysLogged = monthDays.filter(d => {
    return activeSubjectKeys.some((k: string) => (checkins?.[k] || []).includes(d));
  }).length;

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
            const hasStudy = activeSubjectKeys.some((k: string) => (checkins?.[k] || []).includes(d));
            const hasSpending = !!(spending?.entries?.some((e: any) => e.date === d));
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
                  {hasStudy && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#8E4585' }} />}
                  {hasWorkout && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#3B5C6B' }} />}
                  {hasMeal && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#4A6741' }} />}
                  {hasMeasurement && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#B8460E' }} />}
                  {hasActivity && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#C8932E' }} />}
                  {hasSpending && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#3F7A4F' }} />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <span className="tiny muted"><span className="swatch" style={{ background: '#8E4585' }} />Study</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#3B5C6B' }} />Workout</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#4A6741' }} />Meals</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#B8460E' }} />Measurement</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#C8932E' }} />Activity</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#3F7A4F' }} />Spending</span>
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
        {studyDaysLogged > 0 && (
          <div className="between" style={{ padding: '6px 0', borderBottom: '1px solid #E4DCC8' }}>
            <span className="small">Study days</span>
            <span className="mono small" style={{ color: '#8E4585' }}>{studyDaysLogged}</span>
          </div>
        )}
        <div className="between" style={{ padding: '6px 0', borderBottom: '1px solid #E4DCC8' }}>
          <span className="small">Workouts logged</span>
          <span className="mono small">{workoutsLogged}</span>
        </div>
        <div className="between" style={{ padding: '6px 0', borderBottom: '1px solid #E4DCC8' }}>
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

function DayDetailModal({ date, settings, totals, workout, meals, body, activity, checkins, spending, customChallenges,
  onSaveMeals, onSaveWorkout, onSaveTotals, onSaveCheckins, onClose }: any) {
  const [subView, setSubView] = useState<null | 'workout' | 'meals' | 'study'>(null);

  const dayMeals = meals.log?.[date];
  const dayEntries = meals.entries?.[date] || [];
  const dayWorkout = workout.logs?.[date];
  const dayMeasurement = body.entries?.find((e: any) => e.date === date);
  const dayActivities = activity?.[date] || [];
  const daySpending = (spending?.entries || []).filter((e: any) => e.date === date);

  const activeSubjects = (settings.subjectOrder || []).filter(
    (k: string) => settings.subjects[k] && !settings.subjects[k].archived && !settings.subjects[k].deletedAt,
  );

  // Workout sub-view
  const dow = new Date(date + 'T12:00:00').getDay();
  const getSplitDay = (loc: string) => {
    const sp = loc === 'home' ? (workout.homeSplit || HOME_WORKOUT_SPLIT) : (workout.split || DEFAULT_WORKOUT_SPLIT);
    return sp.find((d: any) => d.day === dow) || sp[dow % sp.length] || sp[0];
  };
  const [wData, setWData] = useState<any>(() => {
    if (dayWorkout) return dayWorkout;
    const loc = workout.location || 'gym';
    const sd = getSplitDay(loc);
    return { name: sd?.name || 'Workout', location: loc, exercises: (sd?.exercises || []).map((ex: any) => ({ name: ex.name, sets: Array(ex.sets || 3).fill(0).map(() => ({ weight: '', reps: '', rpe: '' })) })) };
  });
  const switchWLoc = (newLoc: string) => {
    const sd = getSplitDay(newLoc);
    setWData({ name: sd?.name || 'Workout', location: newLoc, exercises: (sd?.exercises || []).map((ex: any) => ({ name: ex.name, sets: Array(ex.sets || 3).fill(0).map(() => ({ weight: '', reps: '', rpe: '' })) })) });
  };
  const wSetSet = (exIdx: number, setIdx: number, field: string, value: string) =>
    setWData((prev: any) => ({
      ...prev,
      exercises: prev.exercises.map((e: any, i: number) =>
        i !== exIdx ? e : { ...e, sets: e.sets.map((s: any, j: number) => j !== setIdx ? s : { ...s, [field]: value }) },
      ),
    }));

  // Meals sub-view
  const [mManual, setMManual] = useState({ name: '', protein: '', carbs: '', fat: '', calories: '' });

  // Study sub-view
  const [studyMins, setStudyMins] = useState<Record<string, string>>({});

  if (subView === 'workout') {
    return (
      <ModalShell title={`Workout · ${fmtDate(date)}`} onClose={onClose} icon={<Dumbbell size={18} color="#3B5C6B" />}>
        <button className="tap" style={{ marginBottom: 14, fontSize: 12 }} onClick={() => setSubView(null)}>
          <ChevronLeft size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to day
        </button>
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <button className={`tap ${wData.location !== 'home' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center', padding: '8px 12px' }} onClick={() => switchWLoc('gym')}>
            <Building2 size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Gym
          </button>
          <button className={`tap ${wData.location === 'home' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center', padding: '8px 12px' }} onClick={() => switchWLoc('home')}>
            <TreePine size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Home
          </button>
        </div>
        <p className="muted small" style={{ marginBottom: 14 }}>Log weight × reps. Leave blank to skip a set.</p>
        {wData.exercises?.map((ex: any, i: number) => (
          <div key={i} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #E4DCC8' }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>{ex.name}</div>
            {ex.sets.map((s: any, j: number) => (
              <div key={j} className="row" style={{ gap: 6, marginBottom: 6 }}>
                <span className="mono tiny muted" style={{ width: 24 }}>S{j + 1}</span>
                <input type="number" placeholder="wt" value={s.weight} onChange={(e) => wSetSet(i, j, 'weight', e.target.value)} style={{ flex: 1, padding: 6, fontSize: 13 }} />
                <span className="muted tiny">×</span>
                <input type="number" placeholder="reps" value={s.reps} onChange={(e) => wSetSet(i, j, 'reps', e.target.value)} style={{ flex: 1, padding: 6, fontSize: 13 }} />
                <input type="number" placeholder="rpe" value={s.rpe} onChange={(e) => wSetSet(i, j, 'rpe', e.target.value)} style={{ width: 50, padding: 6, fontSize: 13 }} />
              </div>
            ))}
          </div>
        ))}
        {(!wData.exercises || wData.exercises.length === 0) && (
          <p className="muted small" style={{ marginBottom: 14 }}>No exercises configured for this day's split.</p>
        )}
        <button className="btn" style={{ width: '100%' }} onClick={async () => {
          await onSaveWorkout({ ...workout, logs: { ...workout.logs, [date]: wData } });
          setSubView(null);
          toast('Workout saved for ' + fmtDate(date));
        }}>
          <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save workout
        </button>
      </ModalShell>
    );
  }

  if (subView === 'meals') {
    return (
      <ModalShell title={`Meals · ${fmtDate(date)}`} onClose={onClose} icon={<Apple size={18} color="#4A6741" />}>
        <button className="tap" style={{ marginBottom: 14, fontSize: 12 }} onClick={() => setSubView(null)}>
          <ChevronLeft size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to day
        </button>
        {dayEntries.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="h2" style={{ marginBottom: 8 }}>Logged items</div>
            {dayEntries.map((e: any) => (
              <div key={e.id} className="between" style={{ padding: '6px 0', borderBottom: '1px solid #F0EAD8' }}>
                <div>
                  <div className="small">{e.name}</div>
                  <div className="mono tiny muted">{e.protein}p · {e.carbs}c · {e.fat}f · {e.calories}cal</div>
                </div>
                <button onClick={async () => onSaveMeals(removeMealEntry(meals, date, e.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E', padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="h2" style={{ marginBottom: 8 }}>Add entry</div>
        <label>Name (optional)</label>
        <input type="text" value={mManual.name} onChange={(e) => setMManual({ ...mManual, name: e.target.value })} placeholder="e.g. Lunch" style={{ marginBottom: 10 }} />
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={mManual.protein} onChange={(e) => setMManual({ ...mManual, protein: e.target.value })} /></div>
          <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={mManual.carbs} onChange={(e) => setMManual({ ...mManual, carbs: e.target.value })} /></div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={mManual.fat} onChange={(e) => setMManual({ ...mManual, fat: e.target.value })} /></div>
          <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={mManual.calories} onChange={(e) => setMManual({ ...mManual, calories: e.target.value })} /></div>
        </div>
        <button className="btn" style={{ width: '100%', marginBottom: 16 }} onClick={async () => {
          const entry = { name: mManual.name || 'Entry', source: 'Manual', protein: parseFloat(mManual.protein) || 0, carbs: parseFloat(mManual.carbs) || 0, fat: parseFloat(mManual.fat) || 0, calories: parseFloat(mManual.calories) || 0 };
          await onSaveMeals(addMealEntry(meals, date, entry));
          setMManual({ name: '', protein: '', carbs: '', fat: '', calories: '' });
          toast('Entry added for ' + fmtDate(date));
        }}>
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Add entry
        </button>
        {meals.presets?.length > 0 && (
          <>
            <div className="h2" style={{ marginBottom: 8 }}>Quick add from presets</div>
            {meals.presets.map((p: any) => (
              <button key={p.id} className="tap" style={{ width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={async () => { await onSaveMeals(addMealEntry(meals, date, { name: p.name, source: p.source || '', qty: 1, protein: p.protein, carbs: p.carbs, fat: p.fat, calories: p.calories })); toast(`${p.name} added`); }}>
                <div style={{ flex: 1 }}>
                  <div className="small" style={{ fontWeight: 500 }}>{p.name}</div>
                  <div className="mono tiny muted">{p.protein}p · {p.carbs}c · {p.fat}f · {p.calories}cal</div>
                </div>
                <Plus size={14} color="#4A6741" />
              </button>
            ))}
          </>
        )}
      </ModalShell>
    );
  }

  if (subView === 'study') {
    return (
      <ModalShell title={`Study · ${fmtDate(date)}`} onClose={onClose} icon={<BookOpen size={18} color="#8E4585" />}>
        <button className="tap" style={{ marginBottom: 14, fontSize: 12 }} onClick={() => setSubView(null)}>
          <ChevronLeft size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to day
        </button>
        <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.5 }}>
          Time subjects add to your cumulative total. Check-off subjects mark the day done.
        </p>
        {activeSubjects.map((k: string) => {
          const s = settings.subjects[k];
          const Icon = ICON_MAP[s.icon] || Target;
          const isCheckoff = s.trackingMode === 'checkoff';
          const alreadyChecked = (checkins?.[k] || []).includes(date);
          return (
            <div key={k} style={{ marginBottom: 12, padding: '12px 14px', background: '#F9F5EC', borderRadius: 10, border: '1px solid #E4DCC8' }}>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <div className="icon-wrap" style={{ background: s.accent, width: 28, height: 28 }}><Icon size={14} /></div>
                <span className="small" style={{ fontWeight: 600, flex: 1 }}>{s.name}</span>
                {isCheckoff && alreadyChecked && <span className="mono tiny" style={{ color: '#4A6741', background: '#4A674122', padding: '2px 6px', borderRadius: 6 }}>✓ Done</span>}
              </div>
              {isCheckoff ? (
                <button className={`tap ${alreadyChecked ? 'active' : ''}`} style={{ width: '100%' }} onClick={async () => {
                  const list: string[] = checkins?.[k] || [];
                  const next = alreadyChecked ? list.filter((d: string) => d !== date) : [...list, date];
                  await onSaveCheckins({ ...checkins, [k]: next });
                  toast(alreadyChecked ? `${s.name} unmarked` : `${s.name} marked done ✓`);
                }}>
                  {alreadyChecked
                    ? <><X size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Unmark</>
                    : <><Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Mark done</>}
                </button>
              ) : (
                <div className="row" style={{ gap: 8 }}>
                  <input type="number" min="0" placeholder={`minutes (target: ${s.target})`} value={studyMins[k] || ''} onChange={(e) => setStudyMins((p) => ({ ...p, [k]: e.target.value }))} style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} />
                  <button className="tap" style={{ padding: '6px 14px', flexShrink: 0 }} onClick={async () => {
                    const mins = parseInt(studyMins[k] || '0') || 0;
                    if (!mins) return;
                    await onSaveTotals({ ...totals, [k]: (totals[k] || 0) + mins });
                    const list: string[] = checkins?.[k] || [];
                    if (!list.includes(date)) await onSaveCheckins({ ...checkins, [k]: [...list, date] });
                    setStudyMins((p) => ({ ...p, [k]: '' }));
                    toast(`+${mins} min logged for ${s.name}`);
                  }}>
                    <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </ModalShell>
    );
  }

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

      <div className="between" style={{ marginBottom: 8 }}>
        <div className="h2">Study</div>
        <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setSubView('study')}>
          <Pencil size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Log
        </button>
      </div>
      {(() => {
        const studied = activeSubjects.filter((k: string) => (checkins?.[k] || []).includes(date));
        if (studied.length === 0) return (
          <p className="muted small" style={{ marginBottom: 14 }}>No study logged.{' '}
            <button className="tap" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSubView('study')}>+ Log</button>
          </p>
        );
        return (
          <div className="card" style={{ padding: 12, marginBottom: 14 }}>
            {studied.map((k: string) => {
              const s = settings.subjects[k];
              const Icon = ICON_MAP[s.icon] || Target;
              return (
                <div key={k} className="row" style={{ gap: 8, padding: '4px 0' }}>
                  <div className="icon-wrap" style={{ background: s.accent, width: 22, height: 22 }}><Icon size={11} /></div>
                  <span className="small">{s.name}</span>
                  <span className="mono tiny" style={{ marginLeft: 'auto', color: '#4A6741' }}>✓</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div className="between" style={{ marginBottom: 8 }}>
        <div className="h2">Nutrition</div>
        <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setSubView('meals')}>
          <Pencil size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {dayMeals ? 'Edit' : 'Log'}
        </button>
      </div>
      {dayMeals && (dayMeals.protein || dayMeals.calories || dayMeals.carbs || dayMeals.fat) ? (
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div><div className="mono tiny muted">PROTEIN</div><div className="h3" style={{ color: '#B8460E' }}>{Math.round(dayMeals.protein || 0)}g</div></div>
            <div><div className="mono tiny muted">CALORIES</div><div className="h3">{Math.round(dayMeals.calories || 0)}</div></div>
            <div><div className="mono tiny muted">CARBS</div><div className="h3">{Math.round(dayMeals.carbs || 0)}g</div></div>
            <div><div className="mono tiny muted">FAT</div><div className="h3">{Math.round(dayMeals.fat || 0)}g</div></div>
          </div>
          {MICRO_DEFS.some(d => (dayMeals[d.key] || 0) > 0) && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #E4DCC8' }}>
              <div className="mono tiny muted" style={{ marginBottom: 5 }}>MICROS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                {MICRO_DEFS.filter(d => (dayMeals[d.key] || 0) > 0).map(d => {
                  const v = dayMeals[d.key];
                  const tgt = settings.microTargets?.[d.key] || d.defaultTarget;
                  const hit = !d.limit && v >= tgt;
                  const over = d.limit && v > tgt;
                  const fmt = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
                  return (
                    <span key={d.key} className="mono tiny" style={{ color: over ? '#B8460E' : hit ? '#4A6741' : '#6B6457' }}>
                      {d.label.replace('Vitamin ', 'Vit ')}: {fmt}{d.unit}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {dayEntries.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid #E4DCC8', paddingTop: 8 }}>
              {dayEntries.map((e: any) => {
                const eMicros = MICRO_DEFS.filter(d => (e[d.key] || 0) > 0);
                return (
                  <div key={e.id} style={{ padding: '4px 0', borderBottom: '1px solid #F0EAD8' }}>
                    <div className="between">
                      <span className="small">{e.name}</span>
                      <span className="mono tiny muted">{e.protein}p · {e.carbs}c · {e.fat}f · {e.calories}cal</span>
                    </div>
                    {eMicros.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 2 }}>
                        {eMicros.map(d => {
                          const v = e[d.key];
                          const fmt = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
                          return <span key={d.key} className="mono tiny" style={{ color: d.limit ? '#B8460E' : '#4A6741' }}>{d.label.replace('Vitamin ', 'Vit ')}: {fmt}{d.unit}</span>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="muted small" style={{ marginBottom: 14 }}>No meals logged.{' '}
          <button className="tap" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSubView('meals')}>+ Log</button>
        </p>
      )}

      <div className="between" style={{ marginBottom: 8 }}>
        <div className="h2">Workout</div>
        <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setSubView('workout')}>
          <Pencil size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {dayWorkout ? 'Edit' : 'Log'}
        </button>
      </div>
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
        <p className="muted small" style={{ marginBottom: 14 }}>No workout logged.{' '}
          <button className="tap" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSubView('workout')}>+ Log</button>
        </p>
      )}

      {dayMeasurement && (
        <>
          <div className="h2" style={{ marginBottom: 8 }}>Measurements</div>
          <div className="card" style={{ padding: 12, marginBottom: 14 }}>
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

      {daySpending.length > 0 && (
        <>
          <div className="h2" style={{ marginBottom: 8 }}>Spending</div>
          <div className="card" style={{ padding: 12, marginBottom: 14 }}>
            {daySpending.map((e: any) => {
              const cat = (spending?.categories || []).find((c: any) => c.id === e.categoryId);
              const isIn = e.type === 'in';
              return (
                <div key={e.id} className="between" style={{ padding: '5px 0', borderBottom: '1px solid #F0EAD8' }}>
                  <div>
                    <div className="small" style={{ fontWeight: 500 }}>{e.name || (isIn ? 'Income' : 'Expense')}</div>
                    {cat && <div className="tiny muted">{cat.name}</div>}
                  </div>
                  <span className="mono small" style={{ color: isIn ? '#3F7A4F' : '#B8460E', fontWeight: 600 }}>
                    {isIn ? '+' : '−'}{fmtMoney(e.amount).replace('−', '')}
                  </span>
                </div>
              );
            })}
            <div className="between" style={{ paddingTop: 8, marginTop: 4, borderTop: '1px solid #E4DCC8' }}>
              <span className="small muted">Net</span>
              <span className="mono small" style={{ fontWeight: 700 }}>
                {fmtMoney(daySpending.filter((e: any) => e.type === 'in').reduce((s: number, e: any) => s + e.amount, 0)
                  - daySpending.filter((e: any) => e.type === 'out').reduce((s: number, e: any) => s + e.amount, 0))}
              </span>
            </div>
          </div>
        </>
      )}

      {(() => {
        const dayChallenges = (customChallenges || []).filter((c: any) => {
          if (!c.startDate || c.startDate > date) return false;
          if (c.completedDate && c.completedDate < date) return false;
          return true;
        });
        if (dayChallenges.length === 0) return null;
        return (
          <>
            <div className="h2" style={{ marginBottom: 8, marginTop: 4 }}>Challenges</div>
            <div className="card" style={{ padding: 12, marginBottom: 14 }}>
              {dayChallenges.map((ch: any) => {
                const sub = settings.subjects?.[ch.subjectKey];
                const logged = (checkins?.[ch.subjectKey] || []).includes(date);
                const isRest = (ch.restDates || []).includes(date);
                const dayNum = diffDays(date, ch.startDate) + 1;
                const isOpen = !ch.days || ch.days === 0;
                return (
                  <div key={ch.id} className="between" style={{ padding: '6px 0', borderBottom: '1px solid #F0EAD8' }}>
                    <div>
                      <div className="small" style={{ fontWeight: 500 }}>{ch.name}</div>
                      <div className="mono tiny muted">{isOpen ? `Day ${dayNum}` : `Day ${dayNum}/${ch.days}`} · {sub?.name || ch.subjectKey}</div>
                    </div>
                    <span className="mono tiny" style={{ color: logged ? '#4A6741' : isRest ? '#6B6457' : '#B8460E', fontWeight: 600 }}>
                      {logged ? '✓ Done' : isRest ? '😴 Rest' : '✗ Missed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
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
    MEASUREMENT_FIELDS.forEach(f => { init[f.key] = previous?.[f.key] != null ? previous[f.key] : ''; });
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
          <label>{f.label} ({f.unit})</label>
          <input type="number" step="0.1" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={previous?.[f.key] != null ? `Previous: ${previous[f.key]}` : ''} />
        </div>
      ))}
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => {
        const entry: Record<string, any> = { date: todayStr() };
        Object.entries(values).forEach(([k, v]) => { if (v !== '' && v != null) entry[k] = parseFloat(v); });
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
  const location = workout.location || 'gym';
  const activeSplit = location === 'home' ? (workout.homeSplit || HOME_WORKOUT_SPLIT) : (workout.split || DEFAULT_WORKOUT_SPLIT);
  const day = activeSplit[Math.min(dayIdx, activeSplit.length - 1)] || activeSplit[0];
  const today = todayStr();
  const initial = workout.logs[today] || { name: day.name, location, exercises: day.exercises.map((ex: any) => ({ name: ex.name, sets: Array(ex.sets).fill(0).map(() => ({ weight: '', reps: '', rpe: '' })) })) };
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
          onClick={() => {
            const s = workout.split || DEFAULT_WORKOUT_SPLIT;
            const d = s[Math.min(dayIdx, s.length - 1)] || s[0];
            setData({ ...data, location: 'gym', name: d.name, exercises: d.exercises.map((ex: any) => ({ name: ex.name, sets: Array(ex.sets).fill(0).map(() => ({ weight: '', reps: '', rpe: '' })) })) });
          }}
        >
          <Building2 size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Gym
        </button>
        <button
          className={`tap ${data.location === 'home' ? 'active' : ''}`}
          style={{ flex: 1, justifyContent: 'center', padding: '8px 12px' }}
          onClick={() => {
            const s = workout.homeSplit || HOME_WORKOUT_SPLIT;
            const d = s[Math.min(dayIdx, s.length - 1)] || s[0];
            setData({ ...data, location: 'home', name: d.name, exercises: d.exercises.map((ex: any) => ({ name: ex.name, sets: Array(ex.sets).fill(0).map(() => ({ weight: '', reps: '', rpe: '' })) })) });
          }}
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
          const nonRestDays = activeSplit.filter((d: any) => !d.rest);
          const cur = workout.sequencePosition || 1;
          nextWorkout.sequencePosition = nonRestDays.length > 0 ? (cur % nonRestDays.length) + 1 : 1;
        }
        await onSave(nextWorkout);
        onClose();
      }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save workout
      </button>
    </ModalShell>
  );
}

function SortableExercise({ id, ex, onUpdate, onRemove }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, marginBottom: 8, padding: 10, background: 'var(--bg-inset)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div className="row" style={{ gap: 6, marginBottom: 6 }}>
        <button {...attributes} {...listeners} style={{ background: 'none', border: 'none', cursor: 'grab', color: 'var(--text)', opacity: 0.4, padding: '2px 4px', touchAction: 'none' }}>
          <GripVertical size={14} />
        </button>
        <input type="text" value={ex.name} onChange={e => onUpdate({ name: e.target.value })} style={{ flex: 1 }} />
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E' }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, marginBottom: 3, display: 'block' }}>Sets</label>
          <input type="number" value={ex.sets} onChange={e => onUpdate({ sets: parseInt(e.target.value) || 0 })} style={{ padding: 6 }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, marginBottom: 3, display: 'block' }}>Reps</label>
          <input type="text" value={ex.reps} placeholder="e.g. 8-12" onChange={e => onUpdate({ reps: e.target.value })} style={{ padding: 6 }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, marginBottom: 3, display: 'block' }}>Weight</label>
          <input type="text" value={ex.weight || ''} placeholder="lbs / kg" onChange={e => onUpdate({ weight: e.target.value })} style={{ padding: 6 }} />
        </div>
      </div>
    </div>
  );
}

function SortableDayRow({ id, day, idx, openDay, setOpenDay, updateDay, updateExercise, addExercise, removeExercise }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const sensors = useDndSensors();
  const isOpen = openDay === idx;
  const exIds = (day.exercises || []).map((_: any, j: number) => `${id}-ex-${j}`);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, marginBottom: 10 }}>
      <div className="card" style={{ padding: 12 }}>
        <div className="between">
          <div className="row" style={{ gap: 8 }}>
            <button {...attributes} {...listeners} style={{ background: 'none', border: 'none', cursor: 'grab', color: 'var(--text)', opacity: 0.4, padding: '4px 2px', touchAction: 'none' }}>
              <GripVertical size={16} />
            </button>
            <span className="mono tiny muted">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.day]}</span>
            <span className="small" style={{ fontWeight: 600 }}>{day.name}</span>
            {day.rest && <span className="pill" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-inset)', color: 'var(--text)', opacity: 0.6 }}>Rest</span>}
          </div>
          <ChevronDown size={16} onClick={() => setOpenDay(isOpen ? null : idx)} style={{ cursor: 'pointer', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        {isOpen && (
          <div style={{ marginTop: 12 }}>
            <label>Day name</label>
            <input type="text" value={day.name} onChange={e => updateDay({ name: e.target.value })} style={{ marginBottom: 10 }} />
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <button className={`tap ${day.rest ? 'active' : ''}`} onClick={() => updateDay({ rest: !day.rest })}>
                {day.rest ? '✓ Rest day' : 'Workout day'}
              </button>
            </div>
            {!day.rest && (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }: DragEndEvent) => {
                  if (!over || active.id === over.id) return;
                  const oldIdx = exIds.indexOf(String(active.id));
                  const newIdx = exIds.indexOf(String(over.id));
                  if (oldIdx !== -1 && newIdx !== -1) updateDay({ exercises: arrayMove(day.exercises, oldIdx, newIdx) });
                }}>
                  <SortableContext items={exIds} strategy={verticalListSortingStrategy}>
                    {(day.exercises || []).map((ex: any, j: number) => (
                      <SortableExercise
                        key={`${id}-ex-${j}`}
                        id={`${id}-ex-${j}`}
                        ex={ex}
                        onUpdate={(patch: any) => updateExercise(j, patch)}
                        onRemove={() => removeExercise(j)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <button className="tap" onClick={addExercise} style={{ width: '100%', marginTop: 4 }}>
                  <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add exercise
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditSplitModal({ workout, onSave, onClose }: any) {
  const [split, setSplit] = useState(() => workout.split.map((d: any, i: number) => ({ ...d, _uid: `day-${i}-${d.day}` })));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const dayIds = split.map((d: any) => d._uid);
  const sensors = useDndSensors();

  const updateDay = (idx: number, patch: any) => setSplit((s: any[]) => s.map((d, i) => i === idx ? { ...d, ...patch } : d));
  const updateExercise = (dayIdx: number, exIdx: number, patch: any) =>
    updateDay(dayIdx, { exercises: split[dayIdx].exercises.map((e: any, i: number) => i === exIdx ? { ...e, ...patch } : e) });
  const addExercise = (dayIdx: number) =>
    updateDay(dayIdx, { exercises: [...(split[dayIdx].exercises || []), { name: 'New exercise', sets: 3, reps: '8-12', weight: '' }] });
  const removeExercise = (dayIdx: number, exIdx: number) =>
    updateDay(dayIdx, { exercises: split[dayIdx].exercises.filter((_: any, i: number) => i !== exIdx) });

  return (
    <ModalShell title="Edit weekly split" onClose={onClose} icon={<Edit3 size={18} color="#3B5C6B" />}>
      <p className="muted small" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
        <GripVertical size={13} /> Drag to reorder days or exercises within a day.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const oldIdx = dayIds.indexOf(String(active.id));
        const newIdx = dayIds.indexOf(String(over.id));
        if (oldIdx !== -1 && newIdx !== -1) {
          setSplit((s: any[]) => arrayMove(s, oldIdx, newIdx));
          setOpenDay(prev => prev === oldIdx ? newIdx : prev === newIdx ? oldIdx : prev);
        }
      }}>
        <SortableContext items={dayIds} strategy={verticalListSortingStrategy}>
          {split.map((day: any, i: number) => (
            <SortableDayRow
              key={day._uid}
              id={day._uid}
              day={day}
              idx={i}
              openDay={openDay}
              setOpenDay={setOpenDay}
              updateDay={(patch: any) => updateDay(i, patch)}
              updateExercise={(exIdx: number, patch: any) => updateExercise(i, exIdx, patch)}
              addExercise={() => addExercise(i)}
              removeExercise={(exIdx: number) => removeExercise(i, exIdx)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={async () => {
        const cleanSplit = split.map(({ _uid, ...d }: any) => d);
        await onSave({ ...workout, split: cleanSplit });
        onClose();
      }}>
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
  const scaled = (m: any, q: number) => {
    const out: any = {
      protein: Math.round((m.protein || 0) * q),
      carbs: Math.round((m.carbs || 0) * q),
      fat: Math.round((m.fat || 0) * q),
      calories: Math.round((m.calories || 0) * q),
    };
    // Preserve all micros, keeping one decimal place for small values.
    for (const k of MICRO_KEYS) {
      const v = (Number(m[k]) || 0) * q;
      out[k] = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
    }
    return out;
  };

  const logItem = async (item: any, q = 1) => {
    const s = scaled(item, q);
    const name = q !== 1 ? `${item.name} ×${q}` : item.name;
    await onSave(addMealEntry(meals, today, { name, source: item.source || '', qty: q, ...s }));
    onClose();
  };

  // Build a preset/entry from a raw food item, preserving all micros.
  const pickFood = (item: any) => {
    const base: any = {
      name: item.name || '',
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
      calories: Number(item.calories) || 0,
      source: item.source || '',
    };
    for (const k of MICRO_KEYS) base[k] = Number(item[k]) || 0;
    return base;
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
      {(() => {
        const s = scaled(review, qty);
        const microHits = MICRO_DEFS.filter(d => (s[d.key] || 0) > 0);
        return (
          <>
            <div className="mono tiny muted" style={{ marginBottom: microHits.length ? 6 : 10 }}>
              {`${s.protein}p · ${s.carbs}c · ${s.fat}f · ${s.calories}cal`}
            </div>
            {microHits.length > 0 && (
              <div style={{ marginBottom: 10, paddingTop: 6, borderTop: '1px solid #C8D9C0' }}>
                <div className="mono tiny muted" style={{ marginBottom: 4 }}>MICROS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                  {microHits.map(d => {
                    const v: number = (s as any)[d.key];
                    const fmt = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
                    return (
                      <span key={d.key} className="mono tiny" style={{ color: d.limit ? '#B8460E' : '#4A6741' }}>
                        {d.label.replace('Vitamin ', 'Vit ')}: {fmt}{d.unit}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      })()}
      <button className="btn" style={{ width: '100%', marginBottom: 6 }} onClick={() => logItem(review, qty)}>
        <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Log to today
      </button>
      <button className="tap" style={{ width: '100%' }} onClick={async () => { await onSave({ ...meals, presets: [...meals.presets, { id: 'p' + Date.now(), ...pickFood(review) }] }); setReview(null); setMode('preset'); }}>
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

const AUTH_API = (() => {
  const base = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.BASE_URL : '/') || '/';
  return base.replace(/\/$/, '') + '/api';
})();

function AccountModal({ onClose }: { onClose: () => void }) {
  const [loggedInAs] = useState(() => getStoredUsername());
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => { setUsername(''); setPassword(''); setConfirmPw(''); setErr(''); };

  const handleSignIn = async () => {
    setErr('');
    if (!username.trim() || !password) { setErr('Enter your username and password.'); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${AUTH_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await resp.json();
      if (!resp.ok) { setErr(data.error || 'Sign-in failed.'); setLoading(false); return; }
      clearLocalSyncData();
      setSyncId(data.userId);
      setStoredUsername(data.username);
      toast.success(`Signed in as ${data.username} — syncing…`);
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setErr('Network error — check your connection.');
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setErr('');
    if (!username.trim()) { setErr('Choose a username.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (password !== confirmPw) { setErr('Passwords don\'t match.'); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${AUTH_API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await resp.json();
      if (!resp.ok) { setErr(data.error || 'Registration failed.'); setLoading(false); return; }
      setSyncId(data.userId);
      setStoredUsername(data.username);
      toast.success(`Account created! Uploading your data…`);
      await pushAllLocalData();
      window.location.reload();
    } catch {
      setErr('Network error — check your connection.');
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    if (!window.confirm(`Sign out of "${loggedInAs}"? This device will become anonymous — your local data stays but won't sync to your account.`)) return;
    clearLocalSyncData();
    clearStoredUsername();
    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setSyncId(newId);
    toast('Signed out.');
    setTimeout(() => window.location.reload(), 600);
  };

  if (loggedInAs) {
    return (
      <ModalShell title="Account" onClose={onClose} icon={<Users size={18} color="#8E4585" />}>
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>Signed in as</div>
          <div className="h2" style={{ color: '#8E4585' }}>{loggedInAs}</div>
        </div>
        <p className="small muted" style={{ marginBottom: 18, lineHeight: 1.5 }}>
          Your data syncs automatically across all devices logged into this account.
          Sign in with the same username and password on any device.
        </p>
        <button
          className="tap"
          style={{ width: '100%', color: '#B8460E', borderColor: '#B8460E', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={handleSignOut}
        >
          <X size={14} /> Sign out of this device
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Account & sync" onClose={onClose} icon={<Users size={18} color="#8E4585" />}>
      <p className="small muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Create an account to sync your data across devices. Sign in on any device with the same username and password.
      </p>

      <div className="row" style={{ gap: 6, marginBottom: 18 }}>
        <button className={`tap${tab === 'signin' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => { setTab('signin'); reset(); }}>
          Sign in
        </button>
        <button className={`tap${tab === 'signup' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => { setTab('signup'); reset(); }}>
          Create account
        </button>
      </div>

      <label>Username</label>
      <input
        type="text"
        value={username}
        onChange={(e) => { setUsername(e.target.value); setErr(''); }}
        placeholder="e.g. donjul"
        autoCapitalize="none"
        autoCorrect="off"
        style={{ marginBottom: 10 }}
        onKeyDown={(e) => e.key === 'Enter' && (tab === 'signin' ? handleSignIn() : undefined)}
      />
      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setErr(''); }}
        placeholder={tab === 'signup' ? 'At least 6 characters' : ''}
        style={{ marginBottom: tab === 'signup' ? 10 : 14 }}
        onKeyDown={(e) => e.key === 'Enter' && (tab === 'signin' ? handleSignIn() : undefined)}
      />
      {tab === 'signup' && (
        <>
          <label>Confirm password</label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setErr(''); }}
            placeholder="Repeat password"
            style={{ marginBottom: 14 }}
          />
        </>
      )}

      {err && <p className="tiny" style={{ color: '#B8460E', marginBottom: 10, lineHeight: 1.4 }}>{err}</p>}

      <button className="btn" style={{ width: '100%' }} onClick={tab === 'signin' ? handleSignIn : handleSignUp} disabled={loading}>
        {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in' : 'Create account'}
      </button>

      {tab === 'signup' && (
        <p className="muted tiny" style={{ marginTop: 10, lineHeight: 1.5 }}>
          Your current data will be linked to this new account and synced going forward.
        </p>
      )}
      {tab === 'signin' && (
        <p className="muted tiny" style={{ marginTop: 10, lineHeight: 1.5 }}>
          Signing in pulls your account's data to this device, replacing any local data.
        </p>
      )}
    </ModalShell>
  );
}

function SettingsModal({ settings, body, onSave, onClose, onEditSubject, onAddSubject, onChallenge, onCustomChallenges, onExportImport, onResetDay, onSyncTransfer }: any) {
  const [draft, setDraft] = useState(settings);
  const [subTab, setSubTab] = useState<'active' | 'archived' | 'deleted'>('active');
  const latestBody = body?.entries?.[body.entries.length - 1];
  const suggested = suggestMacros(latestBody, draft.bodyGoals);
  const suggestedMicros = suggestMicros(latestBody, draft.bodyGoals);
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

  const subjectSensors = useDndSensors();
  const allKeys: string[] = draft.subjectOrder.filter((k: string) => draft.subjects[k]);
  const activeKeys = allKeys.filter((k) => !draft.subjects[k].archived && !draft.subjects[k].deletedAt);
  const archivedKeys = allKeys.filter((k) => draft.subjects[k].archived && !draft.subjects[k].deletedAt);
  const deletedKeys = allKeys.filter((k) => draft.subjects[k].deletedAt);
  const shownKeys = subTab === 'active' ? activeKeys : subTab === 'archived' ? archivedKeys : deletedKeys;
  const handleSubjectDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIdx = activeKeys.indexOf(String(active.id));
    const newIdx = activeKeys.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(activeKeys, oldIdx, newIdx);
    const fullOrder = [...reordered, ...draft.subjectOrder.filter((x: string) => !activeKeys.includes(x))];
    const nd = { ...draft, subjectOrder: fullOrder };
    setDraft(nd); onSave(nd);
  };

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
      {subTab === 'active' ? (
        <DndContext sensors={subjectSensors} collisionDetection={closestCenter} onDragEnd={handleSubjectDragEnd}>
          <SortableContext items={activeKeys} strategy={verticalListSortingStrategy}>
            {activeKeys.map((k: string) => {
              const s = draft.subjects[k];
              const Icon = ICON_MAP[s.icon] || Languages;
              const kind = subjectGoalKind(s);
              const meta = s.trackingMode === 'checkoff' ? `Check-off · ${s.weeklyDays}x/wk` : `${s.target}min/day · ${s.weeklyDays}x/wk`;
              return (
                <SortableRow key={k} id={k}>
                  <div className="between" style={{ padding: '10px 0', paddingLeft: 22, borderBottom: '1px solid #E4DCC8' }}>
                    <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                      <div className="icon-wrap" style={{ background: s.accent, width: 28, height: 28 }}><Icon size={14} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="small" style={{ fontWeight: 600 }}>{s.name}</div>
                        <div className="mono tiny muted">{meta}{kind === 'deadline' ? ` · ${fmtShortDate(s.deadline)}` : kind === 'count' ? ` · ${s.countTotal} sessions` : ''}</div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <button onClick={() => onEditSubject(k)} className="tap" style={{ padding: '4px 8px' }} title="Edit"><Edit3 size={13} /></button>
                      <button onClick={() => applySubjectChange(k, { archived: true })} className="tap" style={{ padding: '4px 8px' }} title="Archive"><Archive size={13} /></button>
                    </div>
                  </div>
                </SortableRow>
              );
            })}
          </SortableContext>
        </DndContext>
      ) : shownKeys.map((k: string) => {
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
                <div className="small" style={{ fontWeight: 600, opacity: 0.6 }}>{s.name}</div>
                <div className="mono tiny muted">{meta}{kind === 'deadline' ? ` · ${fmtShortDate(s.deadline)}` : kind === 'count' ? ` · ${s.countTotal} sessions` : ''}{s.deletedAt ? ` · deletes in ${daysLeft}d` : ''}</div>
              </div>
            </div>
            <div className="row" style={{ gap: 4 }}>
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
        <button
          className="tap"
          style={{ width: '100%', marginBottom: 16, fontSize: 12, color: '#8E4585', borderColor: '#8E4585' }}
          onClick={() => update({ macroTargets: suggested, ...(suggestedMicros ? { microTargets: suggestedMicros } : {}) })}
        >
          <Zap size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Auto from body + goal — sets macros &amp; micros ({suggested.protein}p · {suggested.carbs}c · {suggested.fat}f · {suggested.calories}cal)
        </button>
      ) : (
        <p className="muted tiny" style={{ marginBottom: 16, lineHeight: 1.4 }}>Add a body weight entry to auto-calculate macro + micro targets from your goal.</p>
      )}

      <div className="between" style={{ marginBottom: 8, marginTop: 8 }}>
        <div className="h2">Micros (vitamins &amp; minerals)</div>
        <button
          className="tap"
          style={{ padding: '4px 10px', fontSize: 11 }}
          onClick={() => update({ microsEnabled: draft.microsEnabled === false })}
        >
          {draft.microsEnabled === false ? 'Off' : 'On'}
        </button>
      </div>
      {draft.microsEnabled !== false && (
        <>
          <p className="muted tiny" style={{ marginBottom: 10, lineHeight: 1.4 }}>
            Targets follow general adult guidance. Adjust freely. Limits (sodium, sugar, etc.) are upper caps.
          </p>
          {MICRO_DEFS.map((d) => {
            const t = { ...DEFAULT_MICRO_TARGETS, ...(draft.microTargets || {}) };
            return (
              <div key={d.key} className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span className="small" style={{ flex: 1 }}>
                  {d.label}{d.limit && <span className="muted tiny" style={{ marginLeft: 6 }}>(limit)</span>}
                </span>
                <input
                  type="number"
                  step="any"
                  value={t[d.key] ?? d.defaultTarget}
                  onChange={(e) =>
                    update({
                      microTargets: {
                        ...t,
                        [d.key]: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  style={{ width: 90 }}
                />
                <span className="mono tiny muted" style={{ width: 28 }}>{d.unit}</span>
              </div>
            );
          })}
          <button
            className="tap"
            style={{ width: '100%', marginTop: 8, marginBottom: 16, fontSize: 12 }}
            onClick={() => update({ microTargets: { ...DEFAULT_MICRO_TARGETS } })}
          >
            <RotateCcw size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Reset micro targets to defaults
          </button>
        </>
      )}

      <div className="h2" style={{ marginBottom: 8, marginTop: 16 }}>Preferences</div>

      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label>Time format</label>
          <select value={draft.timeFormat || '12h'} onChange={(e) => update({ timeFormat: e.target.value })} style={{ width: '100%' }}>
            <option value="12h">12-hour (AM/PM)</option>
            <option value="24h">24-hour</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Week starts on</label>
          <select value={draft.weekStart || 'sun'} onChange={(e) => update({ weekStart: e.target.value })} style={{ width: '100%' }}>
            <option value="sun">Sunday</option>
            <option value="mon">Monday</option>
          </select>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label>Weight unit</label>
          <select value={draft.weightUnit || 'lb'} onChange={(e) => update({ weightUnit: e.target.value })} style={{ width: '100%' }}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Length unit</label>
          <select value={draft.lengthUnit || 'in'} onChange={(e) => update({ lengthUnit: e.target.value })} style={{ width: '100%' }}>
            <option value="in">Inches (in)</option>
            <option value="cm">Centimetres (cm)</option>
          </select>
        </div>
      </div>

      <div className="between" style={{ padding: '8px 0', borderBottom: '1px solid #E4DCC8' }}>
        <span className="small">Reminders / notifications</span>
        <button
          className="tap"
          style={{ padding: '4px 12px', fontSize: 12, color: draft.reminders ? '#4A6741' : '#6B6457' }}
          onClick={() => update({ reminders: !draft.reminders })}
        >
          {draft.reminders ? 'On' : 'Off'}
        </button>
      </div>

      <div className="between" style={{ padding: '8px 0', marginBottom: 8, borderBottom: '1px solid #E4DCC8' }}>
        <span className="small">Appearance</span>
        <div className="row" style={{ gap: 6 }}>
          <button
            className={`tap${draft.theme !== 'dark' ? ' active' : ''}`}
            style={{ padding: '4px 12px', fontSize: 12 }}
            onClick={() => update({ theme: 'light' })}
          >☀️ Light</button>
          <button
            className={`tap${draft.theme === 'dark' ? ' active' : ''}`}
            style={{ padding: '4px 12px', fontSize: 12 }}
            onClick={() => update({ theme: 'dark' })}
          >🌙 Dark</button>
        </div>
      </div>

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => { onSave(draft); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save settings
      </button>

      <button className="tap" onClick={onChallenge} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={14} color="#8E4585" />
        <span style={{ flex: 1 }}>60-day workout challenge{settings.challenge?.active && <span className="mono tiny muted" style={{ marginLeft: 6 }}>· active</span>}</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
      <button className="tap" onClick={onCustomChallenges} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Trophy size={14} color="#C8932E" />
        <span style={{ flex: 1 }}>Custom subject challenges</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
      <button className="tap" onClick={onExportImport} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Download size={14} color="#3B5C6B" />
        <span style={{ flex: 1 }}>Backup / restore data</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
      <button className="tap" onClick={onSyncTransfer} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={14} color="#8E4585" />
        <span style={{ flex: 1 }}>{getStoredUsername() ? `Account: ${getStoredUsername()}` : 'Account & sync'}</span>
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
            <>
              <input type="date" value={draft.deadline || addMonth(todayStr(), 3)} onChange={(e) => set({ deadline: e.target.value })} style={{ marginBottom: 10 }} />
              {draft.trackingMode === 'time' && (
                <>
                  <label>Total course hours <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>(optional — overrides deadline math for progress bar)</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={draft.courseHours ?? ''}
                    onChange={(e) => set({ courseHours: e.target.value === '' ? null : parseFloat(e.target.value) || null })}
                    placeholder="e.g. 36"
                    style={{ marginBottom: 8 }}
                  />
                  {draft.courseHours > 0 && (
                    <p className="muted tiny" style={{ marginBottom: 8, lineHeight: 1.5 }}>
                      Progress bar tracks {draft.courseHours}h ({Math.round(draft.courseHours * 60)}min) of actual content, not estimated study time.
                    </p>
                  )}
                </>
              )}
            </>
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

function Checkbox({ checked, onChange, accent = '#B8460E' }: { checked: boolean; onChange: () => void; accent?: string }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked ? accent : '#D4CCB8'}`,
        background: checked ? accent : 'transparent', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {checked && <Check size={13} color="#F5F0E6" />}
    </div>
  );
}

function ResetDayModal({ onReset, onFullReset, onClose }: any) {
  const [view, setView] = useState<'today' | 'full'>('today');

  // ── Today's reset ──
  const ALL_DAY = { subjects: true, macros: true, body: true, workout: true, spending: true, status: true };
  const NONE_DAY = { subjects: false, macros: false, body: false, workout: false, spending: false, status: false };
  const [opts, setOpts] = useState({ subjects: true, macros: true, body: false, workout: false, status: false, spending: false });
  const [confirmDay, setConfirmDay] = useState(false);
  const toggleDay = (k: keyof typeof opts) => setOpts(p => ({ ...p, [k]: !p[k] }));
  const dayRows: { key: keyof typeof opts; label: string; desc: string }[] = [
    { key: 'subjects',  label: 'Study / subject time',        desc: "Clears today's logged minutes and removes them from your totals." },
    { key: 'macros',    label: 'Macros / nutrition',           desc: "Resets today's food log and meal entries to zero." },
    { key: 'body',      label: "Today's body measurement",    desc: "Removes any weight or measurement entry logged today." },
    { key: 'workout',   label: "Today's workout log",          desc: 'Deletes the workout you logged today.' },
    { key: 'spending',  label: "Today's transactions",         desc: "Removes all money entries logged for today." },
    { key: 'status',    label: 'Status (busy / wake / start)', desc: 'Resets back to a fresh morning.' },
  ];
  const anyDay = Object.values(opts).some(Boolean);
  const allDay = Object.values(opts).every(Boolean);

  // ── Full (all-time) reset ──
  const [full, setFull] = useState({ study: false, nutrition: false, body: false, workout: false, spending: false, journal: false, plans: false, settings: false });
  const [confirmFull, setConfirmFull] = useState(false);
  const toggleFull = (k: keyof typeof full) => setFull(p => ({ ...p, [k]: !p[k] }));
  const fullRows: { key: keyof typeof full; label: string; desc: string; accent: string }[] = [
    { key: 'study',     label: 'Study history & totals',    desc: 'All logged time, streaks, check-ins — gone.', accent: '#3B5C6B' },
    { key: 'nutrition', label: 'Nutrition / meal log',      desc: 'Every food entry and preset removed.', accent: '#4A6741' },
    { key: 'body',      label: 'Body measurements',         desc: 'All weight, body-fat, and measurement entries.', accent: '#8E4585' },
    { key: 'workout',   label: 'Workout logs',              desc: 'All workout sessions across every day.', accent: '#B8460E' },
    { key: 'spending',  label: 'Money / spending',          desc: 'All transactions, budget, and savings goals.', accent: '#C8932E' },
    { key: 'journal',   label: 'Journal entries',           desc: 'All notes and trade logs.', accent: '#6E5C8E' },
    { key: 'plans',     label: 'Scheduled plans',           desc: 'All day-level plan entries.', accent: '#5C6E8E' },
    { key: 'settings',  label: 'Settings & subjects',       desc: 'Subjects, macro targets, micro targets — reverts to defaults.', accent: '#6B6457' },
  ];
  const anyFull = Object.values(full).some(Boolean);

  return (
    <ModalShell title="Reset" onClose={onClose} icon={<RotateCcw size={18} color="#B8460E" />}>
      {/* Tab switcher */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button
          className="tap"
          onClick={() => { setView('today'); setConfirmDay(false); setConfirmFull(false); }}
          style={{ flex: 1, background: view === 'today' ? '#B8460E22' : 'transparent', borderColor: view === 'today' ? '#B8460E' : '#E4DCC8' }}
        >
          Reset today
        </button>
        <button
          className="tap"
          onClick={() => { setView('full'); setConfirmDay(false); setConfirmFull(false); }}
          style={{ flex: 1, background: view === 'full' ? '#1A1A2E22' : 'transparent', borderColor: view === 'full' ? '#1A1A2E' : '#E4DCC8' }}
        >
          Full reset
        </button>
      </div>

      {view === 'today' && (
        <>
          <p className="muted small" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Clears selected data for <strong>today only</strong>. Past days untouched. You can Undo right after.
          </p>
          {/* Select all / none */}
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <button
              className="tap"
              style={{ flex: 1, fontSize: 11, background: allDay ? '#B8460E22' : 'transparent', borderColor: allDay ? '#B8460E' : '#E4DCC8' }}
              onClick={() => { setOpts(ALL_DAY); setConfirmDay(false); }}
            >
              Select all
            </button>
            <button
              className="tap"
              style={{ flex: 1, fontSize: 11 }}
              onClick={() => { setOpts(NONE_DAY); setConfirmDay(false); }}
            >
              Clear all
            </button>
          </div>
          {dayRows.map((r) => (
            <div
              key={r.key}
              className="between"
              style={{ padding: '10px 0', borderBottom: '1px solid #E4DCC8', cursor: 'pointer' }}
              onClick={() => toggleDay(r.key)}
            >
              <div style={{ flex: 1, paddingRight: 10 }}>
                <div className="small" style={{ fontWeight: 600 }}>{r.label}</div>
                <div className="muted tiny" style={{ lineHeight: 1.4 }}>{r.desc}</div>
              </div>
              <Checkbox checked={opts[r.key]} onChange={() => toggleDay(r.key)} />
            </div>
          ))}
          {!confirmDay ? (
            <button
              className="btn"
              style={{ width: '100%', marginTop: 14, background: '#B8460E' }}
              disabled={!anyDay}
              onClick={() => setConfirmDay(true)}
            >
              <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Reset selected
            </button>
          ) : (
            <>
              <p className="small" style={{ margin: '14px 0 8px', color: '#B8460E', fontWeight: 600 }}>Reset these items for today?</p>
              <button className="btn" style={{ width: '100%', background: '#B8460E' }} onClick={async () => { await onReset(opts); onClose(); }}>
                Yes, reset today
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setConfirmDay(false)}>Cancel</button>
            </>
          )}
        </>
      )}

      {view === 'full' && (
        <>
          <div
            className="row"
            style={{ gap: 8, background: '#FDF1EC', border: '1px solid #F4C5AD', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}
          >
            <AlertTriangle size={14} color="#B8460E" style={{ flexShrink: 0, marginTop: 1 }} />
            <p className="small" style={{ color: '#8A3010', lineHeight: 1.45 }}>
              <strong>Permanent deletion.</strong> This erases all-time data for the categories you pick. There is no undo — export a backup first if you need it.
            </p>
          </div>
          {fullRows.map((r) => (
            <div
              key={r.key}
              className="between"
              style={{ padding: '10px 0', borderBottom: '1px solid #E4DCC8', cursor: 'pointer' }}
              onClick={() => toggleFull(r.key)}
            >
              <div style={{ flex: 1, paddingRight: 10 }}>
                <div className="small" style={{ fontWeight: 600 }}>
                  <span className="swatch" style={{ background: r.accent }} />
                  {r.label}
                </div>
                <div className="muted tiny" style={{ lineHeight: 1.4 }}>{r.desc}</div>
              </div>
              <Checkbox checked={full[r.key]} onChange={() => toggleFull(r.key)} accent={r.accent} />
            </div>
          ))}

          {/* Select all / none */}
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="tap" style={{ flex: 1, fontSize: 11 }} onClick={() => setFull({ study: true, nutrition: true, body: true, workout: true, spending: true, journal: true, plans: true, settings: true })}>
              Select all
            </button>
            <button className="tap" style={{ flex: 1, fontSize: 11 }} onClick={() => setFull({ study: false, nutrition: false, body: false, workout: false, spending: false, journal: false, plans: false, settings: false })}>
              Clear all
            </button>
          </div>

          {!confirmFull ? (
            <button
              className="btn"
              style={{ width: '100%', marginTop: 14, background: '#1A1A2E' }}
              disabled={!anyFull}
              onClick={() => setConfirmFull(true)}
            >
              <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Delete selected data
            </button>
          ) : (
            <>
              <p className="small" style={{ margin: '14px 0 8px', color: '#B8460E', fontWeight: 600, lineHeight: 1.4 }}>
                This will permanently delete the selected data. Are you absolutely sure?
              </p>
              <button
                className="btn"
                style={{ width: '100%', background: '#B8460E' }}
                onClick={async () => { await onFullReset(full); onClose(); }}
              >
                Yes, permanently delete
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setConfirmFull(false)}>Cancel</button>
            </>
          )}
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

      <p className="muted tiny" style={{ marginBottom: 12, lineHeight: 1.5, color: '#B8460E' }}>
        Heads up: your data lives only in this browser. Export it somewhere safe, or it can be lost if you clear the browser or switch devices.
      </p>

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
  const [showRecover, setShowRecover] = useState(false);
  const [recoverId, setRecoverId] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState('');

  const handleRecover = async () => {
    const id = recoverId.trim();
    if (!id) { setRecoverError('Paste your sync ID above.'); return; }
    setRecoverLoading(true);
    setRecoverError('');
    try {
      clearLocalSyncData();
      setSyncId(id);
      const { hydrate } = await import('./sync');
      await hydrate();
      window.location.reload();
    } catch {
      setRecoverError('Could not load data for that ID. Double-check and try again.');
      setRecoverLoading(false);
    }
  };
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
            {!showImport && !showRecover && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowRecover(true)} style={{ flex: 1 }}>
                  <RotateCcw size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Recover by ID
                </button>
                <button className="btn btn-ghost" onClick={() => setShowImport(true)} style={{ flex: 1 }}>
                  <Upload size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Restore backup
                </button>
              </div>
            )}

            {showRecover && (
              <div className="card" style={{ borderLeft: '3px solid #8E4585' }}>
                <div className="between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <RotateCcw size={16} color="#8E4585" />
                    <span className="h3">Recover account</span>
                  </div>
                  <button onClick={() => { setShowRecover(false); setRecoverId(''); setRecoverError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}>
                    <X size={18} />
                  </button>
                </div>
                <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                  Enter your sync ID to pull your data back. Find it in Settings → Sync / Transfer on any device where you're logged in.
                </p>
                <input
                  type="text"
                  value={recoverId}
                  onChange={(e) => { setRecoverId(e.target.value); setRecoverError(''); }}
                  placeholder="e.g. feff64e9-f366-46a2-aceb-..."
                  style={{ fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 10 }}
                />
                {recoverError && (
                  <div className="small" style={{ color: '#B8460E', marginBottom: 10, padding: 8, background: '#F5E1D5', borderRadius: 6 }}>
                    {recoverError}
                  </div>
                )}
                <button className="btn btn-accent" onClick={handleRecover} disabled={!recoverId.trim() || recoverLoading} style={{ width: '100%' }}>
                  {recoverLoading ? 'Loading…' : 'Recover & reload'}
                </button>
              </div>
            )}

            {showImport && (
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
// MONEY — INCOME PLANNER MODAL
// ════════════════════════════════════════════════════════════════════════════════
function IncomePlannerModal({ spending, onSave, onClose }: any) {
  const inc = spending.income || {};
  const [w2Monthly, setW2Monthly] = useState(String(inc.w2Monthly || ''));
  const [w2YTD, setW2YTD] = useState(String(inc.w2YTD || ''));
  const [w2Employer, setW2Employer] = useState(inc.w2Employer || '');
  const [expectedTrading, setExpectedTrading] = useState(String(inc.expectedTrading || ''));

  const save = () => {
    onSave({ ...spending, income: { w2Monthly: parseFloat(w2Monthly) || 0, w2YTD: parseFloat(w2YTD) || 0, w2Employer: w2Employer.trim(), expectedTrading: parseFloat(expectedTrading) || 0 } });
    onClose();
  };
  const total = (parseFloat(w2Monthly) || 0) + (parseFloat(expectedTrading) || 0);

  return (
    <ModalShell title="Income setup" onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 16 }}>Set your income so Donjul can track YTD totals and project debt payoff.</p>
      <div className="h3" style={{ marginBottom: 8 }}>💼 W-2 / Guaranteed</div>
      <label>Employer</label>
      <input type="text" value={w2Employer} onChange={(e) => setW2Employer(e.target.value)} placeholder="Your employer" style={{ marginBottom: 12 }} />
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Monthly net (after tax)</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}><span className="mono muted">$</span><input type="number" step="0.01" value={w2Monthly} onChange={(e) => setW2Monthly(e.target.value)} placeholder="0.00" style={{ flex: 1 }} /></div>
        </div>
        <div style={{ flex: 1 }}>
          <label>W-2 gross YTD (from paystub)</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}><span className="mono muted">$</span><input type="number" step="0.01" value={w2YTD} onChange={(e) => setW2YTD(e.target.value)} placeholder="e.g. 34120.40" style={{ flex: 1 }} /></div>
        </div>
      </div>
      <div className="h3" style={{ marginBottom: 8 }}>📈 1099 / Trading</div>
      <label>Average monthly trading profit (pre-tax)</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span className="mono muted">$</span>
        <input type="number" step="0.01" value={expectedTrading} onChange={(e) => setExpectedTrading(e.target.value)} placeholder="0.00 (avg)" style={{ flex: 1 }} />
      </div>
      <div className="tiny muted" style={{ marginBottom: 16 }}>Add exact 1099 payouts in the Tax Tracker — they'll auto-appear in your YTD summary.</div>
      {total > 0 && (
        <div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F33', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div className="tiny muted">Expected monthly</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(total)}/mo</div>
          {(parseFloat(w2Monthly)||0) > 0 && (parseFloat(expectedTrading)||0) > 0 && <div className="tiny muted">{fmtMoney(parseFloat(w2Monthly)||0)} W2 + {fmtMoney(parseFloat(expectedTrading)||0)} trading</div>}
        </div>
      )}
      <button className="btn" style={{ width: '100%' }} onClick={save}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — TAX TRACKER MODAL (1099 / California / Federal)
// ════════════════════════════════════════════════════════════════════════════════
function TaxModal({ tax, spending, onSave, onClose }: any) {
  const [view, setView] = useState<'estimate'|'income'|'deductions'|'payments'>('estimate');
  const [draft, setDraft] = useState<any>(() => {
    const t = migrateTax(tax);
    return t;
  });

  // Which year the user is viewing
  const availableYears = Object.keys(draft.years || {}).map(Number).sort((a, b) => b - a);
  const [viewYear, setViewYear] = useState<number>(draft.activeYear || CURRENT_TAX_YEAR);
  const isCurrentYear = viewYear === CURRENT_TAX_YEAR;

  // Year data shortcut + updater
  const yd: any = draft.years?.[viewYear] || makeYearData();
  const updateYD = (patch: Partial<ReturnType<typeof makeYearData>>) => {
    setDraft((d: any) => ({ ...d, years: { ...d.years, [viewYear]: { ...yd, ...patch } } }));
  };

  // Auto-sync W2 YTD from Income Planner
  const spendingW2YTD = Number((spending?.income || {}).w2YTD) || 0;
  const spendingW2Employer = (spending?.income || {}).w2Employer || '';
  const w2YTDForCalc = yd.w2YTDActual > 0 ? yd.w2YTDActual : spendingW2YTD;

  const est = calcTaxEstimate(yd, viewYear, w2YTDForCalc);

  // 1099 entry form
  const [newPayerId, setNewPayerId] = useState('tpt');
  const [newCustomPayer, setNewCustomPayer] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newDate, setNewDate] = useState(todayStr());
  const [newNote, setNewNote] = useState('');

  // Quarterly payment form
  const [newPayment, setNewPayment] = useState({ quarter: 'Q1', amount: '', datePaid: todayStr() });

  const quarters = (yr: number) => [
    { q: 'Q1', due: `Apr 15, ${yr}` },
    { q: 'Q2', due: `Jun 15, ${yr}` },
    { q: 'Q3', due: `Sep 15, ${yr}` },
    { q: 'Q4', due: `Jan 15, ${yr + 1}` },
  ];

  const addEntry = () => {
    const amt = parseFloat(newAmt);
    if (!amt || amt <= 0) { toast.error('Enter an amount'); return; }
    const preset = PAYER_PRESETS.find(p => p.id === newPayerId);
    const payerName = newPayerId === 'other_1099' || newPayerId === 'other_w2'
      ? (newCustomPayer.trim() || 'Other')
      : (preset?.label.split(' (')[0] || newCustomPayer.trim() || 'Unknown');
    const e = {
      id: `t1099_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      payerId: newPayerId, payer: payerName, incomeType: preset?.type || '1099',
      amount: Math.round(amt * 100) / 100, date: newDate, description: newNote.trim(),
    };
    updateYD({ entries1099: [...(yd.entries1099 || []), e] });
    setNewAmt(''); setNewNote(''); setNewDate(todayStr());
    toast('Entry added — tax estimate updated');
  };

  const addPayment = () => {
    const amt = parseFloat(newPayment.amount);
    if (!amt || amt <= 0) { toast.error('Enter an amount'); return; }
    const p = { id: `qp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, quarter: newPayment.quarter, year: String(viewYear), amount: Math.round(amt * 100) / 100, datePaid: newPayment.datePaid };
    updateYD({ payments: [...(yd.payments || []), p] });
    setNewPayment({ quarter: 'Q1', amount: '', datePaid: todayStr() });
    toast('Payment recorded');
  };

  const saveAll = () => { onSave({ ...draft, activeYear: draft.activeYear }); onClose(); };
  const addYear = (yr: number) => {
    if (draft.years?.[yr]) { setViewYear(yr); return; }
    setDraft((d: any) => ({ ...d, years: { ...d.years, [yr]: makeYearData() } }));
    setViewYear(yr);
  };

  const qs = quarters(viewYear);
  const preset = PAYER_PRESETS.find(p => p.id === newPayerId);

  return (
    <ModalShell title={`Tax Tracker`} onClose={onClose}>
      {/* Year selector */}
      <div style={{ background: 'var(--bg-inset)', borderRadius: 10, padding: '8px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {availableYears.map(yr => (
            <button key={yr} onClick={() => setViewYear(yr)} className="tap" style={{ fontSize: 12, padding: '4px 10px', background: viewYear === yr ? '#8E4585' : 'transparent', color: viewYear === yr ? '#F5F0E6' : 'var(--text)', borderColor: viewYear === yr ? '#8E4585' : 'var(--border)' }}>
              {yr}{yr === CURRENT_TAX_YEAR ? ' ★' : ''}
            </button>
          ))}
        </div>
        {!draft.years?.[viewYear - 1] && (
          <button className="tap" onClick={() => addYear(viewYear - 1)} style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            + {viewYear - 1}
          </button>
        )}
      </div>

      {/* View tabs */}
      <div className="row" style={{ gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['estimate','📊 Estimate'],['income','💰 Income'],['deductions','✂️ Deductions'],['payments','💸 Payments']] as [string,string][]).map(([v,label]) => (
          <button key={v} className="tap" onClick={() => setView(v as any)} style={{ fontSize: 11, padding: '5px 10px', background: view === v ? '#8E4585' : 'transparent', color: view === v ? '#F5F0E6' : 'var(--text)', borderColor: view === v ? '#8E4585' : 'var(--border)' }}>{label}</button>
        ))}
      </div>

      {/* ── ESTIMATE ── */}
      {view === 'estimate' && (
        <>
          {est.totalGross === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div className="small muted">Add income entries to see your {viewYear} tax estimate.</div>
              <div className="tiny muted" style={{ marginTop: 6 }}>
                {spendingW2YTD > 0 ? `Income Planner W-2 YTD: ${fmtMoney(spendingW2YTD)} (synced)` : 'Go to Income tab to log your W-2 or 1099 income.'}
              </div>
            </div>
          ) : (
            <>
              {/* Header total */}
              <div style={{ background: '#8E458515', border: '1px solid #8E458530', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div className="h2" style={{ marginBottom: 4 }}>Total estimated {viewYear} tax</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#8E4585' }}>{fmtMoney(est.totalTax)}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Effective rate: {est.effectiveRate.toFixed(1)}% · Total gross: {fmtMoney(est.totalGross)}</div>
              </div>

              {/* Tax breakdown grid */}
              <div className="h2" style={{ marginBottom: 8 }}>Federal</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {([
                  ['Income tax', est.fedIncome, '#3B5C6B'],
                  ['SE — Social Security', est.seSS, '#B8460E'],
                  ['SE — Medicare', est.seMed, '#B8460E'],
                  ['½ SE deduction', -est.halfSE, '#3F7A4F'],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} style={{ background: 'var(--bg-inset2)', borderRadius: 8, padding: '9px 11px' }}>
                    <div className="tiny muted" style={{ marginBottom: 2 }}>{label}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>{val < 0 ? `−${fmtMoney(-val)}` : fmtMoney(val)}</div>
                  </div>
                ))}
              </div>
              <div className="h2" style={{ marginBottom: 8 }}>California</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                {([
                  ['CA Income tax', est.caIncome, '#3B5C6B'],
                  ['CA SDI (1.1%)', est.caSDI, '#6B6457'],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} style={{ background: 'var(--bg-inset2)', borderRadius: 8, padding: '9px 11px' }}>
                    <div className="tiny muted" style={{ marginBottom: 2 }}>{label}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>{fmtMoney(val)}</div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div style={{ background: 'var(--bg-inset)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                {[
                  ['W-2 gross YTD', fmtMoney(est.w2Gross), w2YTDForCalc > 0 && spendingW2YTD > 0 && yd.w2YTDActual === 0 ? ' (synced)' : ''],
                  ['1099 net (after deductions)', fmtMoney(est.netTrading), ''],
                  [`Std. deduction ${viewYear}`, `−${fmtMoney(est.stdDeduct)}`, ''],
                  ['Federal AGI', fmtMoney(est.fedAGI), ''],
                  ['Total withheld/paid', `−${fmtMoney(est.totalWithheld)}`, ''],
                ].map(([l, v, note]) => (
                  <div key={l as string} className="between" style={{ marginBottom: 5 }}>
                    <span className="tiny muted">{l as string}{note ? <span style={{ color: '#3F7A4F', fontSize: 10 }}>{note}</span> : ''}</span>
                    <span className="mono tiny" style={{ color: 'var(--text)' }}>{v as string}</span>
                  </div>
                ))}
                <div className="between" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span className="small" style={{ fontWeight: 600, color: 'var(--text)' }}>Still owed</span>
                  <span className="mono small" style={{ fontWeight: 700, color: est.netOwed > 0 ? '#B8460E' : '#3F7A4F' }}>{est.netOwed > 0 ? fmtMoney(est.netOwed) : '✓ Covered!'}</span>
                </div>
              </div>

              {est.netOwed > 0 && (
                <div style={{ background: '#C8932E15', border: '1px solid #C8932E40', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div className="tiny muted">Recommended quarterly payment</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#C8932E' }}>{fmtMoney(est.quarterly)}/quarter</div>
                  <div className="tiny muted">= {fmtMoney(est.totalTax / 12)}/mo to set aside</div>
                </div>
              )}
              <div className="tiny muted" style={{ textAlign: 'center' }}>{viewYear} CA + Federal brackets · Single filer · Self-employed 15.3% SE tax</div>
            </>
          )}
          <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
        </>
      )}

      {/* ── INCOME ── */}
      {view === 'income' && (
        <>
          {/* W-2 setup */}
          <div style={{ background: 'var(--bg-inset)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div className="h3" style={{ marginBottom: 10, color: 'var(--text)' }}>💼 W-2 Income</div>
            <label>Employer</label>
            <input type="text" value={yd.w2Employer || ''} onChange={(e) => updateYD({ w2Employer: e.target.value })} placeholder="Vsolvit" style={{ marginBottom: 10 }} />
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label>Annual gross (projected)</label>
                <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="100" value={yd.w2GrossAnnual || ''} onChange={(e) => updateYD({ w2GrossAnnual: parseFloat(e.target.value) || 0 })} placeholder="0" style={{ flex: 1 }} /></div>
              </div>
              <div style={{ flex: 1 }}>
                <label>Actual W-2 gross YTD</label>
                <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={yd.w2YTDActual || ''} onChange={(e) => updateYD({ w2YTDActual: parseFloat(e.target.value) || 0 })} placeholder={spendingW2YTD > 0 ? `${spendingW2YTD} (synced)` : '0.00'} style={{ flex: 1 }} /></div>
              </div>
            </div>
            {spendingW2YTD > 0 && yd.w2YTDActual === 0 && (
              <div style={{ background: '#3F7A4F18', border: '1px solid #3F7A4F33', borderRadius: 6, padding: '6px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="tiny" style={{ color: '#3F7A4F' }}>📌 Income Planner YTD: {fmtMoney(spendingW2YTD)}{spendingW2Employer ? ` · ${spendingW2Employer}` : ''}</span>
                <button className="tap" onClick={() => updateYD({ w2YTDActual: spendingW2YTD, w2Employer: spendingW2Employer || yd.w2Employer })} style={{ fontSize: 10, padding: '3px 8px', color: '#3F7A4F', borderColor: '#3F7A4F' }}>Use this</button>
              </div>
            )}
            <div className="h3" style={{ margin: '10px 0 8px', color: 'var(--text)' }}>Withholding (from paystub YTD)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([['Federal income tax', 'w2WithheldFed'],['CA income tax', 'w2WithheldCA'],['Social Security (6.2%)', 'w2WithheldSS'],['Medicare (1.45%)', 'w2WithheldMedicare']] as [string, keyof ReturnType<typeof makeYearData>][]).map(([label, key]) => (
                <div key={key}>
                  <label>{label}</label>
                  <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={(yd[key] as number) || ''} onChange={(e) => updateYD({ [key]: parseFloat(e.target.value) || 0 })} placeholder="0.00" style={{ flex: 1 }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* 1099 add form */}
          <div style={{ background: 'var(--bg-inset)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div className="h3" style={{ marginBottom: 10, color: 'var(--text)' }}>📈 Add 1099 / Prop Firm Payout</div>
            <label>Income source</label>
            <select value={newPayerId} onChange={(e) => setNewPayerId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
              {PAYER_PRESETS.filter(p => p.type === '1099').map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              <optgroup label="W-2">
                {PAYER_PRESETS.filter(p => p.type === 'w2').map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </optgroup>
            </select>
            {(newPayerId === 'other_1099' || newPayerId === 'other_w2') && (
              <input type="text" value={newCustomPayer} onChange={(e) => setNewCustomPayer(e.target.value)} placeholder="Enter payer name" style={{ marginBottom: 8 }} />
            )}
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><label>Amount (gross payout)</label><div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={newAmt} onChange={(e) => setNewAmt(e.target.value)} placeholder="0.00" style={{ flex: 1 }} /></div></div>
              <div style={{ flex: 1 }}><label>Date received</label><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
            </div>
            <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Note (optional)" style={{ marginBottom: 10 }} />
            <button className="btn" style={{ width: '100%' }} onClick={addEntry}><Plus size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Add {preset?.type === 'w2' ? 'W-2' : '1099'} entry</button>
          </div>

          {/* Entries list */}
          <div className="between" style={{ marginBottom: 8 }}>
            <div className="h3" style={{ color: 'var(--text)' }}>YTD {viewYear} entries</div>
            <span className="mono small" style={{ color: '#3F7A4F', fontWeight: 700 }}>{fmtMoney(est.income1099)} total</span>
          </div>
          {(yd.entries1099 || []).length === 0 && <p className="small muted">No entries yet — log each payout by source.</p>}
          {[...(yd.entries1099 || [])].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((e: any) => (
            <div key={e.id} className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="small" style={{ fontWeight: 600, color: 'var(--text)' }}>{e.payer}</div>
                <div className="tiny muted">{fmtShortDate(e.date)} · {e.incomeType === 'w2' ? 'W-2' : '1099'}{e.description ? ` · ${e.description}` : ''}</div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className="mono small" style={{ fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(e.amount)}</span>
                <button className="tap" onClick={() => updateYD({ entries1099: (yd.entries1099 || []).filter((x: any) => x.id !== e.id) })} style={{ padding: '3px 6px', color: '#B8460E' }}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
          <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
        </>
      )}

      {/* ── DEDUCTIONS ── */}
      {view === 'deductions' && (
        <>
          <p className="small muted" style={{ marginBottom: 14 }}>These reduce your 1099 taxable income. Keep receipts for all deductions.</p>
          <div className="h3" style={{ marginBottom: 8, color: 'var(--text)' }}>🏠 Trading & Business Deductions</div>
          <div style={{ marginBottom: 8 }}>
            <label>Platform / data fees (Apex, NinjaTrader, etc.)</label>
            <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={yd.tradingExpenses || ''} onChange={(e) => updateYD({ tradingExpenses: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
          </div>
          {([['homeOffice', 'Home office (% of rent/mortgage)'],['equipment', 'Equipment (computer, monitors, desk)'],['software', 'Software subscriptions'],['internet', 'Internet (business %)'],['other', 'Other deductions']] as [string, string][]).map(([key, label]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <label>{label}</label>
              <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={(yd.deductions?.[key]) || ''} onChange={(e) => updateYD({ deductions: { ...yd.deductions, [key]: parseFloat(e.target.value) || 0 } })} placeholder="0.00" /></div>
            </div>
          ))}
          <div style={{ background: 'var(--bg-inset)', borderRadius: 8, padding: '10px 12px', marginTop: 8, marginBottom: 14 }}>
            <div className="between">
              <span className="small" style={{ color: 'var(--text)' }}>Total deductions</span>
              <span className="mono small" style={{ fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(est.dedTotal)}</span>
            </div>
            <div className="between" style={{ marginTop: 4 }}>
              <span className="tiny muted">1099 net taxable income</span>
              <span className="mono tiny" style={{ color: 'var(--text)' }}>{fmtMoney(est.netTrading)}</span>
            </div>
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save deductions</button>
        </>
      )}

      {/* ── PAYMENTS ── */}
      {view === 'payments' && (
        <>
          <div className="h3" style={{ marginBottom: 8, color: 'var(--text)' }}>Record estimated payment</div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Quarter</label>
              <select value={newPayment.quarter} onChange={(e) => setNewPayment({ ...newPayment, quarter: e.target.value })} style={{ width: '100%' }}>
                {qs.map((q) => <option key={q.q} value={q.q}>{q.q} {viewYear} (due {q.due})</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Amount</label>
              <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} placeholder="0.00" style={{ flex: 1 }} /></div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}><label>Date paid</label><input type="date" value={newPayment.datePaid} onChange={(e) => setNewPayment({ ...newPayment, datePaid: e.target.value })} /></div>
          <button className="btn" style={{ width: '100%', marginBottom: 16 }} onClick={addPayment}><Plus size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Record payment</button>

          <div className="h3" style={{ marginBottom: 8, color: 'var(--text)' }}>{viewYear} payment schedule</div>
          {qs.map((q) => {
            const paid = (yd.payments || []).filter((p: any) => p.quarter === q.q);
            const total = paid.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            return (
              <div key={q.q} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="between">
                  <div>
                    <div className="small" style={{ fontWeight: 600, color: 'var(--text)' }}>{q.q} {viewYear}</div>
                    <div className="tiny muted">Due {q.due}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>{total > 0 ? <span className="mono small" style={{ color: '#3F7A4F', fontWeight: 700 }}>✓ {fmtMoney(total)}</span> : <span className="tiny muted">—</span>}</div>
                </div>
                {paid.map((p: any) => (
                  <div key={p.id} className="between" style={{ paddingLeft: 12, marginTop: 4 }}>
                    <span className="tiny muted">{fmtShortDate(p.datePaid)}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono tiny" style={{ color: 'var(--text)' }}>{fmtMoney(p.amount)}</span>
                      <button className="tap" onClick={() => updateYD({ payments: (yd.payments || []).filter((x: any) => x.id !== p.id) })} style={{ padding: '2px 5px', color: '#B8460E' }}><Trash2 size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="between" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span className="small muted">Total paid {viewYear}</span>
            <span className="mono small" style={{ fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney((yd.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</span>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
        </>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// DAILY HABITS — CUSTOM CHALLENGES MODAL
// ════════════════════════════════════════════════════════════════════════════════
function CustomChallengesModal({ challenges, settings, onSave, onClose }: any) {
  const [view, setView] = useState<'list'|'add'>('list');
  const [form, setForm] = useState({ name: '', subjectKey: '', days: '60' });
  const today = todayStr();

  const subjects = (settings.subjectOrder || [])
    .filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived && !settings.subjects[k].deletedAt)
    .map((k: string) => ({ key: k, ...settings.subjects[k] }));

  const createChallenge = () => {
    if (!form.name.trim()) { toast.error('Enter a challenge name'); return; }
    if (!form.subjectKey) { toast.error('Pick a subject to track'); return; }
    const ch = {
      id: `cch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: form.name.trim(),
      subjectKey: form.subjectKey,
      days: parseInt(form.days) || 0,
      startDate: today,
      active: true,
      streak: 0,
      longestStreak: 0,
      lastActionDate: null,
      restDates: [],
    };
    onSave([...challenges, ch]);
    setForm({ name: '', subjectKey: '', days: '60' });
    setView('list');
    toast(`"${ch.name}" started!`);
  };

  const archiveChallenge = (id: string) => {
    onSave(challenges.map((c: any) => c.id === id ? { ...c, active: false, completedDate: today } : c));
    toast('Challenge archived');
  };

  const deleteChallenge = (id: string) => {
    if (confirm('Delete this challenge? This cannot be undone.')) onSave(challenges.filter((c: any) => c.id !== id));
  };

  const activeChallenges = challenges.filter((c: any) => c.active);
  const archived = challenges.filter((c: any) => !c.active);

  return (
    <ModalShell title="Custom challenges" onClose={onClose} icon={<Trophy size={18} color="#C8932E" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className="tap" onClick={() => setView('list')} style={{ flex: 1, background: view === 'list' ? '#1A1A2E' : 'transparent', color: view === 'list' ? '#F5F0E6' : '#1A1A2E' }}>
          Active ({activeChallenges.length})
        </button>
        <button className="tap" onClick={() => setView('add')} style={{ flex: 1, background: view === 'add' ? '#1A1A2E' : 'transparent', color: view === 'add' ? '#F5F0E6' : '#1A1A2E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Plus size={12} /> New challenge
        </button>
      </div>

      {view === 'list' && (
        <>
          {activeChallenges.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
              <p className="small muted">No active challenges. Create one to track a subject streak.</p>
            </div>
          )}
          {activeChallenges.map((ch: any) => {
            const sub = settings.subjects?.[ch.subjectKey];
            const daysDone = ch.startDate ? Math.max(0, diffDays(today, ch.startDate)) : 0;
            const isOpen = !ch.days || ch.days === 0;
            const pct = isOpen ? 0 : Math.min(100, Math.round((daysDone / ch.days) * 100));
            const doneToday = ch.lastActionDate === today;
            const isRest = doneToday && (ch.restDates || []).includes(today);
            const isLogged = doneToday && !isRest;
            return (
              <div key={ch.id} style={{ padding: '12px 0', borderBottom: '1px solid #F0EAD8' }}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <div>
                    <div className="small" style={{ fontWeight: 600 }}>{ch.name}</div>
                    <div className="tiny muted">{sub?.name || ch.subjectKey} · 🔥 {ch.streak} streak · best {ch.longestStreak || 0}</div>
                    <div className="tiny muted">{isOpen ? `Day ${daysDone + 1} (open-ended)` : `Day ${daysDone} of ${ch.days} · ${Math.max(0, ch.days - daysDone)} to go`}</div>
                  </div>
                  {!isOpen && <span className="mono tiny muted">{pct}%</span>}
                </div>
                {!isOpen && (
                  <div style={{ height: 4, background: '#F0EAD8', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#8E4585', borderRadius: 2 }} />
                  </div>
                )}
                {isLogged ? (
                  <div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F40', borderRadius: 8, padding: '6px 12px', textAlign: 'center', marginBottom: 6 }}>
                    <span className="tiny" style={{ color: '#3F7A4F', fontWeight: 600 }}>✓ Counted today — keep logging {sub?.name}</span>
                  </div>
                ) : isRest ? (
                  <div style={{ background: '#F0EAD8', border: '1px solid #D4CCB8', borderRadius: 8, padding: '6px 12px', textAlign: 'center', marginBottom: 6 }}>
                    <span className="tiny" style={{ color: '#6B6457', fontWeight: 600 }}>😴 Rest day — streak protected</span>
                  </div>
                ) : (
                  <div className="tiny muted" style={{ fontStyle: 'italic', marginBottom: 6 }}>
                    Pending — log {sub?.name || 'subject'} time on Today tab to count this day
                  </div>
                )}
                <div className="row" style={{ gap: 6 }}>
                  <button className="tap" onClick={() => archiveChallenge(ch.id)} style={{ flex: 1, fontSize: 11, padding: '5px' }}>
                    <Trophy size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Complete & archive
                  </button>
                  <button className="tap" onClick={() => deleteChallenge(ch.id)} style={{ padding: '5px 10px', fontSize: 11, color: '#B8460E' }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}

          {archived.length > 0 && (
            <>
              <div className="h3" style={{ marginTop: 16, marginBottom: 8 }}>Completed</div>
              {archived.map((ch: any) => {
                const sub = settings.subjects?.[ch.subjectKey];
                return (
                  <div key={ch.id} className="card" style={{ padding: 10, marginBottom: 8, borderLeft: '3px solid #C8932E' }}>
                    <div className="between">
                      <div>
                        <div className="small" style={{ fontWeight: 600 }}><Award size={11} style={{ verticalAlign: 'middle', marginRight: 4, color: '#C8932E' }} />{ch.name}</div>
                        <div className="tiny muted">{sub?.name || ch.subjectKey} · Best streak: {ch.longestStreak || 0} days</div>
                        {ch.startDate && <div className="tiny muted mono">{fmtShortDate(ch.startDate)} → {fmtShortDate(ch.completedDate || today)}</div>}
                      </div>
                      <button className="tap" onClick={() => deleteChallenge(ch.id)} style={{ padding: '3px 6px', color: '#6B6457' }}><Trash2 size={10} /></button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {view === 'add' && (
        <>
          <p className="small muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
            Pick a subject. Every time you log time (or check it off) on the Today tab, this challenge's streak advances automatically. Press "Rest day" on the Today tab to protect your streak on days you skip.
          </p>

          <label>Challenge name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bible Reading 60 Days, Daily Prayer…" style={{ marginBottom: 14 }} autoFocus />

          <label>Subject to track</label>
          {subjects.length === 0 ? (
            <p className="tiny muted" style={{ marginBottom: 14 }}>No subjects yet — add one in Settings → Subjects first.</p>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {subjects.map((s: any) => (
                <button key={s.key} className="tap" onClick={() => setForm({ ...form, subjectKey: s.key })}
                  style={{ fontSize: 12, padding: '6px 12px', background: form.subjectKey === s.key ? (s.accent || '#1A1A2E') : 'transparent', color: form.subjectKey === s.key ? '#F5F0E6' : '#1A1A2E', borderColor: form.subjectKey === s.key ? (s.accent || '#1A1A2E') : '#E4DCC8' }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <label>Duration</label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {['21','30','60','75','90','0'].map((d) => (
              <button key={d} className="tap" onClick={() => setForm({ ...form, days: d })}
                style={{ fontSize: 11, padding: '5px 10px', background: form.days === d ? '#1A1A2E' : 'transparent', color: form.days === d ? '#F5F0E6' : '#1A1A2E' }}>
                {d === '0' ? '∞ Open' : `${d} days`}
              </button>
            ))}
          </div>

          <button className="btn" style={{ width: '100%' }} onClick={createChallenge}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Start challenge
          </button>
        </>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY TAB — manual personal-finance tracker (Rocket Money inspired)
// ════════════════════════════════════════════════════════════════════════════════
function MoneyTab({ spending, tax, onAdd, onEdit, onDelete, onBudget, onCategories, onAddAccount, onEditAccount, onAddDebt, onEditDebt, onAddOwed, onEditOwed, onTransfer, onEditIncome, onTaxModal, onCustomChallenges, onSaveLayout }: any) {
  const today = todayStr();
  const thisMonth = monthKey(today);
  const [viewMonth, setViewMonth] = useState(thisMonth);
  const [txFilter, setTxFilter] = useState('');
  const [reorderOpen, setReorderOpen] = useState(false);
  const sensors = useDndSensors();
  const cur = spendingByMonth(spending.entries, viewMonth);
  const prev = spendingByMonth(spending.entries, prevMonth(viewMonth));
  const catMap = useMemo(() => Object.fromEntries(spending.categories.map((c: any) => [c.id, c])), [spending.categories]);
  const budget = Number(spending.monthlyBudget) || 0;
  const goal = Number(spending.savingsGoal) || 0;
  const spentPct = budget > 0 ? Math.min(100, (cur.spent / budget) * 100) : 0;
  const savedThisMonth = Math.max(0, cur.net);
  const savedPct = goal > 0 ? Math.min(100, (savedThisMonth / goal) * 100) : 0;
  const savingsRate = cur.income > 0 ? Math.max(0, Math.min(100, (cur.net / cur.income) * 100)) : 0;

  const accounts: any[] = spending.accounts || [];
  const debts: any[] = spending.debts || [];
  const owed: any[] = spending.owed || [];
  const hasCreditCards = accounts.some((a: any) => a.type === 'credit');

  const assets = accounts.filter((a: any) => a.type !== 'credit' && a.includeInNetWorth !== false).reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0);
  const creditDebt = accounts.filter((a: any) => a.type === 'credit' && a.includeInNetWorth !== false).reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0);
  const loanDebt = debts.filter((d: any) => d.includeInNetWorth !== false).reduce((s: number, d: any) => s + (Number(d.balance) || 0), 0);
  const totalLiabilities = creditDebt + loanDebt;
  const netWorth = assets - totalLiabilities;
  const totalOwed = owed.filter((o: any) => !o.paid).reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);

  const [filterCatId, setFilterCatId] = useState('');
  const [filterAcctId, setFilterAcctId] = useState('');
  const [filterType, setFilterType] = useState('');

  const recent = useMemo(
    () => [...spending.entries]
      .filter((e: any) => monthKey(e.date) === viewMonth)
      .sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || '').localeCompare(a.id || ''))),
    [spending.entries, viewMonth],
  );

  const recurring = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of spending.entries) {
      if (!e.recurring || e.type !== 'out') continue;
      const k = `${e.name?.toLowerCase().trim()}|${e.categoryId}`;
      const existing = map.get(k);
      if (!existing || e.date > existing.date) map.set(k, e);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [spending.entries]);

  const trend = useMemo(() => {
    const arr: { ym: string; income: number; spent: number; net: number }[] = [];
    let cursor = thisMonth;
    for (let i = 0; i < 6; i++) {
      const m = spendingByMonth(spending.entries, cursor);
      arr.unshift({ ym: cursor, income: m.income, spent: m.spent, net: m.net });
      cursor = prevMonth(cursor);
    }
    return arr;
  }, [spending.entries, thisMonth]);

  const allCats = useMemo(() => {
    return Object.entries(cur.byCat)
      .map(([id, amt]: any) => ({ id, amount: amt as number, cat: catMap[id] }))
      .filter((x) => x.cat)
      .sort((a, b) => b.amount - a.amount);
  }, [cur.byCat, catMap]);

  const catMonthlyAvg = useMemo(() => {
    const avgs: Record<string, number> = {};
    const pastMonths: string[] = [];
    let c = prevMonth(thisMonth);
    for (let i = 0; i < 5; i++) { pastMonths.push(c); c = prevMonth(c); }
    for (const cat of spending.categories) {
      const vals = pastMonths.map(ym => spendingByMonth(spending.entries, ym).byCat[cat.id] || 0).filter(v => v > 0);
      avgs[cat.id] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    }
    return avgs;
  }, [spending.entries, spending.categories, thisMonth]);

  const currentYear = today.slice(0, 4);
  const w2YTD = Number((spending.income || {}).w2YTD) || 0;
  const income1099YTD = useMemo(() => {
    return ((tax?.entries1099 || []) as any[])
      .filter((e: any) => e.date?.startsWith(currentYear))
      .reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  }, [tax, currentYear]);
  const totalYTD = w2YTD + income1099YTD;

  const filteredRecent = useMemo(() => {
    return recent.filter((e: any) => {
      const cat = catMap[e.categoryId];
      if (txFilter.trim()) {
        const q = txFilter.toLowerCase();
        if (!(e.name || '').toLowerCase().includes(q) && !(cat?.name || '').toLowerCase().includes(q)) return false;
      }
      if (filterCatId && e.categoryId !== filterCatId) return false;
      if (filterAcctId && e.accountId !== filterAcctId) return false;
      if (filterType && e.type !== filterType) return false;
      return true;
    });
  }, [recent, txFilter, filterCatId, filterAcctId, filterType, catMap]);

  const sectionOrder = useMemo(() => {
    const saved: string[] = spending.sectionOrder || [];
    return [...saved.filter((x: string) => MONEY_DEFAULT_ORDER.includes(x)), ...MONEY_DEFAULT_ORDER.filter((x) => !saved.includes(x))];
  }, [spending.sectionOrder]);

  const netDelta = cur.net - prev.net;
  const spentDelta = prev.spent > 0 ? ((cur.spent - prev.spent) / prev.spent) * 100 : 0;
  const trendMax = Math.max(1, ...trend.map((t) => Math.max(t.income, t.spent)));
  const empty = spending.entries.length === 0;
  const negativeMonth = cur.net < 0 && !empty;

  const renderMoneySection = (id: string): React.ReactNode => {
    switch (id) {
      case 'ytd':
        if (w2YTD === 0 && income1099YTD === 0) return null;
        return (
          <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid #3F7A4F' }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><DollarSign size={14} color="#3F7A4F" /><span className="h2">YTD Income · {currentYear}</span></div>
              <button className="tap" onClick={onEditIncome} style={{ padding: '4px 10px', fontSize: 11 }}><Pencil size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Edit</button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {w2YTD > 0 && (
                <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="tiny muted" style={{ marginBottom: 2 }}>W-2 Gross YTD</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>{fmtMoney(w2YTD)}</div>
                  {spending.income?.w2Employer && <div className="tiny muted">{spending.income.w2Employer}</div>}
                </div>
              )}
              {income1099YTD > 0 && (
                <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="tiny muted" style={{ marginBottom: 2 }}>1099 YTD</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#3B5C6B' }}>{fmtMoney(income1099YTD)}</div>
                  <div className="tiny muted">prop firm / trading</div>
                </div>
              )}
            </div>
            {w2YTD > 0 && income1099YTD > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E4DCC8', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="small muted">Total combined YTD</span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(totalYTD)}</span>
              </div>
            )}
          </div>
        );

      case 'accounts':
        return (
          <div style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 6 }}><Wallet size={14} color="#1A1A2E" /><span className="h2">Accounts</span></div>
              <button className="tap" onClick={onAddAccount} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={11} /> Add</button>
            </div>
            {accounts.length === 0 ? (
              <button className="tap" onClick={onAddAccount} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left' }}>
                <CreditCard size={14} color="#6B6457" /><span className="small" style={{ flex: 1 }}>Add a bank account or credit card</span><ChevronRight size={14} color="#6B6457" />
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {accounts.map((acc: any) => {
                  const isCredit = acc.type === 'credit';
                  const limit = Number(acc.creditLimit) || 0;
                  const bal = Number(acc.balance) || 0;
                  const utilPct = isCredit && limit > 0 ? Math.min(100, (bal / limit) * 100) : 0;
                  const available = limit - bal;
                  return (
                    <button key={acc.id} onClick={() => onEditAccount(acc)} style={{ flexShrink: 0, width: 172, padding: 16, borderRadius: 14, border: 'none', cursor: 'pointer', textAlign: 'left', background: isCredit ? '#F5F0E6' : (acc.color || '#1A1A2E'), boxShadow: '0 2px 10px rgba(0,0,0,0.13)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isCredit ? '#6B6457' : 'rgba(245,240,230,0.65)' }}>{isCredit ? 'Credit' : acc.type === 'savings' ? 'Savings' : 'Checking'}</span>
                        {isCredit ? <CreditCard size={13} color="#6B6457" /> : <Wallet size={13} color="rgba(245,240,230,0.6)" />}
                      </div>
                      <div style={{ fontSize: 11, color: isCredit ? '#6B6457' : 'rgba(245,240,230,0.7)', marginBottom: 3 }}>{acc.bank || acc.name}</div>
                      {!isCredit && <div style={{ fontSize: 10, color: 'rgba(245,240,230,0.55)', marginBottom: 4 }}>{acc.name}</div>}
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: isCredit ? '#B8460E' : '#F5F0E6', lineHeight: 1.1, marginBottom: isCredit ? 10 : 0 }}>{fmtMoney(bal)}</div>
                      {isCredit && limit > 0 && (<><div style={{ height: 4, background: '#E4DCC8', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}><div style={{ width: `${utilPct}%`, height: '100%', background: utilPct > 80 ? '#B8460E' : utilPct > 50 ? '#C8932E' : '#3F7A4F', borderRadius: 2 }} /></div><div style={{ fontSize: 10, color: '#6B6457' }}>{fmtMoney(available)} avail · {Math.round(utilPct)}%</div>{acc.dueDay && <div style={{ fontSize: 10, color: '#8E4585', marginTop: 3 }}>Due day {acc.dueDay}</div>}</>)}
                      {isCredit && !acc.name.includes(acc.bank || '') && <div style={{ fontSize: 10, color: '#6B6457', marginTop: 4, opacity: 0.75 }}>{acc.name}</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'budget':
        return budget > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 6 }}><PieChart size={14} color="#8E4585" /><span className="h2">Monthly budget</span></div>
              <span className="mono small">{fmtMoney(cur.spent)} / {fmtMoney(budget)}</span>
            </div>
            <div style={{ height: 10, background: '#F5F0E6', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${spentPct}%`, height: '100%', background: spentPct >= 100 ? '#B8460E' : spentPct >= 80 ? '#C8932E' : '#3F7A4F', transition: 'width 0.3s' }} />
            </div>
            <div className="between tiny muted">
              <span>{spentPct >= 100 ? `Over by ${fmtMoney(cur.spent - budget)}` : `${fmtMoney(budget - cur.spent)} left`}</span>
              <span>{Math.round(spentPct)}% used</span>
            </div>
          </div>
        ) : (
          <button className="tap" onClick={onBudget} style={{ width: '100%', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left' }}>
            <Target size={14} color="#8E4585" /><span className="small" style={{ flex: 1 }}>Set a monthly budget to track spending</span><ChevronRight size={14} color="#6B6457" />
          </button>
        );

      case 'savings':
        return goal > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 6 }}><PiggyBank size={14} color="#3F7A4F" /><span className="h2">Savings goal</span></div>
              <span className="mono small">{fmtMoney(savedThisMonth)} / {fmtMoney(goal)}</span>
            </div>
            <div style={{ height: 10, background: '#F5F0E6', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${savedPct}%`, height: '100%', background: '#3F7A4F', transition: 'width 0.3s' }} />
            </div>
            <div className="tiny muted">{savedPct >= 100 ? `Goal hit — ${fmtMoney(savedThisMonth - goal)} over` : `${fmtMoney(goal - savedThisMonth)} to go`}</div>
          </div>
        ) : null;

      case 'trend':
        return empty ? null : (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><TrendingUp size={14} color="#3B5C6B" /><span className="h2">6-month trend</span></div>
              {prev.spent > 0 && <span className="tiny mono" style={{ color: spentDelta > 0 ? '#B8460E' : '#3F7A4F' }}>{spentDelta > 0 ? '+' : ''}{Math.round(spentDelta)}% spend</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 90, marginBottom: 8 }}>
              {trend.map((t) => (
                <div key={t.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 70, width: '100%', justifyContent: 'center' }}>
                    <div title={`Income ${fmtMoney(t.income)}`} style={{ width: '40%', height: `${(t.income / trendMax) * 100}%`, background: '#3F7A4F', borderRadius: '3px 3px 0 0', minHeight: t.income > 0 ? 2 : 0 }} />
                    <div title={`Spent ${fmtMoney(t.spent)}`} style={{ width: '40%', height: `${(t.spent / trendMax) * 100}%`, background: '#B8460E', borderRadius: '3px 3px 0 0', minHeight: t.spent > 0 ? 2 : 0 }} />
                  </div>
                  <div className="tiny muted" style={{ fontSize: 10 }}>{monthShort(t.ym)}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 14, fontSize: 11 }}>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: '#3F7A4F', borderRadius: 2 }} /> <span className="muted">Income</span></span>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: '#B8460E', borderRadius: 2 }} /> <span className="muted">Spent</span></span>
            </div>
          </div>
        );

      case 'daily': {
        if (empty || viewMonth !== thisMonth) return null;
        const days30: { label: string; spent: number; date: string }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today + 'T00:00:00');
          d.setDate(d.getDate() - i);
          const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          days30.push({ label: i === 0 ? 'today' : `${d.getMonth() + 1}/${d.getDate()}`, date: ds, spent: 0 });
        }
        for (const e of spending.entries) {
          if (e.type !== 'out') continue;
          const idx = days30.findIndex(d => d.date === e.date);
          if (idx !== -1) days30[idx].spent += Number(e.amount) || 0;
        }
        if (!days30.some(d => d.spent > 0)) return null;
        const chartData = days30.map((d, i) => ({ label: (i % 6 === 0 || i >= 27) ? d.label : '', spent: Math.round(d.spent) }));
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 6, marginBottom: 10 }}><Receipt size={14} color="#8E4585" /><span className="h2">Daily spending · last 30 days</span></div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 4, right: 6, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} interval={0} />
                <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} />
                <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`$${v}`, 'Spent']} />
                <Bar dataKey="spent" fill="#8E4585" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'debt': {
        const creditCardAccounts = accounts.filter((a: any) => a.type === 'credit');
        const allDebtItems = [...creditCardAccounts.map((a: any) => ({ ...a, _isCreditAcc: true })), ...debts];
        const totalDailyInterest = allDebtItems.reduce((s, item) => s + calcDailyInterest(Number(item.balance) || 0, Number(item.rate) || 0), 0);
        const totalMonthlyInterest = allDebtItems.reduce((s, item) => s + calcMonthlyInterest(Number(item.balance) || 0, Number(item.rate) || 0), 0);
        const totalAccrued = allDebtItems.reduce((s, item) => s + (Number(item.accruedInterest) || 0), 0);
        const avalancheTarget = allDebtItems.filter((item) => Number(item.balance) > 0 && Number(item.rate) > 0).sort((a, b) => Number(b.rate) - Number(a.rate))[0];
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: totalDailyInterest > 0 ? 8 : 10 }}>
              <div className="row" style={{ gap: 6 }}><Banknote size={14} color="#B8460E" /><span className="h2">Debt tracker</span></div>
              <button className="tap" onClick={onAddDebt} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={11} /> Add</button>
            </div>
            {totalDailyInterest > 0 && (
              <div style={{ background: '#B8460E10', border: '1px solid #B8460E30', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}><div className="tiny muted" style={{ marginBottom: 1 }}>Costing you today</div><div className="mono" style={{ fontSize: 17, fontWeight: 700, color: '#B8460E' }}>{fmtMoney(totalDailyInterest)}<span style={{ fontSize: 11, fontWeight: 400, color: '#6B6457' }}>/day</span></div></div>
                  <div style={{ width: 1, background: '#B8460E25' }} />
                  <div style={{ flex: 1, minWidth: 100 }}><div className="tiny muted" style={{ marginBottom: 1 }}>Monthly interest</div><div className="mono" style={{ fontSize: 14, fontWeight: 600, color: '#B8460E' }}>~{fmtMoney(totalMonthlyInterest)}<span style={{ fontSize: 11, fontWeight: 400, color: '#6B6457' }}>/mo</span></div></div>
                  {totalAccrued > 0 && (<><div style={{ width: 1, background: '#B8460E25' }} /><div style={{ flex: 1, minWidth: 100 }}><div className="tiny muted" style={{ marginBottom: 1 }}>Accrued</div><div className="mono" style={{ fontSize: 14, fontWeight: 600, color: '#6B6457' }}>{fmtMoney(totalAccrued)}</div></div></>)}
                </div>
              </div>
            )}
            {allDebtItems.length === 0 ? (
              <button className="tap" onClick={onAddDebt} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', textAlign: 'left', background: 'transparent', border: 'none' }}>
                <CircleDollarSign size={14} color="#6B6457" /><span className="small muted" style={{ flex: 1 }}>Track a loan or credit card balance</span><ChevronRight size={14} color="#6B6457" />
              </button>
            ) : (
              <>
                {creditCardAccounts.map((acc: any) => {
                  const limit = Number(acc.creditLimit) || 0;
                  const bal = Number(acc.balance) || 0;
                  const apr = Number(acc.rate) || 0;
                  const daily = calcDailyInterest(bal, apr);
                  const monthly = calcMonthlyInterest(bal, apr);
                  const payoffMo = calcPayoffMonths(bal, apr, Number(acc.minPayment) || 0);
                  const totalInterest = calcTotalInterestAtMin(bal, apr, Number(acc.minPayment) || 0);
                  const accrued = Number(acc.accruedInterest) || 0;
                  const utilPct = limit > 0 ? Math.min(100, (bal / limit) * 100) : 0;
                  return (
                    <div key={acc.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #F0EAD8' }}>
                      <div className="between" style={{ marginBottom: 6 }}>
                        <div><div className="small" style={{ fontWeight: 600 }}>{acc.name}{acc.bank ? ` · ${acc.bank}` : ''}</div><div className="tiny muted">Credit Card{apr > 0 ? ` · ${apr}% APR` : ''}{acc.dueDay ? ` · due day ${acc.dueDay}` : ''}</div></div>
                        <div style={{ textAlign: 'right' }}><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(bal)}</div>{limit > 0 && <div className="tiny muted">of {fmtMoney(limit)} limit</div>}</div>
                      </div>
                      {limit > 0 && <div style={{ height: 5, background: '#F0EAD8', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}><div style={{ width: `${utilPct}%`, height: '100%', background: utilPct > 80 ? '#B8460E' : utilPct > 50 ? '#C8932E' : '#3F7A4F', borderRadius: 3 }} /></div>}
                      {apr > 0 && bal > 0 && (<div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 4 }}><span style={{ background: '#B8460E15', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 600 }} className="mono">{fmtMoney(daily)}/day</span><span style={{ background: '#B8460E10', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11 }} className="mono">~{fmtMoney(monthly)}/mo</span>{payoffMo > 0 && <span style={{ background: '#F0EAD8', color: '#6B6457', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>payoff {fmtPayoff(payoffMo)}</span>}{isFinite(totalInterest) && totalInterest > 0 && <span style={{ background: '#F0EAD8', color: '#8E4585', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>+{fmtMoney(totalInterest)} total</span>}</div>)}
                      {accrued > 0 && <div className="tiny" style={{ color: '#B8460E', opacity: 0.7 }}>~{fmtMoney(accrued)} accrued</div>}
                      {limit > 0 && <div className="tiny muted">{fmtMoney(limit - bal)} available</div>}
                    </div>
                  );
                })}
                {debts.map((debt: any) => {
                  const original = Number(debt.originalAmount) || Number(debt.balance) || 1;
                  const bal = Number(debt.balance) || 0;
                  const apr = Number(debt.rate) || 0;
                  const paid = original - bal;
                  const paidPct = Math.max(0, Math.min(100, (paid / original) * 100));
                  const daily = calcDailyInterest(bal, apr);
                  const monthly = calcMonthlyInterest(bal, apr);
                  const payoffMo = calcPayoffMonths(bal, apr, Number(debt.minPayment) || 0);
                  const totalInterest = calcTotalInterestAtMin(bal, apr, Number(debt.minPayment) || 0);
                  const accrued = Number(debt.accruedInterest) || 0;
                  return (
                    <div key={debt.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #F0EAD8' }}>
                      <div className="between" style={{ marginBottom: 6 }}>
                        <div><div className="small" style={{ fontWeight: 600 }}>{debt.name}</div><div className="tiny muted">{DEBT_TYPES.find(t => t.id === debt.type)?.label || 'Loan'}{apr > 0 ? ` · ${apr}% APR` : ''}</div></div>
                        <div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(bal)}</div>
                      </div>
                      {original > bal && <><div style={{ height: 4, background: '#F0EAD8', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}><div style={{ width: `${paidPct}%`, height: '100%', background: '#3F7A4F', borderRadius: 2 }} /></div><div className="tiny muted" style={{ marginBottom: 4 }}>{Math.round(paidPct)}% paid off</div></>}
                      {apr > 0 && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 4 }}><span style={{ background: '#B8460E15', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11 }} className="mono">{fmtMoney(daily)}/day</span><span style={{ background: '#B8460E10', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11 }} className="mono">~{fmtMoney(monthly)}/mo</span>{payoffMo > 0 && <span style={{ background: '#F0EAD8', color: '#6B6457', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>payoff {fmtPayoff(payoffMo)}</span>}{isFinite(totalInterest) && totalInterest > 0 && <span style={{ background: '#F0EAD8', color: '#8E4585', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>+{fmtMoney(totalInterest)} total</span>}</div>}
                      {accrued > 0 && <div className="tiny" style={{ color: '#B8460E', opacity: 0.7 }}>~{fmtMoney(accrued)} accrued</div>}
                    </div>
                  );
                })}
                {avalancheTarget && allDebtItems.filter((i) => Number(i.balance) > 0 && Number(i.rate) > 0).length > 1 && (
                  <div style={{ background: '#8E458510', border: '1px solid #8E458530', borderRadius: 8, padding: '8px 12px', marginTop: 4 }}>
                    <div className="tiny" style={{ fontWeight: 600, color: '#8E4585', marginBottom: 2 }}>💡 Avalanche tip</div>
                    <div className="tiny muted">Pay extra on <strong>{avalancheTarget.name}</strong> first ({avalancheTarget.rate}% APR) to save the most in interest.</div>
                  </div>
                )}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F0EAD8', display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}><div className="tiny muted">Total debt</div><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(totalLiabilities)}</div></div>
                  {totalDailyInterest > 0 && <><div style={{ flex: 1 }}><div className="tiny muted">Daily cost</div><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(totalDailyInterest)}</div></div><div style={{ flex: 1 }}><div className="tiny muted">Monthly cost</div><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>~{fmtMoney(totalMonthlyInterest)}</div></div></>}
                </div>
              </>
            )}
          </div>
        );
      }

      case 'income_payoff': {
        const inc = spending.income || {};
        const w2Monthly = Number(inc.w2Monthly) || 0;
        const expTrading = Number(inc.expectedTrading) || 0;
        const totalExpected = w2Monthly + expTrading;
        const minObligations = [...debts.map((d: any) => Number(d.minPayment) || 0), ...accounts.filter((a: any) => a.type === 'credit').map((a: any) => Number(a.minPayment) || 0)].reduce((s, v) => s + v, 0);
        const surplus = cur.income - cur.spent - minObligations;
        const canCover = cur.income >= minObligations;
        const availExtra = Math.max(0, surplus);
        const totalMonthlyPayment = minObligations + availExtra;
        const roughMonths = totalMonthlyPayment > 0 && totalLiabilities > 0 ? Math.ceil(totalLiabilities / totalMonthlyPayment) : 0;
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><TrendingUp size={14} color="#3F7A4F" /><span className="h2">Income & payoff</span></div>
              <button className="tap" onClick={onEditIncome} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={10} /> Edit</button>
            </div>
            {totalExpected === 0 ? (
              <button className="tap" onClick={onEditIncome} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', textAlign: 'left', background: 'transparent', border: 'none' }}>
                <TrendingUp size={14} color="#6B6457" /><span className="small muted" style={{ flex: 1 }}>Set your income to see debt payoff projections</span><ChevronRight size={14} color="#6B6457" />
              </button>
            ) : (
              <>
                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}><div className="tiny muted" style={{ marginBottom: 2 }}>Expected/mo</div><div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(totalExpected)}</div>{w2Monthly > 0 && expTrading > 0 && <div className="tiny muted">{fmtMoney(w2Monthly)} W2 + {fmtMoney(expTrading)} trading</div>}</div>
                  <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}><div className="tiny muted" style={{ marginBottom: 2 }}>Realized this month</div><div className="mono" style={{ fontSize: 15, fontWeight: 700, color: cur.income >= totalExpected * 0.8 ? '#3F7A4F' : '#C8932E' }}>{fmtMoney(cur.income)}</div></div>
                </div>
                {minObligations > 0 && (<div style={{ marginBottom: 10 }}><div className="between" style={{ marginBottom: 4 }}><span className="small muted">Min debt payments/mo</span><span className="mono small" style={{ color: '#B8460E' }}>{fmtMoney(minObligations)}</span></div><div style={{ height: 4, background: '#F0EAD8', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}><div style={{ height: '100%', width: `${Math.min(100, cur.income > 0 ? (minObligations/cur.income)*100 : 100)}%`, background: canCover ? '#3F7A4F' : '#B8460E', borderRadius: 2 }} /></div><div className="tiny" style={{ color: canCover ? '#3F7A4F' : '#B8460E' }}>{canCover ? `✓ Covered — ${fmtMoney(Math.abs(surplus))} ${surplus >= 0 ? 'surplus' : 'short'} after expenses` : `⚠ Income this month is ${fmtMoney(Math.abs(surplus))} short`}</div></div>)}
                {roughMonths > 0 && totalLiabilities > 0 && (<div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F33', borderRadius: 8, padding: '8px 12px' }}><div className="tiny muted" style={{ marginBottom: 2 }}>Debt-free estimate at current pace</div><div className="row" style={{ alignItems: 'baseline', gap: 6 }}><span className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#3F7A4F' }}>{fmtPayoff(roughMonths)}</span>{availExtra > 0 && <span className="tiny muted">(incl. {fmtMoney(availExtra)}/mo extra)</span>}</div></div>)}
                {totalLiabilities === 0 && debts.length + accounts.filter((a: any) => a.type === 'credit').length > 0 && (<div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F33', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}><span className="small" style={{ color: '#3F7A4F', fontWeight: 600 }}>🎉 Debt free!</span></div>)}
              </>
            )}
          </div>
        );
      }

      case 'tax':
        return (
          <button className="tap" onClick={onTaxModal} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left', borderRadius: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🧾</span>
            <div style={{ flex: 1 }}><div className="small" style={{ fontWeight: 600 }}>Tax tracker</div><div className="tiny muted">1099 entries · CA + Federal estimate · Quarterly payments</div></div>
            <ChevronRight size={14} color="#6B6457" />
          </button>
        );

      case 'categories':
        return allCats.length > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><PieChart size={14} color="#B8460E" /><span className="h2">Where it went · {monthLabel(viewMonth)}</span></div>
              <button className="tap" onClick={onCategories} style={{ padding: '4px 8px', fontSize: 10 }}><Pencil size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Categories</button>
            </div>
            {allCats.map((c) => {
              const pct = cur.spent > 0 ? (c.amount / cur.spent) * 100 : 0;
              const avg = catMonthlyAvg[c.id] || 0;
              const vsAvg = avg > 0 ? ((c.amount - avg) / avg) * 100 : 0;
              return (
                <div key={c.id} style={{ marginBottom: 12 }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span className="small"><span className="swatch" style={{ background: c.cat.color }} />{c.cat.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span className="mono small">{fmtMoney(c.amount)}</span>
                      {avg > 0 && <span className="mono tiny" style={{ marginLeft: 8, color: vsAvg > 15 ? '#B8460E' : vsAvg < -15 ? '#3F7A4F' : '#6B6457' }}>{vsAvg > 0 ? '+' : ''}{Math.round(vsAvg)}% vs avg</span>}
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#F5F0E6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.cat.color, transition: 'width 0.3s' }} />
                  </div>
                  {avg > 0 && <div className="tiny muted" style={{ marginTop: 2 }}>avg {fmtMoney(avg)}/mo</div>}
                </div>
              );
            })}
          </div>
        ) : null;

      case 'recurring':
        return recurring.length > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 6, marginBottom: 12 }}><Repeat size={14} color="#6E5C8E" /><span className="h2">Recurring</span><span className="mono tiny muted" style={{ marginLeft: 'auto' }}>~{fmtMoney(recurring.reduce((s, r) => s + Number(r.amount || 0), 0))}/mo</span></div>
            {recurring.map((r) => {
              const cat = catMap[r.categoryId];
              return (
                <div key={r.id} className="between" style={{ padding: '6px 0', borderBottom: '1px solid #F0EAD8' }}>
                  <div className="row" style={{ gap: 8 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: cat?.color || '#6B6457' }} /><div><div className="small" style={{ fontWeight: 500 }}>{r.name || 'Untitled'}</div><div className="tiny muted">{cat?.name || 'Other'}</div></div></div>
                  <span className="mono small">{fmtMoney(r.amount)}</span>
                </div>
              );
            })}
          </div>
        ) : null;

      case 'owed':
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 6 }}><HandCoins size={14} color="#3F7A4F" /><span className="h2">People owe me</span>{totalOwed > 0 && <span className="mono tiny" style={{ marginLeft: 4, background: '#3F7A4F22', color: '#3F7A4F', padding: '2px 6px', borderRadius: 6 }}>{fmtMoney(totalOwed)}</span>}</div>
              <button className="tap" onClick={onAddOwed} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={11} /> Add</button>
            </div>
            {owed.length === 0 ? (
              <div className="muted small" style={{ textAlign: 'center', padding: '8px 0' }}>No IOUs tracked — add someone who owes you.</div>
            ) : (
              owed.map((item: any) => (
                <button key={item.id} className="tap" onClick={() => onEditOwed(item)} style={{ width: '100%', textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #F0EAD8', background: 'transparent', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: item.paid ? '#3F7A4F22' : '#C8932E22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={14} color={item.paid ? '#3F7A4F' : '#C8932E'} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="small" style={{ fontWeight: 600, color: item.paid ? '#6B6457' : '#1A1A2E', textDecoration: item.paid ? 'line-through' : 'none' }}>{item.name}</div><div className="tiny muted">{item.note ? `${item.note} · ` : ''}{item.dueDate ? `Due ${item.dueDate}` : item.dateAdded ? `Added ${item.dateAdded}` : ''}</div></div>
                  <span className="mono small" style={{ fontWeight: 700, color: item.paid ? '#6B6457' : '#3F7A4F' }}>{fmtMoney(item.amount)}</span>
                </button>
              ))
            )}
          </div>
        );

      case 'transactions': {
        const hasFilters = !!(txFilter.trim() || filterCatId || filterAcctId || filterType);
        return (
          <div className="card">
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 6 }}><Receipt size={14} color="#1A1A2E" /><span className="h2">Transactions</span></div>
              <span className="tiny muted mono">{filteredRecent.length}{hasFilters ? ` / ${recent.length}` : ''} this month</span>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input type="text" value={txFilter} onChange={(e) => setTxFilter(e.target.value)} placeholder="Search by name…" style={{ paddingLeft: 32, fontSize: 13, padding: '8px 10px 8px 32px' }} />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B6457', fontSize: 14 }}>🔍</span>
              {txFilter && <button onClick={() => setTxFilter('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}><X size={14} /></button>}
            </div>
            <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ flex: 1, minWidth: 90, padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #E4DCC8', background: filterType ? '#1A1A2E' : undefined, color: filterType ? '#F5F0E6' : undefined }}>
                <option value="">All types</option>
                <option value="out">Expenses</option>
                <option value="in">Income</option>
              </select>
              {spending.categories?.length > 0 && (
                <select value={filterCatId} onChange={(e) => setFilterCatId(e.target.value)} style={{ flex: 1, minWidth: 110, padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #E4DCC8', background: filterCatId ? '#1A1A2E' : undefined, color: filterCatId ? '#F5F0E6' : undefined }}>
                  <option value="">All categories</option>
                  {spending.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {accounts.length > 0 && (
                <select value={filterAcctId} onChange={(e) => setFilterAcctId(e.target.value)} style={{ flex: 1, minWidth: 110, padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #E4DCC8', background: filterAcctId ? '#1A1A2E' : undefined, color: filterAcctId ? '#F5F0E6' : undefined }}>
                  <option value="">All accounts</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {hasFilters && (
                <button className="tap" style={{ padding: '5px 10px', fontSize: 11, color: '#B8460E' }} onClick={() => { setTxFilter(''); setFilterCatId(''); setFilterAcctId(''); setFilterType(''); }}>
                  <X size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Clear
                </button>
              )}
            </div>
            {filteredRecent.length === 0 ? (
              <div className="muted small" style={{ padding: '12px 0', textAlign: 'center' }}>
                {recent.length === 0
                  ? <><Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />No transactions yet — add income or an expense above.</>
                  : 'No transactions match the current filters.'}
              </div>
            ) : (
              filteredRecent.map((e: any) => {
                const cat = catMap[e.categoryId];
                const isIn = e.type === 'in';
                const acct = accounts.find((a: any) => a.id === e.accountId);
                return (
                  <button key={e.id} className="tap" onClick={() => onEdit(e)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid #F0EAD8', background: 'transparent', borderRadius: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: (cat?.color || '#6B6457') + '22', color: cat?.color || '#6B6457', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isIn ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name || (isIn ? 'Income' : 'Expense')}</div>
                      <div className="tiny muted">{cat?.name || 'Other'} · {e.date}{e.recurring ? ' · recurring' : ''}{acct ? ` · ${acct.name}` : ''}</div>
                    </div>
                    <span className="mono small" style={{ color: isIn ? '#3F7A4F' : '#B8460E', fontWeight: 600 }}>{isIn ? '+' : '−'}{fmtMoney(e.amount).replace('−', '')}</span>
                  </button>
                );
              })
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      <div className="between" style={{ marginBottom: 6 }}>
        <h1 className="h1">Money.</h1>
        <div className="row" style={{ gap: 6 }}>
          <button className="tap" onClick={() => setReorderOpen(true)} style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <GripVertical size={12} /> Layout
          </button>
          <button className="tap" onClick={onBudget} style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Target size={12} /> Goals
          </button>
        </div>
      </div>
      <div className="between" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setViewMonth(prevMonth(viewMonth))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#6B6457' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span className="mono small" style={{ color: '#6B6457' }}>{monthLabel(viewMonth)}</span>
          {viewMonth !== thisMonth && (
            <button
              onClick={() => setViewMonth(thisMonth)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#8E4585', marginLeft: 8, fontFamily: 'inherit' }}
            >
              → today
            </button>
          )}
        </div>
        <button
          onClick={() => setViewMonth(nextMonth(viewMonth))}
          disabled={viewMonth >= thisMonth}
          style={{ background: 'none', border: 'none', cursor: viewMonth >= thisMonth ? 'default' : 'pointer', padding: '4px 6px', color: viewMonth >= thisMonth ? '#D4CCB8' : '#6B6457' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* NEGATIVE MONTH ALERT */}
      {negativeMonth && (
        <div style={{ background: '#B8460E18', border: '1px solid #B8460E55', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BadgeAlert size={16} color="#B8460E" style={{ flexShrink: 0 }} />
          <div>
            <div className="small" style={{ fontWeight: 600, color: '#B8460E' }}>You're in the red this month</div>
            <div className="tiny muted">Spending exceeds income by {fmtMoney(Math.abs(cur.net))}. Check your budget.</div>
          </div>
        </div>
      )}

      {/* HERO */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2A2A4E 100%)', color: '#F5F0E6', padding: 22, marginBottom: 14, border: 'none' }}>
        <div className="row" style={{ gap: 6, marginBottom: 6, opacity: 0.7 }}>
          <Wallet size={13} />
          <span className="h2" style={{ color: '#F5F0E6', opacity: 0.7 }}>Net this month</span>
        </div>
        <div className="mono" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em', color: cur.net >= 0 ? '#A8D8B0' : '#F4A89E', lineHeight: 1.05 }}>
          {fmtMoney(cur.net, { signed: true })}
        </div>
        {!empty && (
          <div className="row" style={{ gap: 6, marginTop: 8, fontSize: 11, opacity: 0.8 }}>
            {netDelta >= 0 ? <ArrowUpRight size={12} color="#A8D8B0" /> : <ArrowDownRight size={12} color="#F4A89E" />}
            <span className="mono">{fmtMoney(Math.abs(netDelta))}</span>
            <span style={{ opacity: 0.7 }}>vs {monthShort(prevMonth(viewMonth))}</span>
          </div>
        )}
        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Income</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#A8D8B0' }}>{fmtMoney(cur.income)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Spent</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#F4A89E' }}>{fmtMoney(cur.spent)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Saved</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{Math.round(savingsRate)}%</div>
          </div>
        </div>
        {(accounts.length > 0 || debts.length > 0) && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(245,240,230,0.15)' }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Net worth</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: netWorth >= 0 ? '#A8D8B0' : '#F4A89E' }}>{fmtMoney(netWorth)}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Assets</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#A8D8B0' }}>{fmtMoney(assets)}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Debt</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#F4A89E' }}>{fmtMoney(totalLiabilities)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUICK ACTIONS */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className="btn" style={{ flex: 1, background: '#3F7A4F', color: '#F5F0E6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onAdd('in')}>
          <Plus size={14} /> Income
        </button>
        <button className="btn" style={{ flex: 1, background: '#B8460E', color: '#F5F0E6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onAdd('out')}>
          <Plus size={14} /> Expense
        </button>
        {hasCreditCards && (
          <button className="btn" style={{ flex: 1, background: '#3B5C6B', color: '#F5F0E6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 13 }} onClick={onTransfer}>
            <ArrowRightLeft size={13} /> Pay Card
          </button>
        )}
      </div>

      {sectionOrder.map((id) => <React.Fragment key={id}>{renderMoneySection(id)}</React.Fragment>)}
      {reorderOpen && (
        <MoneyReorderModal
          order={sectionOrder}
          onSave={(o: string[]) => { if (onSaveLayout) onSaveLayout(o); }}
          onClose={() => setReorderOpen(false)}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — SECTION REORDER MODAL
// ════════════════════════════════════════════════════════════════════════════════
function MoneyReorderModal({ order, onSave, onClose }: { order: string[]; onSave: (o: string[]) => void; onClose: () => void }) {
  const [items, setItems] = useState<string[]>(order);
  const sensors = useDndSensors();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', padding: '0 0 env(safe-area-inset-bottom)' }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg)', borderRadius: '18px 18px 0 0', padding: '20px 20px 32px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 6 }}>
          <span className="h2">Reorder sections</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457', padding: 4 }}><X size={18} /></button>
        </div>
        <p className="small muted" style={{ marginBottom: 16 }}>Drag ⠿ to reorder. Sections that have nothing to show are hidden automatically.</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }: DragEndEvent) => {
          if (over && active.id !== over.id) {
            setItems((prev) => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
          }
        }}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {items.map((id) => (
              <SortableRow key={id} id={id}>
                <div style={{ padding: '11px 12px 11px 28px', borderRadius: 8, marginBottom: 6, background: '#F9F5EC', border: '1px solid #E4DCC8', fontSize: 14, color: '#1A1A2E' }}>
                  {MONEY_LABELS[id] || id}
                </div>
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => { onSave(items); onClose(); }}>
          <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save layout
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER — old inline ACCOUNTS start (replaced by renderMoneySection)
// ════════════════════════════════════════════════════════════════════════════════

function AddTransactionModal({ entry, defaultType, spending, onSave, onDelete, onClose }: any) {
  const isEdit = !!entry;
  const [type, setType] = useState<'in' | 'out'>(entry?.type || defaultType || 'out');
  const cats = spending.categories.filter((c: any) => c.kind === type);
  const [amount, setAmount] = useState<string>(entry ? String(entry.amount) : '');
  const [name, setName] = useState<string>(entry?.name || '');
  const [categoryId, setCategoryId] = useState<string>(entry?.categoryId || cats[0]?.id || '');
  const [date, setDate] = useState<string>(entry?.date || todayStr());
  const [recurring, setRecurring] = useState<boolean>(!!entry?.recurring);
  const [note, setNote] = useState<string>(entry?.note || '');
  const [accountId, setAccountId] = useState<string>(entry?.accountId || '');

  const allAccounts: any[] = spending.accounts || [];
  const relevantAccounts = type === 'out' ? allAccounts : allAccounts.filter((a: any) => a.type !== 'credit');

  useEffect(() => {
    if (!cats.find((c: any) => c.id === categoryId)) setCategoryId(cats[0]?.id || '');
    if (accountId) {
      const acc = allAccounts.find((a: any) => a.id === accountId);
      if (acc && type === 'in' && acc.type === 'credit') setAccountId('');
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter an amount'); return; }
    if (!categoryId) { toast.error('Pick a category'); return; }
    const next = {
      id: entry?.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type, amount: Math.round(amt * 100) / 100, name: name.trim(), categoryId, date, recurring,
      note: note.trim() || undefined,
      accountId: accountId || undefined,
    };
    onSave(next);
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button
          className="tap"
          onClick={() => setType('out')}
          style={{
            flex: 1, padding: '10px',
            background: type === 'out' ? '#B8460E' : 'transparent',
            color: type === 'out' ? '#F5F0E6' : '#1A1A2E',
            borderColor: type === 'out' ? '#B8460E' : '#E4DCC8',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ArrowUpRight size={14} /> Expense
        </button>
        <button
          className="tap"
          onClick={() => setType('in')}
          style={{
            flex: 1, padding: '10px',
            background: type === 'in' ? '#3F7A4F' : 'transparent',
            color: type === 'in' ? '#F5F0E6' : '#1A1A2E',
            borderColor: type === 'in' ? '#3F7A4F' : '#E4DCC8',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ArrowDownRight size={14} /> Income
        </button>
      </div>

      <label>Amount</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 20, color: '#6B6457' }}>$</span>
        <input
          type="number" step="0.01" inputMode="decimal" autoFocus={!isEdit}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          style={{ flex: 1, fontSize: 20, fontFamily: 'JetBrains Mono, monospace' }}
        />
      </div>

      <label>What's it for?</label>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder={type === 'in' ? 'Paycheck, gig, dividend…' : 'Coffee, Netflix, rent…'}
        style={{ marginBottom: 12 }}
      />

      <label>Category</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
        {cats.map((c: any) => (
          <button
            key={c.id}
            className="tap"
            onClick={() => setCategoryId(c.id)}
            style={{
              padding: '8px 10px', textAlign: 'left', fontSize: 12,
              background: categoryId === c.id ? c.color + '22' : 'transparent',
              borderColor: categoryId === c.id ? c.color : '#E4DCC8',
              color: '#1A1A2E',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Recurring</label>
          <button
            className="tap"
            onClick={() => setRecurring(!recurring)}
            style={{
              width: '100%', padding: '10px',
              background: recurring ? '#6E5C8E' : 'transparent',
              color: recurring ? '#F5F0E6' : '#1A1A2E',
              borderColor: recurring ? '#6E5C8E' : '#E4DCC8',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Repeat size={12} /> {recurring ? 'Yes' : 'No'}
          </button>
        </div>
      </div>

      {relevantAccounts.length > 0 && (
        <>
          <label>{type === 'out' ? 'Paid with' : 'Deposit to'} <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="tap" onClick={() => setAccountId('')} style={{ fontSize: 11, padding: '5px 10px', background: !accountId ? '#1A1A2E' : 'transparent', color: !accountId ? '#F5F0E6' : '#1A1A2E', borderColor: !accountId ? '#1A1A2E' : '#E4DCC8' }}>None</button>
            {relevantAccounts.map((a: any) => (
              <button key={a.id} className="tap" onClick={() => setAccountId(a.id)} style={{ fontSize: 11, padding: '5px 10px', background: accountId === a.id ? (a.color || '#1A1A2E') : 'transparent', color: accountId === a.id ? '#F5F0E6' : '#1A1A2E', borderColor: accountId === a.id ? (a.color || '#1A1A2E') : '#E4DCC8' }}>
                {a.name}{a.type === 'credit' ? ' 💳' : ''}
              </button>
            ))}
          </div>
          {accountId && (() => {
            const acc = allAccounts.find((a: any) => a.id === accountId);
            const amt = parseFloat(amount) || 0;
            if (!acc || !amt) return null;
            const newBal = type === 'out' ? (acc.type === 'credit' ? Number(acc.balance) + amt : Number(acc.balance) - amt) : Number(acc.balance) + amt;
            return <div className="tiny muted" style={{ marginBottom: 12 }}>Balance after: <span className="mono" style={{ color: newBal < 0 ? '#B8460E' : '#3F7A4F' }}>{fmtMoney(newBal)}</span></div>;
          })()}
        </>
      )}

      <label>Note (optional)</label>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember" style={{ marginBottom: 16 }} />

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save changes' : 'Add transaction'}
      </button>
      {isEdit && (
        <button
          className="tap"
          onClick={() => { if (confirm('Delete this transaction?')) { onDelete(entry.id); onClose(); } }}
          style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Trash2 size={12} /> Delete
        </button>
      )}
    </ModalShell>
  );
}

function MoneyGoalsModal({ spending, onSave, onClose }: any) {
  const [budget, setBudget] = useState<string>(String(spending.monthlyBudget || ''));
  const [goal, setGoal] = useState<string>(String(spending.savingsGoal || ''));
  const save = () => {
    onSave({ ...spending, monthlyBudget: parseFloat(budget) || 0, savingsGoal: parseFloat(goal) || 0 });
    onClose();
  };
  return (
    <ModalShell title="Money goals" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.4 }}>Set a monthly spending cap and a savings target. Leave at 0 to hide.</p>
      <label>Monthly spending budget</label>
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span className="mono muted">$</span>
        <input type="number" step="1" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 2500" />
      </div>
      <label>Monthly savings goal</label>
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 18 }}>
        <span className="mono muted">$</span>
        <input type="number" step="1" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. 800" />
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save goals
      </button>
    </ModalShell>
  );
}

function MoneyCategoriesModal({ spending, onSave, onClose }: any) {
  const [cats, setCats] = useState<any[]>(spending.categories);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'in' | 'out'>('out');
  const [color, setColor] = useState('#8E4585');
  const palette = ['#B8460E', '#C8932E', '#3F7A4F', '#3B5C6B', '#8E4585', '#6E5C8E', '#A65E8E', '#8E5C5C', '#5C8E4F', '#6B6457'];
  const add = () => {
    if (!name.trim()) return;
    setCats([...cats, { id: `c_${Date.now()}`, name: name.trim(), kind, color }]);
    setName('');
  };
  const remove = (id: string) => {
    if (!confirm('Delete this category? Existing transactions keep the reference but will show as "Other".')) return;
    setCats(cats.filter((c) => c.id !== id));
  };
  const rename = (id: string, n: string) => setCats(cats.map((c) => (c.id === id ? { ...c, name: n } : c)));
  const recolor = (id: string, col: string) => setCats(cats.map((c) => (c.id === id ? { ...c, color: col } : c)));
  return (
    <ModalShell title="Categories" onClose={onClose}>
      <div className="h2" style={{ marginBottom: 8 }}>Add new</div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button className="tap" onClick={() => setKind('out')} style={{ flex: 1, background: kind === 'out' ? '#B8460E22' : 'transparent', borderColor: kind === 'out' ? '#B8460E' : '#E4DCC8' }}>Expense</button>
        <button className="tap" onClick={() => setKind('in')} style={{ flex: 1, background: kind === 'in' ? '#3F7A4F22' : 'transparent', borderColor: kind === 'in' ? '#3F7A4F' : '#E4DCC8' }}>Income</button>
      </div>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" style={{ marginBottom: 8 }} />
      <div className="row" style={{ gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {palette.map((p) => (
          <button key={p} onClick={() => setColor(p)} style={{ width: 24, height: 24, borderRadius: 6, background: p, border: color === p ? '2px solid #1A1A2E' : '1px solid #E4DCC8', cursor: 'pointer' }} />
        ))}
      </div>
      <button className="tap" style={{ width: '100%', marginBottom: 16 }} onClick={add}><Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add category</button>

      <div className="h2" style={{ marginBottom: 8 }}>Existing</div>
      {(['out', 'in'] as const).map((k) => (
        <div key={k} style={{ marginBottom: 14 }}>
          <div className="tiny muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k === 'out' ? 'Expenses' : 'Income'}</div>
          {cats.filter((c) => c.kind === k).map((c) => (
            <div key={c.id} className="row" style={{ gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input type="color" value={c.color} onChange={(e) => recolor(c.id, e.target.value)} style={{ width: 32, height: 32, padding: 0, border: '1px solid #E4DCC8', borderRadius: 6, background: 'transparent' }} />
              <input type="text" value={c.name} onChange={(e) => rename(c.id, e.target.value)} style={{ flex: 1 }} />
              <button className="tap" onClick={() => remove(c.id)} style={{ padding: '6px 8px', color: '#B8460E' }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      ))}

      <button className="btn" style={{ width: '100%' }} onClick={() => { onSave({ ...spending, categories: cats }); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save categories
      </button>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — ADD / EDIT ACCOUNT MODAL
// ════════════════════════════════════════════════════════════════════════════════
function AddAccountModal({ account, onSave, onDelete, onClose }: any) {
  const isEdit = !!account;
  const [name, setName] = useState(account?.name || '');
  const [bank, setBank] = useState(account?.bank || '');
  const [type, setType] = useState<'checking' | 'savings' | 'credit'>(account?.type || 'checking');
  const [balance, setBalance] = useState(String(account?.balance ?? ''));
  const [creditLimit, setCreditLimit] = useState(String(account?.creditLimit ?? ''));
  const [rate, setRate] = useState(String(account?.rate ?? ''));
  const [minPayment, setMinPayment] = useState(String(account?.minPayment ?? ''));
  const [dueDay, setDueDay] = useState(String(account?.dueDay ?? ''));
  const [color, setColor] = useState(account?.color || ACCOUNT_COLORS[0]);
  const [includeNW, setIncludeNW] = useState(account?.includeInNetWorth !== false);

  const save = () => {
    if (!name.trim()) { toast.error('Enter an account name'); return; }
    const bal = parseFloat(balance);
    if (!isFinite(bal) || bal < 0) { toast.error('Enter a valid balance'); return; }
    const next: any = {
      id: account?.id || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), bank: bank.trim(), type,
      balance: Math.round(bal * 100) / 100, color, includeInNetWorth: includeNW,
      accruedInterest: account?.accruedInterest || 0,
      lastAccrualDate: account?.lastAccrualDate || todayStr(),
    };
    if (type === 'credit') {
      next.creditLimit = parseFloat(creditLimit) || 0;
      next.rate = parseFloat(rate) || 0;
      next.minPayment = parseFloat(minPayment) || 0;
      next.dueDay = parseInt(dueDay) || null;
    }
    onSave(next); onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit account' : 'Add account'} onClose={onClose}>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        {(['checking', 'savings', 'credit'] as const).map((t) => (
          <button key={t} className="tap" onClick={() => setType(t)} style={{ flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: type === t ? 700 : 400, background: type === t ? '#1A1A2E' : 'transparent', color: type === t ? '#F5F0E6' : '#1A1A2E', borderColor: type === t ? '#1A1A2E' : '#E4DCC8', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      <label>Account nickname</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'credit' ? 'Navy Federal CC, Chase Sapphire…' : 'Main checking, Emergency fund…'} style={{ marginBottom: 12 }} autoFocus={!isEdit} />

      <label>Bank / institution</label>
      <input type="text" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Chase, Navy Federal, Wells Fargo…" style={{ marginBottom: 12 }} />

      <label>{type === 'credit' ? 'Current balance owed' : 'Current balance'}</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono muted">$</span>
        <input type="number" step="0.01" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }} />
      </div>

      {type === 'credit' && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Credit limit</label>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="mono muted">$</span>
                <input type="number" step="1" inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="e.g. 5000" style={{ flex: 1 }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label>APR %</label>
              <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 24.99" />
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Due day of month</label>
              <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 15" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Min payment</label>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="mono muted">$</span>
                <input type="number" step="0.01" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} placeholder="0.00" style={{ flex: 1 }} />
              </div>
            </div>
          </div>
          {balance && rate && parseFloat(balance) > 0 && parseFloat(rate) > 0 && (
            <div style={{ background: '#B8460E10', border: '1px solid #B8460E33', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
              <span className="muted">Daily interest: </span>
              <span className="mono" style={{ color: '#B8460E', fontWeight: 600 }}>~{fmtMoney(calcDailyInterest(parseFloat(balance), parseFloat(rate)))}/day</span>
              <span className="muted"> · </span>
              <span className="mono" style={{ color: '#B8460E' }}>~{fmtMoney(calcMonthlyInterest(parseFloat(balance), parseFloat(rate)))}/mo</span>
            </div>
          )}
        </>
      )}

      {type !== 'credit' && (
        <>
          <label>Card color</label>
          <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {ACCOUNT_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: color === c ? '3px solid #C8932E' : '1px solid #E4DCC8', cursor: 'pointer' }} />
            ))}
          </div>
        </>
      )}

      <div className="between" style={{ marginBottom: 18 }}>
        <span className="small">Include in net worth</span>
        <button className="tap" onClick={() => setIncludeNW(!includeNW)} style={{ padding: '6px 14px', background: includeNW ? '#3F7A4F' : 'transparent', color: includeNW ? '#F5F0E6' : '#1A1A2E', borderColor: includeNW ? '#3F7A4F' : '#E4DCC8' }}>
          {includeNW ? 'Yes' : 'No'}
        </button>
      </div>

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save account' : 'Add account'}
      </button>
      {isEdit && (
        <button className="tap" onClick={() => { if (confirm('Remove this account?')) { onDelete(account.id); onClose(); } }} style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Trash2 size={12} /> Remove account
        </button>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — ADD / EDIT DEBT MODAL
// ════════════════════════════════════════════════════════════════════════════════
function AddDebtModal({ debt, onSave, onDelete, onClose }: any) {
  const isEdit = !!debt;
  const [name, setName] = useState(debt?.name || '');
  const [type, setType] = useState(debt?.type || 'student_loan');
  const [originalAmount, setOriginalAmount] = useState(String(debt?.originalAmount ?? ''));
  const [balance, setBalance] = useState(String(debt?.balance ?? ''));
  const [minPayment, setMinPayment] = useState(String(debt?.minPayment ?? ''));
  const [rate, setRate] = useState(String(debt?.rate ?? ''));
  const [dueDay, setDueDay] = useState(String(debt?.dueDay ?? ''));
  const [includeNW, setIncludeNW] = useState(debt?.includeInNetWorth !== false);

  const save = () => {
    if (!name.trim()) { toast.error('Enter a name'); return; }
    const bal = parseFloat(balance);
    if (!isFinite(bal) || bal < 0) { toast.error('Enter a valid balance'); return; }
    onSave({
      id: debt?.id || `debt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), type,
      originalAmount: parseFloat(originalAmount) || bal,
      balance: Math.round(bal * 100) / 100,
      minPayment: parseFloat(minPayment) || 0,
      rate: parseFloat(rate) || 0,
      dueDay: parseInt(dueDay) || null,
      includeInNetWorth: includeNW,
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit debt' : 'Add debt'} onClose={onClose}>
      <label>Type of debt</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
        {DEBT_TYPES.map((t) => (
          <button key={t.id} className="tap" onClick={() => setType(t.id)} style={{ padding: '8px', fontSize: 12, background: type === t.id ? '#B8460E22' : 'transparent', borderColor: type === t.id ? '#B8460E' : '#E4DCC8', fontWeight: type === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      <label>Name / label</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sallie Mae, Car loan…" style={{ marginBottom: 12 }} autoFocus={!isEdit} />

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Current balance owed</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mono muted">$</span>
            <input type="number" step="0.01" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" style={{ flex: 1 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label>Original total</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mono muted">$</span>
            <input type="number" step="0.01" inputMode="decimal" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} placeholder="e.g. 20000" style={{ flex: 1 }} />
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Min payment / mo</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mono muted">$</span>
            <input type="number" step="0.01" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} placeholder="0.00" style={{ flex: 1 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label>Interest rate %</label>
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 5.99" />
        </div>
      </div>

      <label>Payment due day of month (optional)</label>
      <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 1" style={{ marginBottom: 12 }} />

      <div className="between" style={{ marginBottom: 18 }}>
        <span className="small">Include in net worth calculation</span>
        <button className="tap" onClick={() => setIncludeNW(!includeNW)} style={{ padding: '6px 14px', background: includeNW ? '#3F7A4F' : 'transparent', color: includeNW ? '#F5F0E6' : '#1A1A2E', borderColor: includeNW ? '#3F7A4F' : '#E4DCC8' }}>
          {includeNW ? 'Yes' : 'No'}
        </button>
      </div>

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save debt' : 'Add debt'}
      </button>
      {isEdit && (
        <button className="tap" onClick={() => { if (confirm('Remove this debt?')) { onDelete(debt.id); onClose(); } }} style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Trash2 size={12} /> Remove debt
        </button>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — ADD / EDIT "PEOPLE OWE ME" MODAL
// ════════════════════════════════════════════════════════════════════════════════
function AddOwedModal({ item, onSave, onDelete, onClose }: any) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [amount, setAmount] = useState(String(item?.amount ?? ''));
  const [note, setNote] = useState(item?.note || '');
  const [dueDate, setDueDate] = useState(item?.dueDate || '');
  const [paid, setPaid] = useState(item?.paid || false);

  const save = () => {
    if (!name.trim()) { toast.error('Enter a name'); return; }
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter an amount'); return; }
    onSave({
      id: item?.id || `owed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), amount: Math.round(amt * 100) / 100,
      note: note.trim() || undefined, dueDate: dueDate || undefined,
      paid, dateAdded: item?.dateAdded || todayStr(),
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit IOU' : 'Someone owes me'} onClose={onClose}>
      <label>Who owes you?</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or group" style={{ marginBottom: 12 }} autoFocus={!isEdit} />

      <label>Amount</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 20, color: '#6B6457' }}>$</span>
        <input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ flex: 1, fontSize: 20, fontFamily: 'JetBrains Mono, monospace' }} />
      </div>

      <label>What for? (optional)</label>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dinner, concert tickets, rent split…" style={{ marginBottom: 12 }} />

      <label>Due date (optional)</label>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ marginBottom: 14 }} />

      {isEdit && (
        <div className="between" style={{ marginBottom: 18 }}>
          <span className="small">Mark as paid</span>
          <button className="tap" onClick={() => setPaid(!paid)} style={{ padding: '6px 14px', background: paid ? '#3F7A4F' : 'transparent', color: paid ? '#F5F0E6' : '#1A1A2E', borderColor: paid ? '#3F7A4F' : '#E4DCC8' }}>
            {paid ? '✓ Paid' : 'Unpaid'}
          </button>
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save' : 'Add IOU'}
      </button>
      {isEdit && (
        <button className="tap" onClick={() => { if (confirm('Delete this IOU?')) { onDelete(item.id); onClose(); } }} style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Trash2 size={12} /> Delete
        </button>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — CREDIT CARD PAYMENT (TRANSFER) MODAL
// ════════════════════════════════════════════════════════════════════════════════
function AccountTransferModal({ spending, onSave, onClose }: any) {
  const fromAccounts = (spending.accounts || []).filter((a: any) => a.type !== 'credit');
  const toAccounts = (spending.accounts || []).filter((a: any) => a.type === 'credit');
  const [fromId, setFromId] = useState(fromAccounts[0]?.id || '');
  const [toId, setToId] = useState(toAccounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());

  const from = fromAccounts.find((a: any) => a.id === fromId);
  const to = toAccounts.find((a: any) => a.id === toId);

  const save = () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter an amount'); return; }
    if (!fromId && fromAccounts.length > 0) { toast.error('Select a source account'); return; }
    if (!toId) { toast.error('Select a credit card to pay'); return; }
    onSave({
      tx: {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'out', amount: Math.round(amt * 100) / 100,
        name: `CC Payment → ${to?.name || 'Credit Card'}`,
        categoryId: 'c_bills', date,
        accountId: fromId || undefined, isTransfer: true,
      },
      creditAccountId: toId,
      amount: Math.round(amt * 100) / 100,
    });
    onClose();
  };

  if (toAccounts.length === 0) {
    return (
      <ModalShell title="Pay credit card" onClose={onClose}>
        <p className="muted small" style={{ textAlign: 'center', padding: '20px 0' }}>No credit cards found. Add a credit card in Accounts first.</p>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Pay credit card" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>Records a payment from a debit/savings account and reduces the credit card balance.</p>

      {fromAccounts.length > 0 && (
        <>
          <label>Pay from (debit / savings)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
            {fromAccounts.map((a: any) => (
              <button key={a.id} className="tap" onClick={() => setFromId(a.id)} style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, background: fromId === a.id ? (a.color || '#1A1A2E') : 'transparent', color: fromId === a.id ? '#F5F0E6' : '#1A1A2E', borderColor: fromId === a.id ? (a.color || '#1A1A2E') : '#E4DCC8' }}>
                {a.name}{a.bank ? ` · ${a.bank}` : ''}
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{fmtMoney(a.balance)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <label>Pay to (credit card)</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {toAccounts.map((a: any) => (
          <button key={a.id} className="tap" onClick={() => setToId(a.id)} style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, background: toId === a.id ? '#B8460E' : 'transparent', color: toId === a.id ? '#F5F0E6' : '#1A1A2E', borderColor: toId === a.id ? '#B8460E' : '#E4DCC8' }}>
            {a.name}{a.bank ? ` · ${a.bank}` : ''}
            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>Owes {fmtMoney(a.balance)}</div>
          </button>
        ))}
      </div>

      <label>Payment amount</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 20, color: '#6B6457' }}>$</span>
        <input type="number" step="0.01" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ flex: 1, fontSize: 20, fontFamily: 'JetBrains Mono, monospace' }} />
      </div>
      {to && Number(to.balance) > 0 && (
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setAmount(String(to.balance))}>Full balance {fmtMoney(to.balance)}</button>
          {Number(to.minPayment) > 0 && <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setAmount(String(to.minPayment))}>Min {fmtMoney(to.minPayment)}</button>}
        </div>
      )}

      <label>Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 18 }} />

      {from && to && parseFloat(amount) > 0 && (
        <div style={{ background: '#F0EAD8', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          <span className="muted">{from.name}</span> <ArrowRightLeft size={11} style={{ verticalAlign: 'middle', margin: '0 4px' }} /> <span className="muted">{to.name}</span>
          <span className="mono" style={{ float: 'right', fontWeight: 700 }}>{fmtMoney(parseFloat(amount) || 0)}</span>
        </div>
      )}

      <button className="btn" style={{ width: '100%' }} onClick={save}>
        <ArrowRightLeft size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Record payment
      </button>
    </ModalShell>
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
  const [spending, setSpending] = useState<any>(DEFAULT_SPENDING);
  const [tax, setTax] = useState<any>(DEFAULT_TAX);
  const [customChallenges, setCustomChallenges] = useState<any[]>([]);
  const [modal, setModal] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const s = await safeGet(K.settings, DEFAULT_SETTINGS);
      const merged = {
        ...DEFAULT_SETTINGS,
        ...s,
        subjects: { ...DEFAULT_SETTINGS.subjects, ...(s.subjects || {}) },
        macroTargets: { ...DEFAULT_SETTINGS.macroTargets, ...(s.macroTargets || {}) },
        microTargets: { ...DEFAULT_SETTINGS.microTargets, ...(s.microTargets || {}) },
        journal: { ...DEFAULT_SETTINGS.journal, ...(s.journal || {}) },
      };
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
      let sp = migrateSpending(await safeGet(K.spending, DEFAULT_SPENDING));
      // Accrue daily interest on all tracked debts and credit cards.
      {
        const today = todayStr();
        const accrueItem = (item: any) => {
          const rate = Number(item.rate) || 0;
          const balance = Number(item.balance) || 0;
          const last = item.lastAccrualDate;
          if (!last) return { ...item, lastAccrualDate: today };
          if (last >= today) return item;
          const days = Math.max(0, diffDays(today, last));
          if (days <= 0 || !rate || !balance) return { ...item, lastAccrualDate: today };
          const interest = calcDailyInterest(balance, rate) * days;
          return { ...item, accruedInterest: Math.round(((Number(item.accruedInterest) || 0) + interest) * 100) / 100, lastAccrualDate: today };
        };
        const newDebts = sp.debts.map(accrueItem);
        const newAccounts = sp.accounts.map((a: any) => a.type === 'credit' ? accrueItem(a) : a);
        const changed = JSON.stringify(newDebts) !== JSON.stringify(sp.debts) || JSON.stringify(newAccounts) !== JSON.stringify(sp.accounts);
        if (changed) {
          sp = { ...sp, debts: newDebts, accounts: newAccounts };
          await safeSet(K.spending, sp);
        }
      }
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
      const txData = migrateTax(await safeGet(K.tax, DEFAULT_TAX));
      const cc = await safeGet(K.customChallenges, []);
      setSpending(sp);
      setTax(txData);
      setCustomChallenges(cc);
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

  const saveSettings = async (next: any) => { setSettings(next); await safeSet(K.settings, next); };
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
  const saveSpending = async (next: any) => { setSpending(next); await safeSet(K.spending, next); };
  const saveTax = async (next: any) => { setTax(next); await safeSet(K.tax, next); };
  const saveCustomChallenges = async (next: any[]) => { setCustomChallenges(next); await safeSet(K.customChallenges, next); };
  const restDayChallenge = async (challengeId: string) => {
    const today = todayStr();
    const updated = customChallenges.map((c: any) => {
      if (c.id !== challengeId || c.lastActionDate === today) return c;
      return { ...c, restDates: [...(c.restDates || []).slice(-60), today], lastActionDate: today };
    });
    await saveCustomChallenges(updated);
    toast('Rest day noted — streak protected 😴');
  };
  // Functional updates so concurrent edits (categories/goals/other tx) aren't clobbered.
  const upsertTransaction = async (tx: any) => {
    let isEdit = false;
    let computed: any = null;
    setSpending((prev: any) => {
      const idx = prev.entries.findIndex((e: any) => e.id === tx.id);
      isEdit = idx >= 0;
      const oldTx = isEdit ? prev.entries[idx] : null;
      const nextEntries = isEdit
        ? prev.entries.map((e: any) => (e.id === tx.id ? tx : e))
        : [tx, ...prev.entries];
      // Adjust linked account balances
      let nextAccounts = [...prev.accounts];
      const applyDelta = (accounts: any[], accId: string, txType: string, amt: number, sign: 1 | -1) => {
        return accounts.map((a: any) => {
          if (a.id !== accId) return a;
          const raw = txType === 'out' ? (a.type === 'credit' ? amt : -amt) : amt;
          return { ...a, balance: Math.round((Number(a.balance) + sign * raw) * 100) / 100 };
        });
      };
      if (isEdit && oldTx?.accountId) nextAccounts = applyDelta(nextAccounts, oldTx.accountId, oldTx.type, oldTx.amount, -1);
      if (tx.accountId) nextAccounts = applyDelta(nextAccounts, tx.accountId, tx.type, tx.amount, 1);
      computed = { ...prev, entries: nextEntries, accounts: nextAccounts };
      return computed;
    });
    if (computed) await safeSet(K.spending, computed);
    toast(isEdit ? 'Transaction updated' : `${tx.type === 'in' ? 'Income' : 'Expense'} added`);
  };
  const deleteTransaction = async (id: string) => {
    let removed: any = null;
    let computed: any = null;
    setSpending((prev: any) => {
      removed = prev.entries.find((e: any) => e.id === id);
      computed = { ...prev, entries: prev.entries.filter((e: any) => e.id !== id) };
      return computed;
    });
    if (computed) await safeSet(K.spending, computed);
    // Undo restores only the affected transaction — categories/goals/other edits are safe.
    undoToast('Transaction deleted', () => {
      if (!removed) return;
      setSpending((prev: any) => {
        if (prev.entries.some((e: any) => e.id === removed.id)) return prev;
        const next = { ...prev, entries: [removed, ...prev.entries] };
        void safeSet(K.spending, next);
        return next;
      });
    });
  };

  const upsertAccount = async (acc: any) => {
    let computed: any = null;
    setSpending((prev: any) => {
      const idx = prev.accounts.findIndex((a: any) => a.id === acc.id);
      const next = { ...prev, accounts: idx >= 0 ? prev.accounts.map((a: any) => a.id === acc.id ? acc : a) : [...prev.accounts, acc] };
      computed = next;
      return next;
    });
    if (computed) await safeSet(K.spending, computed);
  };
  const deleteAccount = async (id: string) => {
    let computed: any = null;
    setSpending((prev: any) => {
      const next = { ...prev, accounts: prev.accounts.filter((a: any) => a.id !== id) };
      computed = next;
      return next;
    });
    if (computed) await safeSet(K.spending, computed);
    toast('Account removed');
  };
  const upsertDebt = async (debt: any) => {
    let computed: any = null;
    setSpending((prev: any) => {
      const idx = prev.debts.findIndex((d: any) => d.id === debt.id);
      const next = { ...prev, debts: idx >= 0 ? prev.debts.map((d: any) => d.id === debt.id ? debt : d) : [...prev.debts, debt] };
      computed = next;
      return next;
    });
    if (computed) await safeSet(K.spending, computed);
  };
  const deleteDebt = async (id: string) => {
    let computed: any = null;
    setSpending((prev: any) => {
      const next = { ...prev, debts: prev.debts.filter((d: any) => d.id !== id) };
      computed = next;
      return next;
    });
    if (computed) await safeSet(K.spending, computed);
  };
  const upsertOwed = async (item: any) => {
    let computed: any = null;
    setSpending((prev: any) => {
      const idx = prev.owed.findIndex((o: any) => o.id === item.id);
      const next = { ...prev, owed: idx >= 0 ? prev.owed.map((o: any) => o.id === item.id ? item : o) : [...prev.owed, item] };
      computed = next;
      return next;
    });
    if (computed) await safeSet(K.spending, computed);
  };
  const deleteOwed = async (id: string) => {
    let computed: any = null;
    setSpending((prev: any) => {
      const next = { ...prev, owed: prev.owed.filter((o: any) => o.id !== id) };
      computed = next;
      return next;
    });
    if (computed) await safeSet(K.spending, computed);
  };
  const doTransfer = async ({ tx, creditAccountId, amount: payAmt }: any) => {
    let computed: any = null;
    setSpending((prev: any) => {
      const nextAccounts = prev.accounts.map((a: any) =>
        a.id === creditAccountId ? { ...a, balance: Math.max(0, (Number(a.balance) || 0) - payAmt) } : a,
      );
      const next = { ...prev, accounts: nextAccounts, entries: [tx, ...prev.entries] };
      computed = next;
      return next;
    });
    if (computed) await safeSet(K.spending, computed);
    toast(`Payment of ${fmtMoney(payAmt)} applied`);
  };

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
      const ticked = tickChallengesForSubject(customChallenges, subject);
      if (ticked.some((c: any, i: number) => c !== customChallenges[i])) await saveCustomChallenges(ticked);
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
    if (newCompleted >= target && target > 0) {
      const ticked = tickChallengesForSubject(customChallenges, subject);
      if (ticked.some((c: any, i: number) => c !== customChallenges[i])) await saveCustomChallenges(ticked);
    }
    if (target > 0 && (daily.completed[subject] || 0) < target && newCompleted >= target) celebrate();
    else haptic();
    const name = settings.subjects[subject]?.name || 'time';
    undoToast(`Logged ${minutes}m of ${name}`, async () => { await saveDaily(prevDaily); await saveTotals(prevTotals); await saveStreaks(prevStreaks); });
  };

  const resetDay = async (opts: { subjects?: boolean; macros?: boolean; body?: boolean; workout?: boolean; status?: boolean; spending?: boolean }) => {
    const prevDaily = daily, prevTotals = totals, prevMeals = meals, prevWorkout = workout, prevSpending = spending, prevBody = body;
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
    if (opts.spending) {
      const next = { ...spending, entries: spending.entries.filter((e: any) => e.date !== today) };
      await saveSpending(next);
    }
    if (opts.body) {
      const next = { ...body, entries: body.entries.filter((e: any) => e.date !== today) };
      await saveBody(next);
    }

    undoToast('Day reset', async () => {
      await saveDaily(prevDaily); await saveTotals(prevTotals); await saveMeals(prevMeals); await saveWorkout(prevWorkout);
      if (opts.spending) await saveSpending(prevSpending);
      if (opts.body) await saveBody(prevBody);
    });
  };

  const fullReset = async (opts: { study?: boolean; nutrition?: boolean; body?: boolean; workout?: boolean; spending?: boolean; journal?: boolean; plans?: boolean; settings?: boolean }) => {
    if (opts.study) {
      const blank = Object.fromEntries(Object.keys(daily.completed || {}).map((k) => [k, 0]));
      await saveDaily({ ...daily, completed: blank, bonus: blank });
      await saveTotals({});
      await safeSet(K.streaks, {});
      setStreaks({});
      await safeSet(K.checkins, {});
      setCheckins({});
      await safeSet(K.activity, {});
      setActivity({});
    }
    if (opts.nutrition) {
      const cleared = { presets: [], log: {}, entries: {}, presetsMicrosMigrated: true };
      await saveMeals(cleared);
    }
    if (opts.body) {
      await saveBody({ entries: [] });
    }
    if (opts.workout) {
      const cleared = { ...workout, logs: {} };
      await saveWorkout(cleared);
    }
    if (opts.spending) {
      const cleared = { ...DEFAULT_SPENDING, categories: spending.categories };
      await saveSpending(cleared);
    }
    if (opts.journal) {
      await saveJournal({});
    }
    if (opts.plans) {
      await savePlans({});
    }
    if (opts.settings) {
      await saveSettings(DEFAULT_SETTINGS);
    }
    toast('Data cleared — reload if anything looks off.');
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

  const isDark = settings.theme === 'dark';

  return (
    <div className={`app${isDark ? ' dark' : ''}`}>
      <GlobalStyles />
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'inherit' } }} />
      <div className="content">
        <Header date={todayStr()} onSettings={() => setModal({ type: 'settings' })} />

        {tab === 'today' && (
          <TodayTab
            settings={settings} daily={daily} totals={totals} streaks={streaks} meals={meals} workout={workout} checkins={checkins}
            customChallenges={customChallenges}
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
            onRestDay={restDayChallenge}
            onManageChallenges={() => setModal({ type: 'customChallenges' })}
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
        {tab === 'money' && (
          <MoneyTab
            spending={spending}
            onAdd={(type: 'in' | 'out') => setModal({ type: 'addTransaction', defaultType: type })}
            onEdit={(entry: any) => setModal({ type: 'addTransaction', entry })}
            onDelete={deleteTransaction}
            onBudget={() => setModal({ type: 'moneyGoals' })}
            onCategories={() => setModal({ type: 'moneyCategories' })}
            onAddAccount={() => setModal({ type: 'addAccount' })}
            onEditAccount={(account: any) => setModal({ type: 'addAccount', account })}
            onAddDebt={() => setModal({ type: 'addDebt' })}
            onEditDebt={(debt: any) => setModal({ type: 'addDebt', debt })}
            onAddOwed={() => setModal({ type: 'addOwed' })}
            onEditOwed={(item: any) => setModal({ type: 'addOwed', item })}
            onTransfer={() => setModal({ type: 'accountTransfer' })}
            onEditIncome={() => setModal({ type: 'incomePlanner' })}
            tax={tax}
            onTaxModal={() => setModal({ type: 'taxModal' })}
            onCustomChallenges={() => setModal({ type: 'customChallenges' })}
            onSaveLayout={(order: string[]) => saveSpending({ ...spending, sectionOrder: order })}
          />
        )}
        {tab === 'journal' && (
          <JournalTab journal={journal} onSave={saveJournal} settings={settings} />
        )}
        {tab === 'history' && (
          <HistoryTab
            settings={settings} totals={totals} workout={workout} meals={meals} body={body}
            activity={activity} streaks={streaks} checkins={checkins} spending={spending}
            onSelectDay={(date: string) => setModal({ type: 'dayDetail', date })}
          />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      {modal?.type === 'settings' && <SettingsModal settings={settings} body={body} onSave={saveSettings} onClose={() => setModal(null)} onEditSubject={(k: string) => setModal({ type: 'editSubject', key: k })} onAddSubject={() => setModal({ type: 'editSubject', key: null })} onChallenge={() => setModal({ type: 'challenge' })} onCustomChallenges={() => setModal({ type: 'customChallenges' })} onExportImport={() => setModal({ type: 'exportImport' })} onResetDay={() => setModal({ type: 'resetDay' })} onSyncTransfer={() => setModal({ type: 'syncTransfer' })} />}
      {modal?.type === 'syncTransfer' && <AccountModal onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'resetDay' && <ResetDayModal onReset={resetDay} onFullReset={fullReset} onClose={() => setModal({ type: 'settings' })} />}
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
      {modal?.type === 'dayDetail' && <DayDetailModal date={modal.date} settings={settings} totals={totals} workout={workout} meals={meals} body={body} activity={activity} checkins={checkins} spending={spending} customChallenges={customChallenges} onSaveMeals={saveMeals} onSaveWorkout={saveWorkout} onSaveTotals={saveTotals} onSaveCheckins={saveCheckins} onClose={() => setModal(null)} />}
      {modal?.type === 'addTransaction' && <AddTransactionModal entry={modal.entry} defaultType={modal.defaultType} spending={spending} onSave={upsertTransaction} onDelete={deleteTransaction} onClose={() => setModal(null)} />}
      {modal?.type === 'moneyGoals' && <MoneyGoalsModal spending={spending} onSave={saveSpending} onClose={() => setModal(null)} />}
      {modal?.type === 'moneyCategories' && <MoneyCategoriesModal spending={spending} onSave={saveSpending} onClose={() => setModal(null)} />}
      {modal?.type === 'addAccount' && <AddAccountModal account={modal.account} onSave={upsertAccount} onDelete={deleteAccount} onClose={() => setModal(null)} />}
      {modal?.type === 'addDebt' && <AddDebtModal debt={modal.debt} onSave={upsertDebt} onDelete={deleteDebt} onClose={() => setModal(null)} />}
      {modal?.type === 'addOwed' && <AddOwedModal item={modal.item} onSave={upsertOwed} onDelete={deleteOwed} onClose={() => setModal(null)} />}
      {modal?.type === 'accountTransfer' && <AccountTransferModal spending={spending} onSave={doTransfer} onClose={() => setModal(null)} />}
      {modal?.type === 'incomePlanner' && <IncomePlannerModal spending={spending} onSave={saveSpending} onClose={() => setModal(null)} />}
      {modal?.type === 'taxModal' && <TaxModal tax={tax} spending={spending} onSave={saveTax} onClose={() => setModal(null)} />}
      {modal?.type === 'customChallenges' && <CustomChallengesModal challenges={customChallenges} settings={settings} onSave={saveCustomChallenges} onClose={() => setModal(null)} />}
      {modal?.type === 'exportImport' && <ExportImportModal data={{ settings, totals, body, workout, meals, plans, streaks, journal, challengeHistory, busyPresets, weeklyAck, spending, tax, customChallenges }} onImport={async (d: any) => {
        if (d.spending) { const sp = migrateSpending(d.spending); setSpending(sp); await safeSet(K.spending, sp); }
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
        if (d.activity) { setActivity(d.activity); await safeSet(K.activity, d.activity); }
        if (d.checkins) { setCheckins(d.checkins); await safeSet(K.checkins, d.checkins); }
        if (d.tax) { const tx = migrateTax(d.tax); setTax(tx); await safeSet(K.tax, tx); }
        if (d.customChallenges) { setCustomChallenges(d.customChallenges); await safeSet(K.customChallenges, d.customChallenges); }
        toast.success('Data restored successfully.');
        setModal(null);
      }} onClose={() => setModal(null)} />}
      {showWeekly && <WeeklyReviewModal settings={settings} totals={totals} body={body} workout={workout} meals={meals} streaks={streaks} onAck={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} onSkip={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} />}
    </div>
  );
}
