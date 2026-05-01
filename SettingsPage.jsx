import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

const API_BASE_KEY = "raneev-api-base";
const DEFAULT_API = "http://localhost:8000";

export default function SettingsPage({ user }) {
  const [apiBase, setApiBase] = useState(localStorage.getItem(API_BASE_KEY) || DEFAULT_API);
  const [notifications, setNotifications] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [simplifiedMode, setSimplifiedMode] = useState(localStorage.getItem("raneev-simplified") === "true");
  const [darkMode] = useState(true); // Always dark

  function toggleSimplified(val) {
    setSimplifiedMode(val);
    localStorage.setItem("raneev-simplified", val);
    toast.success(val ? "Simplified Mode Enabled!" : "Standard Mode Restored");
    setTimeout(() => window.location.reload(), 1000);
  }

  function saveApiBase() {
    localStorage.setItem(API_BASE_KEY, apiBase.trim() || DEFAULT_API);
    toast.success("API URL saved! Refreshing...");
    setTimeout(() => window.location.reload(), 800);
  }

  function resetToDefault() {
    setApiBase(DEFAULT_API);
    localStorage.setItem(API_BASE_KEY, DEFAULT_API);
    toast.success("Reset to default");
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>⚙️ Settings</h1>
        <p>Configure your RANEEV experience</p>
      </div>

      {/* User Info */}
      <motion.div className="glass mb-4" style={{ padding: "18px 20px" }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <p className="section-title mb-3">Account</p>
        <div className="flex items-center gap-3">
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: user?.avatar_color || "linear-gradient(135deg,#e83e3e,#f97316)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.4rem", flexShrink: 0,
          }}>
            {(user?.name?.[0] || "U").toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{user?.name || "Guest"}</p>
            <p className="text-xs text-muted">{user?.email || "Not logged in"}</p>
          </div>
        </div>
      </motion.div>

      {/* Backend Config */}
      <motion.div className="glass mb-4" style={{ padding: "20px 24px" }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <p className="section-title mb-3">Backend Connection</p>
        <div className="input-group mb-3">
          <label className="input-label">API Base URL</label>
          <input
            className="input"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder="http://localhost:8000"
          />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={saveApiBase}>
            💾 Save & Reconnect
          </button>
          <button className="btn btn-ghost btn-sm" onClick={resetToDefault}>
            Reset
          </button>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div className="glass mb-4" style={{ padding: "20px 24px" }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <p className="section-title mb-4">Preferences</p>
        {[
          { label: "Rural Mode",         sub: "Big icons, simple text, loud alerts",state: simplifiedMode, toggle: toggleSimplified, emoji: "🚜" },
          { label: "Push Notifications", sub: "Alert when nearby emergency occurs", state: notifications, toggle: setNotifications, emoji: "🔔" },
          { label: "Vibration Alerts",   sub: "Vibrate on new SOS alerts",          state: vibration,     toggle: setVibration, emoji: "📳" },
          { label: "Dark Mode",          sub: "Always enabled for readability",      state: darkMode,      toggle: () => {}, emoji: "🌙", disabled: true },
        ].map(({ label, sub, state, toggle, emoji, disabled }) => (
          <div key={label} className="flex justify-between items-center" style={{ padding: "14px 0", borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: "1.3rem" }}>{emoji}</span>
              <div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-muted">{sub}</p>
              </div>
            </div>
            <button
              onClick={() => !disabled && toggle(!state)}
              className={`toggle ${state ? "on" : ""}`}
              style={{ opacity: disabled ? 0.5 : 1 }}
              aria-label={`Toggle ${label}`}
            >
              <div className="toggle-thumb" />
            </button>
          </div>
        ))}
      </motion.div>

      {/* App Info */}
      <motion.div className="glass-sm mb-6" style={{ padding: "16px 20px" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <p className="section-title mb-3">About RANEEV</p>
        {[
          ["Version",   "1.0.0"],
          ["Backend",   "FastAPI + SQLite"],
          ["Frontend",  "React + Vite"],
          ["Real-time", "WebSocket + Mock Redis"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between" style={{ padding: "6px 0" }}>
            <span className="text-sm text-muted">{k}</span>
            <span className="text-sm font-semibold">{v}</span>
          </div>
        ))}
      </motion.div>

      {/* Emergency Demo */}
      <motion.div
        className="glass"
        style={{ padding: "16px 20px", borderColor: "rgba(232,62,62,0.2)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-xs text-muted" style={{ textAlign: "center" }}>
          🔐 Demo credentials: <strong style={{ color: "var(--text-secondary)" }}>demo@raneev.app</strong> / <strong style={{ color: "var(--text-secondary)" }}>demo1234</strong>
        </p>
      </motion.div>
    </div>
  );
}
