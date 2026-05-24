import { nowHHMM } from './date';
import type { MealEntry, MealTotals, MealsState } from './types';

// Keys we sum across a day's meal entries (macros + micros).
export const MICRO_KEYS = [
  'fiber', 'sugar', 'sodium', 'potassium', 'calcium', 'iron',
  'magnesium', 'zinc', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminB12',
  'saturatedFat', 'cholesterol',
] as const;

// Sum a day's meal entries into a macro + micro total.
export function mealTotalsFromEntries(entries: MealEntry[]): MealTotals {
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
export type MicroDef = { key: string; label: string; unit: string; defaultTarget: number; limit?: boolean; color: string; group: 'fiber' | 'minerals' | 'vitamins' | 'limits' };
export const MICRO_DEFS: MicroDef[] = [
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
export const DEFAULT_MICRO_TARGETS: Record<string, number> = Object.fromEntries(MICRO_DEFS.map(d => [d.key, d.defaultTarget]));

// Add a meal entry to a date and keep the cached daily total in sync.
export function addMealEntry(meals: MealsState, date: string, entry: Partial<MealEntry>): MealsState {
  const entries = { ...(meals.entries || {}) };
  const dayList = [...(entries[date] || []), { id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6), time: nowHHMM(), ...entry }];
  entries[date] = dayList;
  return { ...meals, entries, log: { ...meals.log, [date]: mealTotalsFromEntries(dayList) } };
}

export function removeMealEntry(meals: MealsState, date: string, id: string): MealsState {
  const entries = { ...(meals.entries || {}) };
  const dayList = (entries[date] || []).filter((e: any) => e.id !== id);
  entries[date] = dayList;
  return { ...meals, entries, log: { ...meals.log, [date]: mealTotalsFromEntries(dayList) } };
}

export function updateMealEntry(meals: MealsState, date: string, id: string, patch: Partial<MealEntry>): MealsState {
  const entries = { ...(meals.entries || {}) };
  const dayList = (entries[date] || []).map((e: any) => (e.id === id ? { ...e, ...patch } : e));
  entries[date] = dayList;
  return { ...meals, entries, log: { ...meals.log, [date]: mealTotalsFromEntries(dayList) } };
}

// One-time migration: turn legacy daily totals into a single editable entry.
// Also runs a ONE-TIME purge of macro-only presets (tracked via presetsMicrosMigrated)
// so the user can re-add them via AI which now grabs micros. After that, manually-created
// macro-only presets are preserved — we don't want to silently delete fresh user data.
export function migrateMeals(meals: any): any {
  const already = !!meals.presetsMicrosMigrated;
  const rawPresets = already ? (meals.presets || []) : (meals.presets || []).filter(isCompletePreset);
  const m = {
    ...meals,
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
export async function fileToResizedBase64(file: File, maxEdge = 1500, quality = 0.9): Promise<{ image: string; mime: string }> {
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

// Presets start empty so the user re-adds them via AI scan/type — that path captures full micros.
export const SAMPLE_PRESETS: any[] = [];

// A preset is "complete" if it carries micro data. Older presets (macros-only) are dropped so
// the user can recapture them with full nutrition via the AI scan/type flow.
export function isCompletePreset(p: any): boolean {
  return p && typeof p === 'object' && MICRO_KEYS.some((k) => Number(p[k]) > 0);
}

// Food serving units + a human label for a serving definition (e.g. "100 g", "2 servings").
export const FOOD_UNITS = ['serving', 'g', 'oz', 'lb', 'ml', 'fl oz', 'cup', 'tbsp', 'tsp', 'piece', 'slice'];
export const fmtNum = (n: any) => String(Math.round((Number(n) || 0) * 100) / 100);
export function servingLabelOf(size: any, unit: any): string {
  const s = Number(size) || 1;
  const u = unit || 'serving';
  if (u !== 'serving') return `${fmtNum(s)} ${u}`;
  return s === 1 ? '1 serving' : `${fmtNum(s)} servings`;
}
// Entry name with portion baked in: "Chicken · 150 g" for real units, "Eggs ×2" for servings.
export function entryDisplayName(base: string, amount: number, unit: string, qty: number): string {
  if (unit && unit !== 'serving') return `${base} · ${fmtNum(amount)} ${unit}`;
  return qty !== 1 ? `${base} ×${fmtNum(qty)}` : base;
}
