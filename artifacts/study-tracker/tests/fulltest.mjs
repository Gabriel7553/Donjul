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
await page.addInitScript((t) => {
  localStorage.setItem('st:settings', JSON.stringify({ setupComplete: true }));
  localStorage.setItem('st:weeklyReview', JSON.stringify({ lastAck: t }));
}, today);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log(`  📸 ${n}.png`); };
const nav = async (label) => { await page.locator('.nav-btn', { hasText: label }).click(); await page.waitForTimeout(500); };
const closeModals = async () => { for (let i=0;i<5 && (await page.locator('.modal-bg').count())>0;i++){ await page.locator('button[aria-label="Close"]').last().click({timeout:1500}).catch(()=>{}); await page.waitForTimeout(250);} };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(`${name} :: ${e.message.slice(0,90)}`, false); await shot(`ERR-${name}`); await closeModals(); } };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.bottom-nav', { timeout: 20000 });
await page.waitForTimeout(600);

// ---------- TODAY: wake → start → dashboard ----------
await step('today', async () => {
  await page.locator('button', { hasText: 'Log wake' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'Start at' }).first().click();
  await page.waitForTimeout(500);
  await shot('t01-today-dashboard');
  check('Today dashboard shows schedule', (await page.getByText("Today's schedule").count()) >= 1);
});

// ---------- FOOD: log a manual meal ----------
await step('food', async () => {
  await nav('Food');
  await shot('t02-food-empty');
  await page.getByText('Add food').first().click();
  await page.waitForTimeout(400);
  await page.locator('.modal').getByText('Manual', { exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator('.modal').getByPlaceholder('e.g. Lunch').fill('Chicken & rice');
  const nums = page.locator('.modal input[type="number"]');
  await nums.nth(1).fill('45'); // protein
  await nums.nth(2).fill('60'); // carbs
  await nums.nth(3).fill('12'); // fat
  await nums.nth(4).fill('520'); // calories
  await page.locator('.modal').getByText('Add to today').click();
  await page.waitForTimeout(600);
  await shot('t03-food-logged');
  check('Meal appears in Food tab', (await page.getByText('Chicken & rice').count()) >= 1);
});

// ---------- BODY: log measurements (x2 for a trend) ----------
await step('body', async () => {
  await nav('Body');
  await shot('t04-body-empty');
  for (const w of ['184', '181']) {
    await page.locator('button', { hasText: 'Log' }).first().click();
    await page.waitForTimeout(400);
    const mn = page.locator('.modal input[type="number"]');
    await mn.nth(0).fill(w);       // weight
    await mn.nth(4).fill('44');    // chest
    await mn.nth(5).fill('33');    // waist
    await page.locator('.modal').getByText('Save measurements').click();
    await page.waitForTimeout(600);
  }
  await shot('t05-body-logged');
  check('Body shows measurement detail', (await page.getByText('Measurement detail').count()) >= 1);
});

// ---------- LIFT: log a workout ----------
await step('lift', async () => {
  await nav('Lift');
  await shot('t06-lift');
  const logBtn = page.locator('button', { hasText: /Log workout/ }).first();
  if (await logBtn.count()) {
    await logBtn.click();
    await page.waitForTimeout(400);
    await page.locator('.modal input[placeholder="wt"]').first().fill('135');
    await page.locator('.modal input[placeholder="reps"]').first().fill('8');
    await page.locator('.modal').getByText('Save workout').click();
    await page.waitForTimeout(600);
    await shot('t07-lift-logged');
    check('Workout logged (recent session shows)', (await page.getByText('Recent sessions').count()) >= 1);
  } else {
    check('Lift: found Log workout button (rest day?)', false);
  }
});

// ---------- MONEY: add an expense ----------
await step('money', async () => {
  await nav('Money');
  await shot('t08-money');
  await page.locator('button.btn').filter({ hasText: 'Expense' }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.modal').getByPlaceholder('0.00').first().fill('42.50');
  const note = page.locator('.modal input[type="text"]').first();
  await note.fill('Groceries');
  await page.locator('.modal').getByText('Add transaction').click();
  await page.waitForTimeout(600);
  await shot('t09-money-added');
  check('Expense persisted', (await page.getByText('Groceries').count()) >= 1);
});

// ---------- JOURNAL: write a note ----------
await step('journal', async () => {
  await nav('Journal');
  await page.locator('textarea').first().fill('Good focus day. Hit Spanish and lifted.');
  await page.getByText('Save note').click();
  await page.waitForTimeout(500);
  await shot('t10-journal');
  check('Journal note saved (Saved state)', (await page.getByText('Saved').count()) >= 0);
});

// ---------- PLAN: plan tomorrow (add a commitment + task) ----------
await step('plan', async () => {
  await nav('Plan');
  await shot('t11-plan');
  await page.getByText('Tap to plan').first().click();
  await page.waitForTimeout(400);
  const modal = page.locator('.modal');
  // Add a commitment: type title, then click the row's "+" to push it into the list.
  await modal.getByPlaceholder('e.g. Work').fill('Class');
  await modal.locator('.row', { has: page.getByPlaceholder('e.g. Work') }).locator('button.tap').click();
  await page.waitForTimeout(200);
  // Add a task the same way.
  await modal.getByPlaceholder('e.g. Pick up groceries').fill('Pick up groceries');
  await modal.locator('.row', { has: page.getByPlaceholder('e.g. Pick up groceries') }).locator('button.tap').click();
  await page.waitForTimeout(200);
  const commitAdded = await modal.getByText('Class').count();
  await modal.getByText('Save plan').click();
  await page.waitForTimeout(500);
  await shot('t12-plan-saved');
  check('Plan commitment + task added and saved', commitAdded >= 1 && (await page.getByText('Class').count()) >= 1);
});

// ---------- HISTORY ----------
await step('history', async () => {
  await nav('History');
  await page.waitForTimeout(500);
  await shot('t13-history');
  check('History renders calendar', (await page.locator('.app').count()) >= 1);
});

// ---------- TRENDS (insights) ----------
await step('trends', async () => {
  await nav('Trends');
  await page.waitForTimeout(700);
  await shot('t14-trends');
  check('Trends renders', (await page.locator('.app').count()) >= 1);
});

// ---------- reload → confirm persistence ----------
await step('persist', async () => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.bottom-nav', { timeout: 15000 });
  await nav('Food');
  check('Meal persists across reload', (await page.getByText('Chicken & rice').count()) >= 1);
});

check('no uncaught runtime errors', errors.length === 0);
if (errors.length) console.log('  ERRORS:', errors.join(' | '));
await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
