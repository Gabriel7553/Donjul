import { useState } from 'react';
import { Line, LineChart, Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Scale, Apple, Wallet, Flame } from 'lucide-react';
import { todayStr, pad, fmtShortDate, diffDays, addMonth } from '../lib/date';
import { fmtMoney, spendingByMonth, monthKey, monthShort, prevMonth } from '../lib/money';
import { calorieGoal } from '../lib/body';
import type { Settings, BodyState, MealsState, SpendingState, StudyTotals, Checkins, Streaks } from '../lib/types';

const RANGES = [{ k: 30, label: '30d' }, { k: 90, label: '90d' }];
const AXIS = { fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' } as const;
const TIP = { fontFamily: 'JetBrains Mono', fontSize: 12, borderRadius: 8 } as const;
const HEAT = ['#EAE3D2', '#C9DDBB', '#9DC086', '#6E9E5A', '#4A6741'];
const HEAT_WEEKS = 16;
const MEASURES = [
  { key: 'waist', label: 'Waist', color: '#B8460E' },
  { key: 'chest', label: 'Chest', color: '#3B5C6B' },
  { key: 'hips', label: 'Hips', color: '#8E4585' },
];

function daysAgoStr(i: number): string {
  const d = new Date(todayStr() + 'T00:00:00');
  d.setDate(d.getDate() - i);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const mdLabel = (ds: string) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;
const monthLabelFromDays = (days: number) => {
  const d = new Date(todayStr() + 'T00:00:00');
  d.setDate(d.getDate() + Math.round(days));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};
const monthLabelFromMonths = (m: number) => new Date(addMonth(todayStr(), Math.max(0, Math.round(m))) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

function StatTile({ icon, label, value, sub, color, onClick }: any) {
  return (
    <div className="card" style={{ margin: 0, padding: 14, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="row" style={{ gap: 6, marginBottom: 8, color }}>
        {icon}
        <span className="h2" style={{ margin: 0 }}>{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      {sub && <div className="tiny muted" style={{ marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export function InsightsTab({ settings, body, meals, spending, totals, checkins, streaks, workout, onNavigate }: {
  settings: Settings; body: BodyState; meals: MealsState; spending: SpendingState;
  totals: StudyTotals; checkins: Checkins; streaks: Streaks; workout?: any; onNavigate?: (tab: string) => void;
}) {
  const [range, setRange] = useState(30);
  const unit = settings?.weightUnit || 'lb';

  // ── Weight (uses all dated weigh-ins; they're sparse) ──
  const wEntries = (body?.entries || []).filter((e: any) => e?.date && Number(e.weight) > 0);
  const wData = wEntries.map((e: any) => ({ label: fmtShortDate(e.date), weight: Number(e.weight) }));
  const wFirst = wEntries[0]?.weight;
  const wLast = wEntries[wEntries.length - 1]?.weight;
  const wDelta = (wFirst != null && wLast != null) ? Math.round((wLast - wFirst) * 10) / 10 : null;

  // ── Body measurements trend (only fields with ≥2 points) ──
  const presentMeasures = MEASURES.filter((m) => wEntries.filter((e: any) => Number(e[m.key]) > 0).length >= 2);
  const measureData = wEntries.map((e: any) => {
    const o: any = { label: fmtShortDate(e.date) };
    for (const m of presentMeasures) o[m.key] = Number(e[m.key]) || null;
    return o;
  });

  // ── Calories (daily, windowed) ──
  const calGoal = calorieGoal(settings, body);
  const calData: any[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const ds = daysAgoStr(i);
    calData.push({ label: mdLabel(ds), calories: Math.round(meals?.log?.[ds]?.calories || 0) });
  }
  const loggedCal = calData.filter((d) => d.calories > 0);
  const avgCal = loggedCal.length ? Math.round(loggedCal.reduce((a, d) => a + d.calories, 0) / loggedCal.length) : 0;

  // ── Spending (last 6 months) + cumulative net ──
  const months: string[] = [];
  let ym = monthKey(todayStr());
  for (let i = 0; i < 6; i++) { months.unshift(ym); ym = prevMonth(ym); }
  const spendData = months.map((m) => {
    const { income, spent } = spendingByMonth(spending?.entries || [], m);
    return { label: monthShort(m), spent: Math.round(spent), income: Math.round(income) };
  });
  let running = 0;
  const cumData = months.map((m) => { running += spendingByMonth(spending?.entries || [], m).net; return { label: monthShort(m), cum: Math.round(running) }; });
  const thisMonth = spendingByMonth(spending?.entries || [], monthKey(todayStr()));
  const hasSpend = (spending?.entries || []).length > 0;

  // ── Study consistency (per-day count of subject check-ins) ──
  const checkByDay: Record<string, number> = {};
  for (const k of Object.keys(checkins || {})) {
    for (const d of (checkins[k] || [])) checkByDay[d] = (checkByDay[d] || 0) + 1;
  }
  const studyData: any[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const ds = daysAgoStr(i);
    studyData.push({ label: mdLabel(ds), count: checkByDay[ds] || 0 });
  }
  const studyDays = studyData.filter((d) => d.count > 0).length;
  const bestStreak = Math.max(0, ...Object.values(streaks || {}).map((s: any) => Number(s?.current) || 0));
  const hasStudy = Object.keys(checkByDay).length > 0;
  const totalMins = (Object.values(totals || {}) as any[]).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

  // ── Activity heatmap (domains logged per day, last 16 weeks) ──
  const bodyDates = new Set((body?.entries || []).map((e: any) => e.date));
  const moneyDates = new Set((spending?.entries || []).map((e: any) => e.date));
  const domainCount = (ds: string) => {
    let n = 0;
    if ((checkByDay[ds] || 0) > 0) n++;
    if (workout?.logs?.[ds]) n++;
    if ((meals?.log?.[ds]?.calories || 0) > 0) n++;
    if (bodyDates.has(ds)) n++;
    if (moneyDates.has(ds)) n++;
    return n;
  };
  const heatStart = new Date(todayStr() + 'T00:00:00');
  heatStart.setDate(heatStart.getDate() - heatStart.getDay() - (HEAT_WEEKS - 1) * 7);
  const heatWeeks: ({ date: string; count: number } | null)[][] = [];
  const heatCur = new Date(heatStart);
  const heatToday = todayStr();
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const col: ({ date: string; count: number } | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const ds = `${heatCur.getFullYear()}-${pad(heatCur.getMonth() + 1)}-${pad(heatCur.getDate())}`;
      col.push(ds > heatToday ? null : { date: ds, count: domainCount(ds) });
      heatCur.setDate(heatCur.getDate() + 1);
    }
    heatWeeks.push(col);
  }
  const heatActive = heatWeeks.reduce((a, wk) => a + wk.filter((c) => c && c.count > 0).length, 0);

  // ── Projections (at recent pace) ──
  const wGoal = Number(settings?.bodyGoals?.weight?.target) || 0;
  let weightEta: string | null = null;
  if (wGoal > 0 && wEntries.length >= 2 && wLast != null && wFirst != null) {
    const spanDays = Math.max(1, diffDays(wEntries[wEntries.length - 1].date, wEntries[0].date));
    const ratePerDay = (wLast - wFirst) / spanDays;
    const remaining = wGoal - wLast;
    if (Math.abs(remaining) < 0.5) weightEta = 'at goal';
    else if (ratePerDay !== 0 && Math.sign(remaining) === Math.sign(ratePerDay)) weightEta = `≈ ${monthLabelFromDays(remaining / ratePerDay)}`;
    else weightEta = 'trending away';
  }
  const savingsGoal = Number(spending?.savingsGoal) || 0;
  let savingsEta: string | null = null;
  if (savingsGoal > 0) {
    const allNet = (spending?.entries || []).reduce((a: number, e: any) => a + (e.type === 'in' ? 1 : -1) * (Number(e.amount) || 0), 0);
    const activeMonths = months.filter((m) => { const r = spendingByMonth(spending?.entries || [], m); return r.income || r.spent; });
    const avgMonthlyNet = activeMonths.length ? activeMonths.reduce((a, m) => a + spendingByMonth(spending?.entries || [], m).net, 0) / activeMonths.length : 0;
    const remaining = savingsGoal - allNet;
    if (remaining <= 0) savingsEta = 'reached';
    else if (avgMonthlyNet > 0) savingsEta = `≈ ${monthLabelFromMonths(remaining / avgMonthlyNet)}`;
    else savingsEta = 'need positive net';
  }

  const anyData = wData.length > 0 || loggedCal.length > 0 || hasSpend || hasStudy;
  const tick = Math.max(1, Math.floor(range / 6));

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <div className="h1">Insights</div>
        <div className="row" style={{ gap: 6 }}>
          {RANGES.map((r) => (
            <button key={r.k} className={`tap ${range === r.k ? 'active' : ''}`} onClick={() => setRange(r.k)}>{r.label}</button>
          ))}
        </div>
      </div>

      {!anyData ? (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div className="muted small">Log meals, weigh-ins, spending, or study time and your trends will show up here.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <StatTile icon={<Scale size={14} />} color="#8E4585" label="Weight" onClick={() => onNavigate?.('body')}
              value={wLast != null ? `${wLast} ${unit}` : '—'}
              sub={wDelta != null ? `${wDelta > 0 ? '+' : ''}${wDelta} ${unit} overall` : 'no weigh-ins yet'} />
            <StatTile icon={<Apple size={14} />} color="#4A6741" label="Avg kcal" onClick={() => onNavigate?.('food')}
              value={avgCal > 0 ? avgCal : '—'}
              sub={`goal ${calGoal} · ${range}d`} />
            <StatTile icon={<Wallet size={14} />} color="#3F7A4F" label="Net this mo." onClick={() => onNavigate?.('money')}
              value={fmtMoney(thisMonth.net, { signed: true })}
              sub={`${fmtMoney(thisMonth.spent)} spent`} />
            <StatTile icon={<Flame size={14} />} color="#C8932E" label="Study days" onClick={() => onNavigate?.('history')}
              value={`${studyDays}`}
              sub={`best streak ${bestStreak}d · ${Math.round(totalMins / 60)}h total`} />
          </div>

          {(weightEta || savingsEta) && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Projections · at recent pace</div>
              {weightEta && (
                <div className="between" style={{ padding: '6px 0', borderBottom: savingsEta ? '1px solid var(--border)' : 'none' }}>
                  <span className="small">Weight goal · {wGoal} {unit}</span>
                  <span className="mono small" style={{ color: '#8E4585' }}>{weightEta}</span>
                </div>
              )}
              {savingsEta && (
                <div className="between" style={{ padding: '6px 0' }}>
                  <span className="small">Savings goal · {fmtMoney(savingsGoal)}</span>
                  <span className="mono small" style={{ color: '#3F7A4F' }}>{savingsEta}</span>
                </div>
              )}
            </div>
          )}

          {heatActive > 0 && (
            <div className="card">
              <div className="between" style={{ marginBottom: 10 }}>
                <div className="h2" style={{ margin: 0 }}>Activity · {HEAT_WEEKS} weeks</div>
                <div className="row" style={{ gap: 3, alignItems: 'center' }}>
                  <span className="tiny muted" style={{ marginRight: 2 }}>less</span>
                  {HEAT.map((c, i) => <span key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />)}
                  <span className="tiny muted" style={{ marginLeft: 2 }}>more</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2 }}>
                {heatWeeks.map((wk, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {wk.map((cell, di) => (
                      <div key={di} title={cell ? `${cell.date} · ${cell.count} logged` : ''}
                        style={{ width: 12, height: 12, borderRadius: 2, flex: '0 0 auto', background: cell ? HEAT[cell.count === 0 ? 0 : Math.min(4, cell.count)] : 'transparent' }} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mono tiny muted" style={{ textAlign: 'center', marginTop: 8 }}>Domains logged per day · {heatActive} active days</div>
            </div>
          )}

          {wData.length >= 2 && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Weight · {unit}</div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={wData} margin={{ top: 5, right: 12, left: -4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" minTickGap={28} />
                  <YAxis tick={AXIS} domain={['dataMin - 2', 'dataMax + 2'] as any} width={42} />
                  <Tooltip contentStyle={TIP} />
                  <Line type="monotone" dataKey="weight" stroke="#8E4585" strokeWidth={2} dot={{ r: 2.5, fill: '#8E4585' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {presentMeasures.length > 0 && (
            <div className="card">
              <div className="between" style={{ marginBottom: 10 }}>
                <div className="h2" style={{ margin: 0 }}>Measurements · {settings?.lengthUnit || 'in'}</div>
                <div className="row" style={{ gap: 10 }}>
                  {presentMeasures.map((m) => <span key={m.key} className="tiny muted"><span className="swatch" style={{ background: m.color }} />{m.label}</span>)}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={measureData} margin={{ top: 5, right: 12, left: -4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" minTickGap={28} />
                  <YAxis tick={AXIS} domain={['dataMin - 1', 'dataMax + 1'] as any} width={42} />
                  <Tooltip contentStyle={TIP} />
                  {presentMeasures.map((m) => <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={{ r: 2, fill: m.color }} connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {loggedCal.length > 0 && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Calories · last {range} days</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={calData} margin={{ top: 5, right: 8, left: -4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} interval={tick} />
                  <YAxis tick={AXIS} width={42} />
                  <Tooltip contentStyle={TIP} />
                  <ReferenceLine y={calGoal} stroke="#B8460E" strokeDasharray="4 3" />
                  <Bar dataKey="calories" fill="#4A6741" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mono tiny muted" style={{ textAlign: 'center' }}>Goal {calGoal} kcal/day · avg {avgCal}</div>
            </div>
          )}

          {hasSpend && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Income vs spending · 6 months</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={spendData} margin={{ top: 5, right: 8, left: -2, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} />
                  <YAxis tick={AXIS} width={42} />
                  <Tooltip contentStyle={TIP} formatter={(v: any) => fmtMoney(Number(v))} />
                  <Bar dataKey="income" fill="#3F7A4F" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="spent" fill="#B8460E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mono tiny muted" style={{ textAlign: 'center' }}>This month net {fmtMoney(thisMonth.net, { signed: true })}</div>
            </div>
          )}

          {hasSpend && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Cumulative net · 6 months</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={cumData} margin={{ top: 5, right: 12, left: -2, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} />
                  <YAxis tick={AXIS} width={42} />
                  <Tooltip contentStyle={TIP} formatter={(v: any) => fmtMoney(Number(v))} />
                  <ReferenceLine y={0} stroke="#6B6457" strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="cum" stroke="#3F7A4F" strokeWidth={2} dot={{ r: 2, fill: '#3F7A4F' }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mono tiny muted" style={{ textAlign: 'center' }}>Running income − spending</div>
            </div>
          )}

          {hasStudy && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Study consistency · last {range} days</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={studyData} margin={{ top: 5, right: 8, left: -28, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} interval={tick} />
                  <YAxis tick={AXIS} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={TIP} />
                  <Bar dataKey="count" fill="#3B5C6B" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mono tiny muted" style={{ textAlign: 'center' }}>{studyDays} active days · best streak {bestStreak}d</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
