// ────── TAX ENGINE (multi-year: California + Federal, Single filer) ──────────
export const CURRENT_TAX_YEAR = new Date().getFullYear();

export const FED_BRACKETS: Record<number, [number, number][]> = {
  2024: [[11600,0.10],[47150,0.12],[100525,0.22],[191950,0.24],[243725,0.32],[609350,0.35],[9_999_999,0.37]],
  2025: [[11925,0.10],[48475,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[626350,0.35],[9_999_999,0.37]],
  2026: [[12200,0.10],[49650,0.12],[105800,0.22],[202050,0.24],[256550,0.32],[641850,0.35],[9_999_999,0.37]],
};
export const CA_BRACKETS: [number, number][] = [
  [10756,0.01],[25499,0.02],[40245,0.04],[55866,0.06],
  [70606,0.08],[360659,0.093],[432787,0.103],[721314,0.113],[9_999_999,0.123],
];
export const STD_DEDUCTION: Record<number, number> = { 2024: 14600, 2025: 15000, 2026: 15350 };
export const SS_WAGE_BASE: Record<number, number> = { 2024: 168600, 2025: 176100, 2026: 176100 };
export const CA_STD_DEDUCT = 5202;

export function applyBrackets(income: number, brackets: [number, number][]): number {
  let tax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    if (income <= prev) break;
    tax += (Math.min(income, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}

// Preset 1099 payers the user works with
export const PAYER_PRESETS = [
  { id: 'vsolvit_w2', label: 'Vsolvit (W-2)', type: 'w2' },
  { id: 'tpt', label: 'TPT (1099)', type: '1099' },
  { id: 'mffu', label: 'MFFU (1099)', type: '1099' },
  { id: 'apex', label: 'Apex Trader (1099)', type: '1099' },
  { id: 'topstep', label: 'Topstep (1099)', type: '1099' },
  { id: 'tradeday', label: 'TradeDay (1099)', type: '1099' },
  { id: 'other_1099', label: 'Other (1099)', type: '1099' },
  { id: 'other_w2', label: 'Other (W-2)', type: 'w2' },
];

export const makeYearData = () => ({
  w2GrossAnnual: 0, w2Employer: 'Vsolvit', w2YTDActual: 0,
  w2WithheldFed: 0, w2WithheldCA: 0, w2WithheldSS: 0, w2WithheldMedicare: 0,
  tradingExpenses: 0,
  deductions: { homeOffice: 0, equipment: 0, software: 0, internet: 0, other: 0 } as Record<string, number>,
  entries1099: [] as any[],
  payments: [] as any[],
});

export const DEFAULT_TAX = {
  activeYear: CURRENT_TAX_YEAR,
  years: { [CURRENT_TAX_YEAR]: makeYearData() } as Record<number, any>,
};

export function migrateTax(t: any): any {
  if (!t) return DEFAULT_TAX;
  if (t.years && typeof t.years === 'object') {
    const years: Record<number, any> = {};
    for (const yr of Object.keys(t.years)) {
      const y = t.years[yr];
      years[Number(yr)] = { ...makeYearData(), ...y,
        entries1099: Array.isArray(y.entries1099) ? y.entries1099 : [],
        payments: Array.isArray(y.payments) ? y.payments : [],
        deductions: { ...makeYearData().deductions, ...(y.deductions || {}) },
      };
    }
    if (!years[CURRENT_TAX_YEAR]) years[CURRENT_TAX_YEAR] = makeYearData();
    return { activeYear: t.activeYear || CURRENT_TAX_YEAR, years };
  }
  // Migrate old flat format → treat as 2025 data
  const old: any = { ...makeYearData(),
    w2GrossAnnual: t.w2GrossAnnual || 0, w2Employer: t.w2Employer || 'Vsolvit',
    w2WithheldFed: t.w2WithheldFed || 0, w2WithheldCA: t.w2WithheldCA || 0,
    tradingExpenses: t.tradingExpenses || 0,
    entries1099: Array.isArray(t.entries1099) ? t.entries1099 : [],
    payments: Array.isArray(t.payments) ? t.payments : [],
  };
  const years: Record<number, any> = { 2025: old };
  if (CURRENT_TAX_YEAR !== 2025) years[CURRENT_TAX_YEAR] = makeYearData();
  return { activeYear: CURRENT_TAX_YEAR, years };
}

export function calcTaxEstimate(yd: any, year: number = CURRENT_TAX_YEAR, w2YTDOverride = 0) {
  const fedBrackets = FED_BRACKETS[year] || FED_BRACKETS[2025];
  const stdDeduct = STD_DEDUCTION[year] || 15000;
  const ssWageBase = SS_WAGE_BASE[year] || 176100;

  const income1099 = ((yd.entries1099 as any[]) || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const w2Gross = w2YTDOverride > 0 ? w2YTDOverride : (Number(yd.w2GrossAnnual) || 0);
  const dedTotal = (Object.values(yd.deductions || {}) as number[]).reduce((s, v) => s + (Number(v) || 0), 0)
    + (Number(yd.tradingExpenses) || 0);
  const netTrading = Math.max(0, income1099 - dedTotal);

  // Self-employment tax (both employer + employee halves)
  const seBase = netTrading * 0.9235;
  const seSS = Math.min(seBase, ssWageBase) * 0.124;
  const seMed = seBase * 0.029;
  const seTax = seSS + seMed;
  const halfSE = seTax / 2;

  // W-2 payroll taxes (employee share shown for awareness)
  const w2SS = Math.min(w2Gross, ssWageBase) * 0.062;
  const w2Med = w2Gross * 0.0145 + Math.max(0, w2Gross - 200000) * 0.009;

  const totalGross = w2Gross + netTrading;
  const fedAGI = Math.max(0, totalGross - halfSE - stdDeduct);
  const caAGI = Math.max(0, totalGross - halfSE - CA_STD_DEDUCT);
  const fedIncome = applyBrackets(fedAGI, fedBrackets);
  const caIncome = applyBrackets(caAGI, CA_BRACKETS);
  const caSDI = totalGross * 0.011;

  const w2WithheldFed = Number(yd.w2WithheldFed) || 0;
  const w2WithheldCA = Number(yd.w2WithheldCA) || 0;
  const w2WithheldSS = Number(yd.w2WithheldSS) || 0;
  const w2WithheldMed = Number(yd.w2WithheldMedicare) || 0;
  const qPaid = ((yd.payments as any[]) || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const totalWithheld = w2WithheldFed + w2WithheldCA + w2WithheldSS + w2WithheldMed + qPaid;

  const totalTax = fedIncome + seTax + caIncome + caSDI;
  const netOwed = Math.max(0, totalTax - totalWithheld);
  const effectiveRate = totalGross > 0 ? (totalTax / totalGross) * 100 : 0;

  return {
    income1099, w2Gross, netTrading, dedTotal,
    seBase, seSS, seMed, seTax, halfSE,
    w2SS, w2Med,
    totalGross, fedAGI, caAGI, stdDeduct,
    fedIncome, caIncome, caSDI,
    totalTax, totalWithheld, netOwed, effectiveRate,
    quarterly: netOwed / 4,
  };
}
