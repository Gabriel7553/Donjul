// Smoke test: drives the running app and asserts core CRUD + persistence flows.
//
// Prereqs:
//   1. Start the app in another shell:  pnpm dev   (serves http://localhost:8080)
//   2. Provide a Chromium for Playwright via PW_CHROMIUM (defaults to the build
//      bundled in this environment). For generic CI use full `playwright` +
//      `npx playwright install chromium` and point PW_CHROMIUM at it.
//
// Run:  pnpm test:smoke   (optionally SMOKE_URL=... PW_CHROMIUM=... pnpm test:smoke)
//
// Exits non-zero if any flow fails, so it can gate CI.
import { chromium } from 'playwright-core';

const EXE = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.SMOKE_URL || 'http://localhost:8080/';
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

const seed = {
  'st:settings': JSON.stringify({ setupComplete: true }),
  'st:meals': JSON.stringify({ presets: [], entries: { [today]: [{ id: 'm1', name: 'Smoke Oatmeal', meal: 'breakfast', calories: 350, protein: 12, carbs: 60, fat: 6, qty: 1 }] }, log: {} }),
  'st:spending': JSON.stringify({ entries: [], categories: [{ id: 'c_x', name: 'Misc', kind: 'out', color: '#B8460E' }], accounts: [], debts: [], owed: [], monthlyBudget: 0, savingsGoal: 0, income: {}, sectionOrder: [] }),
};

const results = [];
const check = (name, cond) => { results.push({ name, ok: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 920 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 140)));
// Seed once (guarded so reloads keep saved state — the bug a naive clear() would mask).
await page.addInitScript((s) => {
  try {
    if (!localStorage.getItem('st:settings')) {
      for (const k in s) localStorage.setItem(k, s[k]);
      const d = new Date();
      localStorage.setItem('st:weeklyReview', JSON.stringify({ lastAck: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }));
    }
  } catch (e) { /* ignore */ }
}, seed);

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.bottom-nav', { timeout: 20000 });
  const reload = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.bottom-nav', { timeout: 20000 }); };

  // 1) boots + navigates every tab without runtime errors
  for (const t of ['Food', 'Body', 'Lift', 'Money', 'Journal', 'Plan', 'History', 'Trends', 'Today']) {
    await page.locator('.nav-btn', { hasText: t }).click(); await page.waitForTimeout(250);
  }
  check('boots and navigates all tabs', true);

  // 2) delete a meal entry (aria-labeled button fires)
  await page.locator('.nav-btn', { hasText: 'Food' }).click(); await page.waitForTimeout(400);
  const before = await page.getByText('Smoke Oatmeal').count();
  await page.locator('button[aria-label="Delete"]').first().click(); await page.waitForTimeout(400);
  check('delete meal entry removes it', before === 1 && (await page.getByText('Smoke Oatmeal').count()) === 0);

  // 3) fasting starts and PERSISTS across reload (regression guard for migrateMeals)
  await page.getByText('Start 16h fast').click(); await page.waitForTimeout(300);
  const started = await page.getByText('End fast').count();
  await reload();
  await page.locator('.nav-btn', { hasText: 'Food' }).click(); await page.waitForTimeout(400);
  check('fasting persists across reload', started === 1 && (await page.getByText('End fast').count()) === 1);
  await page.getByText('End fast').click().catch(() => {});

  // 4) add a transaction and persist
  await page.locator('.nav-btn', { hasText: 'Money' }).click(); await page.waitForTimeout(400);
  await page.locator('button.btn').filter({ hasText: 'Expense' }).first().click(); await page.waitForTimeout(300);
  await page.getByPlaceholder('0.00').fill('25');
  await page.getByPlaceholder(/Coffee, Netflix/).fill('Smoke Coffee');
  await page.getByText('Add transaction').click(); await page.waitForTimeout(400);
  await reload();
  await page.locator('.nav-btn', { hasText: 'Money' }).click(); await page.waitForTimeout(400);
  check('transaction persists across reload', (await page.getByText('Smoke Coffee').count()) >= 1);

  // 5) theme set dark persists
  await page.locator('button[aria-label="Settings"]').click(); await page.waitForTimeout(300);
  await page.getByText('🌙 Dark').click(); await page.waitForTimeout(150);
  await page.getByText('Save settings').click(); await page.waitForTimeout(300);
  await reload();
  check('dark theme persists', (await page.locator('.app.dark').count()) > 0);
} catch (e) {
  check(`driver error: ${e.message.slice(0, 80)}`, false);
}

check('no uncaught runtime errors', errors.length === 0);
if (errors.length) console.log('  errors:', errors.join(' | '));
await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
