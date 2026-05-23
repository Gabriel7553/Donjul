import React, { useState, useEffect, useMemo } from 'react';
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
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { pad, todayStr, diffDays, fmtShortDate } from '../lib/date';
import { ACCOUNT_COLORS, DEBT_TYPES, MONEY_DEFAULT_ORDER, MONEY_LABELS, calcDailyInterest, calcMonthlyInterest, calcPayoffMonths, calcTotalInterestAtMin, fmtMoney, fmtPayoff, monthKey, monthLabel, monthShort, nextMonth, prevMonth, spendingByMonth } from '../lib/money';
import { CURRENT_TAX_YEAR, PAYER_PRESETS, calcTaxEstimate, makeYearData, migrateTax } from '../lib/tax';
import { ModalShell, SortableRow, useDndSensors } from '../ui';

export function IncomePlannerModal({ spending, onSave, onClose }: any) {
  const inc = spending.income || {};
  const [w2Monthly, setW2Monthly] = useState(String(inc.w2Monthly || ''));
  const [w2YTD, setW2YTD] = useState(String(inc.w2YTD || ''));
  const [w2Employer, setW2Employer] = useState(inc.w2Employer || '');
  const [expectedTrading, setExpectedTrading] = useState(String(inc.expectedTrading || ''));

  const save = () => {
    onSave({ ...spending, income: { w2Monthly: parseFloat(w2Monthly) || 0, w2YTD: parseFloat(w2YTD) || 0, w2Employer: w2Employer.trim(), expectedTrading: parseFloat(expectedTrading) || 0 } });
    onClose();
  };
  const total = (parseFloat(w2Monthly) || 0) + (parseFloat(expectedTrading) || 0);

  return (
    <ModalShell title="Income setup" onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 16 }}>Set your income so Donjul can track YTD totals and project debt payoff.</p>
      <div className="h3" style={{ marginBottom: 8 }}>💼 W-2 / Guaranteed</div>
      <label>Employer</label>
      <input type="text" value={w2Employer} onChange={(e) => setW2Employer(e.target.value)} placeholder="Your employer" style={{ marginBottom: 12 }} />
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Monthly net (after tax)</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}><span className="mono muted">$</span><input type="number" step="0.01" value={w2Monthly} onChange={(e) => setW2Monthly(e.target.value)} placeholder="0.00" style={{ flex: 1 }} /></div>
        </div>
        <div style={{ flex: 1 }}>
          <label>W-2 gross YTD (from paystub)</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}><span className="mono muted">$</span><input type="number" step="0.01" value={w2YTD} onChange={(e) => setW2YTD(e.target.value)} placeholder="e.g. 34120.40" style={{ flex: 1 }} /></div>
        </div>
      </div>
      <div className="h3" style={{ marginBottom: 8 }}>📈 1099 / Trading</div>
      <label>Average monthly trading profit (pre-tax)</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span className="mono muted">$</span>
        <input type="number" step="0.01" value={expectedTrading} onChange={(e) => setExpectedTrading(e.target.value)} placeholder="0.00 (avg)" style={{ flex: 1 }} />
      </div>
      <div className="tiny muted" style={{ marginBottom: 16 }}>Add exact 1099 payouts in the Tax Tracker — they'll auto-appear in your YTD summary.</div>
      {total > 0 && (
        <div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F33', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div className="tiny muted">Expected monthly</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(total)}/mo</div>
          {(parseFloat(w2Monthly)||0) > 0 && (parseFloat(expectedTrading)||0) > 0 && <div className="tiny muted">{fmtMoney(parseFloat(w2Monthly)||0)} W2 + {fmtMoney(parseFloat(expectedTrading)||0)} trading</div>}
        </div>
      )}
      <button className="btn" style={{ width: '100%' }} onClick={save}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — TAX TRACKER MODAL (1099 / California / Federal)
// ════════════════════════════════════════════════════════════════════════════════
export function TaxModal({ tax, spending, onSave, onClose }: any) {
  const [view, setView] = useState<'estimate'|'income'|'deductions'|'payments'>('estimate');
  const [draft, setDraft] = useState<any>(() => {
    const t = migrateTax(tax);
    return t;
  });

  // Which year the user is viewing
  const availableYears = Object.keys(draft.years || {}).map(Number).sort((a, b) => b - a);
  const [viewYear, setViewYear] = useState<number>(draft.activeYear || CURRENT_TAX_YEAR);
  const isCurrentYear = viewYear === CURRENT_TAX_YEAR;

  // Year data shortcut + updater
  const yd: any = draft.years?.[viewYear] || makeYearData();
  const updateYD = (patch: Partial<ReturnType<typeof makeYearData>>) => {
    setDraft((d: any) => ({ ...d, years: { ...d.years, [viewYear]: { ...yd, ...patch } } }));
  };

  // Auto-sync W2 YTD from Income Planner
  const spendingW2YTD = Number((spending?.income || {}).w2YTD) || 0;
  const spendingW2Employer = (spending?.income || {}).w2Employer || '';
  const w2YTDForCalc = yd.w2YTDActual > 0 ? yd.w2YTDActual : spendingW2YTD;

  const est = calcTaxEstimate(yd, viewYear, w2YTDForCalc);

  // 1099 entry form
  const [newPayerId, setNewPayerId] = useState('tpt');
  const [newCustomPayer, setNewCustomPayer] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newDate, setNewDate] = useState(todayStr());
  const [newNote, setNewNote] = useState('');

  // Quarterly payment form
  const [newPayment, setNewPayment] = useState({ quarter: 'Q1', amount: '', datePaid: todayStr() });

  const quarters = (yr: number) => [
    { q: 'Q1', due: `Apr 15, ${yr}` },
    { q: 'Q2', due: `Jun 15, ${yr}` },
    { q: 'Q3', due: `Sep 15, ${yr}` },
    { q: 'Q4', due: `Jan 15, ${yr + 1}` },
  ];

  const addEntry = () => {
    const amt = parseFloat(newAmt);
    if (!amt || amt <= 0) { toast.error('Enter an amount'); return; }
    const preset = PAYER_PRESETS.find(p => p.id === newPayerId);
    const payerName = newPayerId === 'other_1099' || newPayerId === 'other_w2'
      ? (newCustomPayer.trim() || 'Other')
      : (preset?.label.split(' (')[0] || newCustomPayer.trim() || 'Unknown');
    const e = {
      id: `t1099_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      payerId: newPayerId, payer: payerName, incomeType: preset?.type || '1099',
      amount: Math.round(amt * 100) / 100, date: newDate, description: newNote.trim(),
    };
    updateYD({ entries1099: [...(yd.entries1099 || []), e] });
    setNewAmt(''); setNewNote(''); setNewDate(todayStr());
    toast('Entry added — tax estimate updated');
  };

  const addPayment = () => {
    const amt = parseFloat(newPayment.amount);
    if (!amt || amt <= 0) { toast.error('Enter an amount'); return; }
    const p = { id: `qp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, quarter: newPayment.quarter, year: String(viewYear), amount: Math.round(amt * 100) / 100, datePaid: newPayment.datePaid };
    updateYD({ payments: [...(yd.payments || []), p] });
    setNewPayment({ quarter: 'Q1', amount: '', datePaid: todayStr() });
    toast('Payment recorded');
  };

  const saveAll = () => { onSave({ ...draft, activeYear: draft.activeYear }); onClose(); };
  const addYear = (yr: number) => {
    if (draft.years?.[yr]) { setViewYear(yr); return; }
    setDraft((d: any) => ({ ...d, years: { ...d.years, [yr]: makeYearData() } }));
    setViewYear(yr);
  };

  const qs = quarters(viewYear);
  const preset = PAYER_PRESETS.find(p => p.id === newPayerId);

  return (
    <ModalShell title={`Tax Tracker`} onClose={onClose}>
      {/* Year selector */}
      <div style={{ background: 'var(--bg-inset)', borderRadius: 10, padding: '8px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {availableYears.map(yr => (
            <button key={yr} onClick={() => setViewYear(yr)} className="tap" style={{ fontSize: 12, padding: '4px 10px', background: viewYear === yr ? '#8E4585' : 'transparent', color: viewYear === yr ? '#F5F0E6' : 'var(--text)', borderColor: viewYear === yr ? '#8E4585' : 'var(--border)' }}>
              {yr}{yr === CURRENT_TAX_YEAR ? ' ★' : ''}
            </button>
          ))}
        </div>
        {!draft.years?.[viewYear - 1] && (
          <button className="tap" onClick={() => addYear(viewYear - 1)} style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            + {viewYear - 1}
          </button>
        )}
      </div>

      {/* View tabs */}
      <div className="row" style={{ gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['estimate','📊 Estimate'],['income','💰 Income'],['deductions','✂️ Deductions'],['payments','💸 Payments']] as [string,string][]).map(([v,label]) => (
          <button key={v} className="tap" onClick={() => setView(v as any)} style={{ fontSize: 11, padding: '5px 10px', background: view === v ? '#8E4585' : 'transparent', color: view === v ? '#F5F0E6' : 'var(--text)', borderColor: view === v ? '#8E4585' : 'var(--border)' }}>{label}</button>
        ))}
      </div>

      {/* ── ESTIMATE ── */}
      {view === 'estimate' && (
        <>
          {est.totalGross === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div className="small muted">Add income entries to see your {viewYear} tax estimate.</div>
              <div className="tiny muted" style={{ marginTop: 6 }}>
                {spendingW2YTD > 0 ? `Income Planner W-2 YTD: ${fmtMoney(spendingW2YTD)} (synced)` : 'Go to Income tab to log your W-2 or 1099 income.'}
              </div>
            </div>
          ) : (
            <>
              {/* Header total */}
              <div style={{ background: '#8E458515', border: '1px solid #8E458530', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div className="h2" style={{ marginBottom: 4 }}>Total estimated {viewYear} tax</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#8E4585' }}>{fmtMoney(est.totalTax)}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Effective rate: {est.effectiveRate.toFixed(1)}% · Total gross: {fmtMoney(est.totalGross)}</div>
              </div>

              {/* Tax breakdown grid */}
              <div className="h2" style={{ marginBottom: 8 }}>Federal</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {([
                  ['Income tax', est.fedIncome, '#3B5C6B'],
                  ['SE — Social Security', est.seSS, '#B8460E'],
                  ['SE — Medicare', est.seMed, '#B8460E'],
                  ['½ SE deduction', -est.halfSE, '#3F7A4F'],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} style={{ background: 'var(--bg-inset2)', borderRadius: 8, padding: '9px 11px' }}>
                    <div className="tiny muted" style={{ marginBottom: 2 }}>{label}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>{val < 0 ? `−${fmtMoney(-val)}` : fmtMoney(val)}</div>
                  </div>
                ))}
              </div>
              <div className="h2" style={{ marginBottom: 8 }}>California</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                {([
                  ['CA Income tax', est.caIncome, '#3B5C6B'],
                  ['CA SDI (1.1%)', est.caSDI, '#6B6457'],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} style={{ background: 'var(--bg-inset2)', borderRadius: 8, padding: '9px 11px' }}>
                    <div className="tiny muted" style={{ marginBottom: 2 }}>{label}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>{fmtMoney(val)}</div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div style={{ background: 'var(--bg-inset)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                {[
                  ['W-2 gross YTD', fmtMoney(est.w2Gross), w2YTDForCalc > 0 && spendingW2YTD > 0 && yd.w2YTDActual === 0 ? ' (synced)' : ''],
                  ['1099 net (after deductions)', fmtMoney(est.netTrading), ''],
                  [`Std. deduction ${viewYear}`, `−${fmtMoney(est.stdDeduct)}`, ''],
                  ['Federal AGI', fmtMoney(est.fedAGI), ''],
                  ['Total withheld/paid', `−${fmtMoney(est.totalWithheld)}`, ''],
                ].map(([l, v, note]) => (
                  <div key={l as string} className="between" style={{ marginBottom: 5 }}>
                    <span className="tiny muted">{l as string}{note ? <span style={{ color: '#3F7A4F', fontSize: 10 }}>{note}</span> : ''}</span>
                    <span className="mono tiny" style={{ color: 'var(--text)' }}>{v as string}</span>
                  </div>
                ))}
                <div className="between" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span className="small" style={{ fontWeight: 600, color: 'var(--text)' }}>Still owed</span>
                  <span className="mono small" style={{ fontWeight: 700, color: est.netOwed > 0 ? '#B8460E' : '#3F7A4F' }}>{est.netOwed > 0 ? fmtMoney(est.netOwed) : '✓ Covered!'}</span>
                </div>
              </div>

              {est.netOwed > 0 && (
                <div style={{ background: '#C8932E15', border: '1px solid #C8932E40', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div className="tiny muted">Recommended quarterly payment</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#C8932E' }}>{fmtMoney(est.quarterly)}/quarter</div>
                  <div className="tiny muted">= {fmtMoney(est.totalTax / 12)}/mo to set aside</div>
                </div>
              )}
              <div className="tiny muted" style={{ textAlign: 'center' }}>{viewYear} CA + Federal brackets · Single filer · Self-employed 15.3% SE tax</div>
            </>
          )}
          <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
        </>
      )}

      {/* ── INCOME ── */}
      {view === 'income' && (
        <>
          {/* W-2 setup */}
          <div style={{ background: 'var(--bg-inset)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div className="h3" style={{ marginBottom: 10, color: 'var(--text)' }}>💼 W-2 Income</div>
            <label>Employer</label>
            <input type="text" value={yd.w2Employer || ''} onChange={(e) => updateYD({ w2Employer: e.target.value })} placeholder="Vsolvit" style={{ marginBottom: 10 }} />
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label>Annual gross (projected)</label>
                <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="100" value={yd.w2GrossAnnual || ''} onChange={(e) => updateYD({ w2GrossAnnual: parseFloat(e.target.value) || 0 })} placeholder="0" style={{ flex: 1 }} /></div>
              </div>
              <div style={{ flex: 1 }}>
                <label>Actual W-2 gross YTD</label>
                <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={yd.w2YTDActual || ''} onChange={(e) => updateYD({ w2YTDActual: parseFloat(e.target.value) || 0 })} placeholder={spendingW2YTD > 0 ? `${spendingW2YTD} (synced)` : '0.00'} style={{ flex: 1 }} /></div>
              </div>
            </div>
            {spendingW2YTD > 0 && yd.w2YTDActual === 0 && (
              <div style={{ background: '#3F7A4F18', border: '1px solid #3F7A4F33', borderRadius: 6, padding: '6px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="tiny" style={{ color: '#3F7A4F' }}>📌 Income Planner YTD: {fmtMoney(spendingW2YTD)}{spendingW2Employer ? ` · ${spendingW2Employer}` : ''}</span>
                <button className="tap" onClick={() => updateYD({ w2YTDActual: spendingW2YTD, w2Employer: spendingW2Employer || yd.w2Employer })} style={{ fontSize: 10, padding: '3px 8px', color: '#3F7A4F', borderColor: '#3F7A4F' }}>Use this</button>
              </div>
            )}
            <div className="h3" style={{ margin: '10px 0 8px', color: 'var(--text)' }}>Withholding (from paystub YTD)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([['Federal income tax', 'w2WithheldFed'],['CA income tax', 'w2WithheldCA'],['Social Security (6.2%)', 'w2WithheldSS'],['Medicare (1.45%)', 'w2WithheldMedicare']] as [string, keyof ReturnType<typeof makeYearData>][]).map(([label, key]) => (
                <div key={key}>
                  <label>{label}</label>
                  <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={(yd[key] as number) || ''} onChange={(e) => updateYD({ [key]: parseFloat(e.target.value) || 0 })} placeholder="0.00" style={{ flex: 1 }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* 1099 add form */}
          <div style={{ background: 'var(--bg-inset)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div className="h3" style={{ marginBottom: 10, color: 'var(--text)' }}>📈 Add 1099 / Prop Firm Payout</div>
            <label>Income source</label>
            <select value={newPayerId} onChange={(e) => setNewPayerId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
              {PAYER_PRESETS.filter(p => p.type === '1099').map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              <optgroup label="W-2">
                {PAYER_PRESETS.filter(p => p.type === 'w2').map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </optgroup>
            </select>
            {(newPayerId === 'other_1099' || newPayerId === 'other_w2') && (
              <input type="text" value={newCustomPayer} onChange={(e) => setNewCustomPayer(e.target.value)} placeholder="Enter payer name" style={{ marginBottom: 8 }} />
            )}
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><label>Amount (gross payout)</label><div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={newAmt} onChange={(e) => setNewAmt(e.target.value)} placeholder="0.00" style={{ flex: 1 }} /></div></div>
              <div style={{ flex: 1 }}><label>Date received</label><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
            </div>
            <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Note (optional)" style={{ marginBottom: 10 }} />
            <button className="btn" style={{ width: '100%' }} onClick={addEntry}><Plus size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Add {preset?.type === 'w2' ? 'W-2' : '1099'} entry</button>
          </div>

          {/* Entries list */}
          <div className="between" style={{ marginBottom: 8 }}>
            <div className="h3" style={{ color: 'var(--text)' }}>YTD {viewYear} entries</div>
            <span className="mono small" style={{ color: '#3F7A4F', fontWeight: 700 }}>{fmtMoney(est.income1099)} total</span>
          </div>
          {(yd.entries1099 || []).length === 0 && <p className="small muted">No entries yet — log each payout by source.</p>}
          {[...(yd.entries1099 || [])].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((e: any) => (
            <div key={e.id} className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="small" style={{ fontWeight: 600, color: 'var(--text)' }}>{e.payer}</div>
                <div className="tiny muted">{fmtShortDate(e.date)} · {e.incomeType === 'w2' ? 'W-2' : '1099'}{e.description ? ` · ${e.description}` : ''}</div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className="mono small" style={{ fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(e.amount)}</span>
                <button className="tap" onClick={() => updateYD({ entries1099: (yd.entries1099 || []).filter((x: any) => x.id !== e.id) })} style={{ padding: '3px 6px', color: '#B8460E' }}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
          <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
        </>
      )}

      {/* ── DEDUCTIONS ── */}
      {view === 'deductions' && (
        <>
          <p className="small muted" style={{ marginBottom: 14 }}>These reduce your 1099 taxable income. Keep receipts for all deductions.</p>
          <div className="h3" style={{ marginBottom: 8, color: 'var(--text)' }}>🏠 Trading & Business Deductions</div>
          <div style={{ marginBottom: 8 }}>
            <label>Platform / data fees (Apex, NinjaTrader, etc.)</label>
            <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={yd.tradingExpenses || ''} onChange={(e) => updateYD({ tradingExpenses: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
          </div>
          {([['homeOffice', 'Home office (% of rent/mortgage)'],['equipment', 'Equipment (computer, monitors, desk)'],['software', 'Software subscriptions'],['internet', 'Internet (business %)'],['other', 'Other deductions']] as [string, string][]).map(([key, label]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <label>{label}</label>
              <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={(yd.deductions?.[key]) || ''} onChange={(e) => updateYD({ deductions: { ...yd.deductions, [key]: parseFloat(e.target.value) || 0 } })} placeholder="0.00" /></div>
            </div>
          ))}
          <div style={{ background: 'var(--bg-inset)', borderRadius: 8, padding: '10px 12px', marginTop: 8, marginBottom: 14 }}>
            <div className="between">
              <span className="small" style={{ color: 'var(--text)' }}>Total deductions</span>
              <span className="mono small" style={{ fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(est.dedTotal)}</span>
            </div>
            <div className="between" style={{ marginTop: 4 }}>
              <span className="tiny muted">1099 net taxable income</span>
              <span className="mono tiny" style={{ color: 'var(--text)' }}>{fmtMoney(est.netTrading)}</span>
            </div>
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save deductions</button>
        </>
      )}

      {/* ── PAYMENTS ── */}
      {view === 'payments' && (
        <>
          <div className="h3" style={{ marginBottom: 8, color: 'var(--text)' }}>Record estimated payment</div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Quarter</label>
              <select value={newPayment.quarter} onChange={(e) => setNewPayment({ ...newPayment, quarter: e.target.value })} style={{ width: '100%' }}>
                {qs.map((q) => <option key={q.q} value={q.q}>{q.q} {viewYear} (due {q.due})</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Amount</label>
              <div className="row" style={{ gap: 4 }}><span className="mono muted">$</span><input type="number" step="0.01" value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} placeholder="0.00" style={{ flex: 1 }} /></div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}><label>Date paid</label><input type="date" value={newPayment.datePaid} onChange={(e) => setNewPayment({ ...newPayment, datePaid: e.target.value })} /></div>
          <button className="btn" style={{ width: '100%', marginBottom: 16 }} onClick={addPayment}><Plus size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Record payment</button>

          <div className="h3" style={{ marginBottom: 8, color: 'var(--text)' }}>{viewYear} payment schedule</div>
          {qs.map((q) => {
            const paid = (yd.payments || []).filter((p: any) => p.quarter === q.q);
            const total = paid.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            return (
              <div key={q.q} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="between">
                  <div>
                    <div className="small" style={{ fontWeight: 600, color: 'var(--text)' }}>{q.q} {viewYear}</div>
                    <div className="tiny muted">Due {q.due}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>{total > 0 ? <span className="mono small" style={{ color: '#3F7A4F', fontWeight: 700 }}>✓ {fmtMoney(total)}</span> : <span className="tiny muted">—</span>}</div>
                </div>
                {paid.map((p: any) => (
                  <div key={p.id} className="between" style={{ paddingLeft: 12, marginTop: 4 }}>
                    <span className="tiny muted">{fmtShortDate(p.datePaid)}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono tiny" style={{ color: 'var(--text)' }}>{fmtMoney(p.amount)}</span>
                      <button className="tap" onClick={() => updateYD({ payments: (yd.payments || []).filter((x: any) => x.id !== p.id) })} style={{ padding: '2px 5px', color: '#B8460E' }}><Trash2 size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="between" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span className="small muted">Total paid {viewYear}</span>
            <span className="mono small" style={{ fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney((yd.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</span>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={saveAll}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save</button>
        </>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// CHALLENGE PAUSED — prompt after a missed day
// ════════════════════════════════════════════════════════════════════════════════
export function ChallengePausedModal({ challenges, settings, pausedIds, onSave, onClose }: any) {
  const idSet = new Set(Array.isArray(pausedIds) ? pausedIds : []);
  // Only show items still flagged paused — once Restart/End runs, the item disappears.
  const items = (challenges || []).filter((c: any) => idSet.has(c.id) && c.paused);
  useEffect(() => { if (!items.length) onClose(); }, [items.length]);
  if (!items.length) return null;
  const subjectName = (k: string) => settings?.subjects?.[k]?.name || k;
  const restart = async (id: string) => {
    const next = challenges.map((c: any) => c.id === id
      ? { ...c, paused: false, pausedReason: null, pausedAt: null, streak: 0, lastActionDate: null, restartedAt: todayStr() }
      : c);
    await onSave(next);
    toast('Challenge restarted — back to day 0.');
  };
  const end = async (id: string) => {
    if (!confirm('End this challenge for good? Your streak history is kept but it stops counting.')) return;
    const next = challenges.map((c: any) => c.id === id
      ? { ...c, paused: false, active: false, endedAt: todayStr(), endReason: 'missed' }
      : c);
    await onSave(next);
    toast('Challenge ended.');
  };
  return (
    <ModalShell title="Missed a day" onClose={onClose} icon={<Trophy size={18} color="#C8932E" />}>
      <p className="small muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
        You missed a day on {items.length === 1 ? 'this challenge' : 'these challenges'}. Pick what to do for each:
      </p>
      {items.map((c: any) => (
        <div key={c.id} className="card" style={{ padding: 14, marginBottom: 10, borderLeft: '3px solid #C8932E' }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>{c.label || `${subjectName(c.subjectKey)} streak`}</div>
          <div className="mono tiny muted" style={{ marginBottom: 10 }}>
            Last action: {c.lastActionDate || '—'} · Streak: {c.pausedStreak ?? c.streak ?? 0} day{(c.pausedStreak ?? c.streak ?? 0) === 1 ? '' : 's'}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" style={{ flex: 1, background: '#4A6741' }} onClick={() => restart(c.id)}>
              <RotateCcw size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Restart
            </button>
            <button className="tap" style={{ flex: 1, color: '#B8460E', borderColor: '#B8460E' }} onClick={() => end(c.id)}>
              <X size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />End
            </button>
          </div>
        </div>
      ))}
      <p className="muted tiny" style={{ marginTop: 8, lineHeight: 1.5 }}>
        Tip: use <strong>Rest day</strong> on the Today tab to protect your streak on planned off-days.
      </p>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// DAILY HABITS — CUSTOM CHALLENGES MODAL
// ════════════════════════════════════════════════════════════════════════════════
export function CustomChallengesModal({ challenges, settings, onSave, onClose }: any) {
  const [view, setView] = useState<'list'|'add'>('list');
  const [form, setForm] = useState({ name: '', subjectKey: '', days: '60' });
  const today = todayStr();

  const subjects = (settings.subjectOrder || [])
    .filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived && !settings.subjects[k].deletedAt)
    .map((k: string) => ({ key: k, ...settings.subjects[k] }));

  const createChallenge = () => {
    if (!form.name.trim()) { toast.error('Enter a challenge name'); return; }
    if (!form.subjectKey) { toast.error('Pick a subject to track'); return; }
    const ch = {
      id: `cch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: form.name.trim(),
      subjectKey: form.subjectKey,
      days: parseInt(form.days) || 0,
      startDate: today,
      active: true,
      streak: 0,
      longestStreak: 0,
      lastActionDate: null,
      restDates: [],
    };
    onSave([...challenges, ch]);
    setForm({ name: '', subjectKey: '', days: '60' });
    setView('list');
    toast(`"${ch.name}" started!`);
  };

  const archiveChallenge = (id: string) => {
    onSave(challenges.map((c: any) => c.id === id ? { ...c, active: false, completedDate: today } : c));
    toast('Challenge archived');
  };

  const deleteChallenge = (id: string) => {
    if (confirm('Delete this challenge? This cannot be undone.')) onSave(challenges.filter((c: any) => c.id !== id));
  };

  const activeChallenges = challenges.filter((c: any) => c.active);
  const archived = challenges.filter((c: any) => !c.active);

  return (
    <ModalShell title="Custom challenges" onClose={onClose} icon={<Trophy size={18} color="#C8932E" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className="tap" onClick={() => setView('list')} style={{ flex: 1, background: view === 'list' ? '#1A1A2E' : 'transparent', color: view === 'list' ? '#F5F0E6' : '#1A1A2E' }}>
          Active ({activeChallenges.length})
        </button>
        <button className="tap" onClick={() => setView('add')} style={{ flex: 1, background: view === 'add' ? '#1A1A2E' : 'transparent', color: view === 'add' ? '#F5F0E6' : '#1A1A2E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Plus size={12} /> New challenge
        </button>
      </div>

      {view === 'list' && (
        <>
          {activeChallenges.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
              <p className="small muted">No active challenges. Create one to track a subject streak.</p>
            </div>
          )}
          {activeChallenges.map((ch: any) => {
            const sub = settings.subjects?.[ch.subjectKey];
            const daysDone = ch.startDate ? Math.max(0, diffDays(today, ch.startDate)) : 0;
            const isOpen = !ch.days || ch.days === 0;
            const pct = isOpen ? 0 : Math.min(100, Math.round((daysDone / ch.days) * 100));
            const doneToday = ch.lastActionDate === today;
            const isRest = doneToday && (ch.restDates || []).includes(today);
            const isLogged = doneToday && !isRest;
            return (
              <div key={ch.id} style={{ padding: '12px 0', borderBottom: '1px solid #F0EAD8' }}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <div>
                    <div className="small" style={{ fontWeight: 600 }}>{ch.name}</div>
                    <div className="tiny muted">{sub?.name || ch.subjectKey} · 🔥 {ch.streak} streak · best {ch.longestStreak || 0}</div>
                    <div className="tiny muted">{isOpen ? `Day ${daysDone + 1} (open-ended)` : `Day ${daysDone} of ${ch.days} · ${Math.max(0, ch.days - daysDone)} to go`}</div>
                  </div>
                  {!isOpen && <span className="mono tiny muted">{pct}%</span>}
                </div>
                {!isOpen && (
                  <div style={{ height: 4, background: '#F0EAD8', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#8E4585', borderRadius: 2 }} />
                  </div>
                )}
                {isLogged ? (
                  <div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F40', borderRadius: 8, padding: '6px 12px', textAlign: 'center', marginBottom: 6 }}>
                    <span className="tiny" style={{ color: '#3F7A4F', fontWeight: 600 }}>✓ Counted today — keep logging {sub?.name}</span>
                  </div>
                ) : isRest ? (
                  <div style={{ background: '#F0EAD8', border: '1px solid #D4CCB8', borderRadius: 8, padding: '6px 12px', textAlign: 'center', marginBottom: 6 }}>
                    <span className="tiny" style={{ color: '#6B6457', fontWeight: 600 }}>😴 Rest day — streak protected</span>
                  </div>
                ) : (
                  <div className="tiny muted" style={{ fontStyle: 'italic', marginBottom: 6 }}>
                    Pending — log {sub?.name || 'subject'} time on Today tab to count this day
                  </div>
                )}
                <div className="row" style={{ gap: 6 }}>
                  <button className="tap" onClick={() => archiveChallenge(ch.id)} style={{ flex: 1, fontSize: 11, padding: '5px' }}>
                    <Trophy size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Complete & archive
                  </button>
                  <button className="tap" onClick={() => deleteChallenge(ch.id)} style={{ padding: '5px 10px', fontSize: 11, color: '#B8460E' }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}

          {archived.length > 0 && (
            <>
              <div className="h3" style={{ marginTop: 16, marginBottom: 8 }}>Completed</div>
              {archived.map((ch: any) => {
                const sub = settings.subjects?.[ch.subjectKey];
                return (
                  <div key={ch.id} className="card" style={{ padding: 10, marginBottom: 8, borderLeft: '3px solid #C8932E' }}>
                    <div className="between">
                      <div>
                        <div className="small" style={{ fontWeight: 600 }}><Award size={11} style={{ verticalAlign: 'middle', marginRight: 4, color: '#C8932E' }} />{ch.name}</div>
                        <div className="tiny muted">{sub?.name || ch.subjectKey} · Best streak: {ch.longestStreak || 0} days</div>
                        {ch.startDate && <div className="tiny muted mono">{fmtShortDate(ch.startDate)} → {fmtShortDate(ch.completedDate || today)}</div>}
                      </div>
                      <button className="tap" onClick={() => deleteChallenge(ch.id)} style={{ padding: '3px 6px', color: '#6B6457' }}><Trash2 size={10} /></button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {view === 'add' && (
        <>
          <p className="small muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
            Pick a subject. Every time you log time (or check it off) on the Today tab, this challenge's streak advances automatically. Press "Rest day" on the Today tab to protect your streak on days you skip.
          </p>

          <label>Challenge name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bible Reading 60 Days, Daily Prayer…" style={{ marginBottom: 14 }} autoFocus />

          <label>Subject to track</label>
          {subjects.length === 0 ? (
            <p className="tiny muted" style={{ marginBottom: 14 }}>No subjects yet — add one in Settings → Subjects first.</p>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {subjects.map((s: any) => (
                <button key={s.key} className="tap" onClick={() => setForm({ ...form, subjectKey: s.key })}
                  style={{ fontSize: 12, padding: '6px 12px', background: form.subjectKey === s.key ? (s.accent || '#1A1A2E') : 'transparent', color: form.subjectKey === s.key ? '#F5F0E6' : '#1A1A2E', borderColor: form.subjectKey === s.key ? (s.accent || '#1A1A2E') : '#E4DCC8' }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <label>Duration</label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {['21','30','60','75','90','0'].map((d) => (
              <button key={d} className="tap" onClick={() => setForm({ ...form, days: d })}
                style={{ fontSize: 11, padding: '5px 10px', background: form.days === d ? '#1A1A2E' : 'transparent', color: form.days === d ? '#F5F0E6' : '#1A1A2E' }}>
                {d === '0' ? '∞ Open' : `${d} days`}
              </button>
            ))}
          </div>

          <button className="btn" style={{ width: '100%' }} onClick={createChallenge}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Start challenge
          </button>
        </>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY TAB — manual personal-finance tracker (Rocket Money inspired)
// ════════════════════════════════════════════════════════════════════════════════
export function MoneyTab({ spending, tax, onAdd, onEdit, onDelete, onBudget, onCategoryBudgets, onCategories, onAddAccount, onEditAccount, onAddDebt, onEditDebt, onAddOwed, onEditOwed, onTransfer, onEditIncome, onTaxModal, onCustomChallenges, onSaveLayout }: any) {
  const today = todayStr();
  const thisMonth = monthKey(today);
  const [viewMonth, setViewMonth] = useState(thisMonth);
  const [txFilter, setTxFilter] = useState('');
  const [reorderOpen, setReorderOpen] = useState(false);
  const sensors = useDndSensors();
  const cur = spendingByMonth(spending.entries, viewMonth);
  const prev = spendingByMonth(spending.entries, prevMonth(viewMonth));
  const catMap = useMemo(() => Object.fromEntries(spending.categories.map((c: any) => [c.id, c])), [spending.categories]);
  const budget = Number(spending.monthlyBudget) || 0;
  const goal = Number(spending.savingsGoal) || 0;
  const spentPct = budget > 0 ? Math.min(100, (cur.spent / budget) * 100) : 0;
  const savedThisMonth = Math.max(0, cur.net);
  const savedPct = goal > 0 ? Math.min(100, (savedThisMonth / goal) * 100) : 0;
  const savingsRate = cur.income > 0 ? Math.max(0, Math.min(100, (cur.net / cur.income) * 100)) : 0;

  const accounts: any[] = spending.accounts || [];
  const debts: any[] = spending.debts || [];
  const owed: any[] = spending.owed || [];
  const hasCreditCards = accounts.some((a: any) => a.type === 'credit');

  const assets = accounts.filter((a: any) => a.type !== 'credit' && a.includeInNetWorth !== false).reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0);
  const creditDebt = accounts.filter((a: any) => a.type === 'credit' && a.includeInNetWorth !== false).reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0);
  const loanDebt = debts.filter((d: any) => d.includeInNetWorth !== false).reduce((s: number, d: any) => s + (Number(d.balance) || 0), 0);
  const totalLiabilities = creditDebt + loanDebt;
  const netWorth = assets - totalLiabilities;
  const totalOwed = owed.filter((o: any) => !o.paid).reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);

  const [filterCatId, setFilterCatId] = useState('');
  const [filterAcctId, setFilterAcctId] = useState('');
  const [filterType, setFilterType] = useState('');

  const recent = useMemo(
    () => [...spending.entries]
      .filter((e: any) => monthKey(e.date) === viewMonth)
      .sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || '').localeCompare(a.id || ''))),
    [spending.entries, viewMonth],
  );

  const recurring = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of spending.entries) {
      if (!e.recurring || e.type !== 'out') continue;
      const k = `${e.name?.toLowerCase().trim()}|${e.categoryId}`;
      const existing = map.get(k);
      if (!existing || e.date > existing.date) map.set(k, e);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [spending.entries]);

  const trend = useMemo(() => {
    const arr: { ym: string; income: number; spent: number; net: number }[] = [];
    let cursor = thisMonth;
    for (let i = 0; i < 6; i++) {
      const m = spendingByMonth(spending.entries, cursor);
      arr.unshift({ ym: cursor, income: m.income, spent: m.spent, net: m.net });
      cursor = prevMonth(cursor);
    }
    return arr;
  }, [spending.entries, thisMonth]);

  const allCats = useMemo(() => {
    return Object.entries(cur.byCat)
      .map(([id, amt]: any) => ({ id, amount: amt as number, cat: catMap[id] }))
      .filter((x) => x.cat)
      .sort((a, b) => b.amount - a.amount);
  }, [cur.byCat, catMap]);

  const catMonthlyAvg = useMemo(() => {
    const avgs: Record<string, number> = {};
    const pastMonths: string[] = [];
    let c = prevMonth(thisMonth);
    for (let i = 0; i < 5; i++) { pastMonths.push(c); c = prevMonth(c); }
    for (const cat of spending.categories) {
      const vals = pastMonths.map(ym => spendingByMonth(spending.entries, ym).byCat[cat.id] || 0).filter(v => v > 0);
      avgs[cat.id] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    }
    return avgs;
  }, [spending.entries, spending.categories, thisMonth]);

  const currentYear = today.slice(0, 4);
  const w2YTD = Number((spending.income || {}).w2YTD) || 0;
  const income1099YTD = useMemo(() => {
    return ((tax?.entries1099 || []) as any[])
      .filter((e: any) => e.date?.startsWith(currentYear))
      .reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  }, [tax, currentYear]);
  const totalYTD = w2YTD + income1099YTD;

  const filteredRecent = useMemo(() => {
    return recent.filter((e: any) => {
      const cat = catMap[e.categoryId];
      if (txFilter.trim()) {
        const q = txFilter.toLowerCase();
        if (!(e.name || '').toLowerCase().includes(q) && !(cat?.name || '').toLowerCase().includes(q)) return false;
      }
      if (filterCatId && e.categoryId !== filterCatId) return false;
      if (filterAcctId && e.accountId !== filterAcctId) return false;
      if (filterType && e.type !== filterType) return false;
      return true;
    });
  }, [recent, txFilter, filterCatId, filterAcctId, filterType, catMap]);

  const sectionOrder = useMemo(() => {
    const saved: string[] = spending.sectionOrder || [];
    return [...saved.filter((x: string) => MONEY_DEFAULT_ORDER.includes(x)), ...MONEY_DEFAULT_ORDER.filter((x) => !saved.includes(x))];
  }, [spending.sectionOrder]);

  const netDelta = cur.net - prev.net;
  const spentDelta = prev.spent > 0 ? ((cur.spent - prev.spent) / prev.spent) * 100 : 0;
  const trendMax = Math.max(1, ...trend.map((t) => Math.max(t.income, t.spent)));
  const empty = spending.entries.length === 0;
  const negativeMonth = cur.net < 0 && !empty;

  const renderMoneySection = (id: string): React.ReactNode => {
    switch (id) {
      case 'ytd':
        if (w2YTD === 0 && income1099YTD === 0) return null;
        return (
          <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid #3F7A4F' }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><DollarSign size={14} color="#3F7A4F" /><span className="h2">YTD Income · {currentYear}</span></div>
              <button className="tap" onClick={onEditIncome} style={{ padding: '4px 10px', fontSize: 11 }}><Pencil size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Edit</button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {w2YTD > 0 && (
                <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="tiny muted" style={{ marginBottom: 2 }}>W-2 Gross YTD</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>{fmtMoney(w2YTD)}</div>
                  {spending.income?.w2Employer && <div className="tiny muted">{spending.income.w2Employer}</div>}
                </div>
              )}
              {income1099YTD > 0 && (
                <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="tiny muted" style={{ marginBottom: 2 }}>1099 YTD</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#3B5C6B' }}>{fmtMoney(income1099YTD)}</div>
                  <div className="tiny muted">prop firm / trading</div>
                </div>
              )}
            </div>
            {w2YTD > 0 && income1099YTD > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E4DCC8', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="small muted">Total combined YTD</span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(totalYTD)}</span>
              </div>
            )}
          </div>
        );

      case 'accounts':
        return (
          <div style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 6 }}><Wallet size={14} color="#1A1A2E" /><span className="h2">Accounts</span></div>
              <button className="tap" onClick={onAddAccount} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={11} /> Add</button>
            </div>
            {accounts.length === 0 ? (
              <button className="tap" onClick={onAddAccount} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left' }}>
                <CreditCard size={14} color="#6B6457" /><span className="small" style={{ flex: 1 }}>Add a bank account or credit card</span><ChevronRight size={14} color="#6B6457" />
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {accounts.map((acc: any) => {
                  const isCredit = acc.type === 'credit';
                  const limit = Number(acc.creditLimit) || 0;
                  const bal = Number(acc.balance) || 0;
                  const utilPct = isCredit && limit > 0 ? Math.min(100, (bal / limit) * 100) : 0;
                  const available = limit - bal;
                  return (
                    <button key={acc.id} onClick={() => onEditAccount(acc)} style={{ flexShrink: 0, width: 172, padding: 16, borderRadius: 14, border: 'none', cursor: 'pointer', textAlign: 'left', background: isCredit ? '#F5F0E6' : (acc.color || '#1A1A2E'), boxShadow: '0 2px 10px rgba(0,0,0,0.13)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isCredit ? '#6B6457' : 'rgba(245,240,230,0.65)' }}>{isCredit ? 'Credit' : acc.type === 'savings' ? 'Savings' : 'Checking'}</span>
                        {isCredit ? <CreditCard size={13} color="#6B6457" /> : <Wallet size={13} color="rgba(245,240,230,0.6)" />}
                      </div>
                      <div style={{ fontSize: 11, color: isCredit ? '#6B6457' : 'rgba(245,240,230,0.7)', marginBottom: 3 }}>{acc.bank || acc.name}</div>
                      {!isCredit && <div style={{ fontSize: 10, color: 'rgba(245,240,230,0.55)', marginBottom: 4 }}>{acc.name}</div>}
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: isCredit ? '#B8460E' : '#F5F0E6', lineHeight: 1.1, marginBottom: isCredit ? 10 : 0 }}>{fmtMoney(bal)}</div>
                      {isCredit && limit > 0 && (<><div style={{ height: 4, background: '#E4DCC8', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}><div style={{ width: `${utilPct}%`, height: '100%', background: utilPct > 80 ? '#B8460E' : utilPct > 50 ? '#C8932E' : '#3F7A4F', borderRadius: 2 }} /></div><div style={{ fontSize: 10, color: '#6B6457' }}>{fmtMoney(available)} avail · {Math.round(utilPct)}%</div>{acc.dueDay && <div style={{ fontSize: 10, color: '#8E4585', marginTop: 3 }}>Due day {acc.dueDay}</div>}</>)}
                      {isCredit && !acc.name.includes(acc.bank || '') && <div style={{ fontSize: 10, color: '#6B6457', marginTop: 4, opacity: 0.75 }}>{acc.name}</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'budget':
        return budget > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 6 }}><PieChart size={14} color="#8E4585" /><span className="h2">Monthly budget</span></div>
              <span className="mono small">{fmtMoney(cur.spent)} / {fmtMoney(budget)}</span>
            </div>
            <div style={{ height: 10, background: '#F5F0E6', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${spentPct}%`, height: '100%', background: spentPct >= 100 ? '#B8460E' : spentPct >= 80 ? '#C8932E' : '#3F7A4F', transition: 'width 0.3s' }} />
            </div>
            <div className="between tiny muted">
              <span>{spentPct >= 100 ? `Over by ${fmtMoney(cur.spent - budget)}` : `${fmtMoney(budget - cur.spent)} left`}</span>
              <span>{Math.round(spentPct)}% used</span>
            </div>
          </div>
        ) : (
          <button className="tap" onClick={onBudget} style={{ width: '100%', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left' }}>
            <Target size={14} color="#8E4585" /><span className="small" style={{ flex: 1 }}>Set a monthly budget to track spending</span><ChevronRight size={14} color="#6B6457" />
          </button>
        );

      case 'catbudgets': {
        const cb = spending.categoryBudgets || {};
        const budgeted = spending.categories
          .filter((c: any) => c.kind === 'out' && Number(cb[c.id]) > 0)
          .map((c: any) => ({ cat: c, limit: Number(cb[c.id]), spent: Math.round(cur.byCat?.[c.id] || 0) }))
          .sort((a: any, b: any) => (b.spent / b.limit) - (a.spent / a.limit));
        if (budgeted.length === 0) {
          return (
            <button className="tap" onClick={onCategoryBudgets} style={{ width: '100%', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left' }}>
              <Target size={14} color="#6E5C8E" /><span className="small" style={{ flex: 1 }}>Set per-category budgets (e.g. Dining out $200/mo)</span><ChevronRight size={14} color="#6B6457" />
            </button>
          );
        }
        const totLimit = budgeted.reduce((a: number, b: any) => a + b.limit, 0);
        const totSpent = budgeted.reduce((a: number, b: any) => a + b.spent, 0);
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><Target size={14} color="#6E5C8E" /><span className="h2">Category budgets · {monthLabel(viewMonth)}</span></div>
              <button className="tap" onClick={onCategoryBudgets} style={{ padding: '4px 8px', fontSize: 10 }}><Pencil size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Edit</button>
            </div>
            {budgeted.map(({ cat, limit, spent }: any) => {
              const pct = limit > 0 ? (spent / limit) * 100 : 0;
              const over = spent > limit;
              const barColor = pct >= 100 ? '#B8460E' : pct >= 80 ? '#C8932E' : cat.color;
              return (
                <div key={cat.id} style={{ marginBottom: 12 }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span className="small"><span className="swatch" style={{ background: cat.color }} />{cat.name}</span>
                    <span className="mono small" style={{ color: over ? '#B8460E' : undefined }}>{fmtMoney(spent)} / {fmtMoney(limit)}</span>
                  </div>
                  <div style={{ height: 6, background: '#F5F0E6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor, transition: 'width 0.3s' }} />
                  </div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>{over ? `Over by ${fmtMoney(spent - limit)}` : `${fmtMoney(limit - spent)} left`}</div>
                </div>
              );
            })}
            <div className="between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E4DCC8' }}>
              <span className="small" style={{ fontWeight: 600 }}>Total budgeted</span>
              <span className="mono small" style={{ color: totSpent > totLimit ? '#B8460E' : undefined, fontWeight: 600 }}>{fmtMoney(totSpent)} / {fmtMoney(totLimit)}</span>
            </div>
          </div>
        );
      }

      case 'savings':
        return goal > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 6 }}><PiggyBank size={14} color="#3F7A4F" /><span className="h2">Savings goal</span></div>
              <span className="mono small">{fmtMoney(savedThisMonth)} / {fmtMoney(goal)}</span>
            </div>
            <div style={{ height: 10, background: '#F5F0E6', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${savedPct}%`, height: '100%', background: '#3F7A4F', transition: 'width 0.3s' }} />
            </div>
            <div className="tiny muted">{savedPct >= 100 ? `Goal hit — ${fmtMoney(savedThisMonth - goal)} over` : `${fmtMoney(goal - savedThisMonth)} to go`}</div>
          </div>
        ) : null;

      case 'trend':
        return empty ? null : (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><TrendingUp size={14} color="#3B5C6B" /><span className="h2">6-month trend</span></div>
              {prev.spent > 0 && <span className="tiny mono" style={{ color: spentDelta > 0 ? '#B8460E' : '#3F7A4F' }}>{spentDelta > 0 ? '+' : ''}{Math.round(spentDelta)}% spend</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 90, marginBottom: 8 }}>
              {trend.map((t) => (
                <div key={t.ym} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 70, width: '100%', justifyContent: 'center' }}>
                    <div title={`Income ${fmtMoney(t.income)}`} style={{ width: '40%', height: `${(t.income / trendMax) * 100}%`, background: '#3F7A4F', borderRadius: '3px 3px 0 0', minHeight: t.income > 0 ? 2 : 0 }} />
                    <div title={`Spent ${fmtMoney(t.spent)}`} style={{ width: '40%', height: `${(t.spent / trendMax) * 100}%`, background: '#B8460E', borderRadius: '3px 3px 0 0', minHeight: t.spent > 0 ? 2 : 0 }} />
                  </div>
                  <div className="tiny muted" style={{ fontSize: 10 }}>{monthShort(t.ym)}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 14, fontSize: 11 }}>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: '#3F7A4F', borderRadius: 2 }} /> <span className="muted">Income</span></span>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: '#B8460E', borderRadius: 2 }} /> <span className="muted">Spent</span></span>
            </div>
          </div>
        );

      case 'daily': {
        if (empty || viewMonth !== thisMonth) return null;
        const days30: { label: string; spent: number; date: string }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today + 'T00:00:00');
          d.setDate(d.getDate() - i);
          const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          days30.push({ label: i === 0 ? 'today' : `${d.getMonth() + 1}/${d.getDate()}`, date: ds, spent: 0 });
        }
        for (const e of spending.entries) {
          if (e.type !== 'out') continue;
          const idx = days30.findIndex(d => d.date === e.date);
          if (idx !== -1) days30[idx].spent += Number(e.amount) || 0;
        }
        if (!days30.some(d => d.spent > 0)) return null;
        const chartData = days30.map((d, i) => ({ label: (i % 6 === 0 || i >= 27) ? d.label : '', spent: Math.round(d.spent) }));
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 6, marginBottom: 10 }}><Receipt size={14} color="#8E4585" /><span className="h2">Daily spending · last 30 days</span></div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 4, right: 6, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} interval={0} />
                <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#6B6457' }} />
                <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`$${v}`, 'Spent']} />
                <Bar dataKey="spent" fill="#8E4585" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'debt': {
        const creditCardAccounts = accounts.filter((a: any) => a.type === 'credit');
        const allDebtItems = [...creditCardAccounts.map((a: any) => ({ ...a, _isCreditAcc: true })), ...debts];
        const totalDailyInterest = allDebtItems.reduce((s, item) => s + calcDailyInterest(Number(item.balance) || 0, Number(item.rate) || 0), 0);
        const totalMonthlyInterest = allDebtItems.reduce((s, item) => s + calcMonthlyInterest(Number(item.balance) || 0, Number(item.rate) || 0), 0);
        const totalAccrued = allDebtItems.reduce((s, item) => s + (Number(item.accruedInterest) || 0), 0);
        const avalancheTarget = allDebtItems.filter((item) => Number(item.balance) > 0 && Number(item.rate) > 0).sort((a, b) => Number(b.rate) - Number(a.rate))[0];
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: totalDailyInterest > 0 ? 8 : 10 }}>
              <div className="row" style={{ gap: 6 }}><Banknote size={14} color="#B8460E" /><span className="h2">Debt tracker</span></div>
              <button className="tap" onClick={onAddDebt} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={11} /> Add</button>
            </div>
            {totalDailyInterest > 0 && (
              <div style={{ background: '#B8460E10', border: '1px solid #B8460E30', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}><div className="tiny muted" style={{ marginBottom: 1 }}>Costing you today</div><div className="mono" style={{ fontSize: 17, fontWeight: 700, color: '#B8460E' }}>{fmtMoney(totalDailyInterest)}<span style={{ fontSize: 11, fontWeight: 400, color: '#6B6457' }}>/day</span></div></div>
                  <div style={{ width: 1, background: '#B8460E25' }} />
                  <div style={{ flex: 1, minWidth: 100 }}><div className="tiny muted" style={{ marginBottom: 1 }}>Monthly interest</div><div className="mono" style={{ fontSize: 14, fontWeight: 600, color: '#B8460E' }}>~{fmtMoney(totalMonthlyInterest)}<span style={{ fontSize: 11, fontWeight: 400, color: '#6B6457' }}>/mo</span></div></div>
                  {totalAccrued > 0 && (<><div style={{ width: 1, background: '#B8460E25' }} /><div style={{ flex: 1, minWidth: 100 }}><div className="tiny muted" style={{ marginBottom: 1 }}>Accrued</div><div className="mono" style={{ fontSize: 14, fontWeight: 600, color: '#6B6457' }}>{fmtMoney(totalAccrued)}</div></div></>)}
                </div>
              </div>
            )}
            {allDebtItems.length === 0 ? (
              <button className="tap" onClick={onAddDebt} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', textAlign: 'left', background: 'transparent', border: 'none' }}>
                <CircleDollarSign size={14} color="#6B6457" /><span className="small muted" style={{ flex: 1 }}>Track a loan or credit card balance</span><ChevronRight size={14} color="#6B6457" />
              </button>
            ) : (
              <>
                {creditCardAccounts.map((acc: any) => {
                  const limit = Number(acc.creditLimit) || 0;
                  const bal = Number(acc.balance) || 0;
                  const apr = Number(acc.rate) || 0;
                  const daily = calcDailyInterest(bal, apr);
                  const monthly = calcMonthlyInterest(bal, apr);
                  const payoffMo = calcPayoffMonths(bal, apr, Number(acc.minPayment) || 0);
                  const totalInterest = calcTotalInterestAtMin(bal, apr, Number(acc.minPayment) || 0);
                  const accrued = Number(acc.accruedInterest) || 0;
                  const utilPct = limit > 0 ? Math.min(100, (bal / limit) * 100) : 0;
                  return (
                    <div key={acc.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #F0EAD8' }}>
                      <div className="between" style={{ marginBottom: 6 }}>
                        <div><div className="small" style={{ fontWeight: 600 }}>{acc.name}{acc.bank ? ` · ${acc.bank}` : ''}</div><div className="tiny muted">Credit Card{apr > 0 ? ` · ${apr}% APR` : ''}{acc.dueDay ? ` · due day ${acc.dueDay}` : ''}</div></div>
                        <div style={{ textAlign: 'right' }}><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(bal)}</div>{limit > 0 && <div className="tiny muted">of {fmtMoney(limit)} limit</div>}</div>
                      </div>
                      {limit > 0 && <div style={{ height: 5, background: '#F0EAD8', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}><div style={{ width: `${utilPct}%`, height: '100%', background: utilPct > 80 ? '#B8460E' : utilPct > 50 ? '#C8932E' : '#3F7A4F', borderRadius: 3 }} /></div>}
                      {apr > 0 && bal > 0 && (<div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 4 }}><span style={{ background: '#B8460E15', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 600 }} className="mono">{fmtMoney(daily)}/day</span><span style={{ background: '#B8460E10', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11 }} className="mono">~{fmtMoney(monthly)}/mo</span>{payoffMo > 0 && <span style={{ background: '#F0EAD8', color: '#6B6457', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>payoff {fmtPayoff(payoffMo)}</span>}{isFinite(totalInterest) && totalInterest > 0 && <span style={{ background: '#F0EAD8', color: '#8E4585', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>+{fmtMoney(totalInterest)} total</span>}</div>)}
                      {accrued > 0 && <div className="tiny" style={{ color: '#B8460E', opacity: 0.7 }}>~{fmtMoney(accrued)} accrued</div>}
                      {limit > 0 && <div className="tiny muted">{fmtMoney(limit - bal)} available</div>}
                    </div>
                  );
                })}
                {debts.map((debt: any) => {
                  const original = Number(debt.originalAmount) || Number(debt.balance) || 1;
                  const bal = Number(debt.balance) || 0;
                  const apr = Number(debt.rate) || 0;
                  const paid = original - bal;
                  const paidPct = Math.max(0, Math.min(100, (paid / original) * 100));
                  const daily = calcDailyInterest(bal, apr);
                  const monthly = calcMonthlyInterest(bal, apr);
                  const payoffMo = calcPayoffMonths(bal, apr, Number(debt.minPayment) || 0);
                  const totalInterest = calcTotalInterestAtMin(bal, apr, Number(debt.minPayment) || 0);
                  const accrued = Number(debt.accruedInterest) || 0;
                  return (
                    <div key={debt.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #F0EAD8' }}>
                      <div className="between" style={{ marginBottom: 6 }}>
                        <div><div className="small" style={{ fontWeight: 600 }}>{debt.name}</div><div className="tiny muted">{DEBT_TYPES.find(t => t.id === debt.type)?.label || 'Loan'}{apr > 0 ? ` · ${apr}% APR` : ''}</div></div>
                        <div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(bal)}</div>
                      </div>
                      {original > bal && <><div style={{ height: 4, background: '#F0EAD8', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}><div style={{ width: `${paidPct}%`, height: '100%', background: '#3F7A4F', borderRadius: 2 }} /></div><div className="tiny muted" style={{ marginBottom: 4 }}>{Math.round(paidPct)}% paid off</div></>}
                      {apr > 0 && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 4 }}><span style={{ background: '#B8460E15', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11 }} className="mono">{fmtMoney(daily)}/day</span><span style={{ background: '#B8460E10', color: '#B8460E', borderRadius: 5, padding: '2px 7px', fontSize: 11 }} className="mono">~{fmtMoney(monthly)}/mo</span>{payoffMo > 0 && <span style={{ background: '#F0EAD8', color: '#6B6457', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>payoff {fmtPayoff(payoffMo)}</span>}{isFinite(totalInterest) && totalInterest > 0 && <span style={{ background: '#F0EAD8', color: '#8E4585', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>+{fmtMoney(totalInterest)} total</span>}</div>}
                      {accrued > 0 && <div className="tiny" style={{ color: '#B8460E', opacity: 0.7 }}>~{fmtMoney(accrued)} accrued</div>}
                    </div>
                  );
                })}
                {avalancheTarget && allDebtItems.filter((i) => Number(i.balance) > 0 && Number(i.rate) > 0).length > 1 && (
                  <div style={{ background: '#8E458510', border: '1px solid #8E458530', borderRadius: 8, padding: '8px 12px', marginTop: 4 }}>
                    <div className="tiny" style={{ fontWeight: 600, color: '#8E4585', marginBottom: 2 }}>💡 Avalanche tip</div>
                    <div className="tiny muted">Pay extra on <strong>{avalancheTarget.name}</strong> first ({avalancheTarget.rate}% APR) to save the most in interest.</div>
                  </div>
                )}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F0EAD8', display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}><div className="tiny muted">Total debt</div><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(totalLiabilities)}</div></div>
                  {totalDailyInterest > 0 && <><div style={{ flex: 1 }}><div className="tiny muted">Daily cost</div><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>{fmtMoney(totalDailyInterest)}</div></div><div style={{ flex: 1 }}><div className="tiny muted">Monthly cost</div><div className="mono small" style={{ fontWeight: 700, color: '#B8460E' }}>~{fmtMoney(totalMonthlyInterest)}</div></div></>}
                </div>
              </>
            )}
          </div>
        );
      }

      case 'income_payoff': {
        const inc = spending.income || {};
        const w2Monthly = Number(inc.w2Monthly) || 0;
        const expTrading = Number(inc.expectedTrading) || 0;
        const totalExpected = w2Monthly + expTrading;
        const minObligations = [...debts.map((d: any) => Number(d.minPayment) || 0), ...accounts.filter((a: any) => a.type === 'credit').map((a: any) => Number(a.minPayment) || 0)].reduce((s, v) => s + v, 0);
        const surplus = cur.income - cur.spent - minObligations;
        const canCover = cur.income >= minObligations;
        const availExtra = Math.max(0, surplus);
        const totalMonthlyPayment = minObligations + availExtra;
        const roughMonths = totalMonthlyPayment > 0 && totalLiabilities > 0 ? Math.ceil(totalLiabilities / totalMonthlyPayment) : 0;
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><TrendingUp size={14} color="#3F7A4F" /><span className="h2">Income & payoff</span></div>
              <button className="tap" onClick={onEditIncome} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={10} /> Edit</button>
            </div>
            {totalExpected === 0 ? (
              <button className="tap" onClick={onEditIncome} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', textAlign: 'left', background: 'transparent', border: 'none' }}>
                <TrendingUp size={14} color="#6B6457" /><span className="small muted" style={{ flex: 1 }}>Set your income to see debt payoff projections</span><ChevronRight size={14} color="#6B6457" />
              </button>
            ) : (
              <>
                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}><div className="tiny muted" style={{ marginBottom: 2 }}>Expected/mo</div><div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#3F7A4F' }}>{fmtMoney(totalExpected)}</div>{w2Monthly > 0 && expTrading > 0 && <div className="tiny muted">{fmtMoney(w2Monthly)} W2 + {fmtMoney(expTrading)} trading</div>}</div>
                  <div style={{ flex: 1, background: '#F9F5EC', borderRadius: 8, padding: '10px 12px' }}><div className="tiny muted" style={{ marginBottom: 2 }}>Realized this month</div><div className="mono" style={{ fontSize: 15, fontWeight: 700, color: cur.income >= totalExpected * 0.8 ? '#3F7A4F' : '#C8932E' }}>{fmtMoney(cur.income)}</div></div>
                </div>
                {minObligations > 0 && (<div style={{ marginBottom: 10 }}><div className="between" style={{ marginBottom: 4 }}><span className="small muted">Min debt payments/mo</span><span className="mono small" style={{ color: '#B8460E' }}>{fmtMoney(minObligations)}</span></div><div style={{ height: 4, background: '#F0EAD8', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}><div style={{ height: '100%', width: `${Math.min(100, cur.income > 0 ? (minObligations/cur.income)*100 : 100)}%`, background: canCover ? '#3F7A4F' : '#B8460E', borderRadius: 2 }} /></div><div className="tiny" style={{ color: canCover ? '#3F7A4F' : '#B8460E' }}>{canCover ? `✓ Covered — ${fmtMoney(Math.abs(surplus))} ${surplus >= 0 ? 'surplus' : 'short'} after expenses` : `⚠ Income this month is ${fmtMoney(Math.abs(surplus))} short`}</div></div>)}
                {roughMonths > 0 && totalLiabilities > 0 && (<div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F33', borderRadius: 8, padding: '8px 12px' }}><div className="tiny muted" style={{ marginBottom: 2 }}>Debt-free estimate at current pace</div><div className="row" style={{ alignItems: 'baseline', gap: 6 }}><span className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#3F7A4F' }}>{fmtPayoff(roughMonths)}</span>{availExtra > 0 && <span className="tiny muted">(incl. {fmtMoney(availExtra)}/mo extra)</span>}</div></div>)}
                {totalLiabilities === 0 && debts.length + accounts.filter((a: any) => a.type === 'credit').length > 0 && (<div style={{ background: '#3F7A4F15', border: '1px solid #3F7A4F33', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}><span className="small" style={{ color: '#3F7A4F', fontWeight: 600 }}>🎉 Debt free!</span></div>)}
              </>
            )}
          </div>
        );
      }

      case 'tax':
        return (
          <button className="tap" onClick={onTaxModal} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left', borderRadius: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🧾</span>
            <div style={{ flex: 1 }}><div className="small" style={{ fontWeight: 600 }}>Tax tracker</div><div className="tiny muted">1099 entries · CA + Federal estimate · Quarterly payments</div></div>
            <ChevronRight size={14} color="#6B6457" />
          </button>
        );

      case 'categories':
        return allCats.length > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 6 }}><PieChart size={14} color="#B8460E" /><span className="h2">Where it went · {monthLabel(viewMonth)}</span></div>
              <button className="tap" onClick={onCategories} style={{ padding: '4px 8px', fontSize: 10 }}><Pencil size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Categories</button>
            </div>
            {allCats.map((c) => {
              const pct = cur.spent > 0 ? (c.amount / cur.spent) * 100 : 0;
              const avg = catMonthlyAvg[c.id] || 0;
              const vsAvg = avg > 0 ? ((c.amount - avg) / avg) * 100 : 0;
              return (
                <div key={c.id} style={{ marginBottom: 12 }}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span className="small"><span className="swatch" style={{ background: c.cat.color }} />{c.cat.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span className="mono small">{fmtMoney(c.amount)}</span>
                      {avg > 0 && <span className="mono tiny" style={{ marginLeft: 8, color: vsAvg > 15 ? '#B8460E' : vsAvg < -15 ? '#3F7A4F' : '#6B6457' }}>{vsAvg > 0 ? '+' : ''}{Math.round(vsAvg)}% vs avg</span>}
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#F5F0E6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.cat.color, transition: 'width 0.3s' }} />
                  </div>
                  {avg > 0 && <div className="tiny muted" style={{ marginTop: 2 }}>avg {fmtMoney(avg)}/mo</div>}
                </div>
              );
            })}
          </div>
        ) : null;

      case 'recurring':
        return recurring.length > 0 ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 6, marginBottom: 12 }}><Repeat size={14} color="#6E5C8E" /><span className="h2">Recurring</span><span className="mono tiny muted" style={{ marginLeft: 'auto' }}>~{fmtMoney(recurring.reduce((s, r) => s + Number(r.amount || 0), 0))}/mo</span></div>
            {recurring.map((r) => {
              const cat = catMap[r.categoryId];
              return (
                <div key={r.id} className="between" style={{ padding: '6px 0', borderBottom: '1px solid #F0EAD8' }}>
                  <div className="row" style={{ gap: 8 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: cat?.color || '#6B6457' }} /><div><div className="small" style={{ fontWeight: 500 }}>{r.name || 'Untitled'}</div><div className="tiny muted">{cat?.name || 'Other'}</div></div></div>
                  <span className="mono small">{fmtMoney(r.amount)}</span>
                </div>
              );
            })}
          </div>
        ) : null;

      case 'owed':
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 6 }}><HandCoins size={14} color="#3F7A4F" /><span className="h2">People owe me</span>{totalOwed > 0 && <span className="mono tiny" style={{ marginLeft: 4, background: '#3F7A4F22', color: '#3F7A4F', padding: '2px 6px', borderRadius: 6 }}>{fmtMoney(totalOwed)}</span>}</div>
              <button className="tap" onClick={onAddOwed} style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={11} /> Add</button>
            </div>
            {owed.length === 0 ? (
              <div className="muted small" style={{ textAlign: 'center', padding: '8px 0' }}>No IOUs tracked — add someone who owes you.</div>
            ) : (
              owed.map((item: any) => (
                <button key={item.id} className="tap" onClick={() => onEditOwed(item)} style={{ width: '100%', textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #F0EAD8', background: 'transparent', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: item.paid ? '#3F7A4F22' : '#C8932E22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={14} color={item.paid ? '#3F7A4F' : '#C8932E'} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="small" style={{ fontWeight: 600, color: item.paid ? '#6B6457' : '#1A1A2E', textDecoration: item.paid ? 'line-through' : 'none' }}>{item.name}</div><div className="tiny muted">{item.note ? `${item.note} · ` : ''}{item.dueDate ? `Due ${item.dueDate}` : item.dateAdded ? `Added ${item.dateAdded}` : ''}</div></div>
                  <span className="mono small" style={{ fontWeight: 700, color: item.paid ? '#6B6457' : '#3F7A4F' }}>{fmtMoney(item.amount)}</span>
                </button>
              ))
            )}
          </div>
        );

      case 'transactions': {
        const hasFilters = !!(txFilter.trim() || filterCatId || filterAcctId || filterType);
        return (
          <div className="card">
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 6 }}><Receipt size={14} color="#1A1A2E" /><span className="h2">Transactions</span></div>
              <span className="tiny muted mono">{filteredRecent.length}{hasFilters ? ` / ${recent.length}` : ''} this month</span>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input type="text" value={txFilter} onChange={(e) => setTxFilter(e.target.value)} placeholder="Search by name…" style={{ paddingLeft: 32, fontSize: 13, padding: '8px 10px 8px 32px' }} />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B6457', fontSize: 14 }}>🔍</span>
              {txFilter && <button onClick={() => setTxFilter('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}><X size={14} /></button>}
            </div>
            <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ flex: 1, minWidth: 90, padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #E4DCC8', background: filterType ? '#1A1A2E' : undefined, color: filterType ? '#F5F0E6' : undefined }}>
                <option value="">All types</option>
                <option value="out">Expenses</option>
                <option value="in">Income</option>
              </select>
              {spending.categories?.length > 0 && (
                <select value={filterCatId} onChange={(e) => setFilterCatId(e.target.value)} style={{ flex: 1, minWidth: 110, padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #E4DCC8', background: filterCatId ? '#1A1A2E' : undefined, color: filterCatId ? '#F5F0E6' : undefined }}>
                  <option value="">All categories</option>
                  {spending.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {accounts.length > 0 && (
                <select value={filterAcctId} onChange={(e) => setFilterAcctId(e.target.value)} style={{ flex: 1, minWidth: 110, padding: '6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #E4DCC8', background: filterAcctId ? '#1A1A2E' : undefined, color: filterAcctId ? '#F5F0E6' : undefined }}>
                  <option value="">All accounts</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {hasFilters && (
                <button className="tap" style={{ padding: '5px 10px', fontSize: 11, color: '#B8460E' }} onClick={() => { setTxFilter(''); setFilterCatId(''); setFilterAcctId(''); setFilterType(''); }}>
                  <X size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Clear
                </button>
              )}
            </div>
            {filteredRecent.length === 0 ? (
              <div className="muted small" style={{ padding: '12px 0', textAlign: 'center' }}>
                {recent.length === 0
                  ? <><Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />No transactions yet — add income or an expense above.</>
                  : 'No transactions match the current filters.'}
              </div>
            ) : (
              filteredRecent.map((e: any) => {
                const cat = catMap[e.categoryId];
                const isIn = e.type === 'in';
                const acct = accounts.find((a: any) => a.id === e.accountId);
                return (
                  <button key={e.id} className="tap" onClick={() => onEdit(e)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid #F0EAD8', background: 'transparent', borderRadius: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: (cat?.color || '#6B6457') + '22', color: cat?.color || '#6B6457', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isIn ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name || (isIn ? 'Income' : 'Expense')}</div>
                      <div className="tiny muted">{cat?.name || 'Other'} · {e.date}{e.recurring ? ' · recurring' : ''}{acct ? ` · ${acct.name}` : ''}</div>
                    </div>
                    <span className="mono small" style={{ color: isIn ? '#3F7A4F' : '#B8460E', fontWeight: 600 }}>{isIn ? '+' : '−'}{fmtMoney(e.amount).replace('−', '')}</span>
                  </button>
                );
              })
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      <div className="between" style={{ marginBottom: 6 }}>
        <h1 className="h1">Money.</h1>
        <div className="row" style={{ gap: 6 }}>
          <button className="tap" onClick={() => setReorderOpen(true)} style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <GripVertical size={12} /> Layout
          </button>
          <button className="tap" onClick={onBudget} style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Target size={12} /> Goals
          </button>
        </div>
      </div>
      <div className="between" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setViewMonth(prevMonth(viewMonth))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#6B6457' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span className="mono small" style={{ color: '#6B6457' }}>{monthLabel(viewMonth)}</span>
          {viewMonth !== thisMonth && (
            <button
              onClick={() => setViewMonth(thisMonth)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#8E4585', marginLeft: 8, fontFamily: 'inherit' }}
            >
              → today
            </button>
          )}
        </div>
        <button
          onClick={() => setViewMonth(nextMonth(viewMonth))}
          disabled={viewMonth >= thisMonth}
          style={{ background: 'none', border: 'none', cursor: viewMonth >= thisMonth ? 'default' : 'pointer', padding: '4px 6px', color: viewMonth >= thisMonth ? '#D4CCB8' : '#6B6457' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* NEGATIVE MONTH ALERT */}
      {negativeMonth && (
        <div style={{ background: '#B8460E18', border: '1px solid #B8460E55', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BadgeAlert size={16} color="#B8460E" style={{ flexShrink: 0 }} />
          <div>
            <div className="small" style={{ fontWeight: 600, color: '#B8460E' }}>You're in the red this month</div>
            <div className="tiny muted">Spending exceeds income by {fmtMoney(Math.abs(cur.net))}. Check your budget.</div>
          </div>
        </div>
      )}

      {/* HERO */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2A2A4E 100%)', color: '#F5F0E6', padding: 22, marginBottom: 14, border: 'none' }}>
        <div className="row" style={{ gap: 6, marginBottom: 6, opacity: 0.7 }}>
          <Wallet size={13} />
          <span className="h2" style={{ color: '#F5F0E6', opacity: 0.7 }}>Net this month</span>
        </div>
        <div className="mono" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em', color: cur.net >= 0 ? '#A8D8B0' : '#F4A89E', lineHeight: 1.05 }}>
          {fmtMoney(cur.net, { signed: true })}
        </div>
        {!empty && (
          <div className="row" style={{ gap: 6, marginTop: 8, fontSize: 11, opacity: 0.8 }}>
            {netDelta >= 0 ? <ArrowUpRight size={12} color="#A8D8B0" /> : <ArrowDownRight size={12} color="#F4A89E" />}
            <span className="mono">{fmtMoney(Math.abs(netDelta))}</span>
            <span style={{ opacity: 0.7 }}>vs {monthShort(prevMonth(viewMonth))}</span>
          </div>
        )}
        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Income</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#A8D8B0' }}>{fmtMoney(cur.income)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Spent</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#F4A89E' }}>{fmtMoney(cur.spent)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Saved</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{Math.round(savingsRate)}%</div>
          </div>
        </div>
        {(accounts.length > 0 || debts.length > 0) && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(245,240,230,0.15)' }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Net worth</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: netWorth >= 0 ? '#A8D8B0' : '#F4A89E' }}>{fmtMoney(netWorth)}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Assets</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#A8D8B0' }}>{fmtMoney(assets)}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(245,240,230,0.15)' }} />
              <div style={{ flex: 1 }}>
                <div className="tiny" style={{ opacity: 0.65, marginBottom: 2 }}>Debt</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#F4A89E' }}>{fmtMoney(totalLiabilities)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUICK ACTIONS */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className="btn" style={{ flex: 1, background: '#3F7A4F', color: '#F5F0E6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onAdd('in')}>
          <Plus size={14} /> Income
        </button>
        <button className="btn" style={{ flex: 1, background: '#B8460E', color: '#F5F0E6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onAdd('out')}>
          <Plus size={14} /> Expense
        </button>
        {hasCreditCards && (
          <button className="btn" style={{ flex: 1, background: '#3B5C6B', color: '#F5F0E6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 13 }} onClick={onTransfer}>
            <ArrowRightLeft size={13} /> Pay Card
          </button>
        )}
      </div>

      {sectionOrder.map((id) => <React.Fragment key={id}>{renderMoneySection(id)}</React.Fragment>)}
      {reorderOpen && (
        <MoneyReorderModal
          order={sectionOrder}
          onSave={(o: string[]) => { if (onSaveLayout) onSaveLayout(o); }}
          onClose={() => setReorderOpen(false)}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — SECTION REORDER MODAL
// ════════════════════════════════════════════════════════════════════════════════
function MoneyReorderModal({ order, onSave, onClose }: { order: string[]; onSave: (o: string[]) => void; onClose: () => void }) {
  const [items, setItems] = useState<string[]>(order);
  const sensors = useDndSensors();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', padding: '0 0 env(safe-area-inset-bottom)' }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg)', borderRadius: '18px 18px 0 0', padding: '20px 20px 32px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 6 }}>
          <span className="h2">Reorder sections</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457', padding: 4 }}><X size={18} /></button>
        </div>
        <p className="small muted" style={{ marginBottom: 16 }}>Drag ⠿ to reorder. Sections that have nothing to show are hidden automatically.</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }: DragEndEvent) => {
          if (over && active.id !== over.id) {
            setItems((prev) => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
          }
        }}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {items.map((id) => (
              <SortableRow key={id} id={id}>
                <div style={{ padding: '11px 12px 11px 28px', borderRadius: 8, marginBottom: 6, background: '#F9F5EC', border: '1px solid #E4DCC8', fontSize: 14, color: '#1A1A2E' }}>
                  {MONEY_LABELS[id] || id}
                </div>
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
        <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => { onSave(items); onClose(); }}>
          <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save layout
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER — old inline ACCOUNTS start (replaced by renderMoneySection)
// ════════════════════════════════════════════════════════════════════════════════

export function AddTransactionModal({ entry, defaultType, spending, onSave, onDelete, onClose }: any) {
  const isEdit = !!entry;
  const [type, setType] = useState<'in' | 'out'>(entry?.type || defaultType || 'out');
  const cats = spending.categories.filter((c: any) => c.kind === type);
  const [amount, setAmount] = useState<string>(entry ? String(entry.amount) : '');
  const [name, setName] = useState<string>(entry?.name || '');
  const [categoryId, setCategoryId] = useState<string>(entry?.categoryId || cats[0]?.id || '');
  const [date, setDate] = useState<string>(entry?.date || todayStr());
  const [recurring, setRecurring] = useState<boolean>(!!entry?.recurring);
  const [note, setNote] = useState<string>(entry?.note || '');
  const [accountId, setAccountId] = useState<string>(entry?.accountId || '');

  const allAccounts: any[] = spending.accounts || [];
  const relevantAccounts = type === 'out' ? allAccounts : allAccounts.filter((a: any) => a.type !== 'credit');

  useEffect(() => {
    if (!cats.find((c: any) => c.id === categoryId)) setCategoryId(cats[0]?.id || '');
    if (accountId) {
      const acc = allAccounts.find((a: any) => a.id === accountId);
      if (acc && type === 'in' && acc.type === 'credit') setAccountId('');
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter an amount'); return; }
    if (!categoryId) { toast.error('Pick a category'); return; }
    const next = {
      id: entry?.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type, amount: Math.round(amt * 100) / 100, name: name.trim(), categoryId, date, recurring,
      note: note.trim() || undefined,
      accountId: accountId || undefined,
    };
    onSave(next);
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button
          className="tap"
          onClick={() => setType('out')}
          style={{
            flex: 1, padding: '10px',
            background: type === 'out' ? '#B8460E' : 'transparent',
            color: type === 'out' ? '#F5F0E6' : '#1A1A2E',
            borderColor: type === 'out' ? '#B8460E' : '#E4DCC8',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ArrowUpRight size={14} /> Expense
        </button>
        <button
          className="tap"
          onClick={() => setType('in')}
          style={{
            flex: 1, padding: '10px',
            background: type === 'in' ? '#3F7A4F' : 'transparent',
            color: type === 'in' ? '#F5F0E6' : '#1A1A2E',
            borderColor: type === 'in' ? '#3F7A4F' : '#E4DCC8',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ArrowDownRight size={14} /> Income
        </button>
      </div>

      <label>Amount</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 20, color: '#6B6457' }}>$</span>
        <input
          type="number" step="0.01" inputMode="decimal" autoFocus={!isEdit}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          style={{ flex: 1, fontSize: 20, fontFamily: 'JetBrains Mono, monospace' }}
        />
      </div>

      <label>What's it for?</label>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder={type === 'in' ? 'Paycheck, gig, dividend…' : 'Coffee, Netflix, rent…'}
        style={{ marginBottom: 12 }}
      />

      <label>Category</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
        {cats.map((c: any) => (
          <button
            key={c.id}
            className="tap"
            onClick={() => setCategoryId(c.id)}
            style={{
              padding: '8px 10px', textAlign: 'left', fontSize: 12,
              background: categoryId === c.id ? c.color + '22' : 'transparent',
              borderColor: categoryId === c.id ? c.color : '#E4DCC8',
              color: '#1A1A2E',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Recurring</label>
          <button
            className="tap"
            onClick={() => setRecurring(!recurring)}
            style={{
              width: '100%', padding: '10px',
              background: recurring ? '#6E5C8E' : 'transparent',
              color: recurring ? '#F5F0E6' : '#1A1A2E',
              borderColor: recurring ? '#6E5C8E' : '#E4DCC8',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Repeat size={12} /> {recurring ? 'Yes' : 'No'}
          </button>
        </div>
      </div>

      {relevantAccounts.length > 0 && (
        <>
          <label>{type === 'out' ? 'Paid with' : 'Deposit to'} <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="tap" onClick={() => setAccountId('')} style={{ fontSize: 11, padding: '5px 10px', background: !accountId ? '#1A1A2E' : 'transparent', color: !accountId ? '#F5F0E6' : '#1A1A2E', borderColor: !accountId ? '#1A1A2E' : '#E4DCC8' }}>None</button>
            {relevantAccounts.map((a: any) => (
              <button key={a.id} className="tap" onClick={() => setAccountId(a.id)} style={{ fontSize: 11, padding: '5px 10px', background: accountId === a.id ? (a.color || '#1A1A2E') : 'transparent', color: accountId === a.id ? '#F5F0E6' : '#1A1A2E', borderColor: accountId === a.id ? (a.color || '#1A1A2E') : '#E4DCC8' }}>
                {a.name}{a.type === 'credit' ? ' 💳' : ''}
              </button>
            ))}
          </div>
          {accountId && (() => {
            const acc = allAccounts.find((a: any) => a.id === accountId);
            const amt = parseFloat(amount) || 0;
            if (!acc || !amt) return null;
            const newBal = type === 'out' ? (acc.type === 'credit' ? Number(acc.balance) + amt : Number(acc.balance) - amt) : Number(acc.balance) + amt;
            return <div className="tiny muted" style={{ marginBottom: 12 }}>Balance after: <span className="mono" style={{ color: newBal < 0 ? '#B8460E' : '#3F7A4F' }}>{fmtMoney(newBal)}</span></div>;
          })()}
        </>
      )}

      <label>Note (optional)</label>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember" style={{ marginBottom: 16 }} />

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save changes' : 'Add transaction'}
      </button>
      {isEdit && (
        <button
          className="tap"
          onClick={() => { if (confirm('Delete this transaction?')) { onDelete(entry.id); onClose(); } }}
          style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Trash2 size={12} /> Delete
        </button>
      )}
    </ModalShell>
  );
}

export function MoneyGoalsModal({ spending, onSave, onClose }: any) {
  const [budget, setBudget] = useState<string>(String(spending.monthlyBudget || ''));
  const [goal, setGoal] = useState<string>(String(spending.savingsGoal || ''));
  const save = () => {
    onSave({ ...spending, monthlyBudget: parseFloat(budget) || 0, savingsGoal: parseFloat(goal) || 0 });
    onClose();
  };
  return (
    <ModalShell title="Money goals" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.4 }}>Set a monthly spending cap and a savings target. Leave at 0 to hide.</p>
      <label>Monthly spending budget</label>
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span className="mono muted">$</span>
        <input type="number" step="1" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 2500" />
      </div>
      <label>Monthly savings goal</label>
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 18 }}>
        <span className="mono muted">$</span>
        <input type="number" step="1" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. 800" />
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save goals
      </button>
    </ModalShell>
  );
}

export function CategoryBudgetsModal({ spending, onSave, onClose }: any) {
  const outCats = spending.categories.filter((c: any) => c.kind === 'out');
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const cb = spending.categoryBudgets || {};
    const o: Record<string, string> = {};
    for (const c of outCats) o[c.id] = cb[c.id] ? String(cb[c.id]) : '';
    return o;
  });
  const total = outCats.reduce((a: number, c: any) => a + (parseFloat(vals[c.id]) || 0), 0);
  const save = () => {
    const cb: Record<string, number> = {};
    for (const c of outCats) { const n = parseFloat(vals[c.id]) || 0; if (n > 0) cb[c.id] = Math.round(n); }
    onSave({ ...spending, categoryBudgets: cb });
    onClose();
  };
  return (
    <ModalShell title="Category budgets" onClose={onClose} icon={<Target size={18} color="#6E5C8E" />}>
      <p className="muted small" style={{ marginBottom: 14, lineHeight: 1.4 }}>Set a monthly limit per spending category. Leave blank to skip — progress shows against the selected month.</p>
      {outCats.length === 0 ? (
        <div className="muted small">Add expense categories first.</div>
      ) : (
        <>
          {outCats.map((c: any) => (
            <div key={c.id} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span className="swatch" style={{ background: c.color }} />
              <span className="small" style={{ flex: 1 }}>{c.name}</span>
              <span className="mono muted tiny">$</span>
              <input type="number" inputMode="decimal" value={vals[c.id]} onChange={(e) => setVals((v) => ({ ...v, [c.id]: e.target.value }))} placeholder="0" style={{ width: 90, margin: 0, padding: '6px 8px', textAlign: 'right' }} />
            </div>
          ))}
          <div className="between" style={{ margin: '12px 0 16px', paddingTop: 10, borderTop: '1px solid #E4DCC8' }}>
            <span className="small" style={{ fontWeight: 600 }}>Total monthly</span>
            <span className="mono small" style={{ fontWeight: 600 }}>{fmtMoney(total)}</span>
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={save}><Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save budgets</button>
        </>
      )}
    </ModalShell>
  );
}

export function MoneyCategoriesModal({ spending, onSave, onClose }: any) {
  const [cats, setCats] = useState<any[]>(spending.categories);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'in' | 'out'>('out');
  const [color, setColor] = useState('#8E4585');
  const palette = ['#B8460E', '#C8932E', '#3F7A4F', '#3B5C6B', '#8E4585', '#6E5C8E', '#A65E8E', '#8E5C5C', '#5C8E4F', '#6B6457'];
  const add = () => {
    if (!name.trim()) return;
    setCats([...cats, { id: `c_${Date.now()}`, name: name.trim(), kind, color }]);
    setName('');
  };
  const remove = (id: string) => {
    if (!confirm('Delete this category? Existing transactions keep the reference but will show as "Other".')) return;
    setCats(cats.filter((c) => c.id !== id));
  };
  const rename = (id: string, n: string) => setCats(cats.map((c) => (c.id === id ? { ...c, name: n } : c)));
  const recolor = (id: string, col: string) => setCats(cats.map((c) => (c.id === id ? { ...c, color: col } : c)));
  return (
    <ModalShell title="Categories" onClose={onClose}>
      <div className="h2" style={{ marginBottom: 8 }}>Add new</div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button className="tap" onClick={() => setKind('out')} style={{ flex: 1, background: kind === 'out' ? '#B8460E22' : 'transparent', borderColor: kind === 'out' ? '#B8460E' : '#E4DCC8' }}>Expense</button>
        <button className="tap" onClick={() => setKind('in')} style={{ flex: 1, background: kind === 'in' ? '#3F7A4F22' : 'transparent', borderColor: kind === 'in' ? '#3F7A4F' : '#E4DCC8' }}>Income</button>
      </div>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" style={{ marginBottom: 8 }} />
      <div className="row" style={{ gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {palette.map((p) => (
          <button key={p} onClick={() => setColor(p)} style={{ width: 24, height: 24, borderRadius: 6, background: p, border: color === p ? '2px solid #1A1A2E' : '1px solid #E4DCC8', cursor: 'pointer' }} />
        ))}
      </div>
      <button className="tap" style={{ width: '100%', marginBottom: 16 }} onClick={add}><Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add category</button>

      <div className="h2" style={{ marginBottom: 8 }}>Existing</div>
      {(['out', 'in'] as const).map((k) => (
        <div key={k} style={{ marginBottom: 14 }}>
          <div className="tiny muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k === 'out' ? 'Expenses' : 'Income'}</div>
          {cats.filter((c) => c.kind === k).map((c) => (
            <div key={c.id} className="row" style={{ gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input type="color" value={c.color} onChange={(e) => recolor(c.id, e.target.value)} style={{ width: 32, height: 32, padding: 0, border: '1px solid #E4DCC8', borderRadius: 6, background: 'transparent' }} />
              <input type="text" value={c.name} onChange={(e) => rename(c.id, e.target.value)} style={{ flex: 1 }} />
              <button className="tap" onClick={() => remove(c.id)} style={{ padding: '6px 8px', color: '#B8460E' }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      ))}

      <button className="btn" style={{ width: '100%' }} onClick={() => { onSave({ ...spending, categories: cats }); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save categories
      </button>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — ADD / EDIT ACCOUNT MODAL
// ════════════════════════════════════════════════════════════════════════════════
export function AddAccountModal({ account, onSave, onDelete, onClose }: any) {
  const isEdit = !!account;
  const [name, setName] = useState(account?.name || '');
  const [bank, setBank] = useState(account?.bank || '');
  const [type, setType] = useState<'checking' | 'savings' | 'credit'>(account?.type || 'checking');
  const [balance, setBalance] = useState(String(account?.balance ?? ''));
  const [creditLimit, setCreditLimit] = useState(String(account?.creditLimit ?? ''));
  const [rate, setRate] = useState(String(account?.rate ?? ''));
  const [minPayment, setMinPayment] = useState(String(account?.minPayment ?? ''));
  const [dueDay, setDueDay] = useState(String(account?.dueDay ?? ''));
  const [color, setColor] = useState(account?.color || ACCOUNT_COLORS[0]);
  const [includeNW, setIncludeNW] = useState(account?.includeInNetWorth !== false);

  const save = () => {
    if (!name.trim()) { toast.error('Enter an account name'); return; }
    const bal = parseFloat(balance);
    if (!isFinite(bal) || bal < 0) { toast.error('Enter a valid balance'); return; }
    const next: any = {
      id: account?.id || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), bank: bank.trim(), type,
      balance: Math.round(bal * 100) / 100, color, includeInNetWorth: includeNW,
      accruedInterest: account?.accruedInterest || 0,
      lastAccrualDate: account?.lastAccrualDate || todayStr(),
    };
    if (type === 'credit') {
      next.creditLimit = parseFloat(creditLimit) || 0;
      next.rate = parseFloat(rate) || 0;
      next.minPayment = parseFloat(minPayment) || 0;
      next.dueDay = parseInt(dueDay) || null;
    }
    onSave(next); onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit account' : 'Add account'} onClose={onClose}>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        {(['checking', 'savings', 'credit'] as const).map((t) => (
          <button key={t} className="tap" onClick={() => setType(t)} style={{ flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: type === t ? 700 : 400, background: type === t ? '#1A1A2E' : 'transparent', color: type === t ? '#F5F0E6' : '#1A1A2E', borderColor: type === t ? '#1A1A2E' : '#E4DCC8', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      <label>Account nickname</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'credit' ? 'Navy Federal CC, Chase Sapphire…' : 'Main checking, Emergency fund…'} style={{ marginBottom: 12 }} autoFocus={!isEdit} />

      <label>Bank / institution</label>
      <input type="text" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Chase, Navy Federal, Wells Fargo…" style={{ marginBottom: 12 }} />

      <label>{type === 'credit' ? 'Current balance owed' : 'Current balance'}</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono muted">$</span>
        <input type="number" step="0.01" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }} />
      </div>

      {type === 'credit' && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Credit limit</label>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="mono muted">$</span>
                <input type="number" step="1" inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="e.g. 5000" style={{ flex: 1 }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label>APR %</label>
              <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 24.99" />
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Due day of month</label>
              <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 15" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Min payment</label>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="mono muted">$</span>
                <input type="number" step="0.01" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} placeholder="0.00" style={{ flex: 1 }} />
              </div>
            </div>
          </div>
          {balance && rate && parseFloat(balance) > 0 && parseFloat(rate) > 0 && (
            <div style={{ background: '#B8460E10', border: '1px solid #B8460E33', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
              <span className="muted">Daily interest: </span>
              <span className="mono" style={{ color: '#B8460E', fontWeight: 600 }}>~{fmtMoney(calcDailyInterest(parseFloat(balance), parseFloat(rate)))}/day</span>
              <span className="muted"> · </span>
              <span className="mono" style={{ color: '#B8460E' }}>~{fmtMoney(calcMonthlyInterest(parseFloat(balance), parseFloat(rate)))}/mo</span>
            </div>
          )}
        </>
      )}

      {type !== 'credit' && (
        <>
          <label>Card color</label>
          <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {ACCOUNT_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: color === c ? '3px solid #C8932E' : '1px solid #E4DCC8', cursor: 'pointer' }} />
            ))}
          </div>
        </>
      )}

      <div className="between" style={{ marginBottom: 18 }}>
        <span className="small">Include in net worth</span>
        <button className="tap" onClick={() => setIncludeNW(!includeNW)} style={{ padding: '6px 14px', background: includeNW ? '#3F7A4F' : 'transparent', color: includeNW ? '#F5F0E6' : '#1A1A2E', borderColor: includeNW ? '#3F7A4F' : '#E4DCC8' }}>
          {includeNW ? 'Yes' : 'No'}
        </button>
      </div>

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save account' : 'Add account'}
      </button>
      {isEdit && (
        <button className="tap" onClick={() => { if (confirm('Remove this account?')) { onDelete(account.id); onClose(); } }} style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Trash2 size={12} /> Remove account
        </button>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — ADD / EDIT DEBT MODAL
// ════════════════════════════════════════════════════════════════════════════════
export function AddDebtModal({ debt, onSave, onDelete, onClose }: any) {
  const isEdit = !!debt;
  const [name, setName] = useState(debt?.name || '');
  const [type, setType] = useState(debt?.type || 'student_loan');
  const [originalAmount, setOriginalAmount] = useState(String(debt?.originalAmount ?? ''));
  const [balance, setBalance] = useState(String(debt?.balance ?? ''));
  const [minPayment, setMinPayment] = useState(String(debt?.minPayment ?? ''));
  const [rate, setRate] = useState(String(debt?.rate ?? ''));
  const [dueDay, setDueDay] = useState(String(debt?.dueDay ?? ''));
  const [includeNW, setIncludeNW] = useState(debt?.includeInNetWorth !== false);

  const save = () => {
    if (!name.trim()) { toast.error('Enter a name'); return; }
    const bal = parseFloat(balance);
    if (!isFinite(bal) || bal < 0) { toast.error('Enter a valid balance'); return; }
    onSave({
      id: debt?.id || `debt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), type,
      originalAmount: parseFloat(originalAmount) || bal,
      balance: Math.round(bal * 100) / 100,
      minPayment: parseFloat(minPayment) || 0,
      rate: parseFloat(rate) || 0,
      dueDay: parseInt(dueDay) || null,
      includeInNetWorth: includeNW,
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit debt' : 'Add debt'} onClose={onClose}>
      <label>Type of debt</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
        {DEBT_TYPES.map((t) => (
          <button key={t.id} className="tap" onClick={() => setType(t.id)} style={{ padding: '8px', fontSize: 12, background: type === t.id ? '#B8460E22' : 'transparent', borderColor: type === t.id ? '#B8460E' : '#E4DCC8', fontWeight: type === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      <label>Name / label</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sallie Mae, Car loan…" style={{ marginBottom: 12 }} autoFocus={!isEdit} />

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Current balance owed</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mono muted">$</span>
            <input type="number" step="0.01" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" style={{ flex: 1 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label>Original total</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mono muted">$</span>
            <input type="number" step="0.01" inputMode="decimal" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} placeholder="e.g. 20000" style={{ flex: 1 }} />
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Min payment / mo</label>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mono muted">$</span>
            <input type="number" step="0.01" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} placeholder="0.00" style={{ flex: 1 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label>Interest rate %</label>
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 5.99" />
        </div>
      </div>

      <label>Payment due day of month (optional)</label>
      <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 1" style={{ marginBottom: 12 }} />

      <div className="between" style={{ marginBottom: 18 }}>
        <span className="small">Include in net worth calculation</span>
        <button className="tap" onClick={() => setIncludeNW(!includeNW)} style={{ padding: '6px 14px', background: includeNW ? '#3F7A4F' : 'transparent', color: includeNW ? '#F5F0E6' : '#1A1A2E', borderColor: includeNW ? '#3F7A4F' : '#E4DCC8' }}>
          {includeNW ? 'Yes' : 'No'}
        </button>
      </div>

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save debt' : 'Add debt'}
      </button>
      {isEdit && (
        <button className="tap" onClick={() => { if (confirm('Remove this debt?')) { onDelete(debt.id); onClose(); } }} style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Trash2 size={12} /> Remove debt
        </button>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — ADD / EDIT "PEOPLE OWE ME" MODAL
// ════════════════════════════════════════════════════════════════════════════════
export function AddOwedModal({ item, onSave, onDelete, onClose }: any) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [amount, setAmount] = useState(String(item?.amount ?? ''));
  const [note, setNote] = useState(item?.note || '');
  const [dueDate, setDueDate] = useState(item?.dueDate || '');
  const [paid, setPaid] = useState(item?.paid || false);

  const save = () => {
    if (!name.trim()) { toast.error('Enter a name'); return; }
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter an amount'); return; }
    onSave({
      id: item?.id || `owed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(), amount: Math.round(amt * 100) / 100,
      note: note.trim() || undefined, dueDate: dueDate || undefined,
      paid, dateAdded: item?.dateAdded || todayStr(),
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? 'Edit IOU' : 'Someone owes me'} onClose={onClose}>
      <label>Who owes you?</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or group" style={{ marginBottom: 12 }} autoFocus={!isEdit} />

      <label>Amount</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 20, color: '#6B6457' }}>$</span>
        <input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ flex: 1, fontSize: 20, fontFamily: 'JetBrains Mono, monospace' }} />
      </div>

      <label>What for? (optional)</label>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dinner, concert tickets, rent split…" style={{ marginBottom: 12 }} />

      <label>Due date (optional)</label>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ marginBottom: 14 }} />

      {isEdit && (
        <div className="between" style={{ marginBottom: 18 }}>
          <span className="small">Mark as paid</span>
          <button className="tap" onClick={() => setPaid(!paid)} style={{ padding: '6px 14px', background: paid ? '#3F7A4F' : 'transparent', color: paid ? '#F5F0E6' : '#1A1A2E', borderColor: paid ? '#3F7A4F' : '#E4DCC8' }}>
            {paid ? '✓ Paid' : 'Unpaid'}
          </button>
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={save}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isEdit ? 'Save' : 'Add IOU'}
      </button>
      {isEdit && (
        <button className="tap" onClick={() => { if (confirm('Delete this IOU?')) { onDelete(item.id); onClose(); } }} style={{ width: '100%', color: '#B8460E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Trash2 size={12} /> Delete
        </button>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — CREDIT CARD PAYMENT (TRANSFER) MODAL
// ════════════════════════════════════════════════════════════════════════════════
export function AccountTransferModal({ spending, onSave, onClose }: any) {
  const fromAccounts = (spending.accounts || []).filter((a: any) => a.type !== 'credit');
  const toAccounts = (spending.accounts || []).filter((a: any) => a.type === 'credit');
  const [fromId, setFromId] = useState(fromAccounts[0]?.id || '');
  const [toId, setToId] = useState(toAccounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());

  const from = fromAccounts.find((a: any) => a.id === fromId);
  const to = toAccounts.find((a: any) => a.id === toId);

  const save = () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter an amount'); return; }
    if (!fromId && fromAccounts.length > 0) { toast.error('Select a source account'); return; }
    if (!toId) { toast.error('Select a credit card to pay'); return; }
    onSave({
      tx: {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'out', amount: Math.round(amt * 100) / 100,
        name: `CC Payment → ${to?.name || 'Credit Card'}`,
        categoryId: 'c_bills', date,
        accountId: fromId || undefined, isTransfer: true,
      },
      creditAccountId: toId,
      amount: Math.round(amt * 100) / 100,
    });
    onClose();
  };

  if (toAccounts.length === 0) {
    return (
      <ModalShell title="Pay credit card" onClose={onClose}>
        <p className="muted small" style={{ textAlign: 'center', padding: '20px 0' }}>No credit cards found. Add a credit card in Accounts first.</p>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Pay credit card" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>Records a payment from a debit/savings account and reduces the credit card balance.</p>

      {fromAccounts.length > 0 && (
        <>
          <label>Pay from (debit / savings)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
            {fromAccounts.map((a: any) => (
              <button key={a.id} className="tap" onClick={() => setFromId(a.id)} style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, background: fromId === a.id ? (a.color || '#1A1A2E') : 'transparent', color: fromId === a.id ? '#F5F0E6' : '#1A1A2E', borderColor: fromId === a.id ? (a.color || '#1A1A2E') : '#E4DCC8' }}>
                {a.name}{a.bank ? ` · ${a.bank}` : ''}
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{fmtMoney(a.balance)}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <label>Pay to (credit card)</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {toAccounts.map((a: any) => (
          <button key={a.id} className="tap" onClick={() => setToId(a.id)} style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, background: toId === a.id ? '#B8460E' : 'transparent', color: toId === a.id ? '#F5F0E6' : '#1A1A2E', borderColor: toId === a.id ? '#B8460E' : '#E4DCC8' }}>
            {a.name}{a.bank ? ` · ${a.bank}` : ''}
            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>Owes {fmtMoney(a.balance)}</div>
          </button>
        ))}
      </div>

      <label>Payment amount</label>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 20, color: '#6B6457' }}>$</span>
        <input type="number" step="0.01" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ flex: 1, fontSize: 20, fontFamily: 'JetBrains Mono, monospace' }} />
      </div>
      {to && Number(to.balance) > 0 && (
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setAmount(String(to.balance))}>Full balance {fmtMoney(to.balance)}</button>
          {Number(to.minPayment) > 0 && <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setAmount(String(to.minPayment))}>Min {fmtMoney(to.minPayment)}</button>}
        </div>
      )}

      <label>Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 18 }} />

      {from && to && parseFloat(amount) > 0 && (
        <div style={{ background: '#F0EAD8', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          <span className="muted">{from.name}</span> <ArrowRightLeft size={11} style={{ verticalAlign: 'middle', margin: '0 4px' }} /> <span className="muted">{to.name}</span>
          <span className="mono" style={{ float: 'right', fontWeight: 700 }}>{fmtMoney(parseFloat(amount) || 0)}</span>
        </div>
      )}

      <button className="btn" style={{ width: '100%' }} onClick={save}>
        <ArrowRightLeft size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Record payment
      </button>
    </ModalShell>
  );
}
