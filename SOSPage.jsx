import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { createSOS } from "../../api/api";
import { useNavigate, useLocation } from "react-router-dom";
import { HeartPulse, Car, Flame, ShieldAlert, AlertTriangle, Siren, Crosshair } from "lucide-react";

const EMERGENCY_TYPES = [
  { value: "medical",  label: "Medical",  Icon: HeartPulse,  desc: "Heart, injury, unconscious" },
  { value: "accident", label: "Accident", Icon: Car,         desc: "Road crash, collision" },
  { value: "fire",     label: "Fire",     Icon: Flame,       desc: "Fire, explosion, smoke" },
  { value: "crime",    label: "Crime",    Icon: ShieldAlert, desc: "Attack, robbery, violence" },
  { value: "other",    label: "Other",    Icon: AlertTriangle, desc: "Other emergency" },
];

const SEVERITY_LABELS = ["", "Very Low", "Low", "Moderate", "High", "Critical", "Critical+", "Severe", "Extreme", "Dire", "Life-Threatening"];

const FIRST_AID = {
  medical: {
    "❤️ CPR": "Check responsiveness, call for help, push hard & fast (100–120/min), 2 breaths per 30 compressions",
    "🩸 Bleeding": "Apply direct pressure with a clean cloth, elevate the limb above heart if possible",
    "😰 Shock": "Keep person warm, lay them flat, elevate feet if no spinal injury",
  },
  accident: {
    "🚗 Car Crash": "Don't move victim, stabilize neck, turn off ignition, call emergency services",
    "🩹 Wounds": "Apply pressure on bleeding cuts, don't remove embedded objects",
    "🦴 Fractures": "Immobilize the injured limb, don't try to straighten it",
  },
  fire: {
    "🔥 Fires": "Evacuate immediately, stay low to avoid smoke, close doors behind you",
    "🫁 Smoke Inhalation": "Move to fresh air, keep victim calm and quiet, give oxygen if available",
    "🧯 Burns": "Cool with running water 10–20 minutes, don't apply ice or butter",
  },
};

export default function SOSPage({ user }) {
  const navigate = useNavigate();
  const locationState = useLocation();
  const [step, setStep] = useState(1); // 1=type, 2=details, 3=sending
  const [form, setForm] = useState({
    emergency_type: "medical",
    mode: locationState.state?.mode || "ERN",
    severity: 8,
    description: "",
  });
  const [location, setLocation] = useState({ lat: "", lng: "" });
  const [locLoading, setLocLoading] = useState(false);
  const [simplified] = useState(localStorage.getItem("raneev-simplified") === "true");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    // Auto-detect location when reaching step 2
    if (step === 2 && !location.lat) {
      detectLocation();
    }
  }, [step]);

  async function detectLocation() {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
        toast.success("Location detected ✓");
        setLocLoading(false);
      },
      () => { toast.error("Location denied. Enter manually."); setLocLoading(false); }
    );
  }

  async function sendSOS() {
    if (!location.lat || !location.lng) { toast.error("Location is required"); return; }
    setSending(true);
    setStep(3);
    try {
      const payload = {
        ...form,
        lat: Number(location.lat),
        lng: Number(location.lng),
        user_email: user?.email || "",
        phone_number: user?.phone_number || "",
      };
      const { data } = await createSOS(payload);
      setResult(data);
      toast.success("🚨 SOS sent! Help is on the way!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send SOS");
      setStep(2);
    } finally {
      setSending(false);
    }
  }

  // --- RESULT SCREEN ---
  if (result) {
    const aid = FIRST_AID[form.emergency_type];
    return (
      <motion.div className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="glass mb-4" style={{
          padding: "28px 24px", textAlign: "center",
          borderColor: "rgba(34,197,94,0.3)",
          background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(20,184,166,0.05))",
        }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>✅</div>
          <h2 className="gradient-text-green">SOS Dispatched!</h2>
          <p className="text-secondary mt-2">Emergency #{result.emergency_id} • {result.responders_notified} volunteers notified</p>
          <div className="glass-sm mt-4 inline-block" style={{ padding: "12px 24px", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)" }}>
            <p className="font-bold text-sm" style={{ color: "var(--brand-orange)" }}>⏳ First-Aiders Arriving In:</p>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)", marginTop: "4px" }}>
               {result.responders_notified > 0 ? `~${Math.max(2, 7 - result.responders_notified)} mins` : "Locating..."}
            </p>
          </div>
        </div>

        {aid && (
          <div className="glass mb-4" style={{ padding: "20px 24px" }}>
            <p className="section-title mb-3">🩺 First Aid Instructions</p>
            {Object.entries(aid).map(([k, v]) => (
              <div key={k} className="glass-sm mb-3" style={{ padding: "12px 16px" }}>
                <p className="font-semibold mb-1" style={{ fontSize: "0.9rem" }}>{k}</p>
                <p className="text-sm text-secondary">{v}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn btn-secondary flex-1" onClick={() => { setResult(null); setStep(1); }}>
            Send Another
          </button>
          <button className="btn btn-primary flex-1" onClick={() => navigate("/history")}>
            View History
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fade-in">
      <div className="hero-header">
        <div className="hero-header-top">
          <div className="hero-icon" aria-hidden="true">
            <span className="hero-icon-core">🚨</span>
            <span className="hero-icon-ring hero-icon-ring-1" />
            <span className="hero-icon-ring hero-icon-ring-2" />
          </div>
          <div className="hero-title-wrap">
            <h1 className="hero-title">
              Send <span className="hero-title-accent">SOS</span>
            </h1>
            <p className="hero-subtitle">Alert trusted volunteers near you in seconds.</p>
          </div>
        </div>

        <div className="hero-meta">
          <span className="hero-pill">
            <span className="dot dot-pulse dot-red" /> Priority dispatch
          </span>
          <span className="hero-pill">
            <span aria-hidden="true">🗺️</span> Location‑aware matching
          </span>
          <span className="hero-pill">
            <span aria-hidden="true">🦺</span> Nearby responders
          </span>
        </div>
      </div>

      {/* Step 1: Emergency Type & Mode */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          
          <p className="section-title">Select Mode</p>
          <div className="flex gap-3 mb-6">
            <motion.button
              type="button"
              className="flex-1 glass mode-card mode-card-ern"
              data-selected={form.mode === "ERN" ? "true" : "false"}
              onClick={() => set("mode", "ERN")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
            >
              <div className="mode-card-top">
                <span className="mode-badge mode-badge-hot">Recommended</span>
                <span className="mode-badge">For any emergency</span>
              </div>
              <div className="mode-card-icon" aria-hidden="true">
                <Siren className="mode-card-icon-svg" />
              </div>
              <div className="mode-card-title">ERN Mode</div>
              <div className="mode-card-sub">Instantly alert nearby responders</div>
              <div className="mode-card-foot">
                <span className="mode-foot-chip"><Crosshair aria-hidden="true" /> Fast match</span>
                <span className="mode-foot-chip"><span className="dot dot-pulse dot-red" /> High priority</span>
              </div>
            </motion.button>

            <motion.button
              type="button"
              className="flex-1 glass mode-card mode-card-ghr"
              data-selected={form.mode === "GHR" ? "true" : "false"}
              onClick={() => set("mode", "GHR")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
            >
              <div className="mode-card-top">
                <span className="mode-badge">Guided</span>
                <span className="mode-badge">Best when waiting for help</span>
              </div>
              <div className="mode-card-icon" aria-hidden="true">
                <span className="mode-card-icon-plus">✚</span>
              </div>
              <div className="mode-card-title">GHR Mode</div>
              <div className="mode-card-sub">Step‑by‑step “golden hour” guidance</div>
              <div className="mode-card-foot">
                <span className="mode-foot-chip">🩺 First aid</span>
                <span className="mode-foot-chip">📋 Checklists</span>
              </div>
            </motion.button>
          </div>

          <p className="section-title">{simplified ? "1. TAP THE PICTURE" : "What is the emergency?"}</p>
          
          {simplified ? (
            <div className="grid-2 gap-4 mb-6" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { val: "medical",  Icon: HeartPulse,  color: "rgba(34,197,94,0.15)", border: "var(--brand-green)", label: "ILLNESS" },
                { val: "accident", Icon: Car,         color: "rgba(37,99,235,0.15)", border: "var(--brand-blue)",  label: "ACCIDENT" },
                { val: "fire",     Icon: Flame,       color: "rgba(232,62,62,0.15)", border: "var(--brand-red)",   label: "FIRE" },
                { val: "crime",    Icon: ShieldAlert, color: "rgba(139,92,246,0.15)", border: "var(--brand-purple)", label: "DANGER" },
              ].map(t => (
                <button
                  key={t.val}
                  onClick={() => { set("emergency_type", t.val); setStep(2); }}
                  className="glass"
                  style={{
                    padding: "32px 12px",
                    borderRadius: "24px",
                    border: `2px solid ${t.border}`,
                    background: t.color,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px"
                  }}
                >
                  <span aria-hidden="true" className="simplified-etype-icon">
                    <t.Icon />
                  </span>
                  <span className="font-bold" style={{ fontSize: "1.2rem", letterSpacing: "1px" }}>{t.label}</span>
                </button>
              ))}
              <button
                onClick={() => { set("emergency_type", "other"); setStep(2); }}
                className="glass"
                style={{
                  gridColumn: "span 2",
                  padding: "20px",
                  borderRadius: "24px",
                  border: "2px solid var(--border-subtle)",
                  fontSize: "1.2rem", fontWeight: "bold"
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <AlertTriangle aria-hidden="true" style={{ width: 22, height: 22 }} />
                  OTHER HELP
                </span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              {EMERGENCY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { set("emergency_type", t.value); setStep(2); }}
                  className="glass emergency-card choice-card flex items-center gap-4"
                  data-selected={form.emergency_type === t.value ? "true" : "false"}
                  style={{
                    border: "none",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "16px 20px",
                  }}
                >
                  <div className={`etype-icon etype-${t.value}`} aria-hidden="true">
                    <t.Icon className="etype-svg" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.label}</p>
                    <p className="text-xs text-muted">{t.desc}</p>
                  </div>
                  <span className="choice-card-cta" aria-hidden="true">
                    <span className="choice-card-cta-text">Select</span>
                    <span className="choice-card-cta-arrow">›</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-3 mb-5">
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)} style={{ fontSize: simplified ? "1.1rem" : "0.9rem" }}>
              {simplified ? "⬅️ BACK" : "← Back"}
            </button>
            {!simplified && (
              <>
                <div className={`etype-icon etype-${form.emergency_type}`} style={{ width: 36, height: 36 }}>
                  {EMERGENCY_TYPES.find(t => t.value === form.emergency_type)?.emoji}
                </div>
                <h2 style={{ fontSize: "1.2rem" }}>
                  {EMERGENCY_TYPES.find(t => t.value === form.emergency_type)?.label} Emergency
                </h2>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">

            {/* Severity */}
            <div className="input-group">
              <label className="input-label" style={{ fontSize: simplified ? "1.1rem" : "0.9rem" }}>
                {simplified ? "2. HOW STUCK ARE YOU?" : `Severity: ${form.severity}/10 — ${SEVERITY_LABELS[form.severity]}`}
              </label>
              
              {simplified ? (
                <div className="flex gap-2 mt-2">
                  {[
                    { val: 3, label: "SAFE",   color: "var(--brand-green)", bg: "rgba(34,197,94,0.1)" },
                    { val: 6, label: "HURT",   color: "var(--brand-orange)", bg: "rgba(249,115,22,0.1)" },
                    { val: 10, label: "DANGER", color: "var(--brand-red)",    bg: "rgba(232,62,62,0.1)" },
                  ].map(s => (
                    <button
                      key={s.val}
                      onClick={() => set("severity", s.val)}
                      className="glass-sm flex-1"
                      style={{
                        padding: "24px 8px",
                        border: form.severity === s.val ? `3px solid ${s.color}` : "1.5px solid var(--border-subtle)",
                        background: form.severity === s.val ? s.bg : "transparent",
                        textAlign: "center"
                      }}
                    >
                      <p className="font-bold" style={{ color: s.color, fontSize: "1rem" }}>{s.label}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="range" min={1} max={10}
                  value={form.severity}
                  onChange={(e) => set("severity", Number(e.target.value))}
                  style={{ width: "100%", accentColor: form.severity >= 8 ? "var(--brand-red)" : "var(--brand-orange)", cursor: "pointer", transition: "accent-color 0.3s ease" }}
                />
              )}
            </div>

            {simplified && (
              <button 
                className="glass mt-2 flex items-center justify-center gap-4" 
                style={{ padding: "18px", border: "1px dashed var(--brand-blue)", background: "rgba(59,130,246,0.05)" }}
                onClick={() => toast("🎤 Voice recording mock active...")}
              >
                <span style={{ fontSize: "1.8rem" }}>🗣️</span>
                <span className="font-semibold">TAP TO SPEAK MESSAGE</span>
              </button>
            )}

            {!simplified && form.severity >= 8 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-sm" style={{ background: "rgba(232,62,62,0.1)", borderColor: "rgba(232,62,62,0.4)", padding: "12px", borderLeft: "4px solid var(--brand-red)" }}>
                <p className="font-bold text-sm" style={{ color: "var(--brand-red)" }}>⚠️ EXTREME PRIORITY ALERT</p>
                <p className="text-xs text-secondary mt-1">This incident will be flagged as life-threatening and bypass normal queues.</p>
              </motion.div>
            )}

            {/* Location */}
            <div>
              <p className="section-title">Location</p>
              {location.lat ? (
                <div className="glass-sm mb-3 flex items-center gap-2" style={{ padding: "12px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)" }}>
                  <span style={{ fontSize: "1.2rem" }}>📍</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--brand-green)" }}>Location Secured</p>
                    <p className="text-[10px] text-muted">{location.lat.slice(0,8)}, {location.lng.slice(0,8)}</p>
                  </div>
                </div>
              ) : (
                <button className="btn btn-secondary btn-full mb-3" onClick={detectLocation} disabled={locLoading}>
                  {locLoading ? <span className="spinner" /> : "⚠️ Tap to Detect Location"}
                </button>
              )}
            </div>

            {/* Send Button */}
            <motion.button
              className="btn btn-primary btn-full btn-lg"
              onClick={sendSOS}
              disabled={sending || !location.lat || !location.lng}
              whileTap={{ scale: 0.97 }}
              style={{ marginTop: 8, fontSize: "1.1rem", padding: "16px" }}
            >
              {sending ? <span className="spinner" /> : "🚨 SEND SOS NOW"}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Sending */}
      {step === 3 && sending && (
        <motion.div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: "60vh", gap: 24 }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="sos-btn" style={{ cursor: "default", animation: "sosPulse 1s ease infinite" }}>
            <div className="sos-ring" /><div className="sos-ring sos-ring-2" /><div className="sos-ring sos-ring-3" />
            <span style={{ fontSize: "2rem" }}>🚨</span>
            <span style={{ fontSize: "1rem" }}>SENDING</span>
          </div>
          <p className="text-secondary text-sm" style={{ textAlign: "center" }}>
            Alerting volunteers near your location...
          </p>
        </motion.div>
      )}
    </div>
  );
}
