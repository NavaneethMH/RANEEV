import { useState, useEffect } from "react";
import { fetchVolunteerHistory } from "../../api/api";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function VolunteerHistoryPage({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchVolunteerHistory(user.id)
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className="fade-in">
      <div className="flex items-center gap-3 mb-6" style={{ marginTop: 24 }}>
        <Link to="/profile" className="btn btn-ghost btn-sm">← Back</Link>
        <div>
          <h1 style={{ fontSize: "1.5rem" }}>Session History</h1>
          <p className="text-xs text-muted">Cases helped & coins earned</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: "60px 0" }}>
          <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      ) : history.length === 0 ? (
        <div className="glass" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📋</div>
          <h3>No sessions yet</h3>
          <p className="text-secondary text-sm mt-2">
            Go live to receive and accept emergencies!
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="flex flex-col gap-3">
            {history.map((record, i) => (
              <motion.div
                key={record.response_id}
                className="glass-sm flex items-center justify-between"
                style={{ padding: "16px" }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div>
                  <div className="flex flex-row items-center gap-2 mb-1">
                    <p className="font-semibold" style={{ fontSize: "0.95rem" }}>{record.emergency_type} Emergency</p>
                    <span className="badge" style={{ background: record.severity >= 8 ? "var(--brand-red)" : "var(--brand-amber)", color: "white", padding: "2px 6px", fontSize: "0.6rem" }}>
                      Sev {record.severity}/10
                    </span>
                  </div>
                  <p className="text-xs text-muted">{formatDate(record.date)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
