import { useState, useEffect, useMemo, Fragment } from 'react';
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
import { pad, todayStr, nowHHMM, diffDays, addMinutes, fmtTime, fmtDate, fmtShortDate, timeToMins, isSunday, dayOfWeek } from '../lib/date';
import { getRequiredDailyMins, expectedTotal, doneThisWeek, doneTotal, targetTotalByDeadline, subjectGoalKind, projectedDate, daysLeftInWeek, buildSchedule } from '../lib/study';
import { ICON_MAP } from '../lib/defaults';
import { ModalShell, useCurrentTime } from '../ui';
import { MacrosCard, MicrosCard } from './cards';

export function TodayTab({ settings, daily, totals, streaks, meals, workout, checkins, customChallenges, onWake, onStatus, onLogTime, onBusy, onBack, onSwitch, onLogMeal, onScheduleStart, onResetMacros, onMarkDone, onFocusStart, onFocusStop, onCoach, onRestDay, onManageChallenges, onSkipToday }: any) {
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
        <div className="card" style={{ borderLeft: `3px solid ${minsToSleep <= 60 ? '#B8460E' : '#C8932E'}`, background: minsToSleep <= 60 ? 'var(--tint-warm)' : 'var(--bg-card)', marginBottom: 14 }}>
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
          {(() => {
            const blocks: Record<string, any> = {
              schedule: (
                <>
                  <Schedule settings={settings} daily={daily} totals={totals} onLog={onLogTime} subjectKeys={subjectKeys} nowMins={nowMins} checkins={checkins} />
                  <CatchUpBanner settings={settings} totals={totals} daily={daily} subjectKeys={subjectKeys} />
                </>
              ),
              progress: (
                <Progress settings={settings} totals={totals} daily={daily} streaks={streaks} subjectKeys={subjectKeys} onLogExtra={onLogTime} checkins={checkins} onMarkDone={onMarkDone} onFocusStart={onFocusStart} focus={daily.focus} onSkipToday={onSkipToday} />
              ),
              challenges: (
                <>
                  <ChallengeCard settings={settings} workout={workout} />
                  <CustomChallengesCard challenges={customChallenges} settings={settings} onRestDay={onRestDay} onManage={onManageChallenges} />
                </>
              ),
              nutrition: (
                <>
                  <MacrosCard targets={settings.macroTargets} totals={todayMacros} onLog={onLogMeal} onReset={onResetMacros} onCoach={onCoach} />
                  {settings.microsEnabled !== false && <MicrosCard targets={settings.microTargets} totals={todayMacros} />}
                </>
              ),
              weekly: (
                <WeeklySummary settings={settings} totals={totals} daily={daily} meals={meals} workout={workout} />
              ),
            };
            const fallback = ['schedule', 'progress', 'challenges', 'nutrition', 'weekly'];
            const saved: string[] = (settings.todayLayout && settings.todayLayout.length) ? settings.todayLayout : fallback;
            const order = [...saved.filter((k: string) => blocks[k]), ...Object.keys(blocks).filter((k) => !saved.includes(k))];
            const hidden: string[] = settings.todayHidden || [];
            return order.filter((k) => !hidden.includes(k)).map((k) => <Fragment key={k}>{blocks[k]}</Fragment>);
          })()}
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
          <div className="mono small" style={{ fontWeight: 600, color: 'var(--text)', fontSize: 18 }}>{fmtTime(now)}</div>
          {minsLeft > 0 && minsLeft < 480 && (
            <div className="mono tiny" style={{ color: timeColor }}>
              {minsLeft <= 60 ? `${minsLeft}m to sleep` : minsLeft <= 120 ? `~${Math.round(minsLeft / 60 * 10) / 10}h to sleep` : ''}
            </div>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
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
    <div className="card" style={{ borderLeft: `3px solid ${subject?.accent || '#4A6741'}`, marginBottom: 14, background: 'var(--tint-warm)' }}>
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


function Schedule({ settings, daily, totals, onLog, subjectKeys, nowMins, checkins }: any) {
  const blocks = useMemo(() => buildSchedule(settings, daily, subjectKeys, checkins, totals), [settings, daily, subjectKeys, checkins, totals]);

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

        let blockBg = 'var(--bg-card)';
        let blockBorder = '1px solid var(--border)';
        let statusEl = null;

        if (done) {
          blockBg = 'var(--tint-good)';
          blockBorder = '1px solid var(--tint-good-bd)';
        } else if (isActive) {
          blockBg = 'var(--tint-warm)';
          blockBorder = `2px solid ${subj.accent}`;
          statusEl = <span className="pill" style={{ background: subj.accent, color: '#F5F0E6', fontSize: 10, padding: '2px 8px', letterSpacing: '0.08em' }}>NOW</span>;
        } else if (isOverdue) {
          blockBg = 'var(--tint-warm)';
          blockBorder = '2px solid #B8460E';
          statusEl = <span className="pill" style={{ background: 'var(--tint-warm)', color: '#B8460E', fontSize: 10, padding: '2px 8px' }}>OVERDUE</span>;
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
        <div key={b.key} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--bg-inset)' }}>
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

function Progress({ settings, totals, daily, streaks, subjectKeys, onLogExtra, checkins, onMarkDone, onFocusStart, focus, onSkipToday }: any) {
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

        let status = '', sColor = '#6B6457', sBg = 'var(--tint-cream)';
        if (weeklyMet) { status = `Done this week · ${weekDone}/${weeklyDays}`; sColor = '#4A6741'; sBg = 'var(--tint-good)'; }
        else if (countComplete) { status = 'Complete'; sColor = '#4A6741'; sBg = 'var(--tint-good)'; }
        else if (showPace) {
          // Use projected-vs-deadline gap — more accurate than elapsed-time comparison.
          if (!proj || proj.projected === null) {
            status = 'no data yet'; sColor = '#6B6457'; sBg = 'var(--tint-cream)';
          } else {
            // diffDays(toDate, fromDate): positive = toDate is further in the future
            const projGap = diffDays(proj.projected, proj.deadline); // pos = behind, neg = ahead
            const daysOff = Math.abs(projGap);
            if (daysOff < 1) { status = 'on pace'; sColor = '#4A6741'; sBg = 'var(--tint-good)'; }
            else if (projGap < 0) { status = `${daysOff.toFixed(1)}d ahead`; sColor = '#4A6741'; sBg = 'var(--tint-good)'; }
            else { status = `${daysOff.toFixed(1)}d behind`; sColor = '#B8460E'; sBg = 'var(--tint-warm)'; }
          }
        } else { status = `${weekDone}/${weeklyDays} this week`; }

        return (
          <div key={k} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)', opacity: weeklyMet || countComplete ? 0.65 : 1 }}>
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
                <CalIcon size={11} className="ico-muted" />
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
                  <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < weekDone ? subj.accent : 'var(--border)' }} />
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
                    {weeklyDays < 7 && !weeklyMet && !(daily.skippedToday || []).includes(k) && (
                      <button onClick={() => onSkipToday?.(k)} className="tap" style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }} title="Skip this subject today">
                        Not today
                      </button>
                    )}
                    {(daily.skippedToday || []).includes(k) && (
                      <span className="mono tiny muted" style={{ padding: '3px 6px' }}>skipped today</span>
                    )}
                    <button onClick={() => onFocusStart(k)} disabled={!!focus} className="tap" style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'JetBrains Mono', color: isFocusing ? '#4A6741' : '#6B6457' }} title="Start a focus timer">
                      <Play size={11} />
                    </button>
                    <button onClick={() => onLogExtra(k, 'edit')} className="tap" style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }} title="Edit/reset today's time">
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


export function NutritionCoachModal({ settings, meals, body, onLogItem, onClose }: any) {
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
          <div key={ch.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--bg-inset)' }}>
            <div className="between" style={{ marginBottom: 4 }}>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>{ch.name}</div>
                <div className="tiny muted">🔥 {ch.streak} streak · {sub?.name || ch.subjectKey} · {isOpen ? `Day ${daysDone + 1}` : `${daysDone}/${ch.days}`}</div>
              </div>
              {!isOpen && <span className="mono tiny muted">{pct}%</span>}
            </div>
            {!isOpen && <div style={{ height: 3, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}><div style={{ height: '100%', width: `${pct}%`, background: '#8E4585', borderRadius: 2 }} /></div>}
            {isLogged ? (
              <div className="tiny" style={{ color: '#3F7A4F', fontWeight: 600 }}>✓ Counted today</div>
            ) : isRest ? (
              <div className="tiny" style={{ color: 'var(--text-muted)' }}>😴 Rest day · streak protected</div>
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
                background: isToday ? '#1A1A2E' : hadWorkout ? '#3B5C6B' : 'var(--bg-card)',
                color: isToday || hadWorkout ? '#F5F0E6' : '#6B6457',
                fontFamily: 'JetBrains Mono', fontSize: 12, margin: '0 auto',
                border: '1px solid var(--border)',
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
