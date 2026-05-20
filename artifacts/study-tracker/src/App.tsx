import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun, Home, Footprints, Check, Plus, Settings as SettingsIcon, X, Music, Languages, Shield,
  Award, Save, Calendar as CalIcon, Activity, Dumbbell, Apple, ListChecks, ChevronRight, ChevronDown, ChevronLeft,
  TrendingUp, TrendingDown, Edit3, Trash2, Flame, ArrowUp, ArrowDown, Minus, Target, BookOpen, Clock, Moon, Coffee,
  Download, Upload, History, Repeat, Zap, Play
} from 'lucide-react';

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
};

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

// ════════════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ════════════════════════════════════════════════════════════════════════════════
const SUBJECTS_DEFAULT: Record<string, any> = {
  spanish: { name: 'Spanish', icon: 'languages', accent: '#B8460E', tools: 'Duolingo + Babbel + Input', target: 95, weeklyDays: 6, deadline: '2026-12-31', archived: false },
  guitar: { name: 'Guitar', icon: 'music', accent: '#4A6741', tools: 'Simply Guitar', target: 30, weeklyDays: 5, deadline: '2026-12-31', archived: false },
  cysa: { name: 'CySA+', icon: 'shield', accent: '#3B5C6B', tools: 'Jason Dion · Udemy', target: 45, weeklyDays: 7, deadline: '2026-06-16', archived: false },
  running: { name: 'Running', icon: 'activity', accent: '#8E4585', tools: 'Easy pace, 25-30 min', target: 28, weeklyDays: 3, deadline: '2026-12-31', archived: false },
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
  { day: 0, name: 'Rest', rest: true, exercises: [] },
  { day: 1, name: 'Push A · Upper Chest + Shoulders', rest: false, exercises: [
    { name: 'Incline Barbell Press', sets: 4, reps: '6-8', weight: '' },
    { name: 'Standing Overhead Press', sets: 4, reps: '6-8', weight: '' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10', weight: '' },
    { name: 'Lateral Raise', sets: 4, reps: '12-15', weight: '' },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12', weight: '' },
    { name: 'Face Pulls', sets: 3, reps: '15-20', weight: '' },
  ]},
  { day: 2, name: 'Pull A · Lat Width', rest: false, exercises: [
    { name: 'Pull-ups (or Lat Pulldown)', sets: 4, reps: '6-10', weight: '' },
    { name: 'Wide-Grip Lat Pulldown', sets: 3, reps: '10-12', weight: '' },
    { name: 'Chest-Supported Row', sets: 4, reps: '8-10', weight: '' },
    { name: 'Straight-Arm Pulldown', sets: 3, reps: '12-15', weight: '' },
    { name: 'Hammer Curl', sets: 3, reps: '10-12', weight: '' },
    { name: 'Rear Delt Flye', sets: 3, reps: '15-20', weight: '' },
  ]},
  { day: 3, name: 'Legs A · Quad-Dominant', rest: false, exercises: [
    { name: 'Back Squat', sets: 4, reps: '6-8', weight: '' },
    { name: 'Leg Press', sets: 4, reps: '10-12', weight: '' },
    { name: 'Walking Lunges', sets: 3, reps: '10 each', weight: '' },
    { name: 'Leg Extension', sets: 3, reps: '12-15', weight: '' },
    { name: 'Lying Leg Curl', sets: 3, reps: '10-12', weight: '' },
    { name: 'Standing Calf Raise', sets: 4, reps: '12-15', weight: '' },
  ]},
  { day: 4, name: 'Pull B · Back Thickness + Arms', rest: false, exercises: [
    { name: 'Pull-ups (weighted if possible)', sets: 4, reps: '5-8', weight: '' },
    { name: 'Barbell Row', sets: 4, reps: '6-8', weight: '' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12', weight: '' },
    { name: 'Barbell Curl', sets: 4, reps: '8-10', weight: '' },
    { name: 'Incline Dumbbell Curl', sets: 3, reps: '10-12', weight: '' },
    { name: 'Face Pulls', sets: 3, reps: '15-20', weight: '' },
  ]},
  { day: 5, name: 'Legs B · Posterior Chain', rest: false, exercises: [
    { name: 'Romanian Deadlift', sets: 4, reps: '6-8', weight: '' },
    { name: 'Hip Thrust', sets: 4, reps: '8-10', weight: '' },
    { name: 'Bulgarian Split Squat', sets: 3, reps: '8-10 each', weight: '' },
    { name: 'Glute Bridge (single leg)', sets: 3, reps: '12 each', weight: '' },
    { name: 'Seated Leg Curl', sets: 3, reps: '10-12', weight: '' },
    { name: 'Seated Calf Raise', sets: 4, reps: '15-20', weight: '' },
  ]},
  { day: 6, name: 'Shoulders + Arms Specialization', rest: false, exercises: [
    { name: 'Seated Dumbbell Press', sets: 4, reps: '8-10', weight: '' },
    { name: 'Cable Lateral Raise', sets: 4, reps: '12-15', weight: '' },
    { name: 'Rear Delt Cable Flye', sets: 3, reps: '15-20', weight: '' },
    { name: 'Close-Grip Bench Press', sets: 3, reps: '8-10', weight: '' },
    { name: 'EZ-Bar Curl', sets: 3, reps: '10-12', weight: '' },
    { name: 'Cable Tricep Overhead Ext.', sets: 3, reps: '12-15', weight: '' },
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
  if (!s) return 0;
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
        background: none; border: none; padding: 8px 12px; cursor: pointer; display: flex;
        flex-direction: column; align-items: center; gap: 4px; color: #6B6457; font-family: inherit; font-size: 11px;
        border-radius: 8px; transition: all 0.15s;
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
    { key: 'workout', label: 'Workout', icon: Dumbbell },
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
function TodayTab({ settings, daily, totals, streaks, meals, workout, onWake, onStatus, onLogTime, onBusy, onLogMeal, onScheduleStart }: any) {
  const subjectKeys = settings.subjectOrder.filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived);
  const todayMacros = meals.log[todayStr()] || { protein: 0, carbs: 0, fat: 0, calories: 0 };

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 18 }}>A day in your study.</h1>
      {!daily.wakeLogged ? (
        <WakeCheckIn plannedWake={daily.plannedWake} onLog={onWake} />
      ) : !daily.scheduleStarted ? (
        <ScheduleStartCard daily={daily} defaultOffset={settings.scheduleStartOffsetMin} onStart={onScheduleStart} />
      ) : (
        <>
          <StatusBar daily={daily} onBusy={onBusy} onHome={() => onStatus('home', null)} />
          <Schedule settings={settings} daily={daily} onLog={onLogTime} subjectKeys={subjectKeys} />
          <Progress settings={settings} totals={totals} daily={daily} streaks={streaks} subjectKeys={subjectKeys} onLogExtra={onLogTime} />
          <ChallengeCard settings={settings} workout={workout} />
          <MacrosCard targets={settings.macroTargets} totals={todayMacros} onLog={onLogMeal} />
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

function StatusBar({ daily, onBusy, onHome }: any) {
  const isBusy = daily.status === 'busy';
  return (
    <div className="card between card-tight">
      <div>
        <div className="h2" style={{ marginBottom: 4 }}>Right now</div>
        <div className="row" style={{ gap: 8 }}>
          {isBusy ? <Footprints size={16} color="#C8932E" /> : <Home size={16} color="#4A6741" />}
          <span style={{ fontSize: 15, fontWeight: 500 }}>
            {isBusy ? `Busy until ${fmtTime(daily.busyUntil)}` : 'Home & available'}
          </span>
        </div>
      </div>
      {isBusy ? <button className="tap active" onClick={onHome}>I'm back</button> : <button className="tap" onClick={onBusy}>I'm busy</button>}
    </div>
  );
}

function buildSchedule(settings: any, daily: any, subjectKeys: string[]) {
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
    if (!s || s.archived) continue;
    const isRest = (s.weeklyDays < 7) && (dow === 0);
    if (isRest) continue;
    const remaining = Math.max(0, s.target - (daily.completed[k] || 0));
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

function Schedule({ settings, daily, onLog, subjectKeys }: any) {
  const blocks = useMemo(() => buildSchedule(settings, daily, subjectKeys), [settings, daily, subjectKeys]);

  if (blocks.length === 0) {
    return (
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Today's plan</div>
        <p className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Award size={14} /> All done for today. Anything extra counts as bonus.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="h2" style={{ marginBottom: 10, paddingLeft: 4 }}>Today's plan</div>
      {blocks.map((b: any, i: number) => {
        const subj = settings.subjects[b.subject];
        const Icon = ICON_MAP[subj.icon] || Languages;
        const done = (daily.completed[b.subject] || 0) >= subj.target;
        return (
          <div key={i} className={`block ${done ? 'done' : ''}`} onClick={() => onLog(b.subject)} style={{ cursor: 'pointer' }}>
            <div className="icon-wrap" style={{ background: subj.accent }}>
              <Icon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="between">
                <div style={{ fontSize: 15, fontWeight: 600 }}>{subj.name}</div>
                <div className="mono tiny muted">{fmtTime(b.start)}</div>
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

function Progress({ settings, totals, daily, streaks, subjectKeys, onLogExtra }: any) {
  return (
    <div className="card">
      <div className="h2" style={{ marginBottom: 14 }}>Progress</div>
      {subjectKeys.map((k: string) => {
        const subj = settings.subjects[k];
        const Icon = ICON_MAP[subj.icon] || Languages;
        const totalDone = (totals[k] || 0) + (daily.completed[k] || 0);
        const expected = expectedTotal(k, settings);
        const target = targetTotalByDeadline(k, settings);
        const pct = Math.min(100, (totalDone / Math.max(target, 1)) * 100);
        const expectedPct = Math.min(100, (expected / Math.max(target, 1)) * 100);
        const diff = totalDone - expected;
        const perDayAvg = subj.target * (subj.weeklyDays / 7);
        const daysOff = Math.abs(diff) / Math.max(perDayAvg, 1);

        let status, sColor, sBg;
        if (Math.abs(diff) < perDayAvg * 0.5) { status = 'on pace'; sColor = '#4A6741'; sBg = '#E8EBE0'; }
        else if (diff > 0) { status = `${daysOff.toFixed(1)}d ahead`; sColor = '#4A6741'; sBg = '#E8EBE0'; }
        else { status = `${daysOff.toFixed(1)}d behind`; sColor = '#B8460E'; sBg = '#F5E1D5'; }

        const streak = streaks[k]?.current || 0;
        const todayDone = daily.completed[k] || 0;
        const todayBonus = (daily.bonus?.[k]) || 0;
        const isComplete = todayDone >= subj.target;

        return (
          <div key={k} style={{ marginBottom: 16 }}>
            <div className="between" style={{ marginBottom: 6 }}>
              <div className="row" style={{ gap: 8 }}>
                <Icon size={14} color={subj.accent} />
                <span className="h3">{subj.name}</span>
                {isComplete && <Check size={14} color="#4A6741" />}
                {streak > 1 && <span className="streak-flame"><Flame size={11} /> {streak}d</span>}
              </div>
              <span className="pill" style={{ background: sBg, color: sColor }}>{status}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%`, background: subj.accent }} />
              <div className="progress-marker" style={{ left: `${expectedPct}%` }} />
            </div>
            <div className="between" style={{ marginTop: 6 }}>
              <span className="mono muted tiny">
                Today {todayDone}m{todayBonus > 0 && <span style={{ color: '#4A6741' }}> +{todayBonus}m bonus</span>} · {Math.round(totalDone / 60 * 10) / 10}h total
              </span>
              <button onClick={() => onLogExtra(k)} className="tap" style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'JetBrains Mono', borderColor: subj.accent, color: subj.accent }}>
                + log
              </button>
            </div>
          </div>
        );
      })}
      <div className="muted tiny" style={{ lineHeight: 1.4, marginTop: 4 }}>
        Notch shows where you should be today. Tap "+ log" anytime to add time.
      </div>
    </div>
  );
}

function MacrosCard({ targets, totals, onLog }: any) {
  const items = [
    { key: 'protein', label: 'Protein', unit: 'g', primary: true, color: '#B8460E' },
    { key: 'calories', label: 'Calories', unit: '', color: '#3B5C6B' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: '#4A6741' },
    { key: 'fat', label: 'Fat', unit: 'g', color: '#C8932E' },
  ];
  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 12 }}>
        <div className="h2">Today's macros</div>
        <button className="tap" onClick={onLog} style={{ padding: '6px 12px', fontSize: 12 }}>
          <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log meal
        </button>
      </div>
      {items.map(it => {
        const t = targets[it.key];
        const c = totals[it.key] || 0;
        const pct = Math.min(100, (c / Math.max(t, 1)) * 100);
        return (
          <div key={it.key} style={{ marginBottom: 10 }}>
            <div className="between" style={{ marginBottom: 4 }}>
              <span className="small" style={{ fontWeight: it.primary ? 600 : 400 }}>{it.label}{it.primary && ' ★'}</span>
              <span className="mono tiny muted">{Math.round(c)} / {t}{it.unit}</span>
            </div>
            <div className="progress-bar" style={{ height: 4 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: it.color }} />
            </div>
          </div>
        );
      })}
      <div className="muted tiny" style={{ lineHeight: 1.4, marginTop: 4 }}>★ Protein is your priority. Hit that first.</div>
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
// WORKOUT TAB
// ════════════════════════════════════════════════════════════════════════════════
function WorkoutTab({ workout, onLogWorkout, onEditSplit, onSaveWorkout, settings }: any) {
  const today = dayOfWeek();
  const mode = workout.mode || 'sequence';
  let todayWorkout: any;
  let todayWorkoutIdx: number;
  if (mode === 'calendar') {
    todayWorkout = workout.split.find((w: any) => w.day === today) || workout.split[0];
    todayWorkoutIdx = workout.split.indexOf(todayWorkout);
  } else {
    const nonRestDays = workout.split.filter((d: any) => !d.rest);
    const seqPos = workout.sequencePosition || 1;
    const seqIdx = ((seqPos - 1) % nonRestDays.length);
    todayWorkout = nonRestDays[seqIdx];
    todayWorkoutIdx = workout.split.indexOf(todayWorkout);
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

  const advanceSequence = async () => {
    const nonRestDays = workout.split.filter((d: any) => !d.rest);
    const next = ((workout.sequencePosition || 1) % nonRestDays.length) + 1;
    await onSaveWorkout({ ...workout, sequencePosition: next });
  };

  return (
    <>
      <h1 className="h1" style={{ marginBottom: 6 }}>Today's lift.</h1>
      <div className="between" style={{ marginBottom: 14 }}>
        <span className="muted tiny" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {mode === 'sequence' ? `Sequence mode · workout ${workout.sequencePosition || 1}` : 'Calendar mode'}
        </span>
        <button onClick={toggleMode} className="tap" style={{ padding: '4px 10px', fontSize: 11 }}>
          <Repeat size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Switch to {mode === 'sequence' ? 'calendar' : 'sequence'}
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
        {workout.split.map((day: any, i: number) => (
          <div key={i} className="between" style={{ padding: '8px 0', borderBottom: i < workout.split.length - 1 ? '1px solid #E4DCC8' : 'none', opacity: (mode === 'calendar' && day.day === today) || (mode === 'sequence' && day === todayWorkout) ? 1 : 0.7 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="mono tiny muted">
                {mode === 'calendar' ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.day] : day.rest ? 'REST' : `D${workout.split.filter((d: any) => !d.rest).indexOf(day) + 1}`}
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
function HistoryTab({ settings, totals, workout, meals, body, onSelectDay }: any) {
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
            const isToday = d === todayStr();
            const isFuture = diffDays(d) > 0;
            return (
              <button
                key={d}
                onClick={() => !isFuture && onSelectDay(d)}
                disabled={isFuture}
                style={{
                  padding: '6px 0',
                  background: isToday ? '#1A1A2E' : (hasWorkout || hasMeal || hasMeasurement) ? '#FBF7EE' : 'transparent',
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
                </div>
              </button>
            );
          })}
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <span className="tiny muted"><span className="swatch" style={{ background: '#3B5C6B' }} />Workout</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#4A6741' }} />Meals</span>
          <span className="tiny muted"><span className="swatch" style={{ background: '#B8460E' }} />Measurement</span>
        </div>
      </div>

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

      <p className="muted tiny" style={{ textAlign: 'center', marginTop: 8 }}>Tap any past day for the full breakdown.</p>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════════════════════════════════════════
function ModalShell({ title, onClose, children, icon = null, color = '#1A1A2E' }: any) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}

function DayDetailModal({ date, settings, totals, workout, meals, body, onClose }: any) {
  const dayMeals = meals.log?.[date];
  const dayWorkout = workout.logs?.[date];
  const dayMeasurement = body.entries?.find((e: any) => e.date === date);

  return (
    <ModalShell title={fmtDate(date)} onClose={onClose} icon={<History size={18} color="#6B6457" />}>
      <div className="h2" style={{ marginBottom: 8 }}>Nutrition</div>
      {dayMeals ? (
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div><div className="mono tiny muted">PROTEIN</div><div className="h3" style={{ color: '#B8460E' }}>{Math.round(dayMeals.protein || 0)}g</div></div>
            <div><div className="mono tiny muted">CALORIES</div><div className="h3">{Math.round(dayMeals.calories || 0)}</div></div>
            <div><div className="mono tiny muted">CARBS</div><div className="h3">{Math.round(dayMeals.carbs || 0)}g</div></div>
            <div><div className="mono tiny muted">FAT</div><div className="h3">{Math.round(dayMeals.fat || 0)}g</div></div>
          </div>
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

function LogTimeModal({ subject, settings, daily, onLog, onClose }: any) {
  const s = settings.subjects[subject];
  const Icon = ICON_MAP[s.icon] || Languages;
  const done = daily.completed[subject] || 0;
  const remaining = Math.max(0, s.target - done);
  const [mins, setMins] = useState(remaining > 0 ? remaining : s.target);

  return (
    <ModalShell title={s.name} onClose={onClose} icon={<div className="icon-wrap" style={{ background: s.accent, width: 32, height: 32 }}><Icon size={16} /></div>}>
      <div className="muted small" style={{ marginBottom: 14 }}>
        {s.tools} · Today: <span className="mono">{done} / {s.target} min</span>
      </div>
      <label>Minutes studied</label>
      <input type="number" min="1" value={mins} onChange={(e) => setMins(parseInt(e.target.value) || 0)} style={{ marginBottom: 12 }} />
      <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[15, 30, 45, 60].map(m => <button key={m} className={`tap ${mins === m ? 'active' : ''}`} onClick={() => setMins(m)}>{m}m</button>)}
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={() => onLog(mins)}>
        <Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Log {mins} min
      </button>
    </ModalShell>
  );
}

function BusyModal({ onConfirm, onClose }: any) {
  const [mins, setMins] = useState(60);
  return (
    <ModalShell title="Stepping out" onClose={onClose} icon={<Footprints size={18} color="#C8932E" />}>
      <p className="muted small" style={{ marginBottom: 14 }}>I'll shift remaining blocks. Tap "I'm back" when you return.</p>
      <label>Roughly how long?</label>
      <input type="number" value={mins} onChange={(e) => setMins(parseInt(e.target.value) || 0)} style={{ marginBottom: 12 }} />
      <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[30, 60, 90, 120, 180].map(m => <button key={m} className={`tap ${mins === m ? 'active' : ''}`} onClick={() => setMins(m)}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>)}
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={() => onConfirm(mins)}>Set busy</button>
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

function BodyGoalsModal({ settings, onSave, onClose }: any) {
  const [goals, setGoals] = useState(settings.bodyGoals);
  const set = (k: string, patch: any) => setGoals({ ...goals, [k]: { ...goals[k], ...patch } });

  return (
    <ModalShell title="Body targets" onClose={onClose} icon={<Target size={18} color="#B8460E" />}>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Set target numbers if you want progress bars. Direction is for trend coloring.
      </p>
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
  const initial = workout.logs[today] || { name: day.name, exercises: day.exercises.map((ex: any) => ({ name: ex.name, sets: Array(ex.sets).fill(0).map(() => ({ weight: '', reps: '', rpe: '' })) })) };
  const [data, setData] = useState(initial);

  const setSet = (exIdx: number, setIdx: number, field: string, value: string) => {
    const next = { ...data, exercises: data.exercises.map((e: any, i: number) => i !== exIdx ? e : { ...e, sets: e.sets.map((s: any, j: number) => j !== setIdx ? s : { ...s, [field]: value }) }) };
    setData(next);
  };

  return (
    <ModalShell title={day.name} onClose={onClose} icon={<Dumbbell size={18} color="#3B5C6B" />}>
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

function LogMealModal({ meals, settings, onSave, onClose }: any) {
  const [mode, setMode] = useState('preset');
  const [newPreset, setNewPreset] = useState({ name: '', protein: '', carbs: '', fat: '', calories: '', source: '' });
  const [manual, setManual] = useState({ protein: '', carbs: '', fat: '', calories: '' });
  const today = todayStr();
  const todayMacros = meals.log[today] || { protein: 0, carbs: 0, fat: 0, calories: 0 };

  const logPreset = async (p: any) => {
    const next = { protein: todayMacros.protein + p.protein, carbs: todayMacros.carbs + p.carbs, fat: todayMacros.fat + p.fat, calories: todayMacros.calories + p.calories };
    await onSave({ ...meals, log: { ...meals.log, [today]: next } });
    onClose();
  };
  const logManual = async () => {
    const next = {
      protein: todayMacros.protein + (parseFloat(manual.protein) || 0),
      carbs: todayMacros.carbs + (parseFloat(manual.carbs) || 0),
      fat: todayMacros.fat + (parseFloat(manual.fat) || 0),
      calories: todayMacros.calories + (parseFloat(manual.calories) || 0),
    };
    await onSave({ ...meals, log: { ...meals.log, [today]: next } });
    onClose();
  };
  const addPreset = async () => {
    const p = { id: 'p' + Date.now(), name: newPreset.name, protein: parseFloat(newPreset.protein) || 0, carbs: parseFloat(newPreset.carbs) || 0, fat: parseFloat(newPreset.fat) || 0, calories: parseFloat(newPreset.calories) || 0, source: newPreset.source };
    await onSave({ ...meals, presets: [...meals.presets, p] });
    setMode('preset');
    setNewPreset({ name: '', protein: '', carbs: '', fat: '', calories: '', source: '' });
  };
  const removePreset = async (id: string) => {
    await onSave({ ...meals, presets: meals.presets.filter((p: any) => p.id !== id) });
  };

  return (
    <ModalShell title="Log meal" onClose={onClose} icon={<Apple size={18} color="#4A6741" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className={`tap ${mode === 'preset' ? 'active' : ''}`} onClick={() => setMode('preset')}>Presets</button>
        <button className={`tap ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>Manual</button>
        <button className={`tap ${mode === 'add' ? 'active' : ''}`} onClick={() => setMode('add')}>+ New preset</button>
      </div>

      {mode === 'preset' && (
        <>
          <div className="muted tiny" style={{ marginBottom: 10 }}>Tap a meal to log it.</div>
          {meals.presets.length === 0 && <p className="muted small" style={{ marginBottom: 10 }}>No presets yet — tap "+ New preset" to add some.</p>}
          {meals.presets.map((p: any) => (
            <div key={p.id} className="card" style={{ padding: 12, marginBottom: 8, cursor: 'pointer' }} onClick={() => logPreset(p)}>
              <div className="between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600 }}>{p.name}</div>
                  {p.source && <div className="muted tiny">{p.source}</div>}
                  <div className="mono tiny muted" style={{ marginTop: 4 }}>
                    {p.protein}p · {p.carbs}c · {p.fat}f · {p.calories}cal
                  </div>
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
          <label>Protein (g)</label>
          <input type="number" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} style={{ marginBottom: 10 }} />
          <label>Carbs (g)</label>
          <input type="number" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} style={{ marginBottom: 10 }} />
          <label>Fat (g)</label>
          <input type="number" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} style={{ marginBottom: 10 }} />
          <label>Calories</label>
          <input type="number" value={manual.calories} onChange={(e) => setManual({ ...manual, calories: e.target.value })} style={{ marginBottom: 14 }} />
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

function SettingsModal({ settings, onSave, onClose, onEditSubject, onAddSubject, onChallenge, onExportImport }: any) {
  const [draft, setDraft] = useState(settings);
  const update = (patch: any) => setDraft({ ...draft, ...patch });

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
      {draft.subjectOrder.map((k: string) => {
        const s = draft.subjects[k];
        if (!s) return null;
        const Icon = ICON_MAP[s.icon] || Languages;
        return (
          <div key={k} className="between" style={{ padding: '10px 0', borderBottom: '1px solid #E4DCC8' }}>
            <div className="row" style={{ gap: 10 }}>
              <div className="icon-wrap" style={{ background: s.accent, width: 28, height: 28 }}><Icon size={14} /></div>
              <div>
                <div className="small" style={{ fontWeight: 600, opacity: s.archived ? 0.5 : 1 }}>{s.name}</div>
                <div className="mono tiny muted">{s.target}min/day · {s.weeklyDays}x/wk{s.archived ? ' · archived' : ''}</div>
              </div>
            </div>
            <button onClick={() => onEditSubject(k)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}>
              <Edit3 size={14} />
            </button>
          </div>
        );
      })}
      <button className="tap" onClick={onAddSubject} style={{ width: '100%', marginTop: 10, marginBottom: 16 }}>
        <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add subject
      </button>

      <div className="h2" style={{ marginBottom: 8, marginTop: 8 }}>Macros</div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={draft.macroTargets.protein} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, protein: parseInt(e.target.value) || 0 } })} /></div>
        <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={draft.macroTargets.calories} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, calories: parseInt(e.target.value) || 0 } })} /></div>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={draft.macroTargets.carbs} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, carbs: parseInt(e.target.value) || 0 } })} /></div>
        <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={draft.macroTargets.fat} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, fat: parseInt(e.target.value) || 0 } })} /></div>
      </div>

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => { onSave(draft); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save settings
      </button>

      <button className="tap" onClick={onChallenge} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={14} color="#8E4585" />
        <span style={{ flex: 1 }}>60-day challenge{settings.challenge?.active && <span className="mono tiny muted" style={{ marginLeft: 6 }}>· active</span>}</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
      <button className="tap" onClick={onExportImport} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Download size={14} color="#3B5C6B" />
        <span style={{ flex: 1 }}>Backup / restore data</span>
        <ChevronRight size={14} color="#6B6457" />
      </button>
    </ModalShell>
  );
}

function EditSubjectModal({ subjectKey, settings, onSave, onClose }: any) {
  const isNew = !subjectKey;
  const existing = isNew ? null : settings.subjects[subjectKey];
  const [draft, setDraft] = useState(existing || { name: '', icon: 'target', accent: '#B8460E', tools: '', target: 30, weeklyDays: 5, deadline: '2026-12-31', archived: false });

  const handleSave = () => {
    const key = subjectKey || draft.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now().toString(36);
    const next = { ...settings, subjects: { ...settings.subjects, [key]: draft } };
    if (isNew) next.subjectOrder = [...settings.subjectOrder, key];
    onSave(next);
    onClose();
  };

  const handleDelete = () => {
    if (!subjectKey) return;
    const next = { ...settings, subjects: { ...settings.subjects, [subjectKey]: { ...existing, archived: !existing.archived } } };
    onSave(next);
    onClose();
  };

  const ICONS = ['languages', 'music', 'shield', 'book', 'target', 'dumbbell'];
  const COLORS = ['#B8460E', '#4A6741', '#3B5C6B', '#C8932E', '#8E4585', '#1A1A2E'];

  return (
    <ModalShell title={isNew ? 'New subject' : 'Edit subject'} onClose={onClose}>
      <label>Name</label>
      <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. CompTIA Security+" style={{ marginBottom: 12 }} />
      <label>Tools / source</label>
      <input type="text" value={draft.tools} onChange={(e) => setDraft({ ...draft, tools: e.target.value })} placeholder="e.g. Jason Dion · Udemy" style={{ marginBottom: 12 }} />
      <label>Icon</label>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {ICONS.map(ic => {
          const I = ICON_MAP[ic];
          return (
            <button key={ic} className={`tap ${draft.icon === ic ? 'active' : ''}`} onClick={() => setDraft({ ...draft, icon: ic })} style={{ padding: 8 }}>
              <I size={16} />
            </button>
          );
        })}
      </div>
      <label>Color</label>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => setDraft({ ...draft, accent: c })} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: draft.accent === c ? '3px solid #1A1A2E' : '1px solid #D4CCB8', cursor: 'pointer' }} />
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}><label>Daily (min)</label><input type="number" value={draft.target} onChange={(e) => setDraft({ ...draft, target: parseInt(e.target.value) || 0 })} /></div>
        <div style={{ flex: 1 }}><label>Days/week</label><input type="number" min="1" max="7" value={draft.weeklyDays} onChange={(e) => setDraft({ ...draft, weeklyDays: parseInt(e.target.value) || 1 })} /></div>
      </div>
      <label>Deadline</label>
      <input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} style={{ marginBottom: 14 }} />
      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={handleSave} disabled={!draft.name}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save subject
      </button>
      {!isNew && (
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={handleDelete}>
          {existing?.archived ? 'Unarchive' : 'Archive subject'}
        </button>
      )}
    </ModalShell>
  );
}

function WeeklyReviewModal({ settings, totals, body, workout, streaks, onAck, onSkip }: any) {
  const subjects = settings.subjectOrder.filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived);
  return (
    <ModalShell title="Sunday review" onClose={onSkip} icon={<ListChecks size={18} color="#4A6741" />}>
      <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Quick weekly checkpoint. Where are you, and what to push next week.
      </p>
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

function ChallengeModal({ settings, onSave, onClose }: any) {
  const ch = settings.challenge || { active: false, name: '60-Day V-Taper', startDate: null, days: 60, deloadWeek: 5 };
  const [draft, setDraft] = useState(ch);

  return (
    <ModalShell title="60-Day Challenge" onClose={onClose} icon={<Zap size={18} color="#8E4585" />}>
      <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.5 }}>
        A focused training block with a built-in deload week for recovery.
      </p>
      <label>Challenge name</label>
      <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ marginBottom: 12 }} />
      <label>Start date</label>
      <input type="date" value={draft.startDate || todayStr()} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} style={{ marginBottom: 12 }} />
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}><label>Duration (days)</label><input type="number" value={draft.days} onChange={(e) => setDraft({ ...draft, days: parseInt(e.target.value) || 60 })} /></div>
        <div style={{ flex: 1 }}><label>Deload week #</label><input type="number" min="1" max="10" value={draft.deloadWeek} onChange={(e) => setDraft({ ...draft, deloadWeek: parseInt(e.target.value) || 5 })} /></div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { onSave({ ...settings, challenge: { ...draft, active: false } }); onClose(); }}>
          {draft.active ? 'Pause' : 'Save (inactive)'}
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={() => { onSave({ ...settings, challenge: { ...draft, active: true, startDate: draft.startDate || todayStr() } }); onClose(); }}>
          <Play size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Activate
        </button>
      </div>
    </ModalShell>
  );
}

function ExportImportModal({ data, onImport, onClose }: any) {
  const [mode, setMode] = useState('export');
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const exportJson = JSON.stringify(data, null, 2);

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
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className={`tap ${mode === 'export' ? 'active' : ''}`} onClick={() => setMode('export')}>
          <Download size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Export
        </button>
        <button className={`tap ${mode === 'import' ? 'active' : ''}`} onClick={() => setMode('import')}>
          <Upload size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Import
        </button>
      </div>

      {mode === 'export' ? (
        <>
          <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Copy this and save it anywhere. If you ever clear local storage, paste it back to restore everything.
          </p>
          <textarea readOnly value={exportJson} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, padding: 10, height: 200, marginBottom: 12, resize: 'vertical', width: '100%' }} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
          <button className="btn" style={{ width: '100%' }} onClick={handleCopy}>
            {copied ? <><Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Copied!</> : 'Copy to clipboard'}
          </button>
        </>
      ) : (
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
  const [modal, setModal] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const s = await safeGet(K.settings, DEFAULT_SETTINGS);
      const merged = { ...DEFAULT_SETTINGS, ...s, subjects: { ...DEFAULT_SETTINGS.subjects, ...(s.subjects || {}) }, macroTargets: { ...DEFAULT_SETTINGS.macroTargets, ...(s.macroTargets || {}) } };
      const t = await safeGet(K.totals, {});
      const b = await safeGet(K.body, { entries: [] });
      const w = await safeGet(K.workout, { split: DEFAULT_WORKOUT_SPLIT, logs: {}, mode: 'sequence', sequencePosition: 1 });
      if (!w.mode) w.mode = 'sequence';
      if (w.sequencePosition == null) w.sequencePosition = 1;
      const m = await safeGet(K.meals, { presets: SAMPLE_PRESETS, log: {} });
      const p = await safeGet(K.plans, {});
      const st = await safeGet(K.streaks, {});
      const wa = await safeGet(K.weeklyReview, { lastAck: null });
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
      setLoaded(true);
    })();
  }, []);

  const saveSettings = async (next: any) => { setSettings(next); await safeSet(K.settings, next); };
  const saveDaily = async (next: any) => { setDaily(next); await safeSet(K.daily, next); };
  const saveTotals = async (next: any) => { setTotals(next); await safeSet(K.totals, next); };
  const saveBody = async (next: any) => { setBody(next); await safeSet(K.body, next); };
  const saveWorkout = async (next: any) => { setWorkout(next); await safeSet(K.workout, next); };
  const saveMeals = async (next: any) => { setMeals(next); await safeSet(K.meals, next); };
  const savePlans = async (next: any) => { setPlans(next); await safeSet(K.plans, next); };
  const saveStreaks = async (next: any) => { setStreaks(next); await safeSet(K.streaks, next); };

  const logTime = async (subject: string, minutes: number) => {
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
  };

  if (!loaded) {
    return <div style={{ minHeight: '100vh', background: '#F5F0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', color: '#6B6457' }}>Loading…</div>;
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
      <div className="content">
        <Header date={todayStr()} onSettings={() => setModal({ type: 'settings' })} />

        {tab === 'today' && (
          <TodayTab
            settings={settings} daily={daily} totals={totals} streaks={streaks} meals={meals} workout={workout}
            onWake={(time: string) => saveDaily({ ...daily, wakeLogged: true, actualWake: time })}
            onScheduleStart={(time: string) => saveDaily({ ...daily, scheduleStarted: true, scheduleStartTime: time })}
            onStatus={(status: string, busyUntil: string) => saveDaily({ ...daily, status, busyUntil })}
            onLogTime={(s: string) => setModal({ type: 'logTime', subject: s })}
            onBusy={() => setModal({ type: 'busy' })}
            onLogMeal={() => setModal({ type: 'logMeal' })}
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
        {tab === 'history' && (
          <HistoryTab
            settings={settings} totals={totals} workout={workout} meals={meals} body={body}
            onSelectDay={(date: string) => setModal({ type: 'dayDetail', date })}
          />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      {modal?.type === 'settings' && <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setModal(null)} onEditSubject={(k: string) => setModal({ type: 'editSubject', key: k })} onAddSubject={() => setModal({ type: 'editSubject', key: null })} onChallenge={() => setModal({ type: 'challenge' })} onExportImport={() => setModal({ type: 'exportImport' })} />}
      {modal?.type === 'editSubject' && <EditSubjectModal subjectKey={modal.key} settings={settings} onSave={saveSettings} onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'logTime' && <LogTimeModal subject={modal.subject} settings={settings} daily={daily} onLog={(m: number) => { logTime(modal.subject, m); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'busy' && <BusyModal onConfirm={(m: number) => { saveDaily({ ...daily, status: 'busy', busyUntil: addMinutes(nowHHMM(), m) }); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'addMeasurement' && <AddMeasurementModal onSave={async (entry: any) => { const next = { ...body, entries: [...body.entries, entry] }; const nextSettings = { ...settings, nextMeasurement: addMonth(todayStr(), 1) }; await saveBody(next); await saveSettings(nextSettings); setModal(null); }} onClose={() => setModal(null)} previous={body.entries[body.entries.length - 1]} />}
      {modal?.type === 'bodyGoals' && <BodyGoalsModal settings={settings} onSave={saveSettings} onClose={() => setModal(null)} />}
      {modal?.type === 'logWorkout' && <LogWorkoutModal dayIdx={modal.dayIdx} workout={workout} onSave={saveWorkout} onClose={() => setModal(null)} />}
      {modal?.type === 'editSplit' && <EditSplitModal workout={workout} onSave={saveWorkout} onClose={() => setModal(null)} />}
      {modal?.type === 'logMeal' && <LogMealModal meals={meals} settings={settings} onSave={saveMeals} onClose={() => setModal(null)} />}
      {modal?.type === 'planDay' && <PlanDayModal date={modal.date} plans={plans} onSave={savePlans} onClose={() => setModal(null)} />}
      {modal?.type === 'dayDetail' && <DayDetailModal date={modal.date} settings={settings} totals={totals} workout={workout} meals={meals} body={body} onClose={() => setModal(null)} />}
      {modal?.type === 'challenge' && <ChallengeModal settings={settings} onSave={saveSettings} onClose={() => setModal(null)} />}
      {modal?.type === 'exportImport' && <ExportImportModal data={{ settings, totals, body, workout, meals, plans, streaks, weeklyAck }} onImport={async (d: any) => {
        if (d.settings) { setSettings(d.settings); await safeSet(K.settings, d.settings); }
        if (d.totals) { setTotals(d.totals); await safeSet(K.totals, d.totals); }
        if (d.body) { setBody(d.body); await safeSet(K.body, d.body); }
        if (d.workout) { setWorkout(d.workout); await safeSet(K.workout, d.workout); }
        if (d.meals) { setMeals(d.meals); await safeSet(K.meals, d.meals); }
        if (d.plans) { setPlans(d.plans); await safeSet(K.plans, d.plans); }
        if (d.streaks) { setStreaks(d.streaks); await safeSet(K.streaks, d.streaks); }
        setModal(null);
      }} onClose={() => setModal(null)} />}
      {showWeekly && <WeeklyReviewModal settings={settings} totals={totals} body={body} workout={workout} streaks={streaks} onAck={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} onSkip={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} />}
    </div>
  );
}
