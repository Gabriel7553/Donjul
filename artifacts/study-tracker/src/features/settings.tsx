import { useState, useEffect } from 'react';
import {
  Sun, Home, Footprints, Check, Plus, Settings as SettingsIcon, X, Music, Languages, Shield,
  Award, Save, Calendar as CalIcon, Activity, Dumbbell, Apple, ListChecks, ChevronRight, ChevronDown, ChevronLeft,
  TrendingUp, TrendingDown, Edit3, Trash2, Flame, ArrowUp, ArrowDown, Minus, Target, BookOpen, Clock, Moon, Coffee,
  Download, Upload, History, Repeat, Zap, Play, AlertTriangle, RotateCcw, MapPin, Building2, TreePine,
  Camera, BookMarked, TrendingUp as Journal, DollarSign, ShoppingCart, Briefcase, Car, ChevronUp, Trophy, Archive, Infinity, Mic,
  Wallet, PiggyBank, CreditCard, PieChart, Receipt, Pencil, ArrowUpRight, ArrowDownRight, Sparkles,
  ArrowRightLeft, Users, Banknote, BadgeAlert, CircleDollarSign, HandCoins, GripVertical,
  Droplets, Utensils, Bike, Copy, Eye, EyeOff, Bell,
} from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { pad, todayStr, diffDays, addMonth, fmtShortDate } from '../lib/date';
import { normalizeSubject, subjectGoalKind, expectedTotal, CATCHUP_SPREAD_OPTIONS } from '../lib/study';
import { suggestMacros, suggestMicros, computeTDEE, calorieGoal } from '../lib/body';
import { MICRO_DEFS, DEFAULT_MICRO_TARGETS } from '../lib/nutrition';
import { DEFAULT_SETTINGS, ICON_MAP } from '../lib/defaults';
import { requestNotifyPermission, notificationsSupported } from '../lib/reminders';
import { K, safeGet } from '../lib/storage';
import { Checkbox, GlobalStyles, ModalShell, SortableRow, useDndSensors, NAV_TABS } from '../ui';
import { getSyncId, setSyncId, getStoredUsername, setStoredUsername, clearStoredUsername, clearLocalSyncData, pushAllLocalData, hydrate } from '../sync';

const AUTH_API = (() => {
  const base = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.BASE_URL : '/') || '/';
  return base.replace(/\/$/, '') + '/api';
})();

export function AccountModal({ onClose }: { onClose: () => void }) {
  const [loggedInAs] = useState(() => getStoredUsername());
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => { setUsername(''); setEmail(''); setPassword(''); setConfirmPw(''); setErr(''); };

  const handleSignIn = async () => {
    setErr('');
    if (!username.trim() || !password) { setErr('Enter your username and password.'); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${AUTH_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await resp.json();
      if (!resp.ok) { setErr(data.error || 'Sign-in failed.'); setLoading(false); return; }
      clearLocalSyncData();
      setSyncId(data.userId);
      setStoredUsername(data.username);
      toast.success(`Signed in as ${data.username} — syncing…`);
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setErr('Network error — check your connection.');
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setErr('');
    if (!username.trim()) { setErr('Choose a username.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (password !== confirmPw) { setErr('Passwords don\'t match.'); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${AUTH_API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, email: email.trim() || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) { setErr(data.error || 'Registration failed.'); setLoading(false); return; }
      setSyncId(data.userId);
      setStoredUsername(data.username);
      toast.success(`Account created! Uploading your data…`);
      await pushAllLocalData();
      window.location.reload();
    } catch {
      setErr('Network error — check your connection.');
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    if (!window.confirm(`Sign out of "${loggedInAs}"? This device will become anonymous — your local data stays but won't sync to your account.`)) return;
    clearLocalSyncData();
    clearStoredUsername();
    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setSyncId(newId);
    toast('Signed out.');
    setTimeout(() => window.location.reload(), 600);
  };

  if (loggedInAs) {
    return (
      <ModalShell title="Account" onClose={onClose} icon={<Users size={18} color="#8E4585" />}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '6px 0 18px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#8E4585', color: '#F5F0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 600, marginBottom: 12 }}>
            {(loggedInAs[0] || '?').toUpperCase()}
          </div>
          <div className="small muted" style={{ marginBottom: 2 }}>Signed in as</div>
          <div className="h2" style={{ color: '#8E4585' }}>{loggedInAs}</div>
          <div className="row" style={{ gap: 5, alignItems: 'center', marginTop: 8, color: '#4A6741' }}>
            <Check size={13} /><span className="tiny">Syncing across your devices</span>
          </div>
        </div>
        <p className="small muted" style={{ marginBottom: 18, lineHeight: 1.5, textAlign: 'center' }}>
          Your data syncs automatically. Sign in with the same username and password on any device.
        </p>
        <button
          className="tap"
          style={{ width: '100%', color: '#B8460E', borderColor: '#B8460E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={handleSignOut}
        >
          <X size={14} /> Sign out of this device
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Account & sync" onClose={onClose} icon={<Users size={18} color="#8E4585" />}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(142,69,133,0.12)', color: '#8E4585', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Users size={24} />
        </div>
        <div className="h2" style={{ marginBottom: 4 }}>{tab === 'signin' ? 'Welcome back' : 'Create your account'}</div>
        <p className="small muted" style={{ lineHeight: 1.5, margin: '0 auto', maxWidth: 320 }}>
          {tab === 'signin' ? 'Sign in to sync your data to this device.' : 'Sync your data across every device you use.'}
        </p>
      </div>

      <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 10, padding: 3, marginBottom: 18 }}>
        {(['signin', 'signup'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); reset(); }}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              background: tab === t ? '#F5F0E6' : 'transparent',
              color: tab === t ? '#1A1A2E' : 'rgba(26,26,46,0.55)',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            {t === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <label>Username</label>
      <input
        type="text"
        value={username}
        onChange={(e) => { setUsername(e.target.value); setErr(''); }}
        placeholder="e.g. donjul"
        autoCapitalize="none"
        autoCorrect="off"
        style={{ marginBottom: 12 }}
        onKeyDown={(e) => { if (e.key === 'Enter' && tab === 'signin') handleSignIn(); }}
      />
      {tab === 'signup' && (
        <>
          <label>Email <span className="muted tiny">(optional)</span></label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(''); }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ marginBottom: 12 }}
          />
        </>
      )}
      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setErr(''); }}
        placeholder={tab === 'signup' ? 'At least 6 characters' : ''}
        style={{ marginBottom: tab === 'signup' ? 12 : 14 }}
        onKeyDown={(e) => { if (e.key === 'Enter' && tab === 'signin') handleSignIn(); }}
      />
      {tab === 'signup' && (
        <>
          <label>Confirm password</label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setErr(''); }}
            placeholder="Repeat password"
            style={{ marginBottom: 14 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSignUp(); }}
          />
        </>
      )}

      {err && <p className="tiny" style={{ color: '#B8460E', marginBottom: 10, lineHeight: 1.4 }}>{err}</p>}

      <button className="btn" style={{ width: '100%' }} onClick={tab === 'signin' ? handleSignIn : handleSignUp} disabled={loading}>
        {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in' : 'Create account'}
      </button>

      <p className="muted tiny" style={{ marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
        {tab === 'signup'
          ? 'Your current data links to the new account and syncs going forward.'
          : "Signing in pulls your account's data to this device, replacing local data."}
      </p>
    </ModalShell>
  );
}

export function SettingsModal({ settings, body, onSave, onClose, onEditSubject, onAddSubject, onChallenge, onCustomChallenges, onExportImport, onResetDay, onSyncTransfer, onDiagnostics }: any) {
  const [draft, setDraft] = useState(settings);
  const [subTab, setSubTab] = useState<'active' | 'archived' | 'deleted'>('active');
  const latestBody = body?.entries?.[body.entries.length - 1];
  const suggested = suggestMacros(latestBody, draft.bodyGoals);
  const suggestedMicros = suggestMicros(latestBody, draft.bodyGoals);
  const update = (patch: any) => setDraft({ ...draft, ...patch });

  // Subject actions persist immediately (and preserve any in-progress schedule/macro edits).
  const applySubjectChange = (key: string, patch: any) => {
    const nd = { ...draft, subjects: { ...draft.subjects, [key]: { ...draft.subjects[key], ...patch } } };
    setDraft(nd); onSave(nd);
  };
  const fullDelete = (key: string) => {
    if (!confirm('Permanently delete this subject? This cannot be undone.')) return;
    const subjects = { ...draft.subjects }; delete subjects[key];
    const nd = { ...draft, subjects, subjectOrder: draft.subjectOrder.filter((x: string) => x !== key) };
    setDraft(nd); onSave(nd);
  };

  const subjectSensors = useDndSensors();
  const allKeys: string[] = draft.subjectOrder.filter((k: string) => draft.subjects[k]);
  const activeKeys = allKeys.filter((k) => !draft.subjects[k].archived && !draft.subjects[k].deletedAt);
  const archivedKeys = allKeys.filter((k) => draft.subjects[k].archived && !draft.subjects[k].deletedAt);
  const deletedKeys = allKeys.filter((k) => draft.subjects[k].deletedAt);
  const shownKeys = subTab === 'active' ? activeKeys : subTab === 'archived' ? archivedKeys : deletedKeys;
  const handleSubjectDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIdx = activeKeys.indexOf(String(active.id));
    const newIdx = activeKeys.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(activeKeys, oldIdx, newIdx);
    const fullOrder = [...reordered, ...draft.subjectOrder.filter((x: string) => !activeKeys.includes(x))];
    const nd = { ...draft, subjectOrder: fullOrder };
    setDraft(nd); onSave(nd);
  };

  const navSensors = useDndSensors();
  const navHidden: string[] = draft.navHidden || [];
  const navOrder: string[] = (() => {
    const saved = Array.isArray(draft.navOrder) ? draft.navOrder.filter((k: string) => NAV_TABS.some((t) => t.key === k)) : [];
    return [...saved, ...NAV_TABS.filter((t) => !saved.includes(t.key)).map((t) => t.key)];
  })();
  const handleNavDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIdx = navOrder.indexOf(String(active.id));
    const newIdx = navOrder.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const nd2 = { ...draft, navOrder: arrayMove(navOrder, oldIdx, newIdx) };
    setDraft(nd2); onSave(nd2);
  };
  const toggleNavHidden = (key: string) => {
    if (key === 'today') return;
    const next = navHidden.includes(key) ? navHidden.filter((k) => k !== key) : [...navHidden, key];
    const nd2 = { ...draft, navHidden: next };
    setDraft(nd2); onSave(nd2);
  };

  const [reminderErr, setReminderErr] = useState('');
  const updateReminder = (id: string, patch: any) => {
    const list = (draft.reminderList || []).map((r: any) => (r.id === id ? { ...r, ...patch } : r));
    const nd2 = { ...draft, reminderList: list };
    setDraft(nd2); onSave(nd2);
  };
  const toggleReminders = async () => {
    if (!draft.reminders) {
      const ok = await requestNotifyPermission();
      if (!ok) { setReminderErr(notificationsSupported() ? 'Allow notifications in your browser settings to enable reminders.' : 'This device does not support notifications.'); return; }
      setReminderErr('');
    }
    update({ reminders: !draft.reminders });
  };

  const todaySensors = useDndSensors();
  const TODAY_CARDS = [
    { key: 'schedule', label: 'Schedule', icon: CalIcon },
    { key: 'progress', label: 'Progress', icon: Target },
    { key: 'challenges', label: 'Challenges', icon: Trophy },
    { key: 'nutrition', label: 'Nutrition', icon: Apple },
    { key: 'weekly', label: 'Weekly summary', icon: TrendingUp },
  ];
  const todayHidden: string[] = draft.todayHidden || [];
  const todayOrder: string[] = (() => {
    const saved = Array.isArray(draft.todayLayout) ? draft.todayLayout.filter((k: string) => TODAY_CARDS.some((t) => t.key === k)) : [];
    return [...saved, ...TODAY_CARDS.filter((t) => !saved.includes(t.key)).map((t) => t.key)];
  })();
  const handleTodayDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIdx = todayOrder.indexOf(String(active.id));
    const newIdx = todayOrder.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const nd2 = { ...draft, todayLayout: arrayMove(todayOrder, oldIdx, newIdx) };
    setDraft(nd2); onSave(nd2);
  };
  const toggleTodayHidden = (key: string) => {
    const next = todayHidden.includes(key) ? todayHidden.filter((k) => k !== key) : [...todayHidden, key];
    const nd2 = { ...draft, todayHidden: next };
    setDraft(nd2); onSave(nd2);
  };

  return (
    <ModalShell title="Settings" onClose={onClose}>
      {!getStoredUsername() ? (
        <button
          onClick={onSyncTransfer}
          style={{
            width: '100%',
            marginBottom: 18,
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #8E4585, #B8460E)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 2px 8px rgba(142,69,133,0.15)',
          }}
        >
          <Users size={22} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Sign in to sync</div>
            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
              Create an account or sign in to back up and sync your data across devices.
            </div>
          </div>
          <ChevronRight size={18} />
        </button>
      ) : (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 14px',
            background: 'var(--tint-purple)',
            border: '1px solid #D4B5CB',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Users size={16} color="#8E4585" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 600, color: '#8E4585' }}>Signed in as {getStoredUsername()}</div>
            <div className="muted tiny">Data syncs across devices.</div>
          </div>
          <button className="tap" style={{ fontSize: 11, padding: '4px 10px' }} onClick={onSyncTransfer}>Manage</button>
        </div>
      )}
      <div className="h2" style={{ marginBottom: 8 }}>Schedule</div>
      <div style={{ marginBottom: 12 }}>
        <label>Default wake</label>
        <input type="time" value={draft.wakeTime} onChange={(e) => update({ wakeTime: e.target.value })} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Default sleep</label>
        <input type="time" value={draft.sleepTime} onChange={(e) => update({ sleepTime: e.target.value })} />
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label>Start offset (min after wake)</label>
          <input type="number" value={draft.scheduleStartOffsetMin ?? 30} onChange={(e) => update({ scheduleStartOffsetMin: parseInt(e.target.value) || 30 })} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Break between blocks (min)</label>
          <input type="number" value={draft.blockBreakMin ?? 15} onChange={(e) => update({ blockBreakMin: parseInt(e.target.value) || 15 })} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>Catch-up spread</label>
        <p className="muted tiny" style={{ marginBottom: 8, lineHeight: 1.4 }}>When you fall behind on a deadline subject, how quickly should missed time be distributed into upcoming daily targets?</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {CATCHUP_SPREAD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`tap ${(draft.catchupSpread ?? 'deadline') === opt.value ? 'active' : ''}`}
              style={{ padding: '6px 4px', fontSize: 11, flexDirection: 'column', gap: 2, height: 'auto', lineHeight: 1.3 }}
              onClick={() => update({ catchupSpread: opt.value })}
              title={opt.desc}
            >
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
              <span className="muted" style={{ fontSize: 9, display: 'block' }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="h2" style={{ marginBottom: 8, marginTop: 16 }}>Subjects</div>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <button className={`tap ${subTab === 'active' ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setSubTab('active')}>Active ({activeKeys.length})</button>
        <button className={`tap ${subTab === 'archived' ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setSubTab('archived')}>Archived ({archivedKeys.length})</button>
        <button className={`tap ${subTab === 'deleted' ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setSubTab('deleted')}>Deleted ({deletedKeys.length})</button>
      </div>
      {shownKeys.length === 0 && <p className="muted small" style={{ padding: '8px 0' }}>{subTab === 'active' ? 'No active subjects.' : subTab === 'archived' ? 'Nothing archived.' : 'Nothing deleted.'}</p>}
      {subTab === 'active' ? (
        <DndContext sensors={subjectSensors} collisionDetection={closestCenter} onDragEnd={handleSubjectDragEnd}>
          <SortableContext items={activeKeys} strategy={verticalListSortingStrategy}>
            {activeKeys.map((k: string) => {
              const s = draft.subjects[k];
              const Icon = ICON_MAP[s.icon] || Languages;
              const kind = subjectGoalKind(s);
              const meta = s.trackingMode === 'checkoff' ? `Check-off · ${s.weeklyDays}x/wk` : `${s.target}min/day · ${s.weeklyDays}x/wk`;
              return (
                <SortableRow key={k} id={k}>
                  <div className="between" style={{ padding: '10px 0', paddingLeft: 22, borderBottom: '1px solid var(--border)' }}>
                    <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                      <div className="icon-wrap" style={{ background: s.accent, width: 28, height: 28 }}><Icon size={14} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="small" style={{ fontWeight: 600 }}>{s.name}</div>
                        <div className="mono tiny muted">{meta}{kind === 'deadline' ? ` · ${fmtShortDate(s.deadline)}` : kind === 'count' ? ` · ${s.countTotal} sessions` : ''}</div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <button onClick={() => onEditSubject(k)} className="tap" style={{ padding: '4px 8px' }} title="Edit" aria-label="Edit"><Edit3 size={13} /></button>
                      <button onClick={() => applySubjectChange(k, { archived: true })} className="tap" style={{ padding: '4px 8px' }} title="Archive" aria-label="Archive"><Archive size={13} /></button>
                    </div>
                  </div>
                </SortableRow>
              );
            })}
          </SortableContext>
        </DndContext>
      ) : shownKeys.map((k: string) => {
        const s = draft.subjects[k];
        const Icon = ICON_MAP[s.icon] || Languages;
        const kind = subjectGoalKind(s);
        const meta = s.trackingMode === 'checkoff' ? `Check-off · ${s.weeklyDays}x/wk` : `${s.target}min/day · ${s.weeklyDays}x/wk`;
        const daysLeft = s.deletedAt ? Math.max(0, 15 - diffDays(todayStr(), s.deletedAt)) : 0;
        return (
          <div key={k} className="between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>
              <div className="icon-wrap" style={{ background: s.accent, width: 28, height: 28 }}><Icon size={14} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600, opacity: 0.6 }}>{s.name}</div>
                <div className="mono tiny muted">{meta}{kind === 'deadline' ? ` · ${fmtShortDate(s.deadline)}` : kind === 'count' ? ` · ${s.countTotal} sessions` : ''}{s.deletedAt ? ` · deletes in ${daysLeft}d` : ''}</div>
              </div>
            </div>
            <div className="row" style={{ gap: 4 }}>
              {subTab === 'archived' && (
                <>
                  <button onClick={() => applySubjectChange(k, { archived: false })} className="tap" style={{ padding: '4px 10px', fontSize: 11 }}>Unarchive</button>
                  <button onClick={() => applySubjectChange(k, { deletedAt: todayStr() })} className="tap" style={{ padding: '4px 8px', color: '#B8460E' }} title="Delete" aria-label="Delete"><Trash2 size={13} /></button>
                </>
              )}
              {subTab === 'deleted' && (
                <>
                  <button onClick={() => applySubjectChange(k, { deletedAt: null })} className="tap" style={{ padding: '4px 10px', fontSize: 11 }}>Restore</button>
                  <button onClick={() => fullDelete(k)} className="tap" style={{ padding: '4px 8px', color: '#B8460E' }} title="Delete now" aria-label="Delete"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {subTab === 'deleted' && deletedKeys.length > 0 && <p className="muted tiny" style={{ marginTop: 8, lineHeight: 1.5 }}>Deleted subjects auto-remove after 15 days. "Delete now" removes permanently.</p>}
      <button className="tap" onClick={onAddSubject} style={{ width: '100%', marginTop: 10, marginBottom: 16 }}>
        <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add subject
      </button>

      <div className="h2" style={{ marginBottom: 8, marginTop: 16 }}>Tabs &amp; navigation</div>
      <p className="muted tiny" style={{ marginBottom: 8, lineHeight: 1.5 }}>Drag to reorder. Tap the eye to show or hide a tab in the bottom bar. Today always stays.</p>
      <DndContext sensors={navSensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd}>
        <SortableContext items={navOrder} strategy={verticalListSortingStrategy}>
          {navOrder.map((key: string) => {
            const t = NAV_TABS.find((x) => x.key === key)!;
            const Icon = t.icon;
            const hidden = key !== 'today' && navHidden.includes(key);
            return (
              <SortableRow key={key} id={key}>
                <div className="between" style={{ padding: '10px 0', paddingLeft: 22, borderBottom: '1px solid var(--border)', opacity: hidden ? 0.5 : 1 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon size={16} />
                    <span className="small" style={{ fontWeight: 600 }}>{t.label}</span>
                  </div>
                  <button className="tap" style={{ padding: '4px 8px' }} onClick={() => toggleNavHidden(key)} disabled={key === 'today'} title={key === 'today' ? 'Always shown' : hidden ? 'Show' : 'Hide'}>
                    {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </SortableRow>
            );
          })}
        </SortableContext>
      </DndContext>

      <div className="h2" style={{ marginBottom: 8, marginTop: 16 }}>Today screen</div>
      <p className="muted tiny" style={{ marginBottom: 8, lineHeight: 1.5 }}>Drag to reorder the cards on your Today screen. Tap the eye to hide one.</p>
      <DndContext sensors={todaySensors} collisionDetection={closestCenter} onDragEnd={handleTodayDragEnd}>
        <SortableContext items={todayOrder} strategy={verticalListSortingStrategy}>
          {todayOrder.map((key: string) => {
            const t = TODAY_CARDS.find((x) => x.key === key)!;
            const Icon = t.icon;
            const hidden = todayHidden.includes(key);
            return (
              <SortableRow key={key} id={key}>
                <div className="between" style={{ padding: '10px 0', paddingLeft: 22, borderBottom: '1px solid var(--border)', opacity: hidden ? 0.5 : 1 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon size={16} />
                    <span className="small" style={{ fontWeight: 600 }}>{t.label}</span>
                  </div>
                  <button className="tap" style={{ padding: '4px 8px' }} onClick={() => toggleTodayHidden(key)} title={hidden ? 'Show' : 'Hide'}>
                    {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </SortableRow>
            );
          })}
        </SortableContext>
      </DndContext>

      <div className="h2" style={{ marginBottom: 8, marginTop: 8 }}>Macros</div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={draft.macroTargets.protein} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, protein: parseInt(e.target.value) || 0 } })} /></div>
        <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={draft.macroTargets.calories} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, calories: parseInt(e.target.value) || 0 } })} /></div>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={draft.macroTargets.carbs} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, carbs: parseInt(e.target.value) || 0 } })} /></div>
        <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={draft.macroTargets.fat} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, fat: parseInt(e.target.value) || 0 } })} /></div>
      </div>
      {suggested ? (
        <button
          className="tap"
          style={{ width: '100%', marginBottom: 16, fontSize: 12, color: '#8E4585', borderColor: '#8E4585' }}
          onClick={() => update({ macroTargets: suggested, ...(suggestedMicros ? { microTargets: suggestedMicros } : {}) })}
        >
          <Zap size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Auto from body + goal — sets macros &amp; micros ({suggested.protein}p · {suggested.carbs}c · {suggested.fat}f · {suggested.calories}cal)
        </button>
      ) : (
        <p className="muted tiny" style={{ marginBottom: 16, lineHeight: 1.4 }}>Add a body weight entry to auto-calculate macro + micro targets from your goal.</p>
      )}

      <div className="h2" style={{ marginBottom: 8, marginTop: 8 }}>Calories &amp; water</div>
      <label>Calorie goal</label>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <button className={`tap${(draft.calorieGoalMode || 'manual') === 'manual' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => update({ calorieGoalMode: 'manual' })}>Manual</button>
        <button className={`tap${draft.calorieGoalMode === 'tdee' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => update({ calorieGoalMode: 'tdee' })}>Auto (TDEE)</button>
      </div>
      {draft.calorieGoalMode === 'tdee' && (() => {
        const fp = draft.fitnessProfile || {};
        const tdee = computeTDEE(draft, body);
        const setFp = (patch: any) => update({ fitnessProfile: { ...fp, ...patch } });
        return (
          <div style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><label>Height (in)</label><input type="number" inputMode="decimal" value={fp.heightIn ?? ''} onChange={(e) => setFp({ heightIn: e.target.value === '' ? null : parseFloat(e.target.value) })} /></div>
              <div style={{ flex: 1 }}><label>Age</label><input type="number" inputMode="numeric" value={fp.age ?? ''} onChange={(e) => setFp({ age: e.target.value === '' ? null : parseInt(e.target.value) })} /></div>
            </div>
            <label>Sex (for metabolic estimate)</label>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              <button className={`tap${fp.sex === 'male' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => setFp({ sex: 'male' })}>Male</button>
              <button className={`tap${fp.sex === 'female' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => setFp({ sex: 'female' })}>Female</button>
            </div>
            <label>Activity level</label>
            <select value={fp.activityLevel || 'moderate'} onChange={(e) => setFp({ activityLevel: e.target.value })} style={{ marginBottom: 8, width: '100%' }}>
              <option value="sedentary">Sedentary (little exercise)</option>
              <option value="light">Light (1–3 days/wk)</option>
              <option value="moderate">Moderate (3–5 days/wk)</option>
              <option value="active">Active (6–7 days/wk)</option>
              <option value="veryActive">Very active (physical job)</option>
            </select>
            <p className="muted tiny" style={{ marginBottom: 4, lineHeight: 1.4 }}>
              {tdee != null
                ? `Estimated TDEE ≈ ${tdee} cal/day. Daily goal ≈ ${calorieGoal(draft, body)} cal (adjusted for your weight goal).`
                : 'Add height, age, sex, and a body weight (Body tab) to estimate your TDEE.'}
            </p>
          </div>
        );
      })()}
      <label>Water goal (fl oz)</label>
      <input type="number" inputMode="numeric" value={draft.waterGoalOz ?? 64} onChange={(e) => update({ waterGoalOz: parseInt(e.target.value) || 0 })} style={{ marginBottom: 16 }} />

      <div className="between" style={{ marginBottom: 8, marginTop: 8 }}>
        <div className="h2">Micros (vitamins &amp; minerals)</div>
        <button
          className="tap"
          style={{ padding: '4px 10px', fontSize: 11 }}
          onClick={() => update({ microsEnabled: draft.microsEnabled === false })}
        >
          {draft.microsEnabled === false ? 'Off' : 'On'}
        </button>
      </div>
      {draft.microsEnabled !== false && (
        <>
          <p className="muted tiny" style={{ marginBottom: 10, lineHeight: 1.4 }}>
            Targets follow general adult guidance. Adjust freely. Limits (sodium, sugar, etc.) are upper caps.
          </p>
          {MICRO_DEFS.map((d) => {
            const t = { ...DEFAULT_MICRO_TARGETS, ...(draft.microTargets || {}) };
            return (
              <div key={d.key} className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span className="small" style={{ flex: 1 }}>
                  {d.label}{d.limit && <span className="muted tiny" style={{ marginLeft: 6 }}>(limit)</span>}
                </span>
                <input
                  type="number"
                  step="any"
                  value={t[d.key] ?? d.defaultTarget}
                  onChange={(e) =>
                    update({
                      microTargets: {
                        ...t,
                        [d.key]: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  style={{ width: 90 }}
                />
                <span className="mono tiny muted" style={{ width: 28 }}>{d.unit}</span>
              </div>
            );
          })}
          <button
            className="tap"
            style={{ width: '100%', marginTop: 8, marginBottom: 16, fontSize: 12 }}
            onClick={() => update({ microTargets: { ...DEFAULT_MICRO_TARGETS } })}
          >
            <RotateCcw size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Reset micro targets to defaults
          </button>
        </>
      )}

      <div className="h2" style={{ marginBottom: 8, marginTop: 16 }}>Preferences</div>

      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label>Time format</label>
          <select value={draft.timeFormat || '12h'} onChange={(e) => update({ timeFormat: e.target.value })} style={{ width: '100%' }}>
            <option value="12h">12-hour (AM/PM)</option>
            <option value="24h">24-hour</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Week starts on</label>
          <select value={draft.weekStart || 'sun'} onChange={(e) => update({ weekStart: e.target.value })} style={{ width: '100%' }}>
            <option value="sun">Sunday</option>
            <option value="mon">Monday</option>
          </select>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label>Weight unit</label>
          <select value={draft.weightUnit || 'lb'} onChange={(e) => update({ weightUnit: e.target.value })} style={{ width: '100%' }}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Length unit</label>
          <select value={draft.lengthUnit || 'in'} onChange={(e) => update({ lengthUnit: e.target.value })} style={{ width: '100%' }}>
            <option value="in">Inches (in)</option>
            <option value="cm">Centimetres (cm)</option>
          </select>
        </div>
      </div>

      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <div className="between">
          <span className="small"><Bell size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Reminders</span>
          <button
            className="tap"
            style={{ padding: '4px 12px', fontSize: 12, color: draft.reminders ? '#4A6741' : '#6B6457' }}
            onClick={toggleReminders}
          >
            {draft.reminders ? 'On' : 'Off'}
          </button>
        </div>
        {reminderErr && <div className="tiny" style={{ color: '#B8460E', marginTop: 4, lineHeight: 1.4 }}>{reminderErr}</div>}
        {draft.reminders && (
          <>
            <div className="muted tiny" style={{ margin: '6px 0 8px', lineHeight: 1.5 }}>Fires while the app is open in your browser. Times are local.</div>
            {(draft.reminderList || []).map((r: any) => (
              <div key={r.id} className="between" style={{ padding: '6px 0' }}>
                <div className="row" style={{ gap: 8, minWidth: 0 }}>
                  <Checkbox checked={r.enabled} onChange={() => updateReminder(r.id, { enabled: !r.enabled })} accent="#4A6741" />
                  <span className="small" onClick={() => updateReminder(r.id, { enabled: !r.enabled })} style={{ cursor: 'pointer', color: r.enabled ? undefined : '#6B6457' }}>{r.label}</span>
                </div>
                <input type="time" value={r.time} onChange={(e) => updateReminder(r.id, { time: e.target.value })} disabled={!r.enabled} style={{ width: 116 }} />
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <Checkbox checked={!!draft.billReminders} onChange={() => update({ billReminders: !draft.billReminders })} accent="#6E5C8E" />
                <span className="small" onClick={() => update({ billReminders: !draft.billReminders })} style={{ cursor: 'pointer', color: draft.billReminders ? undefined : '#6B6457' }}>Bill &amp; subscription due dates</span>
              </div>
              {draft.billReminders && (
                <div className="row" style={{ gap: 8, marginTop: 8, paddingLeft: 30 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10 }}>Days before</label>
                    <input type="number" min={0} max={14} value={draft.billReminderLeadDays ?? 3} onChange={(e) => update({ billReminderLeadDays: Math.max(0, Math.min(14, parseInt(e.target.value) || 0)) })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10 }}>Notify at</label>
                    <input type="time" value={draft.billReminderTime || '09:00'} onChange={(e) => update({ billReminderTime: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="between" style={{ padding: '8px 0', marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <span className="small">Appearance</span>
        <div className="row" style={{ gap: 6 }}>
          <button
            className={`tap${(!draft.theme || draft.theme === 'light') ? ' active' : ''}`}
            style={{ padding: '4px 11px', fontSize: 12 }}
            onClick={() => update({ theme: 'light' })}
          >☀️ Light</button>
          <button
            className={`tap${draft.theme === 'dark' ? ' active' : ''}`}
            style={{ padding: '4px 11px', fontSize: 12 }}
            onClick={() => update({ theme: 'dark' })}
          >🌙 Dark</button>
          <button
            className={`tap${draft.theme === 'auto' ? ' active' : ''}`}
            style={{ padding: '4px 11px', fontSize: 12 }}
            onClick={() => update({ theme: 'auto' })}
          >🌗 Auto</button>
        </div>
      </div>

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => { onSave(draft); onClose(); }}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save settings
      </button>

      <button className="tap" onClick={onChallenge} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={14} color="#8E4585" />
        <span style={{ flex: 1 }}>60-day workout challenge{settings.challenge?.active && <span className="mono tiny muted" style={{ marginLeft: 6 }}>· active</span>}</span>
        <ChevronRight size={14} className="ico-muted" />
      </button>
      <button className="tap" onClick={onCustomChallenges} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Trophy size={14} color="#C8932E" />
        <span style={{ flex: 1 }}>Custom subject challenges</span>
        <ChevronRight size={14} className="ico-muted" />
      </button>
      <button className="tap" onClick={onExportImport} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Download size={14} color="#3B5C6B" />
        <span style={{ flex: 1 }}>Backup / restore data</span>
        <ChevronRight size={14} className="ico-muted" />
      </button>
      <button className="tap" onClick={onSyncTransfer} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={14} color="#8E4585" />
        <span style={{ flex: 1 }}>{getStoredUsername() ? `Account: ${getStoredUsername()}` : 'Account & sync'}</span>
        <ChevronRight size={14} className="ico-muted" />
      </button>
      <button className="tap" onClick={onDiagnostics} style={{ width: '100%', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Activity size={14} color="#4A6741" />
        <span style={{ flex: 1 }}>Diagnostics</span>
        <ChevronRight size={14} className="ico-muted" />
      </button>
      <button className="tap" onClick={onResetDay} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
        <RotateCcw size={14} color="#B8460E" />
        <span style={{ flex: 1 }}>Reset today</span>
        <ChevronRight size={14} className="ico-muted" />
      </button>
    </ModalShell>
  );
}

export function DiagnosticsModal({ onClose }: { onClose: () => void }) {
  const [tests, setTests] = useState<any[]>([]);
  const [running, setRunning] = useState(true);
  const [copied, setCopied] = useState(false);

  const errorLog: any[] = (() => { try { return JSON.parse(localStorage.getItem('st:errorLog') || '[]'); } catch { return []; } })();
  const storage = (() => {
    const rows: { key: string; bytes: number }[] = [];
    let total = 0;
    for (const name of Object.keys(K)) {
      const raw = localStorage.getItem((K as any)[name]);
      const bytes = raw ? new Blob([raw]).size : 0;
      total += bytes;
      if (bytes > 0) rows.push({ key: name, bytes });
    }
    rows.sort((a, b) => b.bytes - a.bytes);
    return { rows, total };
  })();
  const env = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    standalone: typeof window !== 'undefined' && !!(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    screen: typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '',
    sw: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    base: (typeof import.meta !== 'undefined' ? (import.meta as any).env?.BASE_URL : '/') || '/',
    mode: (typeof import.meta !== 'undefined' ? (import.meta as any).env?.MODE : '') || '',
  };
  const sync = { syncId: getSyncId(), username: getStoredUsername() || '(anonymous)' };

  useEffect(() => {
    (async () => {
      const out: any[] = [];
      try { localStorage.setItem('st:__diag', '1'); localStorage.removeItem('st:__diag'); out.push({ name: 'Local storage', ok: true, detail: 'read/write OK' }); }
      catch (e: any) { out.push({ name: 'Local storage', ok: false, detail: e?.message || 'unavailable' }); }
      let bad = 0;
      for (const name of Object.keys(K)) {
        const raw = localStorage.getItem((K as any)[name]);
        if (raw == null) continue;
        try { JSON.parse(raw); } catch { bad++; }
      }
      out.push({ name: 'Saved data integrity', ok: bad === 0, detail: bad === 0 ? 'all stores valid JSON' : `${bad} store(s) corrupted` });
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(`${AUTH_API}/healthz`, { signal: ctrl.signal });
        clearTimeout(t);
        out.push({ name: 'Server connection', ok: resp.ok, detail: resp.ok ? 'reachable (200)' : `HTTP ${resp.status}` });
      } catch (e: any) {
        out.push({ name: 'Server connection', ok: false, detail: e?.name === 'AbortError' ? 'timed out' : 'unreachable' });
      }
      setTests(out);
      setRunning(false);
    })();
  }, []);

  const buildReport = () => [
    'DONJUL DIAGNOSTICS',
    `Time: ${new Date().toISOString()}`,
    `Mode: ${env.mode}  Base: ${env.base}`,
    `Online: ${env.online}  PWA: ${env.standalone}  SW: ${env.sw}`,
    `Viewport: ${env.screen}`,
    `UserAgent: ${env.userAgent}`,
    `Account: ${sync.username}  id=${sync.syncId}`,
    '',
    'SELF-TESTS:',
    ...tests.map((t) => `  [${t.ok ? 'PASS' : 'FAIL'}] ${t.name} — ${t.detail}`),
    '',
    `STORAGE (${(storage.total / 1024).toFixed(1)} KB total):`,
    ...storage.rows.map((r) => `  ${r.key}: ${(r.bytes / 1024).toFixed(1)} KB`),
    '',
    `RECENT ERRORS (${errorLog.length}):`,
    ...(errorLog.length ? errorLog.slice().reverse().map((e: any) => `  ${e.ts || ''} [${e.kind || 'error'}] ${e.message || ''}${e.stack ? '\n    ' + String(e.stack).split('\n').slice(0, 3).join('\n    ') : ''}`) : ['  (none)']),
  ].join('\n');

  const copy = async () => {
    const txt = buildReport();
    try { await navigator.clipboard.writeText(txt); setCopied(true); toast.success('Diagnostics copied'); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('Copy this and paste it to share:', txt); }
  };
  const clearErrors = () => { try { localStorage.removeItem('st:errorLog'); } catch {} toast('Error log cleared'); onClose(); };

  return (
    <ModalShell title="Diagnostics" onClose={onClose} icon={<Activity size={18} color="#4A6741" />}>
      <p className="muted tiny" style={{ marginBottom: 14, lineHeight: 1.5 }}>
        A snapshot of the app's health. Tap "Copy diagnostics" and paste it to me if something's wrong.
      </p>

      <div className="h2" style={{ marginBottom: 8 }}>Self-tests</div>
      <div style={{ marginBottom: 16 }}>
        {running && <div className="small muted">Running checks…</div>}
        {tests.map((t, i) => (
          <div key={i} className="between" style={{ padding: '6px 0', alignItems: 'center' }}>
            <span className="small">{t.name}</span>
            <span className="tiny mono" style={{ color: t.ok ? '#4A6741' : '#B8460E' }}>{t.ok ? '●' : '○'} {t.detail}</span>
          </div>
        ))}
      </div>

      <div className="h2" style={{ marginBottom: 8 }}>Environment</div>
      <div className="small" style={{ marginBottom: 16, lineHeight: 1.7 }}>
        <div className="between"><span className="muted">Connection</span><span>{env.online ? 'Online' : 'Offline'}</span></div>
        <div className="between"><span className="muted">Installed (PWA)</span><span>{env.standalone ? 'Yes' : 'No'}</span></div>
        <div className="between"><span className="muted">Account</span><span>{sync.username}</span></div>
        <div className="between"><span className="muted">Viewport</span><span className="mono tiny">{env.screen}</span></div>
      </div>

      <div className="between" style={{ marginBottom: 8 }}><div className="h2">Storage</div><span className="mono tiny muted">{(storage.total / 1024).toFixed(1)} KB</span></div>
      <div style={{ marginBottom: 16 }}>
        {storage.rows.slice(0, 6).map((r) => (
          <div key={r.key} className="between" style={{ padding: '3px 0' }}><span className="tiny muted">{r.key}</span><span className="mono tiny">{(r.bytes / 1024).toFixed(1)} KB</span></div>
        ))}
      </div>

      <div className="between" style={{ marginBottom: 8 }}><div className="h2">Recent errors</div><span className="mono tiny muted">{errorLog.length}</span></div>
      {errorLog.length === 0 ? (
        <p className="tiny muted" style={{ marginBottom: 16 }}>No errors logged.</p>
      ) : (
        <div style={{ marginBottom: 16, maxHeight: 160, overflowY: 'auto' }}>
          {errorLog.slice().reverse().map((e: any, i: number) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="tiny mono" style={{ color: '#B8460E' }}>{e.kind || 'error'}{e.ts ? ` · ${fmtShortDate(String(e.ts).slice(0, 10))}` : ''}</div>
              <div className="tiny" style={{ lineHeight: 1.4, wordBreak: 'break-word' }}>{e.message || '(no message)'}</div>
            </div>
          ))}
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={copy}>
        <Download size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{copied ? 'Copied!' : 'Copy diagnostics'}
      </button>
      {errorLog.length > 0 && <button className="tap" style={{ width: '100%', color: '#B8460E', borderColor: '#B8460E' }} onClick={clearErrors}>Clear error log</button>}
    </ModalShell>
  );
}

export function EditSubjectModal({ subjectKey, settings, onSave, onClose }: any) {
  const isNew = !subjectKey;
  const existing = isNew ? null : normalizeSubject(settings.subjects[subjectKey]);
  const [draft, setDraft] = useState<any>(existing || normalizeSubject({ name: '', icon: 'target', accent: '#B8460E', trackingMode: 'time', target: 30, weeklyDays: 5, deadline: null, countTotal: null }));
  const [goalSel, setGoalSel] = useState<'none' | 'deadline' | 'count'>(subjectGoalKind(draft));
  const [showDetails, setShowDetails] = useState(!isNew);
  const set = (patch: any) => setDraft({ ...draft, ...patch });

  const handleSave = () => {
    const clean = { ...draft };
    if (goalSel === 'deadline') { clean.countTotal = null; if (!clean.deadline) clean.deadline = addMonth(todayStr(), 3); }
    else if (goalSel === 'count') { clean.deadline = null; clean.countTotal = Math.max(1, parseInt(clean.countTotal) || 10); }
    else { clean.deadline = null; clean.countTotal = null; }
    if (clean.trackingMode === 'checkoff') clean.target = 0;
    const key = subjectKey || draft.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now().toString(36);
    const next = { ...settings, subjects: { ...settings.subjects, [key]: clean } };
    if (isNew) next.subjectOrder = [...settings.subjectOrder, key];
    onSave(next);
    onClose();
  };

  const ICONS = ['languages', 'music', 'shield', 'book', 'target', 'dumbbell', 'activity'];
  const COLORS = ['#B8460E', '#4A6741', '#3B5C6B', '#C8932E', '#8E4585', '#1A1A2E'];
  const goals: { key: typeof goalSel; label: string }[] = [
    { key: 'none', label: 'No deadline' },
    { key: 'deadline', label: 'Deadline' },
    { key: 'count', label: 'Finish after N' },
  ];

  return (
    <ModalShell title={isNew ? 'New subject' : 'Edit subject'} onClose={onClose}>
      <label>Name</label>
      <input type="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. CompTIA Security+" style={{ marginBottom: 12 }} />

      <label>How do you track it?</label>
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        <button className={`tap ${draft.trackingMode === 'time' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => set({ trackingMode: 'time' })}>
          <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Log time
        </button>
        <button className={`tap ${draft.trackingMode === 'checkoff' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => set({ trackingMode: 'checkoff' })}>
          <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Just mark done
        </button>
      </div>

      <label>Icon</label>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {ICONS.map(ic => {
          const I = ICON_MAP[ic];
          return (
            <button key={ic} className={`tap ${draft.icon === ic ? 'active' : ''}`} onClick={() => set({ icon: ic })} style={{ padding: 8 }}>
              <I size={16} />
            </button>
          );
        })}
      </div>
      <label>Color</label>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => set({ accent: c })} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: draft.accent === c ? '3px solid #1A1A2E' : '1px solid var(--border-muted)', cursor: 'pointer' }} />
        ))}
      </div>

      {!showDetails ? (
        <button className="tap" style={{ width: '100%', marginBottom: 14 }} onClick={() => setShowDetails(true)}>
          <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add details (deadline, description, days/week…)
        </button>
      ) : (
        <div style={{ marginBottom: 6 }}>
          <label>Description (optional)</label>
          <input type="text" value={draft.tools} onChange={(e) => set({ tools: e.target.value })} placeholder="e.g. Jason Dion · Udemy" style={{ marginBottom: 12 }} />

          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            {draft.trackingMode === 'time' && (
              <div style={{ flex: 1 }}><label>Daily (min)</label><input type="number" value={draft.target} onChange={(e) => set({ target: parseInt(e.target.value) || 0 })} /></div>
            )}
            <div style={{ flex: 1 }}><label>Days/week</label><input type="number" min="1" max="7" value={draft.weeklyDays} onChange={(e) => set({ weeklyDays: Math.min(7, Math.max(1, parseInt(e.target.value) || 1)) })} /></div>
          </div>

          <label>Finish goal</label>
          <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {goals.map(g => (
              <button key={g.key} className={`tap ${goalSel === g.key ? 'active' : ''}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setGoalSel(g.key)}>{g.label}</button>
            ))}
          </div>
          {goalSel === 'deadline' && (
            <>
              <input type="date" value={draft.deadline || addMonth(todayStr(), 3)} onChange={(e) => set({ deadline: e.target.value })} style={{ marginBottom: 10 }} />
              {draft.trackingMode === 'time' && (
                <>
                  <label>Total course hours <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>(optional — overrides deadline math for progress bar)</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={draft.courseHours ?? ''}
                    onChange={(e) => set({ courseHours: e.target.value === '' ? null : parseFloat(e.target.value) || null })}
                    placeholder="e.g. 36"
                    style={{ marginBottom: 8 }}
                  />
                  {draft.courseHours > 0 && (
                    <p className="muted tiny" style={{ marginBottom: 8, lineHeight: 1.5 }}>
                      Progress bar tracks {draft.courseHours}h ({Math.round(draft.courseHours * 60)}min) of actual content, not estimated study time.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {goalSel === 'count' && (
            <>
              <label>Finish after how many sessions/days?</label>
              <input type="number" min="1" value={draft.countTotal || ''} onChange={(e) => set({ countTotal: parseInt(e.target.value) || 0 })} placeholder="e.g. 20" style={{ marginBottom: 8 }} />
            </>
          )}
          {goalSel === 'none' && <p className="muted tiny" style={{ marginBottom: 8, lineHeight: 1.5 }}>No deadline — just keep doing it. Once you hit your weekly count it hides until next week.</p>}
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={handleSave} disabled={!draft.name}>
        <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Save subject
      </button>
    </ModalShell>
  );
}

export function WeeklyReviewModal({ settings, totals, body, workout, meals, streaks, onAck, onSkip }: any) {
  const subjects = settings.subjectOrder.filter((k: string) => settings.subjects[k] && !settings.subjects[k].archived);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ai, setAi] = useState<any>(null);
  const [aiErr, setAiErr] = useState('');

  const runAiReview = async () => {
    setAiState('loading'); setAiErr('');
    try {
      const week: string[] = [];
      for (let i = 0; i < 7; i++) { const d = new Date(todayStr() + 'T00:00:00'); d.setDate(d.getDate() - i); week.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); }
      const proteinDays = week.map((d) => meals?.log?.[d]?.protein).filter((x: any) => x > 0);
      const avgProtein = proteinDays.length ? Math.round(proteinDays.reduce((a: number, b: number) => a + b, 0) / proteinDays.length) : 0;
      const subjSummary = subjects.map((k: string) => { const s = settings.subjects[k]; const diff = (totals[k] || 0) - expectedTotal(k, settings); return { name: s.name, status: s.deadline ? (diff >= 0 ? 'ahead/on-pace' : 'behind') : 'no deadline', streak: streaks[k]?.current || 0 }; });
      const first = body.entries?.[0], last = body.entries?.[body.entries.length - 1];
      const bodyTrend = first && last && first.weight && last.weight ? { weightChange: Math.round((last.weight - first.weight) * 10) / 10 } : {};
      const resp = await fetch('/api/weekly-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjects: subjSummary, workoutsThisWeek: week.filter((d) => workout.logs[d]).length, avgProtein, proteinTarget: settings.macroTargets.protein, bodyTrend, streaks }) });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Review unavailable.'); }
      setAi(await resp.json()); setAiState('done');
    } catch (e: any) { setAiErr(e?.message || 'Review unavailable.'); setAiState('error'); }
  };

  return (
    <ModalShell title="Sunday review" onClose={onSkip} icon={<ListChecks size={18} color="#4A6741" />}>
      <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Quick weekly checkpoint. Where are you, and what to push next week.
      </p>

      {aiState === 'idle' && (
        <button className="tap" style={{ width: '100%', marginBottom: 14, color: '#8E4585', borderColor: '#8E4585' }} onClick={runAiReview}>
          <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Get AI review of my week
        </button>
      )}
      {aiState === 'loading' && <p className="muted small" style={{ marginBottom: 14 }}>Reviewing your week…</p>}
      {aiState === 'error' && <p className="small" style={{ color: '#B8460E', marginBottom: 14 }}>{aiErr}</p>}
      {aiState === 'done' && ai && (
        <div className="card" style={{ background: 'var(--tint-purple)', border: '1px solid var(--tint-purple-bd)', marginBottom: 16 }}>
          {ai.summary && <p className="small" style={{ fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>{ai.summary}</p>}
          {ai.wins?.length > 0 && <><div className="mono tiny" style={{ color: '#4A6741', fontWeight: 600, marginBottom: 4 }}>WINS</div>{ai.wins.map((w: string, i: number) => <div key={i} className="small" style={{ marginBottom: 3 }}>• {w}</div>)}</>}
          {ai.focus?.length > 0 && <><div className="mono tiny" style={{ color: '#8E4585', fontWeight: 600, margin: '8px 0 4px' }}>NEXT WEEK</div>{ai.focus.map((w: string, i: number) => <div key={i} className="small" style={{ marginBottom: 3 }}>→ {w}</div>)}</>}
        </div>
      )}
      {subjects.map((k: string) => {
        const s = settings.subjects[k];
        const totalDone = totals[k] || 0;
        const expected = expectedTotal(k, settings);
        const diff = totalDone - expected;
        const perDayAvg = s.target * (s.weeklyDays / 7);
        const daysOff = Math.abs(diff) / Math.max(perDayAvg, 1);
        const Icon = ICON_MAP[s.icon] || Languages;
        const streak = streaks[k]?.current || 0;
        return (
          <div key={k} style={{ marginBottom: 12, padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <Icon size={14} color={s.accent} />
              <span className="small" style={{ fontWeight: 600 }}>{s.name}</span>
              {streak > 0 && <span className="streak-flame"><Flame size={11} /> {streak}d</span>}
            </div>
            <div className="mono tiny muted">
              {Math.round(totalDone / 60 * 10) / 10}h done · {diff >= 0 ? `${daysOff.toFixed(1)}d ahead` : `${daysOff.toFixed(1)}d behind`}
            </div>
          </div>
        );
      })}
      <div className="h2" style={{ marginTop: 16, marginBottom: 8 }}>Workouts this week</div>
      {(() => {
        const week = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayStr() + 'T00:00:00');
          d.setDate(d.getDate() - i);
          week.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        }
        const logged = week.filter(d => workout.logs[d]).length;
        return (
          <p className="small">
            <span className="mono">{logged}/6</span> sessions logged. {logged >= 5 ? "Solid week." : logged >= 3 ? "Decent, but push for 6." : "Get back on it next week."}
          </p>
        );
      })()}
      <div className="h2" style={{ marginTop: 16, marginBottom: 8 }}>Body</div>
      {body.entries.length === 0 ? (
        <p className="muted small">No measurements yet.</p>
      ) : (
        <p className="small">{body.entries.length} entries logged · next on {fmtShortDate(settings.nextMeasurement)}</p>
      )}
      <button className="btn" style={{ width: '100%', marginTop: 18 }} onClick={onAck}>
        <Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Got it
      </button>
    </ModalShell>
  );
}

const CHALLENGE_PRESETS = [
  { name: '60-Day V-Taper', days: 60, deloadWeek: 5 },
  { name: '90-Day Recomp', days: 90, deloadWeek: 7 },
  { name: '180-Day Transformation', days: 180, deloadWeek: 9 },
  { name: 'Custom', days: 0, deloadWeek: 5 },
];

export function ChallengeModal({ settings, challengeHistory, onSave, onSaveHistory, onClose }: any) {
  const ch = settings.challenge || { active: false, name: '60-Day V-Taper', startDate: null, days: 60, deloadWeek: 5 };
  const [draft, setDraft] = useState(ch);
  const [view, setView] = useState<'active'|'archive'>('active');
  const history: any[] = challengeHistory || [];

  const completeCurrent = async () => {
    if (!ch.active || !ch.startDate) return;
    const completed = { ...ch, completedDate: todayStr(), active: false };
    await onSaveHistory([completed, ...history]);
    await onSave({ ...settings, challenge: { active: false, name: '', startDate: null, days: 60, deloadWeek: 5 } });
  };

  const daysDone = ch.startDate ? Math.max(0, diffDays(todayStr(), ch.startDate)) : 0;
  const pct = ch.days > 0 ? Math.min(100, Math.round((daysDone / ch.days) * 100)) : 0;
  const isInfinite = ch.days === 0;

  return (
    <ModalShell title="Challenge" onClose={onClose} icon={<Trophy size={18} color="#8E4585" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <button className={`tap ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>
          <Zap size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Active
        </button>
        <button className={`tap ${view === 'archive' ? 'active' : ''}`} onClick={() => setView('archive')}>
          <Archive size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Archive ({history.length})
        </button>
      </div>

      {view === 'archive' && (
        <>
          {history.length === 0 && <p className="muted small">No completed challenges yet.</p>}
          {history.map((h: any, i: number) => (
            <div key={i} className="card" style={{ padding: 12, marginBottom: 8, borderLeft: '3px solid #C8932E' }}>
              <div className="between">
                <div>
                  <div className="small" style={{ fontWeight: 600 }}><Trophy size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: '#C8932E' }} />{h.name}</div>
                  <div className="mono tiny muted">{fmtShortDate(h.startDate)} → {fmtShortDate(h.completedDate)} · {h.days}d</div>
                </div>
                <Award size={20} color="#C8932E" />
              </div>
            </div>
          ))}
        </>
      )}

      {view === 'active' && (
        <>
          {ch.active && (
            <div className="card" style={{ padding: 12, marginBottom: 14, background: 'var(--tint-purple)', borderLeft: '3px solid #8E4585' }}>
              <div className="between" style={{ marginBottom: 8 }}>
                <span className="small" style={{ fontWeight: 600 }}>{ch.name}</span>
                <span className="mono tiny" style={{ color: '#8E4585' }}>{isInfinite ? '∞' : `${pct}%`}</span>
              </div>
              <div className="mono tiny muted" style={{ marginBottom: 8 }}>
                Day {daysDone} {isInfinite ? '· open-ended' : `of ${ch.days} · ${ch.days - daysDone} to go`}
              </div>
              {!isInfinite && (
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#8E4585', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
              )}
              <button className="tap" style={{ width: '100%', fontSize: 12 }} onClick={completeCurrent}>
                <Trophy size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Complete & archive
              </button>
            </div>
          )}

          <div className="h3" style={{ marginBottom: 8 }}>Preset</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {CHALLENGE_PRESETS.map(p => (
              <button key={p.name} className={`tap ${draft.name === p.name ? 'active' : ''}`} style={{ fontSize: 11 }}
                onClick={() => setDraft({ ...draft, name: p.name, days: p.days || draft.days, deloadWeek: p.deloadWeek })}>
                {p.name}
              </button>
            ))}
            <button className={`tap ${draft.days === 0 ? 'active' : ''}`} style={{ fontSize: 11 }} onClick={() => setDraft({ ...draft, days: 0 })}>
              <Infinity size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Open
            </button>
          </div>

          <label>Challenge name</label>
          <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ marginBottom: 12 }} />
          <label>Start date</label>
          <input type="date" value={draft.startDate || todayStr()} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} style={{ marginBottom: 12 }} />
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label>Duration (0 = open)</label>
              <input type="number" value={draft.days} onChange={(e) => setDraft({ ...draft, days: parseInt(e.target.value) || 0 })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Deload week #</label>
              <input type="number" min="1" max="20" value={draft.deloadWeek} onChange={(e) => setDraft({ ...draft, deloadWeek: parseInt(e.target.value) || 5 })} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { onSave({ ...settings, challenge: { ...draft, active: false } }); onClose(); }}>
              {draft.active ? 'Pause' : 'Save (inactive)'}
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => { onSave({ ...settings, challenge: { ...draft, active: true, startDate: draft.startDate || todayStr() } }); onClose(); }}>
              <Play size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Activate
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}


export function ResetDayModal({ onReset, onFullReset, onClose }: any) {
  const [view, setView] = useState<'today' | 'full'>('today');

  // ── Today's reset ──
  const ALL_DAY = { subjects: true, macros: true, body: true, workout: true, spending: true, status: true };
  const NONE_DAY = { subjects: false, macros: false, body: false, workout: false, spending: false, status: false };
  const [opts, setOpts] = useState({ subjects: true, macros: true, body: false, workout: false, status: false, spending: false });
  const [confirmDay, setConfirmDay] = useState(false);
  const toggleDay = (k: keyof typeof opts) => setOpts(p => ({ ...p, [k]: !p[k] }));
  const dayRows: { key: keyof typeof opts; label: string; desc: string }[] = [
    { key: 'subjects',  label: 'Study / subject time',        desc: "Clears today's logged minutes and removes them from your totals." },
    { key: 'macros',    label: 'Macros / nutrition',           desc: "Resets today's food log and meal entries to zero." },
    { key: 'body',      label: "Today's body measurement",    desc: "Removes any weight or measurement entry logged today." },
    { key: 'workout',   label: "Today's workout log",          desc: 'Deletes the workout you logged today.' },
    { key: 'spending',  label: "Today's transactions",         desc: "Removes all money entries logged for today." },
    { key: 'status',    label: 'Status (busy / wake / start)', desc: 'Resets back to a fresh morning.' },
  ];
  const anyDay = Object.values(opts).some(Boolean);
  const allDay = Object.values(opts).every(Boolean);

  // ── Full (all-time) reset ──
  const [full, setFull] = useState({ study: false, nutrition: false, body: false, workout: false, spending: false, journal: false, plans: false, settings: false });
  const [confirmFull, setConfirmFull] = useState(false);
  const toggleFull = (k: keyof typeof full) => setFull(p => ({ ...p, [k]: !p[k] }));
  const fullRows: { key: keyof typeof full; label: string; desc: string; accent: string }[] = [
    { key: 'study',     label: 'Study history & totals',    desc: 'All logged time, streaks, check-ins — gone.', accent: '#3B5C6B' },
    { key: 'nutrition', label: 'Nutrition / meal log',      desc: 'Every food entry and preset removed.', accent: '#4A6741' },
    { key: 'body',      label: 'Body measurements',         desc: 'All weight, body-fat, and measurement entries.', accent: '#8E4585' },
    { key: 'workout',   label: 'Workout logs',              desc: 'All workout sessions across every day.', accent: '#B8460E' },
    { key: 'spending',  label: 'Money / spending',          desc: 'All transactions, budget, and savings goals.', accent: '#C8932E' },
    { key: 'journal',   label: 'Journal entries',           desc: 'All notes and trade logs.', accent: '#6E5C8E' },
    { key: 'plans',     label: 'Scheduled plans',           desc: 'All day-level plan entries.', accent: '#5C6E8E' },
    { key: 'settings',  label: 'Settings & subjects',       desc: 'Subjects, macro targets, micro targets — reverts to defaults.', accent: '#6B6457' },
  ];
  const anyFull = Object.values(full).some(Boolean);

  return (
    <ModalShell title="Reset" onClose={onClose} icon={<RotateCcw size={18} color="#B8460E" />}>
      {/* Tab switcher */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button
          className="tap"
          onClick={() => { setView('today'); setConfirmDay(false); setConfirmFull(false); }}
          style={{ flex: 1, background: view === 'today' ? '#B8460E22' : 'transparent', borderColor: view === 'today' ? '#B8460E' : 'var(--border)' }}
        >
          Reset today
        </button>
        <button
          className="tap"
          onClick={() => { setView('full'); setConfirmDay(false); setConfirmFull(false); }}
          style={{ flex: 1, background: view === 'full' ? '#1A1A2E22' : 'transparent', borderColor: view === 'full' ? '#1A1A2E' : 'var(--border)' }}
        >
          Full reset
        </button>
      </div>

      {view === 'today' && (
        <>
          <p className="muted small" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Clears selected data for <strong>today only</strong>. Past days untouched. You can Undo right after.
          </p>
          {/* Select all / none */}
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <button
              className="tap"
              style={{ flex: 1, fontSize: 11, background: allDay ? '#B8460E22' : 'transparent', borderColor: allDay ? '#B8460E' : 'var(--border)' }}
              onClick={() => { setOpts(ALL_DAY); setConfirmDay(false); }}
            >
              Select all
            </button>
            <button
              className="tap"
              style={{ flex: 1, fontSize: 11 }}
              onClick={() => { setOpts(NONE_DAY); setConfirmDay(false); }}
            >
              Clear all
            </button>
          </div>
          {dayRows.map((r) => (
            <div
              key={r.key}
              className="between"
              style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => toggleDay(r.key)}
            >
              <div style={{ flex: 1, paddingRight: 10 }}>
                <div className="small" style={{ fontWeight: 600 }}>{r.label}</div>
                <div className="muted tiny" style={{ lineHeight: 1.4 }}>{r.desc}</div>
              </div>
              <Checkbox checked={opts[r.key]} onChange={() => toggleDay(r.key)} />
            </div>
          ))}
          {!confirmDay ? (
            <button
              className="btn"
              style={{ width: '100%', marginTop: 14, background: '#B8460E' }}
              disabled={!anyDay}
              onClick={() => setConfirmDay(true)}
            >
              <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Reset selected
            </button>
          ) : (
            <>
              <p className="small" style={{ margin: '14px 0 8px', color: '#B8460E', fontWeight: 600 }}>Reset these items for today?</p>
              <button className="btn" style={{ width: '100%', background: '#B8460E' }} onClick={async () => { await onReset(opts); onClose(); }}>
                Yes, reset today
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setConfirmDay(false)}>Cancel</button>
            </>
          )}
        </>
      )}

      {view === 'full' && (
        <>
          <div
            className="row"
            style={{ gap: 8, background: 'var(--tint-warm)', border: '1px solid var(--tint-warm-bd)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}
          >
            <AlertTriangle size={14} color="#B8460E" style={{ flexShrink: 0, marginTop: 1 }} />
            <p className="small" style={{ color: '#8A3010', lineHeight: 1.45 }}>
              <strong>Permanent deletion.</strong> This erases all-time data for the categories you pick. There is no undo — export a backup first if you need it.
            </p>
          </div>
          {fullRows.map((r) => (
            <div
              key={r.key}
              className="between"
              style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => toggleFull(r.key)}
            >
              <div style={{ flex: 1, paddingRight: 10 }}>
                <div className="small" style={{ fontWeight: 600 }}>
                  <span className="swatch" style={{ background: r.accent }} />
                  {r.label}
                </div>
                <div className="muted tiny" style={{ lineHeight: 1.4 }}>{r.desc}</div>
              </div>
              <Checkbox checked={full[r.key]} onChange={() => toggleFull(r.key)} accent={r.accent} />
            </div>
          ))}

          {/* Select all / none */}
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="tap" style={{ flex: 1, fontSize: 11 }} onClick={() => setFull({ study: true, nutrition: true, body: true, workout: true, spending: true, journal: true, plans: true, settings: true })}>
              Select all
            </button>
            <button className="tap" style={{ flex: 1, fontSize: 11 }} onClick={() => setFull({ study: false, nutrition: false, body: false, workout: false, spending: false, journal: false, plans: false, settings: false })}>
              Clear all
            </button>
          </div>

          {!confirmFull ? (
            <button
              className="btn"
              style={{ width: '100%', marginTop: 14, background: '#1A1A2E' }}
              disabled={!anyFull}
              onClick={() => setConfirmFull(true)}
            >
              <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Delete selected data
            </button>
          ) : (
            <>
              <p className="small" style={{ margin: '14px 0 8px', color: '#B8460E', fontWeight: 600, lineHeight: 1.4 }}>
                This will permanently delete the selected data. Are you absolutely sure?
              </p>
              <button
                className="btn"
                style={{ width: '100%', background: '#B8460E' }}
                onClick={async () => { await onFullReset(full); onClose(); }}
              >
                Yes, permanently delete
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setConfirmFull(false)}>Cancel</button>
            </>
          )}
        </>
      )}
    </ModalShell>
  );
}

export function ExportImportModal({ data, onImport, onClose }: any) {
  const [mode, setMode] = useState('export');
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const exportJson = JSON.stringify(data, null, 2);

  useEffect(() => { (async () => setBackups(await safeGet(K.backups, [])))(); }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      onImport(parsed);
    } catch (e) {
      alert('Invalid JSON. Paste only what you copied from Export.');
    }
  };

  return (
    <ModalShell title="Backup data" onClose={onClose} icon={<Download size={18} color="#3B5C6B" />}>
      <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className={`tap ${mode === 'export' ? 'active' : ''}`} onClick={() => setMode('export')}>
          <Download size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Export
        </button>
        <button className={`tap ${mode === 'import' ? 'active' : ''}`} onClick={() => setMode('import')}>
          <Upload size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Import
        </button>
        <button className={`tap ${mode === 'backups' ? 'active' : ''}`} onClick={() => setMode('backups')}>
          <RotateCcw size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Auto-backups
        </button>
      </div>

      <p className="muted tiny" style={{ marginBottom: 12, lineHeight: 1.5, color: '#B8460E' }}>
        Heads up: your data lives only in this browser. Export it somewhere safe, or it can be lost if you clear the browser or switch devices.
      </p>

      {mode === 'backups' && (
        <>
          <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Automatic snapshots taken while you use the app. Restore one to roll back. This <strong>replaces</strong> current data.
          </p>
          {backups.length === 0 && <p className="muted small">No backups yet — they're created automatically as you use the app.</p>}
          {backups.map((b: any) => (
            <div key={b.ts} className="between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="small">{new Date(b.ts).toLocaleString()}</span>
              <button className="tap" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { if (confirm('Restore this backup? Current data will be replaced.')) onImport(b.data); }}>Restore</button>
            </div>
          ))}
        </>
      )}

      {mode === 'export' && (
        <>
          <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Copy this and save it anywhere. If you ever clear local storage, paste it back to restore everything.
          </p>
          <textarea readOnly value={exportJson} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, padding: 10, height: 200, marginBottom: 12, resize: 'vertical', width: '100%' }} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
          <button className="btn" style={{ width: '100%' }} onClick={handleCopy}>
            {copied ? <><Check size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Copied!</> : 'Copy to clipboard'}
          </button>
        </>
      )}
      {mode === 'import' && (
        <>
          <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Paste a previously exported backup here. This <strong>replaces</strong> all current data.
          </p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste your backup JSON here..." style={{ fontFamily: 'JetBrains Mono', fontSize: 11, padding: 10, height: 200, marginBottom: 12, resize: 'vertical', width: '100%' }} />
          <button className="btn btn-accent" style={{ width: '100%' }} onClick={handleImport} disabled={!importText.trim()}>
            <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Restore from backup
          </button>
        </>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SETUP FLOW (first launch)
// ════════════════════════════════════════════════════════════════════════════════
export function Setup({ onComplete, onImport }: any) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<any>({ ...DEFAULT_SETTINGS, startDate: todayStr() });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showRecover, setShowRecover] = useState(false);
  const [recoverId, setRecoverId] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState('');

  const handleRecover = async () => {
    const id = recoverId.trim();
    if (!id) { setRecoverError('Paste your sync ID above.'); return; }
    setRecoverLoading(true);
    setRecoverError('');
    try {
      clearLocalSyncData();
      setSyncId(id);
      await hydrate();
      window.location.reload();
    } catch {
      setRecoverError('Could not load data for that ID. Double-check and try again.');
      setRecoverLoading(false);
    }
  };
  const update = (patch: any) => setDraft({ ...draft, ...patch });
  const updateSubject = (k: string, patch: any) => update({ subjects: { ...draft.subjects, [k]: { ...draft.subjects[k], ...patch } } });

  const handleImport = async () => {
    setImportError('');
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.settings) {
        setImportError('Backup is missing settings. Paste the full export.');
        return;
      }
      await onImport(parsed);
    } catch (e) {
      setImportError('Invalid JSON. Paste exactly what you copied from Export.');
    }
  };

  const steps = [
    { title: 'Welcome.', body: "Let's set up your daily system. Six quick questions.", content: null, next: 'Begin' },
    {
      title: 'Wake & sleep window',
      content: (
        <>
          <label>Typical wake time</label>
          <input type="time" value={draft.wakeTime} onChange={(e) => update({ wakeTime: e.target.value })} style={{ marginBottom: 14 }} />
          <label>Typical sleep time</label>
          <input type="time" value={draft.sleepTime} onChange={(e) => update({ sleepTime: e.target.value })} />
        </>
      ), next: 'Next',
    },
    {
      title: 'Spanish goal',
      content: (
        <>
          <label>Conversational by</label>
          <input type="date" value={draft.subjects.spanish.deadline} onChange={(e) => updateSubject('spanish', { deadline: e.target.value })} style={{ marginBottom: 14 }} />
          <label>Daily target (minutes)</label>
          <input type="number" value={draft.subjects.spanish.target} onChange={(e) => updateSubject('spanish', { target: parseInt(e.target.value) || 0 })} />
        </>
      ), next: 'Next',
    },
    {
      title: 'CySA+ deadline',
      content: (
        <>
          <label>Finish course by</label>
          <input type="date" value={draft.subjects.cysa.deadline} onChange={(e) => updateSubject('cysa', { deadline: e.target.value })} />
          <div className="muted tiny" style={{ marginTop: 10, lineHeight: 1.4 }}>
            Default: 4 weeks from today. Video-only.
          </div>
        </>
      ), next: 'Next',
    },
    {
      title: 'Macro targets',
      content: (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label>Protein (g)</label><input type="number" value={draft.macroTargets.protein} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, protein: parseInt(e.target.value) || 0 } })} /></div>
            <div style={{ flex: 1 }}><label>Calories</label><input type="number" value={draft.macroTargets.calories} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, calories: parseInt(e.target.value) || 0 } })} /></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}><label>Carbs (g)</label><input type="number" value={draft.macroTargets.carbs} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, carbs: parseInt(e.target.value) || 0 } })} /></div>
            <div style={{ flex: 1 }}><label>Fat (g)</label><input type="number" value={draft.macroTargets.fat} onChange={(e) => update({ macroTargets: { ...draft.macroTargets, fat: parseInt(e.target.value) || 0 } })} /></div>
          </div>
          <div className="muted tiny" style={{ marginTop: 10, lineHeight: 1.4 }}>
            Defaults: 170p / 2300cal for recomp. Edit anytime.
          </div>
        </>
      ), next: 'Next',
    },
    {
      title: 'Body measurements',
      content: (
        <>
          <label>First measurement date</label>
          <input type="date" value={draft.nextMeasurement} onChange={(e) => update({ nextMeasurement: e.target.value })} />
          <div className="muted tiny" style={{ marginTop: 10, lineHeight: 1.4 }}>
            After your first entry, the next is auto-scheduled monthly. Default is tomorrow.
          </div>
        </>
      ), next: 'Finish',
    },
  ];

  const current = steps[step];
  return (
    <div className="app">
      <GlobalStyles />
      <div className="content" style={{ paddingTop: 40 }}>
        <div className="mono tiny" style={{ letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 24, textTransform: 'uppercase' }}>
          Step {step + 1} of {steps.length}
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 12, fontFamily: 'Fraunces, serif' }}>{current.title}</h1>
        {current.body && <p style={{ fontSize: 16, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.5, fontFamily: 'Fraunces, serif' }}>{current.body}</p>}
        {current.content && <div style={{ marginBottom: 28 }}>{current.content}</div>}
        <div className="row" style={{ gap: 10 }}>
          {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn" style={{ flex: 1 }} onClick={() => step === steps.length - 1 ? onComplete(draft) : setStep(step + 1)}>{current.next}</button>
        </div>

        {step === 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '36px 0 18px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="mono tiny muted" style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}>Returning?</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            {!showImport && !showRecover && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowRecover(true)} style={{ flex: 1 }}>
                  <RotateCcw size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Recover by ID
                </button>
                <button className="btn btn-ghost" onClick={() => setShowImport(true)} style={{ flex: 1 }}>
                  <Upload size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Restore backup
                </button>
              </div>
            )}

            {showRecover && (
              <div className="card" style={{ borderLeft: '3px solid #8E4585' }}>
                <div className="between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <RotateCcw size={16} color="#8E4585" />
                    <span className="h3">Recover account</span>
                  </div>
                  <button onClick={() => { setShowRecover(false); setRecoverId(''); setRecoverError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={18} />
                  </button>
                </div>
                <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                  Enter your sync ID to pull your data back. Find it in Settings → Sync / Transfer on any device where you're logged in.
                </p>
                <input
                  type="text"
                  value={recoverId}
                  onChange={(e) => { setRecoverId(e.target.value); setRecoverError(''); }}
                  placeholder="e.g. feff64e9-f366-46a2-aceb-..."
                  style={{ fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 10 }}
                />
                {recoverError && (
                  <div className="small" style={{ color: '#B8460E', marginBottom: 10, padding: 8, background: 'var(--tint-warm)', borderRadius: 6 }}>
                    {recoverError}
                  </div>
                )}
                <button className="btn btn-accent" onClick={handleRecover} disabled={!recoverId.trim() || recoverLoading} style={{ width: '100%' }}>
                  {recoverLoading ? 'Loading…' : 'Recover & reload'}
                </button>
              </div>
            )}

            {showImport && (
              <div className="card" style={{ borderLeft: '3px solid #3B5C6B' }}>
                <div className="between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Upload size={16} color="#3B5C6B" />
                    <span className="h3">Restore data</span>
                  </div>
                  <button onClick={() => { setShowImport(false); setImportText(''); setImportError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={18} />
                  </button>
                </div>
                <p className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                  Paste your backup JSON below. This will restore everything and skip setup.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
                  placeholder="Paste your backup JSON here..."
                  style={{ fontFamily: 'JetBrains Mono', fontSize: 11, padding: 10, height: 180, marginBottom: 10, resize: 'vertical', width: '100%' }}
                />
                {importError && (
                  <div className="small" style={{ color: '#B8460E', marginBottom: 10, padding: 8, background: 'var(--tint-warm)', borderRadius: 6 }}>
                    {importError}
                  </div>
                )}
                <button className="btn btn-accent" onClick={handleImport} disabled={!importText.trim()} style={{ width: '100%' }}>
                  <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Restore everything
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
