import { useState, useEffect } from "react";
import { fetchStats, checkHealth, fetchProfile } from "../../api/api";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ClipboardList, Siren, Handshake, BadgeCheck, Users, Map, Medal, Settings, BriefcaseMedical } from "lucide-react";

const STAT_CARDS = [
  { key: "total",           label: "Total Cases",      color: "blue",   Icon: ClipboardList },
  { key: "active",          label: "Active",           color: "red",    Icon: Siren },
  { key: "accepted",        label: "Accepted",         color: "orange", Icon: Handshake },
  { key: "resolved",        label: "Resolved",         color: "green",  Icon: BadgeCheck },
  { key: "volunteers_live", label: "Live Volunteers",  color: "teal",   Icon: Users },
];

function StatCard({ label, value, color, Icon, index }) {
  return (
    <motion.div
      className={`stat-card stat-card-${color}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.16,1,0.3,1] }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="stat-label">{label}</span>
        {Icon ? <Icon className="stat-icon" aria-hidden="true" /> : null}
      </div>
      <div className={`stat-value gradient-text-${color === "blue" || color === "teal" ? "blue" : color === "green" ? "green" : ""}`}
        style={{ color: color === "red" ? "var(--brand-red)" : color === "orange" ? "var(--brand-orange)" : color === "amber" ? "var(--brand-amber)" : undefined }}>
        {value ?? "—"}
      </div>
    </motion.div>
  );
}

export default function HomePage({ user }) {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState("checking");
  const [time, setTime] = useState(new Date());
  const [homeMode, setHomeMode] = useState("ERN");
  const [isLive, setIsLive] = useState(false);
  const [simplified] = useState(localStorage.getItem("raneev-simplified") === "true");

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, hRes] = await Promise.all([fetchStats(), checkHealth()]);
        setStats(sRes.data);
        setHealth("online");
      } catch {
        setHealth("offline");
      }
      if (user?.email) {
        fetchProfile(user.email).then(({ data }) => setIsLive(data.volunteer_info?.is_live || false)).catch(()=>null);
      }
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-muted mb-1">{greeting} 👋</p>
          <h1 style={{ fontSize: "1.8rem" }}>
            {user?.name?.split(" ")[0] || "Responder"}
          </h1>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className={`connection-pill`}>
            <span className={`dot dot-pulse ${health === "online" ? "dot-green" : health === "offline" ? "dot-red" : "dot-amber"}`} />
            <span className="text-xs font-semibold" style={{
              color: health === "online" ? "var(--brand-green)" : health === "offline" ? "var(--brand-red)" : "var(--brand-amber)"
            }}>
              {health.toUpperCase()}
            </span>
          </div>
          <span className="time-chip" aria-label="Current time">{time.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <p className="section-title">{simplified ? "VOLUNTEERS READY" : "Live Dashboard"}</p>
      
      {simplified ? (
        <div className="glass flex items-center justify-between mb-8" style={{ padding: "32px 24px", background: "rgba(20,184,166,0.1)", borderColor: "var(--brand-teal)" }}>
          <div className="flex items-center gap-6">
            <div className="stat-hero-icon" aria-hidden="true"><Users /></div>
            <div>
              <p className="font-bold text-3xl gradient-text-blue">{stats?.volunteers_live || 0}</p>
              <p className="font-semibold text-muted">Ready to Help</p>
            </div>
          </div>
          <div className="dot dot-pulse dot-green" style={{ width: 14, height: 14 }} />
        </div>
      ) : (
        <div className="grid-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          {STAT_CARDS.map((c, i) => (
            <StatCard key={c.key} {...c} value={stats?.[c.key]} index={i} />
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <p className="section-title">{simplified ? "OTHER ACTIONS" : "Quick Actions"}</p>
      <div className="grid-2 mb-6">
        {[
          { to: "/history",   Icon: ClipboardList, label: "Cases", sub: "Old help cases", color: "#3b82f6", requiresLive: true },
          { to: "/map",       Icon: Map,          label: "Live Map", sub: "Where help is", color: "#14b8a6" },
          { to: "/profile",   Icon: Medal,        label: "My Profile", sub: "Personal info", color: "#8b5cf6" },
          { to: "/settings",  Icon: Settings,     label: "Settings", sub: "App settings", color: "#6b7280" },
        ].filter(item => !item.requiresLive || isLive).map(({ to, Icon, label, sub, color }, i) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
          >
            <Link to={to} style={{ textDecoration: "none" }}>
              <div className="glass emergency-card flex flex-col items-center justify-center gap-3" 
                style={{ padding: simplified ? "30px 16px" : "16px", minHeight: simplified ? "140px" : "auto" }}>
                <div style={{
                  width: simplified ? 64 : 44, height: simplified ? 64 : 44, borderRadius: 16,
                  background: `${color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {Icon ? <Icon aria-hidden="true" className="qa-icon" /> : null}
                </div>
                <div style={{ textAlign: "center" }}>
                  <p className="font-semibold" style={{ color: "var(--text-primary)", marginBottom: 2, fontSize: simplified ? "1.1rem" : "0.9rem" }}>{label}</p>
                  <p className="text-xs text-muted">{sub}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Volunteer CTA */}
      <motion.div
        className="glass"
        style={{ padding: "20px 24px", borderColor: "rgba(34,197,94,0.2)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <BriefcaseMedical aria-hidden="true" style={{ width: 18, height: 18, color: "var(--brand-green)" }} />
              Become a Volunteer
            </p>
            <p className="text-sm text-muted">Go live and earn coins for every emergency you respond to</p>
          </div>
          <Link to="/profile" className="btn btn-success btn-sm" style={{ flexShrink: 0 }}>
            Go Live
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
