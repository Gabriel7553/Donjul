import { Languages, Music, Shield, BookOpen, Target, Dumbbell, Activity } from 'lucide-react';
import { todayStr, tomorrowStr } from './date';
import { DEFAULT_MICRO_TARGETS } from './nutrition';
import { SUBJECTS_DEFAULT } from './study';

export const ICON_MAP: Record<string, any> = { languages: Languages, music: Music, shield: Shield, book: BookOpen, target: Target, dumbbell: Dumbbell, activity: Activity, run: Activity };

export const DEFAULT_SETTINGS: Record<string, any> = {
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
  catchupSpread: 'deadline',
  macroTargets: { protein: 170, carbs: 230, fat: 75, calories: 2300 },
  microTargets: DEFAULT_MICRO_TARGETS,
  microsEnabled: true,
  waterGoalOz: 64,
  calorieGoalMode: 'manual',
  fitnessProfile: { heightIn: null, age: null, sex: null, activityLevel: 'moderate' },
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
