import { MICRO_DEFS } from './nutrition';
import type { Settings, BodyState } from './types';

// Derive earned/locked achievement badges from existing data (no separate tracking needed).
export function computeAchievements(totals: any, streaks: any, workout: any, body: any, meals: any) {
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
export function suggestMacros(latestBody: any, bodyGoals: any) {
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
export function suggestMicros(latestBody: any, bodyGoals: any) {
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

// ── CALORIE BALANCE — TDEE, daily calorie goal, and exercise burn (MyFitnessPal-style) ──
export const lbToKg = (lb: number) => lb * 0.45359237;
export const inToCm = (inches: number) => inches * 2.54;

// Latest logged bodyweight in lb (converts if the user stores kg).
export function latestWeightLb(body: BodyState, settings: Settings): number | null {
  const e = body?.entries?.[body.entries.length - 1];
  const w = Number(e?.weight);
  if (!w) return null;
  return settings?.weightUnit === 'kg' ? w / 0.45359237 : w;
}

// Mifflin–St Jeor (metric). Returns null if any input is missing.
export function computeBMR(weightLb: number | null, heightIn: number | null, age: number | null, sex: string | null): number | null {
  if (!weightLb || !heightIn || !age || !sex) return null;
  const base = 10 * lbToKg(weightLb) + 6.25 * inToCm(heightIn) - 5 * age;
  return Math.round(sex === 'female' ? base - 161 : base + 5);
}

export function activityFactor(level: string | null): number {
  switch (level) {
    case 'sedentary': return 1.2;
    case 'light': return 1.375;
    case 'active': return 1.725;
    case 'veryActive': return 1.9;
    default: return 1.55; // moderate
  }
}

export function computeTDEE(settings: Settings, body: BodyState): number | null {
  const p = settings?.fitnessProfile || {};
  const bmr = computeBMR(latestWeightLb(body, settings), Number(p.heightIn) || null, Number(p.age) || null, p.sex || null);
  return bmr == null ? null : Math.round(bmr * activityFactor(p.activityLevel));
}

// Daily calorie goal. In 'tdee' mode (with a complete profile) we adjust for the
// weight-goal direction; otherwise we fall back to the manual macro calorie target.
export function calorieGoal(settings: Settings, body: BodyState): number {
  if (settings?.calorieGoalMode === 'tdee') {
    const tdee = computeTDEE(settings, body);
    if (tdee != null) {
      const dir = settings?.bodyGoals?.weight?.direction || 'maintain';
      const delta = dir === 'down' ? -500 : dir === 'up' ? 300 : 0;
      return Math.max(1200, Math.round((tdee + delta) / 10) * 10);
    }
  }
  return Number(settings?.macroTargets?.calories) || 2000;
}

export const MET_BY_TYPE: Record<string, number> = { run: 9.8, walk: 3.5, cycle: 7.5, cardio: 7, strength: 5, other: 4 };

// MET-based estimate: kcal = MET · kg · hours (needs a duration).
export function estimateBurn(entry: any, weightLb: number | null): number {
  const mins = Number(entry?.durationMin) || 0;
  const met = MET_BY_TYPE[entry?.type] ?? 4;
  return Math.max(0, Math.round(met * lbToKg(weightLb || 160) * (mins / 60)));
}

export function sumBurn(dayList: any[]): number {
  return (dayList || []).reduce((a: number, e: any) => a + (Number(e.caloriesBurned) || 0), 0);
}

export const MEASUREMENT_FIELDS = [
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
