// Central domain types for the persisted app state.
//
// The app stores loosely-shaped, user-editable data and was written
// untyped, so the big aggregate states keep an index signature to stay
// compatible with existing access while still documenting their known
// fields. The bounded leaf models (entries, totals, streaks) are precise.

import type { Reminder } from './reminders';
export type { Reminder };

export interface MacroTargets { protein: number; carbs: number; fat: number; calories: number; }

export interface MealEntry {
  id: string;
  name?: string;
  time?: string;
  baseName?: string;
  source?: string;
  qty?: number;
  amount?: number;
  unit?: string;
  servingSize?: number;
  meal?: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  calories?: number;
  [micro: string]: any;
}

export interface MealTotals {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  [micro: string]: number;
}

export interface MealPreset {
  id: string;
  name: string;
  source?: string;
  servingSize?: number;
  servingUnit?: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  calories?: number;
  [micro: string]: any;
}

export interface MealsState {
  presets: MealPreset[];
  log: Record<string, MealTotals>;
  entries?: Record<string, MealEntry[]>;
  presetsMicrosMigrated?: boolean;
}

export interface BodyEntry {
  date: string;
  weight?: number;
  body_fat?: number;
  [measurement: string]: any;
}
export interface BodyState { entries: BodyEntry[]; }

export interface WorkoutState {
  split: any;
  logs: Record<string, any>;
  mode?: string;
  sequencePosition?: number;
  [k: string]: any;
}

export interface SpendingEntry {
  id?: string;
  date: string;
  amount: number;
  type: 'in' | 'out';
  categoryId?: string;
  [k: string]: any;
}
export interface SpendCategory { id: string; name: string; kind: 'in' | 'out'; color: string; }
export interface SpendingState {
  entries: SpendingEntry[];
  categories: SpendCategory[];
  accounts: any[];
  debts: any[];
  owed: any[];
  monthlyBudget: number;
  savingsGoal: number;
  income: Record<string, any>;
  sectionOrder: string[];
  [k: string]: any;
}

export interface Streak { current: number; longest: number; lastDate: string | null; }

export interface Settings {
  macroTargets: MacroTargets;
  subjects: Record<string, any>;
  subjectOrder: string[];
  weightUnit?: string;
  theme?: string;
  navOrder?: string[];
  navHidden?: string[];
  reminders?: boolean;
  reminderList?: Reminder[];
  microTargets?: Record<string, number>;
  calorieGoalMode?: string;
  waterGoalOz?: number;
  [k: string]: any;
}

// Date-keyed maps (YYYY-MM-DD -> value).
export type StudyTotals = Record<string, number>;
export type Checkins = Record<string, string[]>;
export type WaterLog = Record<string, number>;
export type Streaks = Record<string, Streak>;
