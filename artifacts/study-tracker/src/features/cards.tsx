import { useState } from 'react';
import { RotateCcw, Plus, Zap, Apple, ChevronUp, ChevronDown } from 'lucide-react';
import { DEFAULT_MICRO_TARGETS, MICRO_DEFS, type MicroDef } from '../lib/nutrition';

export function MacrosCard({ targets, totals, onLog, onReset, onCoach }: any) {
  const [confirmReset, setConfirmReset] = useState(false);
  const items = [
    { key: 'protein', label: 'Protein', unit: 'g', primary: true, color: '#B8460E' },
    { key: 'calories', label: 'Calories', unit: '', color: '#3B5C6B' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: '#4A6741' },
    { key: 'fat', label: 'Fat', unit: 'g', color: '#C8932E' },
  ];
  const hasData = (totals.protein || 0) + (totals.calories || 0) > 0;
  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 12 }}>
        <div className="h2">Today's macros</div>
        <div className="row" style={{ gap: 6 }}>
          {hasData && !confirmReset && (
            <button className="tap" onClick={() => setConfirmReset(true)} style={{ padding: '6px 10px', fontSize: 12, color: '#B8460E' }}>
              <RotateCcw size={12} style={{ verticalAlign: 'middle' }} />
            </button>
          )}
          {confirmReset && (
            <>
              <button className="tap" style={{ padding: '6px 10px', fontSize: 11, color: '#B8460E', borderColor: '#B8460E' }} onClick={() => { onReset(); setConfirmReset(false); }}>Reset</button>
              <button className="tap" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => setConfirmReset(false)}>Cancel</button>
            </>
          )}
          <button className="tap" onClick={onLog} style={{ padding: '6px 12px', fontSize: 12 }}>
            <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log meal
          </button>
        </div>
      </div>
      {items.map(it => {
        const t = targets[it.key];
        const c = totals[it.key] || 0;
        const pct = Math.min(100, (c / Math.max(t, 1)) * 100);
        const over = c > t;
        return (
          <div key={it.key} style={{ marginBottom: 10 }}>
            <div className="between" style={{ marginBottom: 4 }}>
              <span className="small" style={{ fontWeight: it.primary ? 600 : 400 }}>{it.label}{it.primary && ' ★'}</span>
              <span className="mono tiny" style={{ color: over && it.primary ? '#4A6741' : over ? '#C8932E' : '#6B6457' }}>
                {Math.round(c)} / {t}{it.unit}
              </span>
            </div>
            <div className="progress-bar" style={{ height: 4 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: over ? (it.primary ? '#4A6741' : '#C8932E') : it.color }} />
            </div>
          </div>
        );
      })}
      <button className="tap" onClick={onCoach} style={{ width: '100%', marginTop: 8, color: '#8E4585', borderColor: '#8E4585' }}>
        <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Ask the nutrition coach
      </button>
      <div className="muted tiny" style={{ lineHeight: 1.4, marginTop: 8 }}>★ Protein is your priority. Hit that first. Rotate arrow to reset.</div>
    </div>
  );
}

export function MicrosCard({ targets, totals }: any) {
  const [open, setOpen] = useState(false);
  const t = { ...DEFAULT_MICRO_TARGETS, ...(targets || {}) };
  const groups: Array<{ title: string; group: MicroDef['group'] }> = [
    { title: 'Fiber', group: 'fiber' },
    { title: 'Minerals', group: 'minerals' },
    { title: 'Vitamins', group: 'vitamins' },
    { title: 'Limits', group: 'limits' },
  ];
  const fmtVal = (v: number) => v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  // Headline coverage = avg % of essential micros hit (excluding limits).
  const essentials = MICRO_DEFS.filter(d => !d.limit);
  const coverage = Math.round(
    essentials.reduce((acc, d) => acc + Math.min(100, ((totals[d.key] || 0) / Math.max(t[d.key] || 1, 1)) * 100), 0) / essentials.length
  );
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)} className="between" style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <Apple size={16} color="#4A6741" />
          <div style={{ textAlign: 'left' }}>
            <div className="h2" style={{ marginBottom: 2 }}>Today's micros</div>
            <div className="mono tiny muted">{coverage}% essentials covered · tap to {open ? 'hide' : 'see'} details</div>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="#6B6457" /> : <ChevronDown size={16} color="#6B6457" />}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {groups.map(g => {
            const defs = MICRO_DEFS.filter(d => d.group === g.group);
            return (
              <div key={g.group} style={{ marginBottom: 12 }}>
                <div className="mono tiny muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.title}</div>
                {defs.map(d => {
                  const tgt = t[d.key] || d.defaultTarget;
                  const c = totals[d.key] || 0;
                  const pct = Math.min(100, (c / Math.max(tgt, 1)) * 100);
                  const over = c > tgt;
                  // For limits: green when under, orange when over. For essentials: gray when low, green when hit.
                  const barColor = d.limit
                    ? (over ? '#B8460E' : '#4A6741')
                    : (pct >= 100 ? '#4A6741' : d.color);
                  return (
                    <div key={d.key} style={{ marginBottom: 8 }}>
                      <div className="between" style={{ marginBottom: 3 }}>
                        <span className="small">{d.label}{d.limit && <span className="muted tiny" style={{ marginLeft: 6 }}>(limit)</span>}</span>
                        <span className="mono tiny" style={{ color: d.limit ? (over ? '#B8460E' : '#6B6457') : (pct >= 100 ? '#4A6741' : '#6B6457') }}>
                          {fmtVal(c)} / {fmtVal(tgt)} {d.unit}
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 3 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <p className="muted tiny" style={{ lineHeight: 1.4, marginTop: 4 }}>
            Micros are estimated from your logged foods. Use the AI scan or "type food" for the most accurate readings — they include vitamins, minerals, and limits.
          </p>
        </div>
      )}
    </div>
  );
}
