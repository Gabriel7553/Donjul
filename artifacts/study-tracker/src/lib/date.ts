// Date & time utilities. Dates are local-timezone "YYYY-MM-DD" strings; times are "HH:MM".
export const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const addMonth = (dateStr: string, months = 1) => { const d = new Date(dateStr + 'T00:00:00'); d.setMonth(d.getMonth() + months); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function diffDays(toDate: string, fromDate = todayStr()) {
  const a = new Date(toDate + 'T00:00:00');
  const b = new Date(fromDate + 'T00:00:00');
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
export function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor((total / 60) % 24);
  return `${pad(nh)}:${pad(total % 60)}`;
}
export function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}
export function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
export function fmtShortDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function dayOfWeek() { return new Date(todayStr() + 'T00:00:00').getDay(); }
export function isSunday(dateStr = todayStr()) { return new Date(dateStr + 'T00:00:00').getDay() === 0; }
export function timeToMins(hhmm: string) { const [h, m] = (hhmm || '00:00').split(':').map(Number); return h * 60 + m; }
export function minsToHHMM(mins: number) { const h = Math.floor(mins / 60) % 24; const m = mins % 60; return `${pad(h)}:${pad(m)}`; }
export function weekStartStr(dateStr = todayStr()) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
