import { useState, useEffect } from "react";
import { fetchEmergencies, acceptEmergency } from "../../api/api";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const TYPE_META = {
  medical:  { emoji: "🏥", color: "red",    cls: "badge-red",    cardCls: "emergency-card-active" },
  accident: { emoji: "🚗", color: "orange", cls: "badge-orange", cardCls: "emergency-card-accepted" },
  fire:     { emoji: "🔥", color: "amber",  cls: "badge-amber",  cardCls: "emergency-card-active" },
  crime:    { emoji: "🚔", color: "purple", cls: "badge-purple", cardCls: "emergency-card-accepted" },
  other:    { emoji: "⚠️", color: "blue",   cls: "badge-blue",   cardCls: "" },
};

const STATUS_META = {
  active:   { cls: "badge-red",    label: "Active" },
  accepted: { cls: "badge-amber",  label: "Accepted" },
  resolved: { cls: "badge-green",  label: "Resolved" },
  pending:  { cls: "badge-orange", label: "Pending" },
};

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString();
}

function EmergencyCard({ e, onAccept, user }) {
  const meta = TYPE_META[e.emergency_type] || TYPE_META.other;
  const sMeta = STATUS_META[e.status] || STATUS_META.pending;

  return (
    <motion.div
      className={`emergency-card ${meta.cardCls}`}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="flex items-start gap-3">
        <div className={`etype-icon etype-${e.emergency_type}`} style={{ width: 44, height: 44, flexShrink: 0 }}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-width-0">
          <div className="flex justify-between items-center gap-2 mb-2 wrap">
            <div className="flex gap-2 items-center wrap">
              <span className={`badge ${meta.cls}`}>{e.emergency_type?.toUpperCase()}</span>
              <span className={`badge ${sMeta.cls}`}>{sMeta.label}</span>
              <span className="badge badge-blue">⚡ {e.severity}/10</span>
            </div>
            <span className="text-xs text-muted">{formatDate(e.created_at)}</span>
          </div>
          <p className="font-semibold" style={{ fontSize: "0.9rem", marginBottom: 4 }}>
            #{e.id} — {e.description || "No description"}
          </p>
          <p className="text-xs text-muted">
            📍 {e.lat?.toFixed(4)}, {e.lng?.toFixed(4)}
            {e.user_email && ` · 👤 ${e.user_email}`}
          </p>
        </div>
      </div>

      {e.status === "active" && user?.is_volunteer && (
        <button
          className="btn btn-success btn-sm btn-full mt-3"
          onClick={() => onAccept(e.id)}
        >
          🤝 Accept & Respond
        </button>
      )}
    </motion.div>
  );
}

const FILTERS = ["all", "active", "accepted", "resolved"];

export default function EmergencyHistoryPage({ user }) {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const { data } = await fetchEmergencies();
      setEmergencies(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load emergencies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, []);

  async function handleAccept(emergencyId) {
    if (!user?.id) { toast.error("Login required"); return; }
    try {
      await acceptEmergency({ emergency_id: emergencyId, volunteer_user_id: user.id });
      toast.success("✅ Emergency accepted! +25 coins earned");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to accept");
    }
  }

  const displayed = emergencies.filter((e) => {
    const matchFilter = filter === "all" || e.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || (e.description || "").toLowerCase().includes(q)
      || (e.emergency_type || "").includes(q)
      || String(e.id).includes(q);
    return matchFilter && matchSearch;
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "all" ? emergencies.length : emergencies.filter(e => e.status === f).length;
    return acc;
  }, {});

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Emergency History</h1>
        <p>{emergencies.length} total cases tracked</p>
      </div>

      {/* Search */}
      <input
        className="input mb-4"
        placeholder="🔍 Search by ID, type, description..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5 wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`badge ${filter === f ? "badge-orange" : ""}`}
            style={{
              cursor: "pointer", border: "1px solid",
              borderColor: filter === f ? "var(--brand-orange)" : "var(--border-subtle)",
              background: filter === f ? "rgba(249,115,22,0.15)" : "var(--bg-surface)",
              color: filter === f ? "var(--brand-orange)" : "var(--text-muted)",
              padding: "6px 14px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: "auto" }}>
          🔄 Refresh
        </button>
      </div>

      {/* List */}
      {loading && (
        <div className="flex justify-center" style={{ padding: "40px 0" }}>
          <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <div className="glass" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📭</div>
          <h3>No emergencies found</h3>
          <p className="text-secondary text-sm mt-2">
            {filter !== "all" ? `No ${filter} emergencies` : "No emergencies recorded yet"}
          </p>
        </div>
      )}

      <AnimatePresence>
        <div className="flex flex-col gap-3">
          {displayed.map((e) => (
            <EmergencyCard key={e.id} e={e} onAccept={handleAccept} user={user} />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
