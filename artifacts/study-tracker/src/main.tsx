import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { hydrate } from "./sync";

async function boot() {
  await hydrate();
  createRoot(document.getElementById("root")!).render(<App />);
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {/* SW unavailable in dev is fine */});
  });
}
