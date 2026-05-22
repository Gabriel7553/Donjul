import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { hasError: boolean; error: Error | null; info: ErrorInfo | null };

const LOG_KEY = "st:errorLog";

function appendLog(entry: any) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    while (arr.length > 25) arr.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(arr));
  } catch {
    /* storage unavailable */
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    appendLog({
      ts: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack || "",
      componentStack: info?.componentStack || "",
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    });
  }

  reset = () => this.setState({ hasError: false, error: null, info: null });

  copyReport = async () => {
    const { error, info } = this.state;
    const report = [
      "Donjul error report",
      `Time: ${new Date().toISOString()}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : ""}`,
      `UserAgent: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
      "",
      `Message: ${error?.message || String(error)}`,
      "",
      "Stack:",
      error?.stack || "(no stack)",
      "",
      "Component stack:",
      info?.componentStack || "(no component stack)",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(report);
      alert("Report copied. Paste it to Replit so the agent can fix it.");
    } catch {
      window.prompt("Copy this report and paste it to Replit:", report);
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const msg = this.state.error?.message || "Unknown error";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5EFE2",
          color: "#3D362A",
          padding: "32px 20px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#FBF7EE",
            border: "1px solid #E4DCC8",
            borderRadius: 14,
            padding: 24,
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#B8460E" }}>
            Something broke 😕
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
            Your data is safe — it's saved locally. The app hit an error and
            couldn't recover this view.
          </p>
          <div
            style={{
              background: "#F5EFE2",
              border: "1px solid #E4DCC8",
              borderRadius: 8,
              padding: 10,
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 12,
              color: "#6B6457",
              marginBottom: 16,
              maxHeight: 120,
              overflow: "auto",
              wordBreak: "break-word",
            }}
          >
            {msg}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "10px 14px",
                background: "#B8460E",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload app
            </button>
            <button
              onClick={this.reset}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "10px 14px",
                background: "transparent",
                color: "#3D362A",
                border: "1px solid #C8B89A",
                borderRadius: 8,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
          <button
            onClick={this.copyReport}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "10px 14px",
              background: "transparent",
              color: "#8E4585",
              border: "1px solid #D4B5CB",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Copy error report for Replit
          </button>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 11,
              color: "#6B6457",
              lineHeight: 1.5,
            }}
          >
            Tip: paste the copied report into the Replit chat so the agent knows
            exactly what to fix.
          </p>
        </div>
      </div>
    );
  }
}
