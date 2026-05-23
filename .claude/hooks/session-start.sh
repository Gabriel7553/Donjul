#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web.
# Installs workspace deps and exports the env vars the SPA's vite.config.ts
# requires (it throws if PORT or BASE_PATH are missing), so builds, the dev
# server, and typecheck work without manual setup.

# Only run in remote (web) sessions; local dev already has its own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Install all workspace dependencies. Idempotent, and the container image is
# cached after the hook completes, so re-runs are fast. `install` (not
# `--frozen-lockfile`) is used deliberately to benefit from that caching.
pnpm install

# Persist env vars for the whole session. vite.config.ts reads PORT (dev/preview
# server bind port; 8080 matches .replit) and BASE_PATH (app base path).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  grep -q '^export PORT=' "$CLAUDE_ENV_FILE" 2>/dev/null || echo 'export PORT="8080"' >> "$CLAUDE_ENV_FILE"
  grep -q '^export BASE_PATH=' "$CLAUDE_ENV_FILE" 2>/dev/null || echo 'export BASE_PATH="/"' >> "$CLAUDE_ENV_FILE"
fi
