import { useState } from 'react';
import {
  Sun, Home, Footprints, Check, Plus, Settings as SettingsIcon, X, Music, Languages, Shield,
  Award, Save, Calendar as CalIcon, Activity, Dumbbell, Apple, ListChecks, ChevronRight, ChevronDown, ChevronLeft,
  TrendingUp, TrendingDown, Edit3, Trash2, Flame, ArrowUp, ArrowDown, Minus, Target, BookOpen, Clock, Moon, Coffee,
  Download, Upload, History, Repeat, Zap, Play, AlertTriangle, RotateCcw, MapPin, Building2, TreePine,
  Camera, BookMarked, TrendingUp as Journal, DollarSign, ShoppingCart, Briefcase, Car, ChevronUp, Trophy, Archive, Infinity, Mic,
  Wallet, PiggyBank, CreditCard, PieChart, Receipt, Pencil, ArrowUpRight, ArrowDownRight, Sparkles,
  ArrowRightLeft, Users, Banknote, BadgeAlert, CircleDollarSign, HandCoins, GripVertical,
  Droplets, Utensils, Bike, Copy,
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { pad, todayStr, diffDays, fmtTime, fmtDate } from '../lib/date';
import { MICRO_DEFS, addMealEntry, removeMealEntry } from '../lib/nutrition';
import { MEASUREMENT_FIELDS, computeAchievements, sumBurn, calorieGoal } from '../lib/body';
import { DEFAULT_WORKOUT_SPLIT, HOME_WORKOUT_SPLIT } from '../lib/workout';
import { ICON_MAP } from '../lib/defaults';
import { fmtMoney } from '../lib/money';
import { getCustomStreak } from '../lib/challenges';
import { ModalShell } from '../ui';

export function HistoryTab({ settings, totals, workout, meals, body, activity, streaks, checkins, spending, onSelectDay }: any) {
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

export function DayDetailModal({ date, settings, totals, workout, meals, body, activity, checkins, spending, customChallenges,
  onSaveMeals, onSaveWorkout, onSaveTotals, onSaveCheckins, onOpenMealLogger, onClose }: any) {
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
        {onOpenMealLogger && (
          <button
            className="btn"
            style={{ width: '100%', marginBottom: 14, background: '#4A6741', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => onOpenMealLogger(date)}
          >
            <Plus size={14} /> Open full logger (Scan / Type / Combo / Presets)
          </button>
        )}
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

