import { pad } from './date';
import type { SpendingEntry } from './types';

export const DEFAULT_SPEND_CATEGORIES = [
  // Income
  { id: 'c_salary',     name: 'Salary',         kind: 'in',  color: '#3F7A4F' },
  { id: 'c_freelance',  name: 'Freelance',      kind: 'in',  color: '#2F6E5F' },
  { id: 'c_invest',     name: 'Investments',    kind: 'in',  color: '#5C8E4F' },
  { id: 'c_other_in',   name: 'Other income',   kind: 'in',  color: '#7A9A4E' },
  // Expenses
  { id: 'c_rent',       name: 'Rent / Housing', kind: 'out', color: '#8E4585' },
  { id: 'c_food',       name: 'Food & Groceries', kind: 'out', color: '#B8460E' },
  { id: 'c_dining',     name: 'Dining out',     kind: 'out', color: '#C8932E' },
  { id: 'c_transport',  name: 'Transport',      kind: 'out', color: '#3B5C6B' },
  { id: 'c_bills',      name: 'Bills & Utilities', kind: 'out', color: '#6E5C8E' },
  { id: 'c_subs',       name: 'Subscriptions',  kind: 'out', color: '#5C6E8E' },
  { id: 'c_shopping',   name: 'Shopping',       kind: 'out', color: '#A65E8E' },
  { id: 'c_health',     name: 'Health',         kind: 'out', color: '#8E5C5C' },
  { id: 'c_fun',        name: 'Entertainment',  kind: 'out', color: '#C87A2E' },
  { id: 'c_other_out',  name: 'Other',          kind: 'out', color: '#6B6457' },
];

export const DEFAULT_SPENDING = {
  entries: [] as any[],
  categories: DEFAULT_SPEND_CATEGORIES,
  accounts: [] as any[],
  debts: [] as any[],
  owed: [] as any[],
  monthlyBudget: 0,
  savingsGoal: 0,
  income: { w2Monthly: 0, w2Employer: '', expectedTrading: 0, w2YTD: 0 } as any,
  sectionOrder: [] as string[],
};

export function migrateSpending(s: any): any {
  const base = { ...DEFAULT_SPENDING, ...(s || {}) };
  base.entries = Array.isArray(base.entries) ? base.entries : [];
  base.categories = Array.isArray(base.categories) && base.categories.length > 0 ? base.categories : DEFAULT_SPEND_CATEGORIES;
  base.accounts = Array.isArray(base.accounts)
    ? base.accounts.map((a: any) => a.type === 'credit' ? { accruedInterest: 0, lastAccrualDate: null, ...a } : a)
    : [];
  base.debts = Array.isArray(base.debts)
    ? base.debts.map((d: any) => ({ accruedInterest: 0, lastAccrualDate: null, ...d }))
    : [];
  base.owed = Array.isArray(base.owed) ? base.owed : [];
  base.monthlyBudget = Number(base.monthlyBudget) || 0;
  base.savingsGoal = Number(base.savingsGoal) || 0;
  if (!base.income || typeof base.income !== 'object') base.income = { w2Monthly: 0, w2Employer: '', expectedTrading: 0 };
  if (!Array.isArray(base.sectionOrder)) base.sectionOrder = [];
  return base;
}

export const ACCOUNT_COLORS = ['#1A1A2E', '#3B5C6B', '#8E4585', '#3F7A4F', '#B8460E', '#C8932E', '#5C6E8E', '#6B6457'];
export const DEBT_TYPES = [
  { id: 'student_loan', label: 'Student Loan' },
  { id: 'car_loan', label: 'Car Loan' },
  { id: 'personal_loan', label: 'Personal Loan' },
  { id: 'mortgage', label: 'Mortgage' },
  { id: 'credit_card', label: 'Credit Card (debt)' },
  { id: 'other', label: 'Other' },
];

export function calcDailyInterest(balance: number, apr: number): number {
  if (!balance || !apr || balance <= 0 || apr <= 0) return 0;
  return (balance * (apr / 100)) / 365;
}
export function calcMonthlyInterest(balance: number, apr: number): number {
  if (!balance || !apr || balance <= 0 || apr <= 0) return 0;
  return (balance * (apr / 100)) / 12;
}
export function calcPayoffMonths(balance: number, apr: number, minPayment: number): number {
  if (!balance || balance <= 0) return 0;
  if (!minPayment || minPayment <= 0) return Number.POSITIVE_INFINITY;
  if (!apr || apr <= 0) return Math.ceil(balance / minPayment);
  const r = (apr / 100) / 12;
  const monthlyInterest = balance * r;
  if (minPayment <= monthlyInterest) return Number.POSITIVE_INFINITY;
  return Math.ceil(-Math.log(1 - (r * balance) / minPayment) / Math.log(1 + r));
}
export function calcTotalInterestAtMin(balance: number, apr: number, minPayment: number): number {
  const months = calcPayoffMonths(balance, apr, minPayment);
  if (!isFinite(months) || months <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, months * minPayment - balance);
}
export function fmtPayoff(months: number): string {
  if (!isFinite(months) || months <= 0) return '—';
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}yr ${rem}mo` : `${years}yr`;
}

export function fmtMoney(n: number, opts: { signed?: boolean } = {}): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const s = abs >= 1000 ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 }) : abs.toFixed(2);
  if (opts.signed) return `${v < 0 ? '−' : '+'}$${s}`;
  return `${v < 0 ? '−' : ''}$${s}`;
}

export function monthKey(date: string): string { return date.slice(0, 7); }
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
export function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}
export function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function spendingByMonth(entries: SpendingEntry[], ym: string) {
  let income = 0, spent = 0;
  const byCat: Record<string, number> = {};
  for (const e of entries) {
    if (!e?.date || monthKey(e.date) !== ym) continue;
    const amt = Number(e.amount) || 0;
    if (e.type === 'in') income += amt;
    else { spent += amt; if (e.categoryId) byCat[e.categoryId] = (byCat[e.categoryId] || 0) + amt; }
  }
  return { income, spent, net: income - spent, byCat };
}

export const MONEY_DEFAULT_ORDER = [
  'ytd','accounts','budget','savings','trend','daily',
  'debt','income_payoff','tax','categories','recurring','owed','transactions',
];
export const MONEY_LABELS: Record<string, string> = {
  ytd: '💰 YTD Income',
  accounts: '🏦 Accounts',
  budget: '📊 Budget',
  savings: '🐷 Savings Goal',
  trend: '📈 6-Month Trend',
  daily: '📅 Daily Spending',
  debt: '💳 Debt Tracker',
  income_payoff: '💼 Income & Payoff',
  tax: '🧾 Tax Tracker',
  categories: '🥧 Where It Went',
  recurring: '🔁 Recurring',
  owed: '🤝 People Owe Me',
  transactions: '🧾 Transactions',
};
