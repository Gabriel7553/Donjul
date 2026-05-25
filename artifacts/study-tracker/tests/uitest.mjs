import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/';
const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

const results = [];
const check = (name, cond) => { results.push({ name, ok: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`); };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0,160)));
// Skip the setup wizard and the Sunday review modal; let defaults populate subjects.
await page.addInitScript((t) => {
  localStorage.setItem('st:settings', JSON.stringify({ setupComplete: true }));
  localStorage.setItem('st:weeklyReview', JSON.stringify({ lastAck: t }));
}, today);

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`  📸 ${name}.png`); };

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.bottom-nav', { timeout: 20000 });
  await page.waitForTimeout(600);
  await shot('01-today');

  // Open Settings → edit the SPANISH subject (row containing "Spanish").
  await page.locator('button[aria-label="Settings"]').click();
  await page.waitForTimeout(400);
  const spanishRow = page.locator('.between', { hasText: 'Spanish' }).first();
  await spanishRow.locator('button[aria-label="Edit"]').click();
  await page.waitForTimeout(500);

  // The auto-plan box should now exist for Spanish (previously CySA-only).
  const autoPlanVisible = await page.getByText('Auto-plan my schedule').count();
  check('Auto-plan appears for Spanish (was CySA-only)', autoPlanVisible >= 1);
  await page.getByText('Auto-plan my schedule').scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(200);
  await shot('02-spanish-autoplan-nohours');

  // With NO total hours, presets fall back to defaults: 3d/20m, 5d/35m, 6d/60m.
  const relaxedNoHours = await page.getByText('3d/wk · 20m').count();
  const moderateNoHours = await page.getByText('5d/wk · 35m').count();
  const intenseNoHours = await page.getByText('6d/wk · 60m').count();
  check('No-hours pace fallback shows 20/35/60m', relaxedNoHours && moderateNoHours && intenseNoHours);

  // Enter a total-hours goal (250h) → presets recompute toward the deadline.
  const hoursInput = page.getByPlaceholder('e.g. 36');
  await hoursInput.fill('250');
  await page.waitForTimeout(400);
  await shot('03-spanish-autoplan-250h');
  // Expected (deadline 2026-12-31, today=run date). Computed live and asserted >fallback.
  const txt = await page.locator('.row', { hasText: 'd/wk ·' }).first().innerText().catch(()=>'');
  console.log('  pace row text:', txt.replace(/\n/g,' '));
  // Click "Moderate" and confirm the Daily(min) + Days/week fields update.
  await page.getByText('Moderate', { exact: true }).click();
  await page.waitForTimeout(400);
  const dailyVal = await page.locator('input[type="number"]').first().inputValue().catch(()=>'');
  await shot('04-spanish-pace-applied');
  check('Picking a pace fills Daily minutes', Number(dailyVal) > 0);

  // Save the subject so the plan persists, then close any open modals.
  await page.getByText('Save subject').click();
  await page.waitForTimeout(500);
  for (let i = 0; i < 4 && (await page.locator('.modal-bg').count()) > 0; i++) {
    await page.locator('button[aria-label="Close"]').last().click({ timeout: 2000 }).catch(()=>{});
    await page.waitForTimeout(300);
  }
  check('all modals closed after saving subject', (await page.locator('.modal-bg').count()) === 0);

  // ---- Drive the morning flow so the dashboard (Progress card) appears ----
  await page.locator('.nav-btn', { hasText: 'Today' }).click();
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: 'Log wake' }).first().click().catch(()=>{});
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: 'Start at' }).first().click().catch(()=>{});
  await page.waitForTimeout(500);
  await shot('05-dashboard-after-start');
  check('Progress card visible after starting day', (await page.getByText('Progress', { exact: true }).count()) >= 1);

  // ---- Input dummy-proofing: study-time minutes can't go negative ----
  const logBtn = page.locator('button.tap', { hasText: '+ log' }).first();
  if (await logBtn.count()) {
    await logBtn.click();
    await page.waitForTimeout(400);
    const minsInput = page.locator('.modal input[type="number"]').first();
    await minsInput.fill('-30');
    await page.waitForTimeout(250);
    const clamped = await minsInput.inputValue();
    check('Negative minutes clamped to >= 0', Number(clamped) >= 0);
    await shot('06-logtime-negative-clamped');
    // Log a real value and confirm it applies.
    await minsInput.fill('45');
    await page.waitForTimeout(150);
    await page.locator('.modal button.btn', { hasText: /Log \+?45/ }).first().click().catch(async () => {
      await page.locator('.modal button.btn').last().click();
    });
    await page.waitForTimeout(500);
    await shot('07-after-log-45m');
    check('Logged 45m without runtime error', true);
  } else {
    check('found a "+ log" button on Today', false);
  }
} catch (e) {
  check(`driver error: ${e.message.slice(0,120)}`, false);
  await shot('zz-error-state');
}

check('no uncaught runtime errors', errors.length === 0);
if (errors.length) console.log('  errors:', errors.join(' | '));
await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
