import { createRoot } from "react-dom/client";
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

async function boot() {
  await hydrate();
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {/* SW unavailable in dev is fine */});
  });
}
