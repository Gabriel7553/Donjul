import { useState, useEffect, useRef, useMemo } from 'react';
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
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { pad, todayStr, nowHHMM, diffDays, fmtDate, fmtShortDate } from '../lib/date';
import { MICRO_KEYS, MICRO_DEFS, addMealEntry, removeMealEntry, updateMealEntry, mealTotalsFromEntries, fileToResizedBase64, FOOD_UNITS, fmtNum, servingLabelOf, entryDisplayName } from '../lib/nutrition';
import { calorieGoal, estimateBurn, latestWeightLb, sumBurn } from '../lib/body';
import { ModalShell, QtyStepper, SortableRow, VoiceButton, useDndSensors } from '../ui';
import { MicrosCard } from './cards';

export function LogMealModal({ meals, settings, onSave, onClose, targetDate, mealType }: any) {
  const target = targetDate || todayStr();
  const isToday = target === todayStr();
  const [mode, setMode] = useState('preset');
  const [newPreset, setNewPreset] = useState({ name: '', protein: '', carbs: '', fat: '', calories: '', source: '', servingSize: '1', servingUnit: 'serving' });
  const [manual, setManual] = useState<any>({ name: '', protein: '', carbs: '', fat: '', calories: '', servingSize: '1', servingUnit: 'serving' });
  const [manualMicros, setManualMicros] = useState<any>({});
  const [showManualMicros, setShowManualMicros] = useState(false);
  const [parts, setParts] = useState<any[]>([{ id: 'c0', name: '', servingLabel: '1 serving', protein: '', carbs: '', fat: '', calories: '', servings: '1' }]);
  const [comboScanIdx, setComboScanIdx] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [scanState, setScanState] = useState<'idle'|'scanning'|'done'|'error'>('idle');
  const [scanError, setScanError] = useState('');
  const [review, setReview] = useState<any>(null); // parsed item awaiting log/save (scan/type/barcode)
  const [typeText, setTypeText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const dayEntries = meals.entries?.[target] || [];
  // Recently logged foods (distinct by name, newest first) reconstructed to per-serving macros for one-tap re-log.
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    const dates = Object.keys(meals.entries || {}).sort().reverse();
    for (const d of dates) {
      const list = meals.entries[d] || [];
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        const base = (e.baseName || e.name || '').trim();
        if (!base || base === 'Logged earlier') continue;
        const key = base.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const q = Number(e.qty) || 1;
        const per = (v: any) => (Number(v) || 0) / (q || 1);
        const item: any = {
          name: base, source: e.source || '',
          servingSize: Number(e.servingSize) || 1, servingUnit: e.unit || 'serving',
          protein: Math.round(per(e.protein)), carbs: Math.round(per(e.carbs)), fat: Math.round(per(e.fat)), calories: Math.round(per(e.calories)),
        };
        for (const k of MICRO_KEYS) { const v = per(e[k]); item[k] = v < 10 ? Math.round(v * 10) / 10 : Math.round(v); }
        out.push(item);
        if (out.length >= 8) return out;
      }
    }
    return out;
  }, [meals.entries]);
  const scaled = (m: any, q: number) => {
    const out: any = {
      protein: Math.round((m.protein || 0) * q),
      carbs: Math.round((m.carbs || 0) * q),
      fat: Math.round((m.fat || 0) * q),
      calories: Math.round((m.calories || 0) * q),
    };
    // Preserve all micros, keeping one decimal place for small values.
    for (const k of MICRO_KEYS) {
      const v = (Number(m[k]) || 0) * q;
      out[k] = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
    }
    return out;
  };

  const logItem = async (item: any, q = 1) => {
    const s = scaled(item, q);
    const size = Number(item.servingSize) || 1;
    const u = item.servingUnit || 'serving';
    const realUnit = u !== 'serving';
    const amount = realUnit ? Math.round(q * size * 100) / 100 : q;
    const name = entryDisplayName(item.name, amount, u, q);
    await onSave(addMealEntry(meals, target, { name, baseName: item.name, source: item.source || '', qty: q, amount, unit: u, servingSize: size, ...s, ...(mealType ? { meal: mealType } : {}) }));
    onClose();
  };

  // Build a preset/entry from a raw food item, preserving all micros.
  const pickFood = (item: any) => {
    const base: any = {
      name: item.name || '',
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
      calories: Number(item.calories) || 0,
      source: item.source || '',
    };
    for (const k of MICRO_KEYS) base[k] = Number(item[k]) || 0;
    return base;
  };
  const removeEntry = async (id: string) => { await onSave(removeMealEntry(meals, target, id)); };

  const scanImage = async (file: File) => {
    setScanState('scanning'); setReview(null); setScanError('');
    try {
      const { image, mime } = await fileToResizedBase64(file);
      const resp = await fetch('/api/scan-food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, mime }) });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || 'Could not read macros.'); }
      const data = await resp.json();
      setReview({ ...data, source: data.serving ? `Scan · ${data.serving}` : 'AI scan' });
      setQty(1); setScanState('done');
    } catch (e: any) { setScanState('error'); setScanError(e?.message || 'Could not read macros.'); }
  };

  const scanBarcode = async (file: File) => {
    setScanState('scanning'); setReview(null); setScanError('');
    try {
      if (!('BarcodeDetector' in window)) throw new Error('Barcode scanning needs a newer phone browser. Use photo scan instead.');
      const bitmap = await createImageBitmap(file);
      // @ts-ignore - BarcodeDetector is not yet in TS DOM lib
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const codes = await detector.detect(bitmap);
      if (!codes.length) throw new Error('No barcode found. Try again, square on the code.');
      const code = codes[0].rawValue;
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments,serving_size`);
      const j = await r.json();
      if (j.status !== 1 || !j.product) throw new Error('Product not found in the food database.');
      const n = j.product.nutriments || {};
      const perServing = n['energy-kcal_serving'] != null;
      const pick = (base: string) => Number(perServing ? n[`${base}_serving`] : n[`${base}_100g`]) || 0;
      setReview({
        name: j.product.product_name || 'Scanned product',
        protein: pick('proteins'), carbs: pick('carbohydrates'), fat: pick('fat'),
        calories: Number(perServing ? n['energy-kcal_serving'] : n['energy-kcal_100g']) || 0,
        source: perServing ? `Barcode · ${j.product.serving_size || 'per serving'}` : 'Barcode · per 100g',
      });
      setQty(1); setScanState('done');
    } catch (e: any) { setScanState('error'); setScanError(e?.message || 'Barcode scan failed.'); }
  };

  const parseTyped = async () => {
    if (!typeText.trim()) return;
    setBusy(true); setScanError(''); setReview(null);
    try {
      const resp = await fetch('/api/parse-food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: typeText }) });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || 'Could not read that.'); }
      const data = await resp.json();
      setReview(data); setQty(1);
    } catch (e: any) { setScanError(e?.message || 'Could not read that.'); }
    finally { setBusy(false); }
  };

  const logManual = async () => {
    const micros: any = {};
    for (const k of MICRO_KEYS) micros[k] = parseFloat(manualMicros[k]) || 0;
    await logItem({ name: manual.name || 'Manual entry', source: 'Manual', protein: parseFloat(manual.protein) || 0, carbs: parseFloat(manual.carbs) || 0, fat: parseFloat(manual.fat) || 0, calories: parseFloat(manual.calories) || 0, servingSize: parseFloat(manual.servingSize) || 1, servingUnit: manual.servingUnit || 'serving', ...micros }, qty);
  };

  const partSum = (p: any) => {
    const s = Math.max(0.01, parseFloat(p.servings) || 1);
    const out: any = { protein: (parseFloat(p.protein)||0)*s, carbs: (parseFloat(p.carbs)||0)*s, fat: (parseFloat(p.fat)||0)*s, calories: (parseFloat(p.calories)||0)*s };
    for (const k of MICRO_KEYS) out[k] = (parseFloat(p[k])||0)*s;
    return out;
  };
  const comboTotal = parts.reduce((acc: any, p: any) => {
    const n = partSum(p);
    acc.protein += n.protein; acc.carbs += n.carbs; acc.fat += n.fat; acc.calories += n.calories;
    for (const k of MICRO_KEYS) acc[k] = (acc[k]||0) + n[k];
    return acc;
  }, { protein: 0, carbs: 0, fat: 0, calories: 0, ...Object.fromEntries(MICRO_KEYS.map(k => [k, 0])) });
  const logCombo = async () => {
    const name = parts.map((p: any) => p.name || 'item').join(' + ');
    // Auto-save each named ingredient as its own preset (dedupe by name).
    const existingNames = new Set((meals.presets || []).map((x: any) => (x.name || '').toLowerCase()));
    const newPresets: any[] = [];
    for (const p of parts) {
      const nm = (p.name || '').trim();
      if (!nm || existingNames.has(nm.toLowerCase())) continue;
      existingNames.add(nm.toLowerCase());
      const item: any = {
        id: 'p' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: nm,
        source: p.servingLabel ? `Per ${p.servingLabel}` : '',
        protein: parseFloat(p.protein) || 0,
        carbs: parseFloat(p.carbs) || 0,
        fat: parseFloat(p.fat) || 0,
        calories: parseFloat(p.calories) || 0,
      };
      for (const k of MICRO_KEYS) item[k] = parseFloat(p[k]) || 0;
      newPresets.push(item);
    }
    // Build the meal entry inline so we can persist presets + entry in ONE save (avoid stale-closure overwrite).
    const item = { name, source: 'Combo', ...comboTotal };
    const s = scaled(item, 1);
    const withPresets = newPresets.length
      ? { ...meals, presets: [...(meals.presets || []), ...newPresets] }
      : meals;
    await onSave(addMealEntry(withPresets, target, { name, source: 'Combo', qty: 1, ...s, ...(mealType ? { meal: mealType } : {}) }));
    onClose();
  };
  const updatePart = (idx: number, patch: any) => setParts((ps: any[]) => ps.map((p, i) => i === idx ? { ...p, ...patch } : p));
  const applyComboScan = (data: any, idx: number) => {
    updatePart(idx, { name: data.name || parts[idx].name, protein: String(data.protein||0), carbs: String(data.carbs||0), fat: String(data.fat||0), calories: String(data.calories||0), servingLabel: data.serving || '1 serving', ...Object.fromEntries(MICRO_KEYS.map(k => [k, String(data[k]||0)])) });
    setComboScanIdx(null); setReview(null); setScanState('idle');
  };
  const addPreset = async () => {
    const p = { id: 'p' + Date.now(), name: newPreset.name, protein: parseFloat(newPreset.protein) || 0, carbs: parseFloat(newPreset.carbs) || 0, fat: parseFloat(newPreset.fat) || 0, calories: parseFloat(newPreset.calories) || 0, source: newPreset.source, servingSize: parseFloat(newPreset.servingSize) || 1, servingUnit: newPreset.servingUnit || 'serving' };
    await onSave({ ...meals, presets: [...meals.presets, p] });
    setMode('preset');
    setNewPreset({ name: '', protein: '', carbs: '', fat: '', calories: '', source: '', servingSize: '1', servingUnit: 'serving' });
  };
  const removePreset = async (id: string) => { await onSave({ ...meals, presets: meals.presets.filter((p: any) => p.id !== id) }); };

  const ReviewPanel = review && (
    <div className="card" style={{ padding: 14, marginBottom: 12, background: '#F0F5ED', border: '1px solid #C8D9C0' }}>
      <div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>{review.name}</div>
      {review.source && <div className="muted tiny" style={{ marginBottom: 8 }}>{review.source}</div>}
      <QtyStepper qty={qty} setQty={setQty} />
      {(() => {
        const s = scaled(review, qty);
        const microHits = MICRO_DEFS.filter(d => (s[d.key] || 0) > 0);
        return (
          <>
            <div className="mono tiny muted" style={{ marginBottom: microHits.length ? 6 : 10 }}>
              {`${s.protein}p · ${s.carbs}c · ${s.fat}f · ${s.calories}cal`}
            </div>
            {microHits.length > 0 && (
              <div style={{ marginBottom: 10, paddingTop: 6, borderTop: '1px solid #C8D9C0' }}>
                <div className="mono tiny muted" style={{ marginBottom: 4 }}>MICROS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                  {microHits.map(d => {
                    const v: number = (s as any)[d.key];
                    const fmt = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
                    return (
                      <span key={d.key} className="mono tiny" style={{ color: d.limit ? '#B8460E' : '#4A6741' }}>
                        {d.label.replace('Vitamin ', 'Vit ')}: {fmt}{d.unit}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      })()}
      <button className="btn" style={{ width: '100%', marginBottom: 6 }} onClick={() => logItem(review, qty)}>
        <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isToday ? 'Log to today' : `Log to ${fmtDate(target)}`}
      </button>
      <button className="tap" style={{ width: '100%' }} onClick={async () => { await onSave({ ...meals, presets: [...meals.presets, { id: 'p' + Date.now(), ...pickFood(review) }] }); setReview(null); setMode('preset'); }}>
        Save as preset
      </button>
    </div>
  );

  return (
    <ModalShell title={isToday ? 'Log meal' : `Log meal · ${fmtDate(target)}`} onClose={onClose} icon={<Apple size={18} color="#4A6741" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`tap ${mode === 'preset' ? 'active' : ''}`} onClick={() => setMode('preset')}>Presets</button>
        <button className={`tap ${mode === 'type' ? 'active' : ''}`} onClick={() => { setMode('type'); setReview(null); }}>Type</button>
        <button className={`tap ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>Manual</button>
        <button className={`tap ${mode === 'combo' ? 'active' : ''}`} onClick={() => { setMode('combo'); setReview(null); setComboScanIdx(null); }}>Combo</button>
        <button className={`tap ${mode === 'add' ? 'active' : ''}`} onClick={() => setMode('add')}>+ Save</button>
        <button
          onClick={() => { setMode('scan'); setReview(null); setScanState('idle'); setComboScanIdx(null); }}
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '9px 16px', borderRadius: 8, border: '1px solid #8E4585', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            background: mode === 'scan' ? '#6F3468' : '#8E4585', color: '#F5F0E6',
          }}
        >
          <Camera size={15} />Scan
        </button>
      </div>

      {mode === 'type' && (
        <>
          <div className="between" style={{ marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Describe what you ate</label>
            <VoiceButton onResult={(t: string) => setTypeText((prev) => prev ? `${prev} ${t}` : t)} />
          </div>
          <textarea value={typeText} onChange={(e) => setTypeText(e.target.value)} placeholder="e.g. 2 scrambled eggs, a slice of buttered toast, and a banana" style={{ height: 70, marginBottom: 10, width: '100%', resize: 'vertical' }} />
          {scanError && <p className="small" style={{ color: '#B8460E', marginBottom: 8 }}>{scanError}</p>}
          {ReviewPanel}
          <button className="btn" style={{ width: '100%' }} onClick={parseTyped} disabled={busy || !typeText.trim()}>
            {busy ? 'Estimating…' : <><Zap size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Estimate with AI</>}
          </button>
        </>
      )}

      {mode === 'scan' && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12, background: '#EEF2F8', border: '1px solid #C8D4E4', textAlign: 'center' }}>
            <Camera size={28} color="#3B5C6B" style={{ marginBottom: 8 }} />
            <p className="muted small" style={{ lineHeight: 1.5, marginBottom: 12 }}>Photo a nutrition label, cookbook page, or meal — or scan a product barcode.</p>
            {scanState === 'scanning' && <p className="mono small" style={{ color: '#3B5C6B' }}>Reading…</p>}
            {scanState === 'error' && <p className="small" style={{ color: '#B8460E', marginBottom: 8 }}>{scanError}</p>}
            {scanState !== 'scanning' && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) scanImage(f); }} />
                <input ref={barcodeRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) scanBarcode(f); }} />
                <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => fileRef.current?.click()}>
                  <Camera size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Photo (label / food)
                </button>
                <button className="tap" style={{ width: '100%' }} onClick={() => barcodeRef.current?.click()}>
                  Scan barcode
                </button>
              </>
            )}
          </div>
          {ReviewPanel}
          <p className="muted tiny" style={{ lineHeight: 1.5 }}>Review the values and set servings before logging. AI reads labels well but may estimate portions.</p>
        </>
      )}

      {mode === 'preset' && (
        <>
          <div className="muted tiny" style={{ marginBottom: 10 }}>Set servings, then tap a meal to log it.</div>
          <QtyStepper qty={qty} setQty={setQty} />
          {recents.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="mono tiny muted" style={{ marginBottom: 6 }}>RECENT</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {recents.map((r: any, i: number) => (
                  <button key={i} className="tap" style={{ textAlign: 'left', flex: '1 1 46%', minWidth: 0, padding: '7px 10px' }} onClick={() => logItem(r, qty)} title={`${r.protein}p · ${r.carbs}c · ${r.fat}f · ${r.calories}cal`}>
                    <div className="small" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div className="mono tiny muted">{r.calories}cal · {servingLabelOf(r.servingSize, r.servingUnit)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {meals.presets.length === 0 && <p className="muted small" style={{ marginBottom: 10 }}>No presets yet — tap "+ Save" to add some.</p>}
          {meals.presets.map((p: any) => (
            <div key={p.id} className="card" style={{ padding: 12, marginBottom: 8, cursor: 'pointer' }} onClick={() => logItem(p, qty)}>
              <div className="between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600 }}>{p.name}</div>
                  {p.source && <div className="muted tiny">{p.source}</div>}
                  {((p.servingUnit && p.servingUnit !== 'serving') || (Number(p.servingSize) || 1) !== 1) && (
                    <div className="mono tiny muted" style={{ marginTop: 3 }}>per {servingLabelOf(p.servingSize, p.servingUnit)}</div>
                  )}
                  <div className="mono tiny muted" style={{ marginTop: 3 }}>{p.protein}p · {p.carbs}c · {p.fat}f · {p.calories}cal{qty !== 1 ? ` (×${qty})` : ''}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removePreset(p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E', padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {mode === 'manual' && (
        <>
          <label>Name (optional)</label>
          <input type="text" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="e.g. Lunch" style={{ marginBottom: 10 }} />
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1 }}><label>Serving size</label><input type="number" inputMode="decimal" value={manual.servingSize} onChange={(e) => setManual({ ...manual, servingSize: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Unit</label><select value={manual.servingUnit} onChange={(e) => setManual({ ...manual, servingUnit: e.target.value })}>{FOOD_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          <p className="muted tiny" style={{ marginBottom: 10, lineHeight: 1.4 }}>Macros below are for {servingLabelOf(manual.servingSize, manual.servingUnit)}; set servings to log a multiple.</p>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={manual.calories} onChange={(e) => setManual({ ...manual, calories: e.target.value })} /></div>
          </div>
          <button className="tap" style={{ width: '100%', marginTop: 12, marginBottom: 4, fontSize: 11 }} onClick={() => setShowManualMicros(!showManualMicros)}>
            <ChevronDown size={11} style={{ verticalAlign: 'middle', marginRight: 4, transform: showManualMicros ? 'rotate(180deg)' : 'none' }} />
            Micros (optional)
          </button>
          {showManualMicros && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
                {MICRO_DEFS.map(d => (
                  <div key={d.key}>
                    <label style={{ fontSize: 10 }}>{d.label} ({d.unit})</label>
                    <input type="number" value={manualMicros[d.key] || ''} onChange={(e) => setManualMicros({ ...manualMicros, [d.key]: e.target.value })} placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <QtyStepper qty={qty} setQty={setQty} />
          <button className="btn" style={{ width: '100%' }} onClick={logManual}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {isToday ? 'Add to today' : `Add to ${fmtDate(target)}`}
          </button>
        </>
      )}

      {mode === 'combo' && (
        <>
          {comboScanIdx !== null ? (
            /* mini-scan flow for one ingredient */
            <>
              <div className="between" style={{ marginBottom: 10 }}>
                <span className="small" style={{ fontWeight: 600 }}>Scan label for: {parts[comboScanIdx]?.name || `Ingredient ${comboScanIdx + 1}`}</span>
                <button className="tap" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => { setComboScanIdx(null); setScanState('idle'); setReview(null); }}>Cancel</button>
              </div>
              <div className="card" style={{ padding: 14, marginBottom: 12, background: '#EEF2F8', border: '1px solid #C8D4E4', textAlign: 'center' }}>
                <Camera size={24} color="#3B5C6B" style={{ marginBottom: 8 }} />
                <p className="muted small" style={{ marginBottom: 10, lineHeight: 1.4 }}>Photo the nutrition label. Values will fill in automatically.</p>
                {scanState === 'scanning' && <p className="mono small" style={{ color: '#3B5C6B' }}>Reading…</p>}
                {scanState === 'error' && <p className="small" style={{ color: '#B8460E', marginBottom: 8 }}>{scanError}</p>}
                {scanState !== 'scanning' && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { scanImage(f).then(() => {}); } }} />
                    <button className="btn" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
                      <Camera size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Photo label
                    </button>
                  </>
                )}
              </div>
              {scanState === 'done' && review && (
                <div className="card" style={{ padding: 12, marginBottom: 12, background: '#F0F5ED', border: '1px solid #C8D9C0' }}>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{review.name}</div>
                  {review.source && <div className="muted tiny" style={{ marginBottom: 6 }}>{review.source}</div>}
                  <div className="mono tiny muted" style={{ marginBottom: 10 }}>{review.protein}p · {review.carbs}c · {review.fat}f · {review.calories}cal</div>
                  <button className="btn" style={{ width: '100%' }} onClick={() => applyComboScan(review, comboScanIdx!)}>
                    Use these values
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="muted tiny" style={{ marginBottom: 12, lineHeight: 1.4 }}>Build a meal from multiple ingredients. Enter per-serving nutrition, set how many servings you're having.</p>
              {parts.map((p: any, i: number) => {
                const n = partSum(p);
                return (
                  <div key={p.id} className="card" style={{ padding: 12, marginBottom: 10, borderLeft: `3px solid #4A6741` }}>
                    <div className="between" style={{ marginBottom: 8 }}>
                      <input type="text" value={p.name} onChange={(e) => updatePart(i, { name: e.target.value })} placeholder={`Ingredient ${i + 1}`} style={{ flex: 1, marginRight: 8, marginBottom: 0 }} />
                      <div className="row" style={{ gap: 6 }}>
                        <button className="tap" style={{ fontSize: 11, padding: '3px 8px', color: '#3B5C6B' }} onClick={() => { setComboScanIdx(i); setScanState('idle'); setReview(null); }}>
                          <Camera size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Scan
                        </button>
                        {parts.length > 1 && (
                          <button className="tap" style={{ fontSize: 11, padding: '3px 6px', color: '#B8460E' }} onClick={() => setParts((ps: any[]) => ps.filter((_: any, j: number) => j !== i))}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 70px' }}><label style={{ fontSize: 10 }}>Protein (g)</label><input type="number" value={p.protein} onChange={(e) => updatePart(i, { protein: e.target.value })} placeholder="0" /></div>
                      <div style={{ flex: '1 1 70px' }}><label style={{ fontSize: 10 }}>Carbs (g)</label><input type="number" value={p.carbs} onChange={(e) => updatePart(i, { carbs: e.target.value })} placeholder="0" /></div>
                      <div style={{ flex: '1 1 70px' }}><label style={{ fontSize: 10 }}>Fat (g)</label><input type="number" value={p.fat} onChange={(e) => updatePart(i, { fat: e.target.value })} placeholder="0" /></div>
                      <div style={{ flex: '1 1 70px' }}><label style={{ fontSize: 10 }}>Cal</label><input type="number" value={p.calories} onChange={(e) => updatePart(i, { calories: e.target.value })} placeholder="0" /></div>
                    </div>
                    <div className="between">
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <label style={{ fontSize: 10, margin: 0, whiteSpace: 'nowrap' }}>Servings</label>
                        <input type="number" value={p.servings} min="0.1" step="0.25" onChange={(e) => updatePart(i, { servings: e.target.value })} style={{ width: 60, margin: 0 }} />
                        {p.servingLabel && <span className="mono tiny muted">({p.servingLabel})</span>}
                      </div>
                      {(parseFloat(p.protein)||parseFloat(p.calories)) > 0 && (
                        <span className="mono tiny" style={{ color: '#4A6741' }}>
                          → {Math.round(n.protein)}p · {Math.round(n.carbs)}c · {Math.round(n.fat)}f · {Math.round(n.calories)}cal
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <button className="tap" style={{ width: '100%', marginBottom: 10 }} onClick={() => setParts((ps: any[]) => [...ps, { id: 'c' + Date.now(), name: '', servingLabel: '1 serving', protein: '', carbs: '', fat: '', calories: '', servings: '1' }])}>
                <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add ingredient
              </button>
              {parts.some((p: any) => parseFloat(p.calories) > 0 || parseFloat(p.protein) > 0) && (
                <div className="card" style={{ padding: 12, marginBottom: 10, background: '#F0F5ED', border: '1px solid #C8D9C0' }}>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Total</div>
                  <div className="mono small">{Math.round(comboTotal.protein)}p · {Math.round(comboTotal.carbs)}c · {Math.round(comboTotal.fat)}f · {Math.round(comboTotal.calories)} cal</div>
                </div>
              )}
              <button className="btn" style={{ width: '100%' }} onClick={logCombo} disabled={!parts.some((p: any) => parseFloat(p.calories) > 0 || parseFloat(p.protein) > 0)}>
                <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Log combo
              </button>
            </>
          )}
        </>
      )}

      {mode === 'add' && (
        <>
          <label>Meal name</label>
          <input type="text" value={newPreset.name} onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })} placeholder="e.g. Skinnytaste turkey chili" style={{ marginBottom: 10 }} />
          <label>Source (optional)</label>
          <input type="text" value={newPreset.source} onChange={(e) => setNewPreset({ ...newPreset, source: e.target.value })} placeholder="e.g. Skinnytaste Meal Prep" style={{ marginBottom: 10 }} />
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1 }}><label>Serving size</label><input type="number" inputMode="decimal" value={newPreset.servingSize} onChange={(e) => setNewPreset({ ...newPreset, servingSize: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Unit</label><select value={newPreset.servingUnit} onChange={(e) => setNewPreset({ ...newPreset, servingUnit: e.target.value })}>{FOOD_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          <p className="muted tiny" style={{ marginBottom: 10, lineHeight: 1.4 }}>Macros below are per {servingLabelOf(newPreset.servingSize, newPreset.servingUnit)}.</p>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><label>Protein</label><input type="number" value={newPreset.protein} onChange={(e) => setNewPreset({ ...newPreset, protein: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Carbs</label><input type="number" value={newPreset.carbs} onChange={(e) => setNewPreset({ ...newPreset, carbs: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1 }}><label>Fat</label><input type="number" value={newPreset.fat} onChange={(e) => setNewPreset({ ...newPreset, fat: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={newPreset.calories} onChange={(e) => setNewPreset({ ...newPreset, calories: e.target.value })} /></div>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={addPreset} disabled={!newPreset.name}>
            <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save preset
          </button>
        </>
      )}

      {dayEntries.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid #E4DCC8', paddingTop: 12 }}>
          <div className="h3" style={{ marginBottom: 8 }}>{isToday ? "Today's meals" : `Meals on ${fmtDate(target)}`}</div>
          {dayEntries.map((e: any) => (
            <div key={e.id} className="between" style={{ padding: '6px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small">{e.name}</div>
                <div className="mono tiny muted">{e.protein}p · {e.carbs}c · {e.fat}f · {e.calories}cal</div>
              </div>
              <button onClick={() => removeEntry(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E', padding: 4 }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}


export function ExerciseLogModal({ date, exercise, settings, body, onSave, onClose }: any) {
  const isToday = date === todayStr();
  const wLb = latestWeightLb(body, settings);
  const [type, setType] = useState('run');
  const [name, setName] = useState('');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState(settings?.weightUnit === 'kg' ? 'km' : 'mi');
  const [durationMin, setDurationMin] = useState('');
  const [calories, setCalories] = useState('');
  const [caloriesTouched, setCaloriesTouched] = useState(false);

  const typeLabels: Record<string, string> = { run: 'Run', walk: 'Walk', cycle: 'Cycle', cardio: 'Cardio', strength: 'Strength', other: 'Other' };
  const showDistance = type === 'run' || type === 'walk' || type === 'cycle';
  const estimate = estimateBurn({ type, durationMin: Number(durationMin) || 0 }, wLb);
  useEffect(() => { if (!caloriesTouched) setCalories(estimate ? String(estimate) : ''); }, [estimate, caloriesTouched]);

  const save = async () => {
    const entry: any = {
      id: 'ex' + Date.now() + Math.random().toString(36).slice(2, 6),
      time: nowHHMM(), type, name: name.trim() || typeLabels[type],
      durationMin: Number(durationMin) || 0, caloriesBurned: Number(calories) || 0,
    };
    if (showDistance && distance) { entry.distance = Number(distance) || 0; entry.distanceUnit = distanceUnit; }
    await onSave({ ...exercise, [date]: [...(exercise?.[date] || []), entry] });
  };

  return (
    <ModalShell title={isToday ? 'Log exercise' : `Log exercise · ${fmtShortDate(date)}`} icon={<Flame size={18} color="#B8460E" />} onClose={onClose}>
      <label>Activity</label>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.keys(typeLabels).map((t) => (
          <button key={t} className={`tap${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{typeLabels[t]}</button>
        ))}
      </div>
      <label>Name (optional)</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={typeLabels[type]} style={{ marginBottom: 12 }} />
      {showDistance && (
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 2 }}><label>Distance</label><input type="number" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="0" /></div>
          <div style={{ flex: 1 }}><label>Unit</label><select value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}><option value="mi">mi</option><option value="km">km</option></select></div>
        </div>
      )}
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}><label>Duration (min)</label><input type="number" inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><label>Calories burned</label><input type="number" inputMode="numeric" value={calories} onChange={(e) => { setCaloriesTouched(true); setCalories(e.target.value); }} placeholder="0" /></div>
      </div>
      <p className="muted tiny" style={{ marginBottom: 12, lineHeight: 1.4 }}>
        {wLb ? 'Calories are estimated from duration + your bodyweight — edit if you have a better number.' : 'Add a body weight on the Body tab for better calorie estimates.'}
      </p>
      <button className="btn" style={{ width: '100%' }} onClick={save} disabled={!(Number(durationMin) > 0 || Number(calories) > 0)}>Save</button>
    </ModalShell>
  );
}

export function FoodTab({ settings, meals, water, exercise, body, onOpenLogger, onSaveMeals, onSaveWater, onSaveExercise, onLogExercise, onCoach }: any) {
  const [selDate, setSelDate] = useState(todayStr());
  const [showMicros, setShowMicros] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const sensors = useDndSensors();
  const isToday = selDate === todayStr();
  const shiftDay = (n: number) => {
    const d = new Date(selDate + 'T00:00:00'); d.setDate(d.getDate() + n);
    const ns = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (diffDays(ns) > 0) return;
    setSelDate(ns);
  };

  const dayEntries: any[] = meals.entries?.[selDate] || [];
  const totals: any = meals.log?.[selDate] || mealTotalsFromEntries(dayEntries);
  const goal = calorieGoal(settings, body);
  const foodCals = Math.round(Number(totals.calories) || 0);
  const exDay: any[] = exercise?.[selDate] || [];
  const burn = sumBurn(exDay);
  const remaining = goal - foodCals + burn;
  const over = remaining < 0;
  const macroTargets: any = settings.macroTargets || {};

  const SECTIONS = [
    { key: 'breakfast', label: 'Breakfast', icon: Coffee },
    { key: 'lunch', label: 'Lunch', icon: Utensils },
    { key: 'dinner', label: 'Dinner', icon: Utensils },
    { key: 'snacks', label: 'Snacks', icon: Apple },
  ];
  const sectionFor = (e: any) => (['breakfast', 'lunch', 'dinner', 'snacks'].includes(e.meal) ? e.meal : 'snacks');
  const bySection: Record<string, any[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
  for (const e of dayEntries) bySection[sectionFor(e)].push(e);

  const reorderSection = (key: string, oi: number, ni: number) => {
    const slice = arrayMove(bySection[key], oi, ni);
    const merged = [
      ...(key === 'breakfast' ? slice : bySection.breakfast),
      ...(key === 'lunch' ? slice : bySection.lunch),
      ...(key === 'dinner' ? slice : bySection.dinner),
      ...(key === 'snacks' ? slice : bySection.snacks),
    ];
    onSaveMeals({ ...meals, entries: { ...(meals.entries || {}), [selDate]: merged } });
  };

  const waterOz = Number(water?.[selDate]) || 0;
  const waterGoal = Number(settings.waterGoalOz) || 64;
  const setWaterOz = (oz: number) => onSaveWater({ ...water, [selDate]: Math.max(0, Math.round(oz)) });
  const trashStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#B8460E', padding: 2, display: 'flex' };
  const editStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#3B5C6B', padding: 2, display: 'flex' };
  const startEdit = (e: any) => { setEditId(e.id); setEditVal(fmtNum(Number(e.amount ?? e.qty) || 1)); };
  // Rescale a logged entry to a new amount (in its own unit), keeping macros proportional.
  const applyEdit = (e: any) => {
    const next = parseFloat(editVal);
    const old = Number(e.amount ?? e.qty) || 1;
    if (!(next > 0) || old <= 0) { setEditId(null); return; }
    const f = next / old;
    const patch: any = { amount: next, qty: (Number(e.qty) || 1) * f };
    for (const k of ['protein', 'carbs', 'fat', 'calories']) patch[k] = Math.round((Number(e[k]) || 0) * f);
    for (const k of MICRO_KEYS) { const v = (Number(e[k]) || 0) * f; patch[k] = v < 10 ? Math.round(v * 10) / 10 : Math.round(v); }
    patch.name = entryDisplayName(e.baseName || e.name, next, e.unit || 'serving', patch.qty);
    onSaveMeals(updateMealEntry(meals, selDate, e.id, patch));
    setEditId(null);
  };
  const prevStr = (() => { const d = new Date(selDate + 'T00:00:00'); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const prevEntries: any[] = meals.entries?.[prevStr] || [];
  const copyPrevDay = () => {
    if (!prevEntries.length) return;
    const cloned = prevEntries.map((e: any, i: number) => ({ ...e, id: 'm' + Date.now() + i + Math.random().toString(36).slice(2, 5), time: nowHHMM() }));
    const dayList = [...dayEntries, ...cloned];
    onSaveMeals({ ...meals, entries: { ...(meals.entries || {}), [selDate]: dayList }, log: { ...meals.log, [selDate]: mealTotalsFromEntries(dayList) } });
  };

  const macroBar = (label: string, val: number, tgt: number, color: string) => {
    const pct = tgt > 0 ? Math.min(100, (val / tgt) * 100) : 0;
    return (
      <div style={{ flex: 1 }}>
        <div className="between" style={{ marginBottom: 4 }}><span className="tiny muted">{label}</span><span className="tiny mono">{Math.round(val)}/{tgt}g</span></div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>
      </div>
    );
  };

  return (
    <div>
      <div className="between" style={{ marginBottom: 14 }}>
        <button className="tap" onClick={() => shiftDay(-1)}><ChevronLeft size={16} /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="h2">{isToday ? 'Today' : fmtShortDate(selDate)}</div>
          {!isToday && <button style={{ background: 'none', border: 'none', color: '#B8460E', cursor: 'pointer', fontSize: 12 }} onClick={() => setSelDate(todayStr())}>Jump to today</button>}
        </div>
        <button className="tap" onClick={() => shiftDay(1)} disabled={isToday}><ChevronRight size={16} /></button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="between" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
          <div><div className="muted small">Calories remaining</div><div className="h1" style={{ color: over ? '#B8460E' : '#4A6741' }}>{remaining}</div></div>
          <div className="tiny muted" style={{ textAlign: 'right', lineHeight: 1.6 }}><div>{goal} goal</div><div>− {foodCals} food</div><div>+ {burn} exercise</div></div>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, goal > 0 ? (foodCals / goal) * 100 : 0)}%`, background: over ? '#B8460E' : '#4A6741' }} /></div>
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          {macroBar('Protein', Number(totals.protein) || 0, Number(macroTargets.protein) || 0, '#B8460E')}
          {macroBar('Carbs', Number(totals.carbs) || 0, Number(macroTargets.carbs) || 0, '#3B5C6B')}
          {macroBar('Fat', Number(totals.fat) || 0, Number(macroTargets.fat) || 0, '#C8932E')}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="tap" style={{ flex: 1 }} onClick={onCoach}><Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Coach</button>
          {settings.microsEnabled && <button className="tap" style={{ flex: 1 }} onClick={() => setShowMicros((v) => !v)}>{showMicros ? 'Hide micros' : 'Micros'}</button>}
        </div>
      </div>

      {showMicros && settings.microsEnabled && <div style={{ marginBottom: 14 }}><MicrosCard targets={settings.microTargets} totals={totals} /></div>}

      {dayEntries.length === 0 && prevEntries.length > 0 && (
        <button className="tap" style={{ width: '100%', marginBottom: 12 }} onClick={copyPrevDay}>
          <Copy size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Copy {prevEntries.length} {prevEntries.length === 1 ? 'meal' : 'meals'} from {fmtShortDate(prevStr)}
        </button>
      )}

      {SECTIONS.map((sec) => {
        const list = bySection[sec.key];
        const cals = Math.round(list.reduce((a: number, e: any) => a + (Number(e.calories) || 0), 0));
        return (
          <div className="card" key={sec.key} style={{ marginBottom: 12 }}>
            <div className="between" style={{ marginBottom: list.length ? 10 : 0 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}><sec.icon size={15} color="#8E4585" /><span className="h2">{sec.label}</span></div>
              <span className="mono tiny muted">{cals} cal</span>
            </div>
            {list.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(ev: DragEndEvent) => {
                const { active, over } = ev;
                if (!over || active.id === over.id) return;
                const oi = list.findIndex((x: any) => x.id === active.id);
                const ni = list.findIndex((x: any) => x.id === over.id);
                if (oi >= 0 && ni >= 0) reorderSection(sec.key, oi, ni);
              }}>
                <SortableContext items={list.map((x: any) => x.id)} strategy={verticalListSortingStrategy}>
                  {list.map((e: any) => (
                    <SortableRow key={e.id} id={e.id}>
                      <div className="between" style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                          {e.source && <div className="tiny muted">{e.source}</div>}
                        </div>
                        {editId === e.id ? (
                          <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                            <input type="number" inputMode="decimal" value={editVal} autoFocus onChange={(ev) => setEditVal(ev.target.value)}
                              onKeyDown={(ev) => { if (ev.key === 'Enter') applyEdit(e); if (ev.key === 'Escape') setEditId(null); }}
                              style={{ width: 56, textAlign: 'center', margin: 0, padding: '4px 6px' }} />
                            <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{e.unit && e.unit !== 'serving' ? e.unit : 'srv'}</span>
                            <button style={{ ...editStyle, color: '#4A6741' }} onClick={() => applyEdit(e)}><Check size={15} /></button>
                            <button style={trashStyle} onClick={() => setEditId(null)}><X size={15} /></button>
                          </div>
                        ) : (
                          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                            <span className="mono tiny">{Math.round(Number(e.calories) || 0)}</span>
                            <button style={editStyle} onClick={() => startEdit(e)}><Pencil size={13} /></button>
                            <button style={trashStyle} onClick={() => onSaveMeals(removeMealEntry(meals, selDate, e.id))}><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            )}
            <button className="tap" style={{ width: '100%', marginTop: 10 }} onClick={() => onOpenLogger(selDate, sec.key)}><Plus size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add food</button>
          </div>
        );
      })}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}><Droplets size={15} color="#3B5C6B" /><span className="h2">Water</span></div>
          <span className="mono tiny muted">{waterOz} / {waterGoal} oz</span>
        </div>
        <div className="progress-bar" style={{ marginBottom: 10 }}><div className="progress-fill" style={{ width: `${Math.min(100, waterGoal > 0 ? (waterOz / waterGoal) * 100 : 0)}%`, background: '#3B5C6B' }} /></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="tap" style={{ flex: 1 }} onClick={() => setWaterOz(waterOz - 8)}>−8 oz</button>
          <button className="tap" style={{ flex: 1 }} onClick={() => setWaterOz(waterOz + 8)}>+8 oz</button>
          <button className="tap" style={{ flex: 1 }} onClick={() => setWaterOz(waterOz + 16)}>+16 oz</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="between" style={{ marginBottom: exDay.length ? 10 : 0 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}><Flame size={15} color="#B8460E" /><span className="h2">Exercise</span></div>
          <span className="mono tiny muted">{burn} cal</span>
        </div>
        {exDay.map((ex: any) => (
          <div key={ex.id} className="between" style={{ padding: '6px 0', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div className="small">{ex.name}</div>
              <div className="tiny muted">{[ex.distance ? `${ex.distance} ${ex.distanceUnit || ''}`.trim() : '', ex.durationMin ? `${ex.durationMin} min` : ''].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span className="mono tiny" style={{ color: '#B8460E' }}>{Math.round(Number(ex.caloriesBurned) || 0)}</span>
              <button style={trashStyle} onClick={() => onSaveExercise({ ...exercise, [selDate]: exDay.filter((x: any) => x.id !== ex.id) })}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button className="tap" style={{ width: '100%', marginTop: 10 }} onClick={() => onLogExercise(selDate)}><Plus size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add exercise</button>
      </div>
    </div>
  );
}

