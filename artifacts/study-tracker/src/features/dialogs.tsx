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
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { todayStr, nowHHMM, fmtTime, timeToMins } from '../lib/date';
import { MEASUREMENT_FIELDS } from '../lib/body';
import { DEFAULT_WORKOUT_SPLIT, HOME_WORKOUT_SPLIT } from '../lib/workout';
import { ICON_MAP } from '../lib/defaults';
import { ModalShell, useDndSensors } from '../ui';

export function LogTimeModal({ subject, settings, daily, onLog, onSet, onClose, editMode }: any) {
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
      <div className="card" style={{ padding: '10px 14px', marginBottom: 14, background: 'var(--bg)' }}>
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

export const BUSY_PRESET_DEFAULTS = ['Shopping', 'Work', 'Errands', 'Gym', 'Appointment', 'Commute', 'Family'];

export function BusyModal({ onConfirm, onClose, busyPresets, onSavePresets, isSwitch }: any) {
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

export function BusyBackModal({ daily, onConfirm, onClose }: any) {
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

export function AddMeasurementModal({ onSave, onClose, previous }: any) {
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

export function BodyGoalsModal({ settings, onSave, onClose }: any) {
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
      <div className="card" style={{ padding: '12px 14px', marginBottom: 14, background: 'var(--tint-info)', border: '1px solid var(--tint-info-bd)' }}>
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

export function LogWorkoutModal({ dayIdx, workout, onSave, onClose }: any) {
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
          <div key={i} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
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

function SortableDayRow({ id, day, idx, openDay, setOpenDay, updateDay, updateExercise, addExercise, removeExercise, onDeleteDay }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const sensors = useDndSensors();
  const isOpen = openDay === idx;
  const [confirmDel, setConfirmDel] = useState(false);
  const exIds = (day.exercises || []).map((_: any, j: number) => `${id}-ex-${j}`);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, marginBottom: 10 }}>
      <div className="card" style={{ padding: 12 }}>
        <div className="between">
          <div className="row" style={{ gap: 8 }}>
            <button {...attributes} {...listeners} style={{ background: 'none', border: 'none', cursor: 'grab', color: 'var(--text)', opacity: 0.4, padding: '4px 2px', touchAction: 'none' }}>
              <GripVertical size={16} />
            </button>
            <span className="mono tiny muted">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.day] ?? `Day ${idx + 1}`}</span>
            <span className="small" style={{ fontWeight: 600 }}>{day.name}</span>
            {day.rest && <span className="pill" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-inset)', color: 'var(--text)', opacity: 0.6 }}>Rest</span>}
          </div>
          <ChevronDown size={16} onClick={() => setOpenDay(isOpen ? null : idx)} style={{ cursor: 'pointer', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        {isOpen && (
          <div style={{ marginTop: 12 }}>
            <label>Day name</label>
            <input type="text" value={day.name} onChange={e => updateDay({ name: e.target.value })} style={{ marginBottom: 10 }} />
            <div className="between" style={{ marginBottom: 12 }}>
              <button className={`tap ${day.rest ? 'active' : ''}`} onClick={() => updateDay({ rest: !day.rest })}>
                {day.rest ? '✓ Rest day' : 'Workout day'}
              </button>
              {!confirmDel ? (
                <button className="tap" style={{ fontSize: 11, color: '#B8460E', padding: '4px 10px' }} onClick={() => setConfirmDel(true)}>
                  <Trash2 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Delete day
                </button>
              ) : (
                <div className="row" style={{ gap: 6 }}>
                  <span className="tiny muted">Delete?</span>
                  <button className="tap" style={{ fontSize: 11, color: '#B8460E', padding: '3px 8px' }} onClick={() => { setConfirmDel(false); onDeleteDay?.(); }}>Yes</button>
                  <button className="tap" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setConfirmDel(false)}>No</button>
                </div>
              )}
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

export function EditSplitModal({ workout, mode, onSave, onClose }: any) {
  const isHome = mode === 'home';
  const defaultSplit = isHome ? HOME_WORKOUT_SPLIT : DEFAULT_WORKOUT_SPLIT;
  const sourceSplit = isHome ? (workout.homeSplit || HOME_WORKOUT_SPLIT) : (workout.split || DEFAULT_WORKOUT_SPLIT);

  const [split, setSplit] = useState(() => sourceSplit.map((d: any, i: number) => ({ ...d, _uid: `day-${i}-${Date.now()}-${i}` })));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const dayIds = split.map((d: any) => d._uid);
  const sensors = useDndSensors();

  const updateDay = (idx: number, patch: any) => setSplit((s: any[]) => s.map((d: any, i: number) => i === idx ? { ...d, ...patch } : d));
  const removeDay = (idx: number) => {
    setSplit((s: any[]) => s.filter((_: any, i: number) => i !== idx));
    setOpenDay(null);
  };
  const addDay = () => {
    const uid = `day-new-${Date.now()}`;
    setSplit((s: any[]) => [...s, { day: s.length, name: 'New Day', rest: false, exercises: [], _uid: uid }]);
    setOpenDay(split.length);
  };
  const updateExercise = (dayIdx: number, exIdx: number, patch: any) =>
    updateDay(dayIdx, { exercises: split[dayIdx].exercises.map((e: any, i: number) => i === exIdx ? { ...e, ...patch } : e) });
  const addExercise = (dayIdx: number) =>
    updateDay(dayIdx, { exercises: [...(split[dayIdx].exercises || []), { name: 'New exercise', sets: 3, reps: '8-12', weight: '' }] });
  const removeExercise = (dayIdx: number, exIdx: number) =>
    updateDay(dayIdx, { exercises: split[dayIdx].exercises.filter((_: any, i: number) => i !== exIdx) });

  const doReset = () => {
    setSplit(defaultSplit.map((d: any, i: number) => ({ ...d, _uid: `day-reset-${i}` })));
    setOpenDay(null);
    setConfirmReset(false);
  };

  return (
    <ModalShell title={isHome ? 'Edit home circuit' : 'Edit weekly split'} onClose={onClose} icon={<Edit3 size={18} color="#3B5C6B" />}>
      <div className="between" style={{ marginBottom: 12 }}>
        <p className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}>
          <GripVertical size={13} /> Drag to reorder days.
        </p>
        {!confirmReset ? (
          <button className="tap" style={{ fontSize: 11, padding: '4px 10px', color: '#B8460E' }} onClick={() => setConfirmReset(true)}>
            <RotateCcw size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Reset to default
          </button>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <span className="tiny muted">Reset all days?</span>
            <button className="tap" style={{ fontSize: 11, padding: '3px 8px', color: '#B8460E' }} onClick={doReset}>Yes</button>
            <button className="tap" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setConfirmReset(false)}>No</button>
          </div>
        )}
      </div>

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
              onDeleteDay={() => removeDay(i)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={addDay}>
        <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Add day
      </button>
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={async () => {
        const cleanSplit = split.map(({ _uid, ...d }: any) => d);
        if (isHome) {
          await onSave({ ...workout, homeSplit: cleanSplit });
        } else {
          await onSave({ ...workout, split: cleanSplit });
        }
        onClose();
      }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save split
      </button>
    </ModalShell>
  );
}


