import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import { hasSupabaseConfig, supabaseConfigError } from "./utils/supabase/client";
import "./styles/index.css";

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);

const setupEnvText = `VITE_SUPABASE_URL=https://fuvhpohwxyezscryekwq.supabase.co
VITE_SUPABASE_PROJECT_ID=fuvhpohwxyezscryekwq
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_ENABLE_DEMO_AUTH=true
VITE_FORCE_CUSTOMER_DEMO_AUTH=false`;

if (!hasSupabaseConfig) {
  root.render(
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(38, 208, 206, 0.16), transparent 32%), #f4f7fb",
        padding: "24px",
        fontFamily:
          '"Instrument Sans", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          borderRadius: "28px",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          background: "#ffffff",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.12)",
          padding: "32px",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "999px",
            background: "rgba(14, 165, 233, 0.12)",
            color: "#0369a1",
            padding: "8px 12px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Setup Required
        </div>
        <h1 style={{ margin: "18px 0 12px", fontSize: "clamp(32px, 4vw, 44px)", lineHeight: 1.05 }}>
          Missing <code>CentralPerk/.env</code>
        </h1>
        <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.7, color: "#334155" }}>
          {supabaseConfigError}
        </p>
        <p style={{ margin: "14px 0 0", fontSize: "16px", lineHeight: 1.7, color: "#334155" }}>
          This is why the app shows a plain white page on a fresh GitHub clone. The repo was pushed,
          but <code>.env</code> was not included, which is normal because it is ignored by Git.
        </p>
        <div
          style={{
            marginTop: "24px",
            borderRadius: "20px",
            background: "#0f172a",
            color: "#e2e8f0",
            padding: "20px",
            overflowX: "auto",
          }}
        >
          <div style={{ marginBottom: "10px", fontSize: "13px", color: "#7dd3fc", fontWeight: 700 }}>
            Create this file: <code>CentralPerk/.env</code>
          </div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.7 }}>
            {setupEnvText}
          </pre>
        </div>
        <div style={{ marginTop: "20px", fontSize: "15px", lineHeight: 1.8, color: "#334155" }}>
          <div>1. Copy <code>CentralPerk/.env.example</code> to <code>CentralPerk/.env</code>.</div>
          <div>2. Paste the real publishable key and anon key from your Supabase project.</div>
          <div>3. Restart <code>npm run dev</code> and reload <code>http://localhost:5173</code>.</div>
        </div>
      </div>
    </div>,
  );
} else {
  root.render(<RouterProvider router={router} />);
}
