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

Daily tracker with: schedule (subjects/tasks with catch-up), Body/Lift (workout PRs + volume trends + per-exercise progress detail), Money (spending, debts, tax, bill reminders, category budgets), Journal, Plan, History, Meals (Presets/Type/Manual/Combo/Scan/+Save/Recent + 7-day summary), Insights (cross-domain trends + goal-ETA projections + 16-week activity heatmap), custom challenges/streaks, achievements, local reminders, global quick-add (+), customizable/hideable bottom-nav tabs & Today cards, optional sync.

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

## Session log

- **2026-05-22**: ErrorBoundary + global error listeners; LogMealModal refactor (`targetDate` prop, Scan styling normalized); combo auto-saves ingredients as presets in a single save; DayDetailModal "Open full logger" button with return-to-day-detail; Settings prominent sign-in card; `pauseStaleChallenges` + `ChallengePausedModal` (Restart/End); boot shell in `main.tsx` with loading spinner, 8s hydrate timeout, and "Continue offline" recovery so the page is never blank. Service worker cache version bumped to `donjul-v3-20260522`; SW auto-update + reload-on-controllerchange added so users always get the latest bundle; `window.__donjulReset()` console helper unregisters SW + clears caches for hard recovery.
- **2026-05-23**: Split the monolithic `App.tsx` (~9k lines) into focused modules — `src/lib/*` (pure logic/data), `src/ui.tsx` (shared primitives), `src/features/*` (screens + modals). `App.tsx` is now the ~760-line root (state, hydration, modal router, tab switch). Mechanical move, behavior unchanged; full typecheck + production build green. SW cache bumped `donjul-v3-20260522` → `donjul-v4-20260523`. Not yet smoke-tested in a browser.
- **2026-05-22 (sync check)**: Verified `main` is already at the same commit as `origin/Repli` (`630a258`) — no merge required. Typecheck passes; SPA boots to the Welcome onboarding in a clean env.
- **2026-05-23 (cont.)**: Added an **Insights** tab (`features/insights.tsx`) — summary tiles + recharts trends for weight, calories (vs goal), 6-month income/spending, and study consistency, with a 30/90-day toggle; wired into `BottomNav` as "Trends". Also made `sync.hydrate` a static import (removed a Vite mixed-import warning) and added a SessionStart hook (`.claude/`) that installs deps + sets `PORT`/`BASE_PATH` for web sessions. SW cache → `donjul-v5-20260523`.
- **2026-05-23 (features batch)**: Reviewed the module split (no bugs — verified Infinity/Lucide shadow, the `logCombo` single-save invariant, prop seams). Then shipped: customizable bottom-nav (reorder + show/hide tabs via `settings.navOrder`/`navHidden`); per-preset edit-before-log in the meal logger; local reminders (`lib/reminders.ts` — Notification permission + per-day fired tracking, foreground-only, Settings panel); `manualChunks` vendor split (main chunk ~1.16MB → ~371kB, >500kB warning gone); and central domain types (`lib/types.ts`) adopted at the App state layer (caught a `diffDays(today, null)` streak bug). SW cache → `donjul-v10-20260523`. Typecheck + build green throughout; not browser-tested.
- **2026-05-23 (enhancements + QA)**: Made the Today cards reorderable/hideable (wired the unused `todayLayout` + `todayHidden`). Then built four requested features, each verified in headless Chromium (seeded data, zero JS/React errors): tappable Insights tiles + body-measurement & cumulative-net charts + weight/savings goal-ETA projections; a global quick-add FAB (meal/weigh-in/expense/income → existing modals); bill & subscription due-date reminders (`upcomingBills` from credit/debt `dueDay` + recurring expenses, fired once-daily); workout PRs + per-session volume trends (`computePRs`/`sessionVolume`/`estimate1RM` over the existing set/weight logs). Also typed core `lib/` signatures + InsightsTab/MacrosCard/MicrosCard props with `lib/types`. Full-app QA drive found no real bugs. SW cache → `donjul-v16-20260523`.
- **2026-05-23 (more best-features)**: Two self-directed additions, both browser-verified: per-exercise **progress detail** (tap any lift in the Lift tab → best set, est. 1RM, top-set progression chart, per-session set history via `exerciseHistory`); and a GitHub-style 16-week **activity heatmap** on Insights (shades each day by # of domains logged — study/lift/food/weigh-in/money; needed `workout` passed into `InsightsTab`). Also fixed a pre-existing Y-axis **clipping** bug — weight/measurement/calorie chart axes were too narrow (`width={34}` + large negative left margin), so 3-4-digit labels lost their leading digit (180 lb → "80", 2300 kcal → "300"); widened to `width={42}`/`left:-4`. SW cache → `donjul-v17-20260523`.
- **2026-05-23 (food + money menus)**: Two more browser-verified additions. **Food**: a 7-day nutrition summary card on the Food tab — mini calorie bar chart vs the goal line + avg calories/protein vs targets (the tab was previously single-day only; note "recent foods" quick-relog already existed in the logger, so not duplicated). **Money**: per-category budgets — a new "Category budgets" section (added to `MONEY_DEFAULT_ORDER`, auto-appends for existing users via the order-merge at money.tsx:756) showing each budgeted category's month-to-date spend vs limit with over-budget colors, plus `CategoryBudgetsModal` to set limits (stored in `spending.categoryBudgets`). SW cache → `donjul-v18-20260523`.
- **Deferred**: route-level lazy-loading (needs a SW precache manifest to keep offline/unvisited tabs working — see Architecture decisions).

## Cache / blank-screen recovery

Whenever shipping changes that touch `App.tsx`, `main.tsx`, or assets, bump `CACHE` in `artifacts/study-tracker/public/sw.js` (e.g. `donjul-v18-…` → `donjul-v19-…`). If a user reports a blank page, ask them to: (1) hard-refresh (Ctrl/Cmd+Shift+R), or (2) open devtools console and run `__donjulReset()`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
