import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { hydrate } from "./sync";

async function boot() {
  await hydrate();
  createRoot(document.getElementById("root")!).render(<App />);
}

boot();
