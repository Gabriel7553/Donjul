import { useState } from 'react';
import { Line, LineChart, Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Scale, Apple, Wallet, Flame } from 'lucide-react';
import { todayStr, pad, fmtShortDate } from '../lib/date';
import { fmtMoney, spendingByMonth, monthKey, monthShort, prevMonth } from '../lib/money';
import { calorieGoal } from '../lib/body';

const RANGES = [{ k: 30, label: '30d' }, { k: 90, label: '90d' }];
const AXIS = { fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' } as const;
const TIP = { fontFamily: 'JetBrains Mono', fontSize: 12, borderRadius: 8 } as const;

function daysAgoStr(i: number): string {
  const d = new Date(todayStr() + 'T00:00:00');
  d.setDate(d.getDate() - i);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const mdLabel = (ds: string) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8, 10))}`;

function StatTile({ icon, label, value, sub, color }: any) {
  return (
    <div className="card" style={{ margin: 0, padding: 14 }}>
      <div className="row" style={{ gap: 6, marginBottom: 8, color }}>
        {icon}
        <span className="h2" style={{ margin: 0 }}>{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      {sub && <div className="tiny muted" style={{ marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export function InsightsTab({ settings, body, meals, spending, totals, checkins, streaks }: any) {
  const [range, setRange] = useState(30);
  const unit = settings?.weightUnit || 'lb';

  // ── Weight (uses all dated weigh-ins; they're sparse) ──
  const wEntries = (body?.entries || []).filter((e: any) => e?.date && Number(e.weight) > 0);
  const wData = wEntries.map((e: any) => ({ label: fmtShortDate(e.date), weight: Number(e.weight) }));
  const wFirst = wEntries[0]?.weight;
  const wLast = wEntries[wEntries.length - 1]?.weight;
  const wDelta = (wFirst != null && wLast != null) ? Math.round((wLast - wFirst) * 10) / 10 : null;

  // ── Calories (daily, windowed) ──
  const calGoal = calorieGoal(settings, body);
  const calData: any[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const ds = daysAgoStr(i);
    calData.push({ label: mdLabel(ds), calories: Math.round(meals?.log?.[ds]?.calories || 0) });
  }
  const loggedCal = calData.filter((d) => d.calories > 0);
  const avgCal = loggedCal.length ? Math.round(loggedCal.reduce((a, d) => a + d.calories, 0) / loggedCal.length) : 0;

  // ── Spending (last 6 months) ──
  const months: string[] = [];
  let ym = monthKey(todayStr());
  for (let i = 0; i < 6; i++) { months.unshift(ym); ym = prevMonth(ym); }
  const spendData = months.map((m) => {
    const { income, spent } = spendingByMonth(spending?.entries || [], m);
    return { label: monthShort(m), spent: Math.round(spent), income: Math.round(income) };
  });
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
            <StatTile icon={<Scale size={14} />} color="#8E4585" label="Weight"
              value={wLast != null ? `${wLast} ${unit}` : '—'}
              sub={wDelta != null ? `${wDelta > 0 ? '+' : ''}${wDelta} ${unit} overall` : 'no weigh-ins yet'} />
            <StatTile icon={<Apple size={14} />} color="#4A6741" label="Avg kcal"
              value={avgCal > 0 ? avgCal : '—'}
              sub={`goal ${calGoal} · ${range}d`} />
            <StatTile icon={<Wallet size={14} />} color="#3F7A4F" label="Net this mo."
              value={fmtMoney(thisMonth.net, { signed: true })}
              sub={`${fmtMoney(thisMonth.spent)} spent`} />
            <StatTile icon={<Flame size={14} />} color="#C8932E" label="Study days"
              value={`${studyDays}`}
              sub={`best streak ${bestStreak}d · ${Math.round(totalMins / 60)}h total`} />
          </div>

          {wData.length >= 2 && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Weight · {unit}</div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={wData} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" minTickGap={28} />
                  <YAxis tick={AXIS} domain={['dataMin - 2', 'dataMax + 2'] as any} width={34} />
                  <Tooltip contentStyle={TIP} />
                  <Line type="monotone" dataKey="weight" stroke="#8E4585" strokeWidth={2} dot={{ r: 2.5, fill: '#8E4585' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {loggedCal.length > 0 && (
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Calories · last {range} days</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={calData} margin={{ top: 5, right: 8, left: -14, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS} interval={tick} />
                  <YAxis tick={AXIS} width={34} />
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
