# Donjul

Personal study / fitness / nutrition / spending tracker. Single-user offline-first PWA with optional cross-device sync.

## Run & Operate

- `pnpm --filter @workspace/study-tracker run dev` — run the SPA
- `pnpm --filter @workspace/api-server run dev` — run the API server (sync + food parsing)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- SPA: React + Vite (modular: thin `App.tsx` root + `src/lib` logic, `src/features` screens/modals, `src/ui.tsx` primitives)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (Zod via `zod/v4`, `drizzle-zod`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

SPA paths are under `artifacts/study-tracker/src/`.

- `App.tsx` — the root `App()` only: top-level state, hydration/persistence effects, modal router, and tab switch (~760 lines)
- `lib/` — pure logic & data, no JSX: `date`, `storage`, `haptics`, `nutrition`, `money`, `tax`, `challenges`, `body`, `study`, `workout`, `defaults`, `reminders`, `types`
- `ui.tsx` — shared presentational primitives (GlobalStyles, Header, BottomNav, Checkbox, QtyStepper, VoiceButton, SortableRow, shared hooks)
- `features/` — screens + their modals: `today`, `food`, `history`, `trackers`, `dialogs`, `settings`, `money`, `cards`, `insights`
- `ErrorBoundary.tsx` — React error UI + log to `localStorage:st:errorLog`
- `main.tsx` — boot shell with loading spinner + 8s hydrate timeout + global error listeners
- `sync.ts` — `hydrate()` / push / pull, talks to API server
- `artifacts/api-server/src/routes/sync.ts` — sync endpoints

## Architecture decisions

- `App.tsx` was split (2026-05-23) into `lib/` (pure logic), `ui.tsx` (shared primitives), and `features/` (screens + modals). `App()` itself stays the thin root that owns state and routes modals/tabs. Put new pure helpers in `lib/`, shared UI in `ui.tsx`, and screen/modal code in `features/`.
- `Infinity` is shadowed by a Lucide import — use `Number.POSITIVE_INFINITY`.
- All meal operations must persist presets + entries in **one** `onSave` call (avoid stale-closure overwrites — see `logCombo`).
- Boot path always renders a shell first (`main.tsx` → `BootShell`) so a hung `hydrate()` cannot produce a blank page.
- Persisted-state shapes live in `lib/types.ts` (Settings, Meals, Body, Workout, Spending + leaf models). Aggregates keep an index signature so loose access compiles; tighten incrementally.
- Vendors are split via `manualChunks` in `vite.config.ts` (charts/motion/dnd/react/vendor). Keep heavy deps **eager-importable** so the SW caches them on first load — don't add route-level dynamic `import()` without a precache manifest or offline/unvisited tabs break (violates the no-blank-screen rule).

## Product

Daily tracker with: schedule (subjects/tasks with catch-up), Body/Lift (workout PRs + volume trends + per-exercise progress detail), Money (spending, debts, tax, bill reminders, category budgets, upcoming-bills card, CSV export), Journal, Plan, History, Meals (Presets/Type/Manual/Combo/Scan/+Save/Recent + 7-day summary + fasting timer), Insights (cross-domain trends + goal-ETA projections + 16-week activity heatmap), custom challenges/streaks, achievements, local reminders, global quick-add (+), customizable/hideable bottom-nav tabs & Today cards, a polished light/dark/auto theme, optional sync.

## User preferences

- Sign-in must be obvious in Settings (prominent gradient card at top, not buried).
- Combo logging auto-saves named ingredients as presets (dedupe by lowercase name).
- Missed-day on a challenge → auto-pause + prompt Restart/End on next open. Rest days protect streaks.
- Old dates in DayDetailModal must support scan/type/combo (use full logger button).
- Food tab is MFP-style (breakfast/lunch/dinner/snacks + water + calorie burn) — shipped. Bottom-nav tabs are reorderable/hideable in Settings → "Tabs & navigation" (Today always shown).

## Gotchas

- Don't blank-screen the user. `main.tsx` boot shell + ErrorBoundary + 8s hydrate timeout exist for this reason; preserve them.
- `tickChallengesForSubject` must short-circuit on `ch.paused`.
- Modal child components should not call `onClose()` during render — use `useEffect`.
- After major changes, run code review via `architect({ task, relevantFiles, includeGitDiff: true })`.
- Smoke test before shipping: `pnpm dev` in one shell, then `pnpm --filter @workspace/study-tracker test:smoke` (drives core flows in a real browser; needs `PW_CHROMIUM` if not in this env). When testing persistence, never `localStorage.clear()` on every load in the harness — guard with `if (!localStorage.getItem('st:settings'))`, or a reload wipes the very state you're checking.

## Session log

- **2026-05-22**: ErrorBoundary + global error listeners; LogMealModal refactor (`targetDate` prop, Scan styling normalized); combo auto-saves ingredients as presets in a single save; DayDetailModal "Open full logger" button with return-to-day-detail; Settings prominent sign-in card; `pauseStaleChallenges` + `ChallengePausedModal` (Restart/End); boot shell in `main.tsx` with loading spinner, 8s hydrate timeout, and "Continue offline" recovery so the page is never blank. Service worker cache version bumped to `donjul-v3-20260522`; SW auto-update + reload-on-controllerchange added so users always get the latest bundle; `window.__donjulReset()` console helper unregisters SW + clears caches for hard recovery.
- **2026-05-23**: Split the monolithic `App.tsx` (~9k lines) into focused modules — `src/lib/*` (pure logic/data), `src/ui.tsx` (shared primitives), `src/features/*` (screens + modals). `App.tsx` is now the ~760-line root (state, hydration, modal router, tab switch). Mechanical move, behavior unchanged; full typecheck + production build green. SW cache bumped `donjul-v3-20260522` → `donjul-v4-20260523`. Not yet smoke-tested in a browser.
- **2026-05-22 (sync check)**: Verified `main` is already at the same commit as `origin/Repli` (`630a258`) — no merge required. Typecheck passes; SPA boots to the Welcome onboarding in a clean env.
- **2026-05-23 (cont.)**: Added an **Insights** tab (`features/insights.tsx`) — summary tiles + recharts trends for weight, calories (vs goal), 6-month income/spending, and study consistency, with a 30/90-day toggle; wired into `BottomNav` as "Trends". Also made `sync.hydrate` a static import (removed a Vite mixed-import warning) and added a SessionStart hook (`.claude/`) that installs deps + sets `PORT`/`BASE_PATH` for web sessions. SW cache → `donjul-v5-20260523`.
- **2026-05-23 (features batch)**: Reviewed the module split (no bugs — verified Infinity/Lucide shadow, the `logCombo` single-save invariant, prop seams). Then shipped: customizable bottom-nav (reorder + show/hide tabs via `settings.navOrder`/`navHidden`); per-preset edit-before-log in the meal logger; local reminders (`lib/reminders.ts` — Notification permission + per-day fired tracking, foreground-only, Settings panel); `manualChunks` vendor split (main chunk ~1.16MB → ~371kB, >500kB warning gone); and central domain types (`lib/types.ts`) adopted at the App state layer (caught a `diffDays(today, null)` streak bug). SW cache → `donjul-v10-20260523`. Typecheck + build green throughout; not browser-tested.
- **2026-05-23 (enhancements + QA)**: Made the Today cards reorderable/hideable (wired the unused `todayLayout` + `todayHidden`). Then built four requested features, each verified in headless Chromium (seeded data, zero JS/React errors): tappable Insights tiles + body-measurement & cumulative-net charts + weight/savings goal-ETA projections; a global quick-add FAB (meal/weigh-in/expense/income → existing modals); bill & subscription due-date reminders (`upcomingBills` from credit/debt `dueDay` + recurring expenses, fired once-daily); workout PRs + per-session volume trends (`computePRs`/`sessionVolume`/`estimate1RM` over the existing set/weight logs). Also typed core `lib/` signatures + InsightsTab/MacrosCard/MicrosCard props with `lib/types`. Full-app QA drive found no real bugs. SW cache → `donjul-v16-20260523`.
- **2026-05-23 (more best-features)**: Two self-directed additions, both browser-verified: per-exercise **progress detail** (tap any lift in the Lift tab → best set, est. 1RM, top-set progression chart, per-session set history via `exerciseHistory`); and a GitHub-style 16-week **activity heatmap** on Insights (shades each day by # of domains logged — study/lift/food/weigh-in/money; needed `workout` passed into `InsightsTab`). Also fixed a pre-existing Y-axis **clipping** bug — weight/measurement/calorie chart axes were too narrow (`width={34}` + large negative left margin), so 3-4-digit labels lost their leading digit (180 lb → "80", 2300 kcal → "300"); widened to `width={42}`/`left:-4`. SW cache → `donjul-v17-20260523`.
- **2026-05-23 (food + money menus)**: Two more browser-verified additions. **Food**: a 7-day nutrition summary card on the Food tab — mini calorie bar chart vs the goal line + avg calories/protein vs targets (the tab was previously single-day only; note "recent foods" quick-relog already existed in the logger, so not duplicated). **Money**: per-category budgets — a new "Category budgets" section (added to `MONEY_DEFAULT_ORDER`, auto-appends for existing users via the order-merge at money.tsx:756) showing each budgeted category's month-to-date spend vs limit with over-budget colors, plus `CategoryBudgetsModal` to set limits (stored in `spending.categoryBudgets`). SW cache → `donjul-v18-20260523`.
- **2026-05-23 (food + money, batch 2)**: Four more browser-verified features (incl. a real CSV download via Playwright). **Food**: a live intermittent-fasting timer (`FastingCard`, self-contained 1s tick, 16:8/18:6/20:4/OMAD, progress + 30-entry history, stored under `meals.fasting`); plus per-meal-section "copy yesterday's <section>" buttons. **Money**: transaction CSV export (RFC-escaped, resolves category/account names, triggers a Blob download); plus an "Upcoming bills · 14 days" section card reusing `upcomingBills` (visual companion to the bill reminder notifications). SW cache → `donjul-v19-20260523`.
- **2026-05-24 (dark mode completion)**: Dark mode shipped half-done — the toggle + `.dark` CSS (in `ui.tsx`) existed, but ~800 inline hex colors in feature files didn't adapt (light cards/borders, invisible text on dark). Completed it by converting the **neutral** inline colors to the existing CSS vars — and the key safety property is that each neutral hex equals its variable's *light* value, so light mode is pixel-identical while dark flips. Backgrounds (`#FBF7EE/#F0EAD8/#F9F5EC/#F5F0E6`→`--bg-card/--bg-inset/--bg-inset2/--bg`), borders (`#E4DCC8/#D4CCB8`→`--border(-muted)`), inline `color:` text (`#6B6457/#1A1A2E`→`--text-muted/--text`). Hand-fixed dual-use spots: the "physical" credit-card surface, inactive toggle text (`active ? light : '#1A1A2E'`→`var(--text)`, was dark-on-dark), the activity-heatmap empty cell, hardcoded-dark lucide header icons (→`currentColor`). **Left literal:** recharts `fill:` and lucide `color=` props (SVG presentation attributes can't resolve `var()`). Verified across all 9 tabs in both themes (light unchanged, dark coherent). `ui.tsx` excluded from the sed (it *defines* the `:root` vars). SW cache → `donjul-v20-20260524`.
- **2026-05-24 (auto theme)**: Appearance is now Light / Dark / **Auto**. `App` tracks `prefers-color-scheme` via a `matchMedia` listener (hook lives up top, before the setup/loading early returns) and `isDark = theme==='dark' || (theme==='auto' && systemDark)`, so Auto live-switches when the device flips to night mode (verified via Playwright `emulateMedia`, no reload). SW cache → `donjul-v21-20260524`.
- **2026-05-24 (a11y + icon polish)**: Added keyboard `:focus-visible` rings to all interactive elements (accent in light, gold in dark) and `aria-label`s to the shared icon-only controls (Header gear → "Settings", ModalShell close → "Close", so every modal is covered; FAB already had one). Converted the 22 hardcoded-muted lucide icons (`color="#6B6457"`) to a `.ico-muted` class (`color: var(--text-muted)`) so they follow the theme — lucide renders `stroke="currentColor"`, so a CSS `color` cascades correctly where the `var()` SVG-attribute trick can't. Same treatment for `ui.tsx`'s own inline muted text. Verified focus ring (`2px solid #B8460E`) + labels via Playwright. SW cache → `donjul-v22-20260524`. **Remaining a11y nice-to-have**: per-row trash/edit icon buttons in lists still lack labels.
- **2026-05-24 (state-tint dark mode)**: Finished dark mode's last gap — the **semantic state tints** (done=green `#F0F5ED`, active=blue `#EEF2F8`, warning=peach `#F5E1D5`, accent=purple, subtle cream) were hardcoded light pastels that only render in certain states (so they weren't in earlier screenshots) and showed as glaring light boxes on dark. Added `--tint-good/info/warm/purple/cream` (+`-bd` border) variable pairs — light values equal the originals (grouped by family, sub-perceptible shifts), dark values are hue-matched darks — and converted the `background:`/`solid` usages. Left literal: HEAT (heatmap) array + recharts colors. Verified the exercise-detail "best set" card in both themes (light cream unchanged, dark now a dark surface). SW cache → `donjul-v23-20260524`.
- **2026-05-24 (empty-state fix)**: The Today schedule card showed "All done for today" even when a user had **no subjects** (e.g. all archived → `subjectKeys` empty), which is misleading. The `Schedule` component now branches on `subjectKeys.length === 0`: a "No subjects yet" hint + an "Add a subject" CTA (new `onAddSubject` prop threaded `App → TodayTab → Schedule`, opens the `editSubject` modal); the genuine "all done" message stays otherwise. Verified end-to-end (seed `subjectOrder: []`, advance past wake/start, CTA opens the modal). SW cache → `donjul-v24-20260524`. (Note: the schedule section only renders after wake + start-time are picked.)
- **2026-05-24 (a11y labels + empty-state sweep)**: Labeled the per-row **icon-only** buttons (delete/edit/archive/prev/next) so screen readers announce them. Applied via a perl pattern that matches *strictly icon-only* buttons — `<button((?:[^<>]|=>)*)>\s*<Icon …/>\s*</button>` — the `(?:[^<>]|=>)*` allows arrow-fn `=>` in attributes but **no `<`**, so buttons with nested elements (e.g. a text row + chevron) can't match. (A first naive attempt that allowed nested content mangled `</div aria-label>` tags — reverted, then fixed; lesson: JSX `=>`/nesting defeats simple `[^>]` regexes.) Counts: Delete 15, Edit 5, Archive 1, Previous 3, Next 2. Swept empty states across tabs — Money (Accounts/Budget/Debt/Owed/Transactions prompts), History (calendar + legend + "Tap any past day" + achievements), Plan, Journal all already adequate; the only real gap was Today-no-subjects (fixed previously). Verified at runtime (Delete label present, **0 console errors across all 8 tabs**). SW cache → `donjul-v25-20260524`.
- **2026-05-24 (interaction QA + real bug fix)**: Ran a Playwright interaction pass (not just render checks) over core CRUD/persistence. Caught a genuine bug: `migrateMeals` rebuilt the meals object from only `presets/log/entries`, so **`meals.fasting` was silently stripped on every hydrate** — an in-progress fast vanished on reload/restart. Fixed by spreading `...meals` first (preserves fasting + any future extra field). Verified delete (aria-labeled trash button fires), fasting start→persist→end, and theme set→persist (note: theme is draft-based — applies on "Save settings", not on close; by design). Also a test-harness lesson: an `addInitScript` that `localStorage.clear()`s unconditionally wipes state on reload — guard with `if (!localStorage.getItem('st:settings'))` when testing persistence. SW cache → `donjul-v26-20260524`.
- **2026-05-24 (study math + smoke harness)**: Fixed study pacing math that "felt off": `getRequiredDailyMins` spread remaining work over **calendar** days, ignoring `weeklyDays` (a 3×/week subject's daily target was badly understated) → now divides by study-days-left; `expectedTotal` omitted the `+1` that `targetTotalByDeadline` uses (so the "expected" line never reached 100% even on the deadline day) → now counts today and caps at the deadline; the Progress **status pill** used a projection model while the bar used expected-so-far (could show "on pace" beside a red "behind") → pill now uses the same expected-vs-done measure as the bar; and the CatchUpBanner's contradictory second figure ("spread +Nm/day × 7 days this week", wrong for <7-day subjects) was removed. The workout challenge is a **calendar program** (counts days, not a streak), so it "kept going" after a missed workout — it now shows session recency ("Nd since a session") so the gap is visible. Added a committed Playwright **smoke harness** (`pnpm test:smoke` → `tests/smoke.mjs`, `playwright-core@1.60.0` matching the chromium build) covering 6 core flows incl. the fasting-persistence regression; exits non-zero to gate CI. SW cache → `donjul-v27-20260524`.
- **Deferred**: route-level lazy-loading (needs a SW precache manifest to keep offline/unvisited tabs working — see Architecture decisions).

## Cache / blank-screen recovery

Whenever shipping changes that touch `App.tsx`, `main.tsx`, or assets, bump `CACHE` in `artifacts/study-tracker/public/sw.js` (e.g. `donjul-v27-…` → `donjul-v28-…`). If a user reports a blank page, ask them to: (1) hard-refresh (Ctrl/Cmd+Shift+R), or (2) open devtools console and run `__donjulReset()`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
