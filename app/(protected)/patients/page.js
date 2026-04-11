"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { getInitials, formatDate } from "@/lib/utils";

function LogoutButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (confirming) {
    return (
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button onClick={handleLogout} style={{ fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 500, color: "#a05870", background: "#f9f0f3", border: "0.5px solid #e0b8c8", borderRadius: "8px", padding: "5px 12px", cursor: "pointer" }}>
          אישור
        </button>
        <button onClick={() => setConfirming(false)} style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "#a8a0a8", background: "none", border: "none", cursor: "pointer", padding: "5px" }}>
          ביטול
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", color: "#a8a0a8", display: "flex", alignItems: "center", touchAction: "manipulation" }} aria-label="התנתק">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
      </svg>
    </button>
  );
}

const AVATAR_COLORS = [
  { bg: "#f5e8ee", color: "#a05870" },
  { bg: "#eef6f3", color: "#3a7060" },
];

function deriveClientStatus(sessions) {
  if (!sessions || sessions.length === 0) return null;
  const pastSessions = sessions
    .filter((s) => new Date(s.date) <= new Date())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (pastSessions.length === 0) return null;
  const latest = pastSessions[0];
  const hasNote = Array.isArray(latest.notes) ? latest.notes.length > 0 : !!latest.notes?.id;
  return hasNote ? "completed" : "needs-note";
}

export default function PatientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("alpha");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("patients")
      .select("id, full_name, age, gender, phone, email, chief_complaint, created_at, sessions(id, date, notes(id))")
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        const enriched = (data || []).map((c) => {
          const sessions = c.sessions || [];
          const pastSessions = sessions.filter((s) => new Date(s.date) <= new Date());
          const sorted = [...pastSessions].sort((a, b) => new Date(b.date) - new Date(a.date));
          return {
            ...c,
            session_count: sessions.length,
            last_session_date: sorted[0]?.date || null,
            last_session_status: deriveClientStatus(sessions),
          };
        });
        setClients(enriched);
        setLoading(false);
      });
  }, []);

  const filtered = clients.filter(
    (c) =>
      c.full_name.includes(query) ||
      c.full_name.toLowerCase().includes(query.toLowerCase())
  );

  const sorted =
    sortMode === "alpha"
      ? [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name, "he"))
      : [...filtered].sort((a, b) => {
          if (!b.last_session_date) return -1;
          if (!a.last_session_date) return 1;
          return new Date(b.last_session_date) - new Date(a.last_session_date);
        });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--color-bg)" }}>
      {/* Title */}
      <div style={{ padding: "12px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", direction: "rtl" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 300, color: "#2e2a38" }}>מטופלים</span>
        <LogoutButton />
      </div>

      {/* Search */}
      <div style={{ padding: "10px 16px" }}>
        <input
          className="search-box"
          type="text"
          placeholder="חפש מטופל/ת..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          dir="rtl"
        />
      </div>

      {/* Sort pills */}
      <div className="sort-pills-row">
        <div
          className={`sort-pill ${sortMode === "alpha" ? "active" : "inactive"}`}
          onClick={() => setSortMode("alpha")}
        >
          א–ת
        </div>
        <div
          className={`sort-pill ${sortMode === "recent" ? "active" : "inactive"}`}
          onClick={() => setSortMode("recent")}
        >
          אחרון
        </div>
      </div>

      {/* Client list */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
        {loading ? (
          <div style={{ padding: "16px" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: "56px", borderRadius: "var(--radius-md)", background: "var(--color-border)", opacity: 0.4, marginBottom: "4px" }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "40px", fontSize: "14px" }}>
            {query ? "אין תוצאות" : "אין מטופלים"}
          </div>
        ) : (
          sorted.map((client, index) => {
            const av = AVATAR_COLORS[index % AVATAR_COLORS.length];
            return (
              <div
                key={client.id}
                className="client-row"
                onClick={() => router.push(`/patients/${client.id}`)}
              >
                <div className="client-avatar" style={{ background: av.bg, color: av.color }}>
                  {getInitials(client.full_name)}
                </div>
                <div className="client-info">
                  <span className="client-name">{client.full_name}</span>
                  <span className="client-sub">
                    {client.session_count > 0
                      ? `טיפול ${client.session_count} · ${formatDate(client.last_session_date)}`
                      : "מטופל/ת חדש/ה"}
                  </span>
                </div>
                {client.last_session_status && (
                  <StatusBadge status={client.last_session_status} />
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 19.5-7.5-7.5 7.5-7.5" />
                </svg>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
