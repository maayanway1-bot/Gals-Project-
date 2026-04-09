"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

const AVATAR_COLORS = [
  { bg: "#FFF3EC", color: "#D4845A" },
  { bg: "#EAF0E6", color: "#4A5E4A" },
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0];
  return parts[0][0] + parts[parts.length - 1][0];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

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
      <div style={{ padding: "12px 16px 0", fontFamily: "var(--font-display)", fontSize: "20px", color: "var(--color-text-primary)" }}>
        לקוחות
      </div>

      {/* Search */}
      <div style={{ padding: "10px 16px" }}>
        <input
          className="search-box"
          type="text"
          placeholder="חפש לקוח..."
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
            {query ? "אין תוצאות" : "אין לקוחות"}
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
                      : "לקוח חדש"}
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
