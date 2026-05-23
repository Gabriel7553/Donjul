import { useState, useEffect } from 'react';
import { Check, Trophy } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { haptic, celebrate } from './lib/haptics';
import { K, safeGet, safeSet, createBackup } from './lib/storage';
import { pad, todayStr, nowHHMM, addMonth, diffDays, addMinutes, isSunday, timeToMins } from './lib/date';
import { addMealEntry, migrateMeals, SAMPLE_PRESETS } from './lib/nutrition';
import { DEFAULT_SPENDING, migrateSpending, calcDailyInterest, fmtMoney } from './lib/money';
import { DEFAULT_TAX, migrateTax } from './lib/tax';
import { tickChallengesForSubject, pauseStaleChallenges } from './lib/challenges';
import { computeAchievements } from './lib/body';
import { normalizeSubject, doneThisWeek } from './lib/study';
import { DEFAULT_WORKOUT_SPLIT } from './lib/workout';
import { DEFAULT_SETTINGS } from './lib/defaults';
import { GlobalStyles, Header, BottomNav } from './ui';
import { TodayTab, NutritionCoachModal } from './features/today';
import { LogMealModal, ExerciseLogModal, FoodTab } from './features/food';
import { HistoryTab, DayDetailModal } from './features/history';
import { BodyTab, JournalTab, WorkoutTab, PlanTab, PlanDayModal } from './features/trackers';
import { LogTimeModal, BusyModal, BusyBackModal, AddMeasurementModal, BodyGoalsModal, LogWorkoutModal, EditSplitModal, BUSY_PRESET_DEFAULTS } from './features/dialogs';
import { AccountModal, SettingsModal, DiagnosticsModal, EditSubjectModal, WeeklyReviewModal, ChallengeModal, ResetDayModal, ExportImportModal, Setup } from './features/settings';
import { IncomePlannerModal, TaxModal, ChallengePausedModal, CustomChallengesModal, MoneyTab, AddTransactionModal, MoneyGoalsModal, MoneyCategoriesModal, AddAccountModal, AddDebtModal, AddOwedModal, AccountTransferModal } from './features/money';

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
  const [water, setWater] = useState<any>({});
  const [exercise, setExercise] = useState<any>({});
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
        fitnessProfile: { ...DEFAULT_SETTINGS.fitnessProfile, ...(s.fitnessProfile || {}) },
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
          skippedToday: [],
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
      setWater(await safeGet(K.water, {}));
      setExercise(await safeGet(K.exercise, {}));
      const txData = migrateTax(await safeGet(K.tax, DEFAULT_TAX));
      const cc = await safeGet(K.customChallenges, []);
      // Pause any challenge whose last action was before yesterday (and yesterday wasn't a rest day).
      const { next: ccNext, paused: ccPaused } = pauseStaleChallenges(cc);
      if (ccPaused.length) await safeSet(K.customChallenges, ccNext);
      setSpending(sp);
      setTax(txData);
      setCustomChallenges(ccNext);
      if (ccPaused.length) {
        // Defer modal so the rest of the app mounts first.
        setTimeout(() => setModal({ type: 'challengePaused', items: ccPaused.map((c: any) => c.id) }), 400);
      }
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
  const saveWater = async (next: any) => { setWater(next); await safeSet(K.water, next); };
  const saveExercise = async (next: any) => { setExercise(next); await safeSet(K.exercise, next); };
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
            onSkipToday={async (k: string) => {
              const cur = daily.skippedToday || [];
              if (!cur.includes(k)) await saveDaily({ ...daily, skippedToday: [...cur, k] });
            }}
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
            onEditSplit={(loc: string) => setModal({ type: 'editSplit', splitMode: loc || 'gym' })}
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
        {tab === 'food' && (
          <FoodTab
            settings={settings} meals={meals} water={water} exercise={exercise} body={body}
            onOpenLogger={(d: string, meal: string) => setModal({ type: 'logMeal', targetDate: d, mealType: meal })}
            onSaveMeals={saveMeals} onSaveWater={saveWater} onSaveExercise={saveExercise}
            onLogExercise={(d: string) => setModal({ type: 'logExercise', date: d })}
            onCoach={() => setModal({ type: 'nutritionCoach' })}
          />
        )}
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      {modal?.type === 'settings' && <SettingsModal settings={settings} body={body} onSave={saveSettings} onClose={() => setModal(null)} onEditSubject={(k: string) => setModal({ type: 'editSubject', key: k })} onAddSubject={() => setModal({ type: 'editSubject', key: null })} onChallenge={() => setModal({ type: 'challenge' })} onCustomChallenges={() => setModal({ type: 'customChallenges' })} onExportImport={() => setModal({ type: 'exportImport' })} onResetDay={() => setModal({ type: 'resetDay' })} onSyncTransfer={() => setModal({ type: 'syncTransfer' })} onDiagnostics={() => setModal({ type: 'diagnostics' })} />}
      {modal?.type === 'syncTransfer' && <AccountModal onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'diagnostics' && <DiagnosticsModal onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'resetDay' && <ResetDayModal onReset={resetDay} onFullReset={fullReset} onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'editSubject' && <EditSubjectModal subjectKey={modal.key} settings={settings} onSave={saveSettings} onClose={() => setModal({ type: 'settings' })} />}
      {modal?.type === 'logTime' && <LogTimeModal subject={modal.subject} settings={settings} daily={daily} editMode={modal.editMode} onLog={(m: number) => { logTime(modal.subject, m); setModal(null); }} onSet={(m: number) => { setSubjectTime(modal.subject, m); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'busy' && <BusyModal isSwitch={modal.mode === 'switch'} busyPresets={busyPresets} onSavePresets={saveBusyPresets} onConfirm={(m: number | null, reason: string) => { if (modal.mode === 'switch') switchBusy(m, reason); else startBusy(m, reason); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'busyBack' && <BusyBackModal daily={daily} onConfirm={(log: boolean) => { endBusy(log); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'addMeasurement' && <AddMeasurementModal onSave={async (entry: any) => { const next = { ...body, entries: [...body.entries, entry] }; const nextSettings = { ...settings, nextMeasurement: addMonth(todayStr(), 1) }; await saveBody(next); await saveSettings(nextSettings); setModal(null); }} onClose={() => setModal(null)} previous={body.entries[body.entries.length - 1]} />}
      {modal?.type === 'bodyGoals' && <BodyGoalsModal settings={settings} onSave={saveSettings} onClose={() => setModal(null)} />}
      {modal?.type === 'logWorkout' && <LogWorkoutModal dayIdx={modal.dayIdx} workout={workout} onSave={saveWorkout} onClose={() => setModal(null)} />}
      {modal?.type === 'editSplit' && <EditSplitModal workout={workout} mode={modal.splitMode || 'gym'} onSave={saveWorkout} onClose={() => setModal(null)} />}
      {modal?.type === 'challenge' && <ChallengeModal settings={settings} challengeHistory={challengeHistory} onSave={saveSettings} onSaveHistory={saveChallengeHistory} onClose={() => setModal(null)} />}
      {modal?.type === 'logMeal' && <LogMealModal meals={meals} settings={settings} onSave={saveMeals} targetDate={modal.targetDate} mealType={modal.mealType} onClose={() => {
        // If we came from a day-detail view, return to it instead of closing everything.
        if (modal.returnTo) setModal(modal.returnTo); else setModal(null);
      }} />}
      {modal?.type === 'logExercise' && <ExerciseLogModal date={modal.date} exercise={exercise} settings={settings} body={body} onSave={async (next: any) => { await saveExercise(next); setModal(null); }} onClose={() => setModal(null)} />}
      {modal?.type === 'nutritionCoach' && <NutritionCoachModal settings={settings} meals={meals} body={body} onLogItem={async (item: any) => { await saveMeals(addMealEntry(meals, todayStr(), { qty: 1, ...item })); toast(`Logged ${item.name}`); }} onClose={() => setModal(null)} />}
      {modal?.type === 'planDay' && <PlanDayModal date={modal.date} plans={plans} onSave={savePlans} onClose={() => setModal(null)} />}
      {modal?.type === 'dayDetail' && <DayDetailModal date={modal.date} settings={settings} totals={totals} workout={workout} meals={meals} body={body} activity={activity} checkins={checkins} spending={spending} customChallenges={customChallenges} onSaveMeals={saveMeals} onSaveWorkout={saveWorkout} onSaveTotals={saveTotals} onSaveCheckins={saveCheckins} onOpenMealLogger={(d: string) => setModal({ type: 'logMeal', targetDate: d, returnTo: { type: 'dayDetail', date: d } })} onClose={() => setModal(null)} />}
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
      {modal?.type === 'challengePaused' && <ChallengePausedModal challenges={customChallenges} settings={settings} pausedIds={modal.items} onSave={saveCustomChallenges} onClose={() => setModal(null)} />}
      {modal?.type === 'exportImport' && <ExportImportModal data={{ settings, totals, body, workout, meals, plans, streaks, journal, challengeHistory, busyPresets, weeklyAck, spending, tax, customChallenges, water, exercise }} onImport={async (d: any) => {
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
        if (d.water) { setWater(d.water); await safeSet(K.water, d.water); }
        if (d.exercise) { setExercise(d.exercise); await safeSet(K.exercise, d.exercise); }
        toast.success('Data restored successfully.');
        setModal(null);
      }} onClose={() => setModal(null)} />}
      {showWeekly && <WeeklyReviewModal settings={settings} totals={totals} body={body} workout={workout} meals={meals} streaks={streaks} onAck={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} onSkip={async () => { const next = { lastAck: todayStr() }; await safeSet(K.weeklyReview, next); setWeeklyAck(next); }} />}
    </div>
  );
}
