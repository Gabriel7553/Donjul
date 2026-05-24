import { useState, useMemo } from 'react';
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
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { pad, todayStr, tomorrowStr, diffDays, fmtTime, fmtDate, fmtShortDate, dayOfWeek } from '../lib/date';
import { MEASUREMENT_FIELDS } from '../lib/body';
import { DEFAULT_WORKOUT_SPLIT, HOME_WORKOUT_SPLIT, computePRs, sessionVolume, exerciseHistory } from '../lib/workout';
import { ModalShell, VoiceButton } from '../ui';

export function BodyTab({ settings, body, workout, onAddEntry, onEditGoals }: any) {
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
              <button onClick={onEditGoals} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
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
                <div key={f.key} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span className="small" style={{ fontWeight: 600 }}>{f.label}</span>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="mono small">{current}{f.unit}</span>
                      {change != null && (
                        <span className="pill" style={{ background: isGood ? 'var(--tint-good)' : 'var(--tint-warm)', color: isGood ? '#4A6741' : '#B8460E', padding: '2px 8px' }}>
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

export function JournalTab({ journal, onSave, settings }: any) {
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
                      flex: 1, padding: '6px 4px', border: `1px solid ${mood === m.value ? '#8E4585' : 'var(--border)'}`,
                      borderRadius: 8, background: mood === m.value ? 'var(--tint-purple)' : 'transparent',
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
              style={{ width: '100%', minHeight: 120, fontFamily: 'Fraunces, serif', fontSize: 15, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text)', resize: 'vertical', lineHeight: 1.6 }}
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
              <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
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
                      <span className="mono tiny" style={{ color: t.direction === 'L' ? '#4A6741' : '#B8460E', background: t.direction === 'L' ? 'var(--tint-good)' : 'var(--tint-warm)', padding: '1px 6px', borderRadius: 4 }}>{t.direction === 'L' ? 'LONG' : 'SHORT'}</span>
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
            <div className="card" style={{ padding: 14, marginBottom: 12, background: 'var(--tint-good)', border: '1px solid var(--tint-good-bd)' }}>
              <div className="h3" style={{ marginBottom: 10 }}>Summary</div>
              <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
                <div><div className="mono tiny muted">Total P&L</div><div className="mono small" style={{ fontWeight: 700, color: totalPnl >= 0 ? '#4A6741' : '#B8460E' }}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}</div></div>
                <div><div className="mono tiny muted">Win rate</div><div className="mono small" style={{ fontWeight: 700 }}>{winRate}%</div></div>
                <div><div className="mono tiny muted">Trades</div><div className="mono small" style={{ fontWeight: 700 }}>{allTrades.length}</div></div>
                <div><div className="mono tiny muted">W / L</div><div className="mono small" style={{ fontWeight: 700, color: '#4A6741' }}>{winTrades.length}<span style={{ color: 'var(--text-muted)' }}>/</span><span style={{ color: '#B8460E' }}>{allTrades.length - winTrades.length}</span></div></div>
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
                    {entry?.note && <BookMarked size={12} className="ico-muted" />}
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
export function WorkoutTab({ workout, onLogWorkout, onEditSplit, onSaveWorkout, settings }: any) {
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

  const [detailEx, setDetailEx] = useState<string | null>(null);
  const prs = useMemo(() => computePRs(workout.logs), [workout.logs]);
  const volTrend = useMemo(() => Object.entries(workout.logs)
    .sort((a: any, b: any) => a[0].localeCompare(b[0]))
    .map(([date, log]: any) => ({ label: fmtShortDate(date), volume: sessionVolume(log) }))
    .filter((d) => d.volume > 0)
    .slice(-10), [workout.logs]);

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
              <div key={i} onClick={() => setDetailEx(ex.name)} style={{ padding: '10px 0', borderBottom: i < todayWorkout.exercises.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                <div className="between">
                  <span className="small" style={{ fontWeight: 600 }}>{ex.name}</span>
                  <span className="mono tiny muted">{ex.sets} × {ex.reps}</span>
                </div>
                {lastW && !logged && (
                  <div className="mono tiny" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
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
            <div key={date} className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>{log.name || 'Session'}</div>
                <div className="mono tiny muted">{fmtShortDate(date)}</div>
              </div>
              <span className="mono tiny muted">{sessionVolume(log) > 0 ? `${sessionVolume(log).toLocaleString()} lb·reps` : `${log.exercises?.length || 0} ex`}</span>
            </div>
          ))}
        </div>
      )}

      {prs.length > 0 && (
        <div className="card">
          <div className="h2" style={{ marginBottom: 10 }}>Personal records</div>
          {prs.slice(0, 6).map((p) => (
            <div key={p.name} onClick={() => setDetailEx(p.name)} className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                <div className="small" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div className="mono tiny muted">{fmtShortDate(p.date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono small" style={{ fontWeight: 600 }}>{p.weight}×{p.reps}</div>
                <div className="mono tiny muted">~{p.e1rm} est. 1RM</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {volTrend.length >= 2 && (
        <div className="card">
          <div className="h2" style={{ marginBottom: 10 }}>Volume · last {volTrend.length} sessions</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={volTrend} margin={{ top: 5, right: 8, left: -6, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} width={40} />
              <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="volume" fill="#3B5C6B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mono tiny muted" style={{ textAlign: 'center' }}>Σ weight × reps per session</div>
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <div className="h2">Weekly split</div>
          <button onClick={() => onEditSplit(location)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <Edit3 size={16} />
          </button>
        </div>
        {activeSplit.map((day: any, i: number) => (
          <div key={i} className="between" style={{ padding: '8px 0', borderBottom: i < activeSplit.length - 1 ? '1px solid var(--border)' : 'none', opacity: (mode === 'calendar' && day.day === today) || (mode === 'sequence' && day === todayWorkout) ? 1 : 0.7 }}>
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

      {detailEx && <ExerciseDetailModal name={detailEx} logs={workout.logs} unit={settings?.weightUnit || 'lb'} onClose={() => setDetailEx(null)} />}
    </>
  );
}

function ExerciseDetailModal({ name, logs, unit, onClose }: any) {
  const hist = useMemo(() => exerciseHistory(logs, name), [logs, name]);
  const best = hist.reduce((b: any, h: any) => (h.e1rm > (b?.e1rm || 0) ? h : b), null as any);
  const chartData = hist.filter((h) => h.topWeight > 0).map((h) => ({ label: fmtShortDate(h.date), weight: h.topWeight }));
  return (
    <ModalShell title={name} onClose={onClose} icon={<Dumbbell size={18} />} color="#3B5C6B">
      {hist.length === 0 ? (
        <div className="muted small">No logged sets for this exercise yet.</div>
      ) : (
        <>
          {best && best.e1rm > 0 && (
            <div className="card" style={{ margin: '0 0 14px', background: 'var(--tint-cream)' }}>
              <div className="between"><span className="small muted">Best set</span><span className="mono small" style={{ fontWeight: 600 }}>{best.topWeight}×{best.topReps} {unit}</span></div>
              <div className="between" style={{ marginTop: 5 }}><span className="small muted">Est. 1RM</span><span className="mono small">{best.e1rm} {unit} · {fmtShortDate(best.date)}</span></div>
            </div>
          )}
          {chartData.length >= 2 && (
            <div style={{ marginBottom: 14 }}>
              <div className="h3" style={{ marginBottom: 8 }}>Top-set weight · {unit}</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData} margin={{ top: 5, right: 12, left: -4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} domain={['dataMin - 5', 'dataMax + 5'] as any} width={42} />
                  <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="weight" stroke="#3B5C6B" strokeWidth={2} dot={{ r: 2.5, fill: '#3B5C6B' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="h3" style={{ marginBottom: 8 }}>History · {hist.length} session{hist.length === 1 ? '' : 's'}</div>
          {[...hist].reverse().map((h) => (
            <div key={h.date} className="between" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="mono tiny muted">{fmtShortDate(h.date)}</span>
              <span className="mono tiny">{h.sets.filter((s: any) => s.weight).map((s: any) => `${s.weight}×${s.reps || '—'}`).join('  ') || '—'}</span>
            </div>
          ))}
        </>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PLAN TAB
// ════════════════════════════════════════════════════════════════════════════════
export function PlanTab({ plans, settings, onPlanDay }: any) {
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
    <div onClick={onClick} style={{ padding: '12px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}>
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
      <ChevronRight size={16} className="ico-muted" />
    </div>
  );
}

export function PlanDayModal({ date, plans, onSave, onClose }: any) {
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
        <div key={i} className="between" style={{ padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
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
        <div key={i} className="between" style={{ padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
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

