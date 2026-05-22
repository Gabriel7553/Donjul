import { createRoot, type Root } from "react-dom/client";
import { StrictMode, useEffect, useState } from "react";
import App from "./App";
import "./index.css";
import { hydrate } from "./sync";
import { ErrorBoundary } from "./ErrorBoundary";

// Global unhandled-error logging (so non-render errors are also captured).
function appendErrLog(entry: any) {
  try {
    const raw = localStorage.getItem("st:errorLog");
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    while (arr.length > 25) arr.shift();
    localStorage.setItem("st:errorLog", JSON.stringify(arr));
  } catch {}
}
window.addEventListener("error", (e) => {
  appendErrLog({
    ts: new Date().toISOString(),
    kind: "window.error",
    message: e?.message || "",
    stack: (e?.error && e.error.stack) || "",
    source: e?.filename || "",
    lineno: e?.lineno || 0,
  });
});
window.addEventListener("unhandledrejection", (e) => {
  appendErrLog({
    ts: new Date().toISOString(),
    kind: "unhandledrejection",
    message: (e?.reason && (e.reason.message || String(e.reason))) || "",
    stack: (e?.reason && e.reason.stack) || "",
  });
});

// Lightweight pre-app shell so the user NEVER sees a blank page, even if hydrate hangs.
function BootShell() {
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    // Hard timeout: if hydrate takes > 8s, surface a recoverable error instead of staying blank forever.
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      appendErrLog({ ts: new Date().toISOString(), kind: "boot.timeout", message: "hydrate() exceeded 8s" });
      setErr("Loading your data is taking longer than expected. You can continue offline or reload.");
      setPhase("failed");
    }, 8000);

    (async () => {
      try {
        await hydrate();
        if (cancelled) return;
        clearTimeout(timeoutId);
        setPhase("ready");
      } catch (e: any) {
        if (cancelled) return;
        clearTimeout(timeoutId);
        appendErrLog({
          ts: new Date().toISOString(),
          kind: "boot.error",
          message: e?.message || String(e),
          stack: e?.stack || "",
        });
        setErr(e?.message || "Could not load your data.");
        setPhase("failed");
      }
    })();

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, []);

  if (phase === "ready") return <App />;

  const shell = (msg: string, isError: boolean) => (
    <div style={{
      minHeight: "100vh",
      background: "#F5EFE2",
      color: "#3D362A",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        maxWidth: 380,
        width: "100%",
        background: "#FBF7EE",
        border: "1px solid #E4DCC8",
        borderRadius: 14,
        padding: 24,
        textAlign: "center",
      }}>
        <div style={{
          width: 36,
          height: 36,
          margin: "0 auto 14px",
          border: "3px solid #E4DCC8",
          borderTopColor: "#B8460E",
          borderRadius: "50%",
          animation: isError ? "none" : "donjul-spin 0.8s linear infinite",
          opacity: isError ? 0 : 1,
        }} />
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: isError ? "#B8460E" : "#3D362A" }}>
          {isError ? "Couldn't load Donjul" : "Loading Donjul…"}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5, color: "#6B6457" }}>{msg}</p>
        {isError && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "#B8460E", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >Reload</button>
            <button
              onClick={() => setPhase("ready")}
              style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "transparent", color: "#3D362A", border: "1px solid #C8B89A", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
            >Continue offline</button>
          </div>
        )}
      </div>
      <style>{`@keyframes donjul-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return phase === "failed"
    ? shell(err || "Something went wrong starting up.", true)
    : shell("Syncing your latest data…", false);
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = '<pre style="padding:20px;color:#B8460E">Fatal: #root element missing.</pre>';
} else {
  let root: Root;
  try {
    root = createRoot(rootEl);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <BootShell />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (e: any) {
    appendErrLog({ ts: new Date().toISOString(), kind: "boot.mount", message: e?.message || String(e), stack: e?.stack || "" });
    rootEl.innerHTML = `<div style="padding:20px;font-family:system-ui">
      <h2 style="color:#B8460E">Donjul failed to start</h2>
      <p>${(e?.message || "Unknown error").replace(/</g, "&lt;")}</p>
      <button onclick="location.reload()" style="padding:8px 14px;background:#B8460E;color:white;border:none;border-radius:6px;cursor:pointer">Reload</button>
    </div>`;
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates every load + every 60s; if a new SW takes control, reload once to pick up new bundle.
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 60000);
      })
      .catch(() => {/* SW unavailable in dev is fine */});
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      window.location.reload();
    });
  });
}

// Expose a global recovery helper users can call from the console if anything ever blanks: `__donjulReset()`.
(window as any).__donjulReset = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    window.location.reload();
  }
};
