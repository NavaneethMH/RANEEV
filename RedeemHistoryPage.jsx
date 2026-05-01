import { useState, useEffect } from "react";
import { fetchRedeemHistory } from "../../api/api";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function RedeemHistoryPage({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    fetchRedeemHistory(user.email)
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [user?.email]);

  return (
    <div className="fade-in">
      <div className="flex items-center gap-3 mb-6" style={{ marginTop: 24 }}>
        <Link to="/profile" className="btn btn-ghost btn-sm">← Back</Link>
        <div>
          <h1 style={{ fontSize: "1.5rem" }}>Coin History</h1>
          <p className="text-xs text-muted">Your rewards and redemptions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: "60px 0" }}>
          <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      ) : history.length === 0 ? (
        <div className="glass" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🪙</div>
          <h3>No records found</h3>
          <p className="text-secondary text-sm mt-2">
            Go respond to emergencies to earn coins!
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="flex flex-col gap-3">
            {history.map((record, i) => (
              <motion.div
                key={record.id}
                className="glass-sm flex items-center justify-between"
                style={{ padding: "16px" }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div>
                  <p className="font-semibold" style={{ fontSize: "0.95rem" }}>{record.description}</p>
                  <p className="text-xs text-muted mt-1">{formatDate(record.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: record.amount > 0 ? "var(--brand-green)" : "var(--brand-red)", fontSize: "1.1rem" }}>
                    {record.amount > 0 ? `+${record.amount}` : record.amount}
                  </p>
                  <p className="text-xs text-muted mt-1">coins</p>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
