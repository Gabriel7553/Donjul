const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const USER_ID_KEY = "st:userId";
const TRANSFER_KEY = "st:transferKey";
const USERNAME_KEY = "st:username";
const LOCAL_TS_PREFIX = "st:_ts:";
const SYNC_PREFIX = "st:";
const NO_SYNC_KEYS = new Set(["st:backups", USER_ID_KEY, USERNAME_KEY]);
const HYDRATE_TIMEOUT_MS = 2500;
const DEBOUNCE_MS = 400;

function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function headers(): HeadersInit {
  return { "Content-Type": "application/json", "x-user-id": getUserId() };
}

export function shouldSync(key: string): boolean {
  return (
    key.startsWith(SYNC_PREFIX) &&
    !NO_SYNC_KEYS.has(key) &&
    !key.startsWith(LOCAL_TS_PREFIX)
  );
}

export function getSyncId(): string {
  return getUserId();
}

export function setSyncId(next: string): void {
  const id = String(next || "").trim();
  if (!id) throw new Error("Invalid sync id");
  localStorage.setItem(USER_ID_KEY, id);
}

export function getTransferKey(): string {
  let key = localStorage.getItem(TRANSFER_KEY);
  if (!key) {
    key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(TRANSFER_KEY, key);
  }
  return key;
}

export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setStoredUsername(name: string): void {
  localStorage.setItem(USERNAME_KEY, name);
}

export function clearStoredUsername(): void {
  localStorage.removeItem(USERNAME_KEY);
}

/**
 * Wipe all synced data keys (but NOT the userId or username) so that
 * the next hydrate() pulls server data without any local-wins conflicts.
 */
export function clearLocalSyncData(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (
      k &&
      k.startsWith(SYNC_PREFIX) &&
      k !== USER_ID_KEY &&
      k !== TRANSFER_KEY &&
      k !== USERNAME_KEY
    ) {
      keys.push(k);
    }
  }
  for (const k of keys) localStorage.removeItem(k);
}

function markLocalTs(key: string): void {
  try {
    localStorage.setItem(LOCAL_TS_PREFIX + key, String(Date.now()));
  } catch {
    /* quota */
  }
}

function getLocalTs(key: string): number {
  const v = localStorage.getItem(LOCAL_TS_PREFIX + key);
  return v ? Number(v) || 0 : 0;
}

const pending = new Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>();

function flush(key: string): void {
  const entry = pending.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(key);
  const body = JSON.stringify({ key, value: entry.value });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${API}/sync/push?uid=${encodeURIComponent(getUserId())}`, blob);
      return;
    }
  } catch {
    /* fall through */
  }
  fetch(`${API}/sync/push`, {
    method: "POST",
    headers: headers(),
    body,
    keepalive: true,
  }).catch(() => {});
}

export function pushKey(key: string, value: unknown): void {
  if (!shouldSync(key)) return;
  markLocalTs(key);
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    const e = pending.get(key);
    if (!e) return;
    pending.delete(key);
    fetch(`${API}/sync/push`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ key, value: e.value }),
      keepalive: true,
    }).catch(() => {});
  }, DEBOUNCE_MS);
  pending.set(key, { value, timer });
}

function flushAll(): void {
  for (const key of Array.from(pending.keys())) flush(key);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAll);
  window.addEventListener("beforeunload", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
}

export async function hydrate(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), HYDRATE_TIMEOUT_MS);
    const resp = await fetch(`${API}/sync/pull`, {
      headers: headers(),
      signal: ctrl.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) return;
    const json = (await resp.json()) as {
      data?: Record<string, { value: unknown; updatedAt?: string }>;
    };
    const data = json.data ?? {};
    for (const [key, entry] of Object.entries(data)) {
      if (!shouldSync(key)) continue;
      const remoteTs = entry.updatedAt ? Date.parse(entry.updatedAt) : 0;
      const localTs = getLocalTs(key);
      // Only overwrite local if remote is newer (or no local timestamp recorded yet).
      if (localTs && localTs > remoteTs) continue;
      try {
        localStorage.setItem(key, JSON.stringify(entry.value));
        if (remoteTs) localStorage.setItem(LOCAL_TS_PREFIX + key, String(remoteTs));
      } catch {
        /* quota */
      }
    }
  } catch {
    /* offline or timed out — use local data */
  }
}
