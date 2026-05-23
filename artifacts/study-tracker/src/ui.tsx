import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  GripVertical, Settings as SettingsIcon, X, Mic, Check,
  Sun, Apple, Activity, Dumbbell, Wallet, BookMarked, Calendar as CalIcon, History,
} from 'lucide-react';
import { KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { nowHHMM, fmtDate } from './lib/date';

export function useCurrentTime() {
  const [now, setNow] = useState(nowHHMM());
  useEffect(() => {
    const id = setInterval(() => setNow(nowHHMM()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, position: 'relative', zIndex: isDragging ? 20 : undefined }}>
      <span {...attributes} {...listeners} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', cursor: 'grab', color: '#C0B8A8', padding: '4px 2px', touchAction: 'none', display: 'flex', alignItems: 'center' }}>
        <GripVertical size={15} />
      </span>
      {children}
    </div>
  );
}

export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { margin: 0; background: #F5F0E6; }
      .app {
        min-height: 100vh; background: #F5F0E6; color: #1A1A2E;
        font-family: 'Fraunces', serif; font-feature-settings: 'ss01' on;
        max-width: 480px; margin: 0 auto; position: relative; padding-bottom: 88px;
      }
      .content { padding: 20px 18px 40px; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      .h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.05; }
      .h2 { font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6B6457; }
      .h3 { font-size: 16px; font-weight: 600; }
      .muted { color: #6B6457; }
      .small { font-size: 12px; }
      .tiny { font-size: 11px; }
      .card { background: #FBF7EE; border: 1px solid #E4DCC8; border-radius: 14px; padding: 18px; margin-bottom: 14px; }
      .card-tight { padding: 14px; }
      .btn { background: #1A1A2E; color: #F5F0E6; border: none; padding: 12px 18px; border-radius: 10px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; }
      .btn:active { opacity: 0.8; }
      .btn-ghost { background: transparent; color: #1A1A2E; border: 1px solid #D4CCB8; }
      .btn-accent { background: #B8460E; }
      .row { display: flex; gap: 10px; align-items: center; }
      .between { display: flex; justify-content: space-between; align-items: center; }
      .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; letter-spacing: 0.05em; font-family: 'JetBrains Mono', monospace; font-weight: 500; }
      .progress-bar { height: 6px; background: #E4DCC8; border-radius: 3px; overflow: hidden; position: relative; }
      .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
      .progress-marker { position: absolute; top: -3px; width: 2px; height: 12px; background: #1A1A2E; }
      input[type="time"], input[type="date"], input[type="number"], input[type="text"], select, textarea {
        font-family: 'JetBrains Mono', monospace; font-size: 14px; padding: 10px; border: 1px solid #D4CCB8; background: #FBF7EE; border-radius: 8px; color: #1A1A2E; width: 100%;
      }
      input[type="text"] { font-family: 'Fraunces', serif; }
      label { font-size: 12px; color: #6B6457; display: block; margin-bottom: 4px; letter-spacing: 0.05em; }
      .modal-bg { position: fixed; inset: 0; background: rgba(26,26,46,0.55); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
      .modal { background: #F5F0E6; border-radius: 18px; padding: 22px; max-width: 440px; width: 100%; max-height: 92vh; overflow-y: auto; }
      .tap { padding: 9px 14px; border: 1px solid #D4CCB8; border-radius: 8px; background: transparent; font-family: inherit; font-size: 13px; cursor: pointer; color: #1A1A2E; }
      .tap.active { background: #1A1A2E; color: #F5F0E6; border-color: #1A1A2E; }
      .block { padding: 14px 16px; border-radius: 10px; background: #FBF7EE; border: 1px solid #E4DCC8; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
      .block.done { opacity: 0.55; }
      .icon-wrap { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #F5F0E6; flex-shrink: 0; }
      .bottom-nav {
        position: fixed; bottom: 0; left: 0; right: 0; background: #FBF7EE;
        border-top: 1px solid #E4DCC8; padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
        display: flex; justify-content: space-around; max-width: 480px; margin: 0 auto; z-index: 30;
      }
      .nav-btn {
        background: none; border: none; padding: 6px 8px; cursor: pointer; display: flex;
        flex-direction: column; align-items: center; gap: 3px; color: #6B6457; font-family: inherit; font-size: 9.5px;
        border-radius: 8px; transition: all 0.15s; flex: 1;
      }
      .nav-btn.active { color: #1A1A2E; background: #F5F0E6; }
      .sparkline { display: flex; align-items: flex-end; gap: 2px; height: 24px; }
      .sparkline-bar { width: 4px; background: #B8460E; border-radius: 1px; }
      .divider { height: 1px; background: #E4DCC8; margin: 12px 0; border: none; }
      .swatch { width: 8px; height: 8px; border-radius: 2px; display: inline-block; margin-right: 6px; vertical-align: middle; }
      .streak-flame { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #C8932E; }

      /* ── DARK THEME ─────────────────────────────────────────────── */
      .dark, .dark body { background: #14141C !important; color: #E8E4DC !important; }
      .dark .app { background: #14141C; color: #E8E4DC; }
      .dark .card { background: #1C1C28; border-color: #2C2C3E; }
      .dark .block { background: #1C1C28; border-color: #2C2C3E; }
      .dark .modal { background: #1C1C28; }
      .dark .modal-bg { background: rgba(0,0,0,0.72); }
      .dark .btn { background: #E8E4DC; color: #14141C; }
      .dark .btn-ghost { background: transparent; color: #E8E4DC; border-color: #3A3A50; }
      .dark .tap { border-color: #3A3A50; color: #E8E4DC; background: transparent; }
      .dark .tap.active { background: #E8E4DC; color: #14141C; border-color: #E8E4DC; }
      .dark .bottom-nav { background: #1C1C28; border-color: #2C2C3E; }
      .dark .nav-btn { color: #7A7570; }
      .dark .nav-btn.active { color: #E8E4DC; background: #2C2C3E; }
      .dark .muted, .dark .h2 { color: #7A7570 !important; }
      .dark label { color: #7A7570; }
      .dark .divider { background: #2C2C3E; }
      .dark .progress-bar { background: #2C2C3E; }
      .dark input[type="time"], .dark input[type="date"], .dark input[type="number"],
      .dark input[type="text"], .dark select, .dark textarea {
        background: #1A1A26; border-color: #3A3A50; color: #E8E4DC;
      }
      .dark .swatch { opacity: 0.9; }
      /* CSS custom properties for dark-mode-aware inline styles */
      :root {
        --text: #1A1A2E; --text-muted: #6B6457; --text-sub: #3B3B55;
        --bg: #F5F0E6; --bg-card: #FBF7EE; --bg-inset: #F0EAD8;
        --bg-inset2: #F9F5EC; --border: #E4DCC8; --border-muted: #D4CCB8;
      }
      .dark {
        --text: #E8E4DC; --text-muted: #9A9590; --text-sub: #C0BAB0;
        --bg: #14141C; --bg-card: #1C1C28; --bg-inset: #20202E;
        --bg-inset2: #252535; --border: #2C2C3E; --border-muted: #3A3A50;
      }
      .dark .h1, .dark .h3 { color: #E8E4DC !important; }
      .dark .small { color: #D8D4CC; }
      .dark .tiny { color: #B0A9A0; }
      .dark .mono { color: #E8E4DC; }
      .dark .streak-flame { color: #E8A838; }
      .dark .progress-marker { background: #E8E4DC; }
      .dark .sparkline-bar { background: #C8603E; }
      .dark .pill { border-color: #3A3A50; }
    `}</style>
  );
}

export function Header({ date, onSettings }: { date: string; onSettings: () => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <div className="mono tiny" style={{ letterSpacing: '0.15em', color: '#6B6457', textTransform: 'uppercase' }}>
          {fmtDate(date)}
        </div>
        <button onClick={onSettings} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#6B6457' }}>
          <SettingsIcon size={18} />
        </button>
      </div>
    </div>
  );
}

export function BottomNav({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const items = [
    { key: 'today', label: 'Today', icon: Sun },
    { key: 'food', label: 'Food', icon: Apple },
    { key: 'body', label: 'Body', icon: Activity },
    { key: 'workout', label: 'Lift', icon: Dumbbell },
    { key: 'money', label: 'Money', icon: Wallet },
    { key: 'journal', label: 'Journal', icon: BookMarked },
    { key: 'plan', label: 'Plan', icon: CalIcon },
    { key: 'history', label: 'History', icon: History },
  ];
  return (
    <div className="bottom-nav">
      {items.map(it => (
        <button key={it.key} className={`nav-btn ${tab === it.key ? 'active' : ''}`} onClick={() => setTab(it.key)}>
          <it.icon size={18} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ModalShell({ title, onClose, children, icon = null, color = '#1A1A2E' }: any) {
  return (
    <motion.div className="modal-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      <motion.div className="modal" onClick={(e: any) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
        <div className="between" style={{ marginBottom: 18 }}>
          <div className="row" style={{ gap: 10 }}>
            {icon}
            <div style={{ fontSize: 19, fontWeight: 600, color }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6457' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function VoiceButton({ onResult, style }: any) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  if (!SR) return null;
  const toggle = () => {
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { onResult(e.results[0][0].transcript); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };
  return (
    <button className={`tap ${listening ? 'active' : ''}`} onClick={toggle} title="Voice input" style={{ padding: '6px 10px', ...style }}>
      <Mic size={14} style={{ verticalAlign: 'middle' }} />{listening ? ' …' : ''}
    </button>
  );
}

export function QtyStepper({ qty, setQty }: any) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
      <span className="small" style={{ fontWeight: 600 }}>Servings</span>
      <button className="tap" style={{ padding: '4px 12px' }} onClick={() => setQty(Math.max(0.25, Math.round((qty - 0.5) * 4) / 4))}>−</button>
      <input type="number" step="0.25" min="0.25" value={qty} onChange={(e) => setQty(Math.max(0.25, parseFloat(e.target.value) || 0.25))} style={{ width: 70, textAlign: 'center' }} />
      <button className="tap" style={{ padding: '4px 12px' }} onClick={() => setQty(Math.round((qty + 0.5) * 4) / 4)}>+</button>
    </div>
  );
}

export function Checkbox({ checked, onChange, accent = '#B8460E' }: { checked: boolean; onChange: () => void; accent?: string }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked ? accent : '#D4CCB8'}`,
        background: checked ? accent : 'transparent', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {checked && <Check size={13} color="#F5F0E6" />}
    </div>
  );
}
