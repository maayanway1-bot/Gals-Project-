"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ClientBanner from "@/components/ClientBanner";
import StatusBadge from "@/components/StatusBadge";
import TopBar from "@/components/TopBar";
import SessionNoteDrawer from "@/components/SessionNoteDrawer";

const PAGE_SIZE = 10;

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0];
  return parts[0][0] + parts[parts.length - 1][0];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

function formatMonthYear(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntil(dateStr) {
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "היום";
  if (days === 1) return "מחר";
  return `בעוד ${days} ימים`;
}

export default function ClientProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  // Client data (fast — Supabase only)
  const [client, setClient] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [clientReady, setClientReady] = useState(false);

  // Upcoming from Google Calendar (slow — loaded in background)
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);

  // Past sessions — simple load (not paginated until we have enough data to need it)
  const [pastSessions, setPastSessions] = useState([]);
  const [pastLoading, setPastLoading] = useState(true);

  // Note drawer
  const [noteDrawerSession, setNoteDrawerSession] = useState(null);

  // Step 1: Load client + past sessions immediately (fast)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: pat }, { data: sess, count }] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id).single(),
        supabase
          .from("sessions")
          .select("id, date, session_number, duration, google_event_id, notes(id, note_type, created_at)", { count: "exact" })
          .eq("patient_id", id)
          .lte("date", new Date().toISOString())
          .order("date", { ascending: false })
          .range(0, 49),
      ]);

      if (cancelled) return;
      setClient(pat);
      setSessionCount(count || 0);
      setPastSessions(sess || []);
      setPastLoading(false);
      setClientReady(true);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // Step 2: Load upcoming from calendar in background (slow, non-blocking)
  useEffect(() => {
    if (!client?.email) return;
    let cancelled = false;
    setUpcomingLoading(true);
    fetch(`/api/calendar/patient?email=${encodeURIComponent(client.email)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled) {
          if (data?.events) setUpcomingEvents(data.events);
          setUpcomingLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setUpcomingLoading(false); });
    return () => { cancelled = true; };
  }, [client?.email]);

  if (!clientReady || !client) {
    return (
      <div style={{ padding: "16px" }}>
        <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: "var(--color-border)", opacity: 0.4 }} />
      </div>
    );
  }

  // Cap upcoming at 3
  const upcoming = upcomingEvents.slice(0, 3);

  // Number past sessions for display
  const numberedPast = pastSessions.map((s, i) => ({
    ...s,
    number: sessionCount - i,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--color-bg)" }}>
      <TopBar
        title=""
        onBack={() => router.push("/patients")}
        backLabel="מטופלים"
        rightLabel=""
        onRight={() => {}}
        rightDisabled
      />

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
        <ClientBanner
          variant="profile"
          clientName={client.full_name}
          sessionLabel={`${sessionCount} טיפולים · מ${formatMonthYear(client.created_at)}`}
          avatarContent={getInitials(client.full_name)}
          tag={sessionCount > 0 ? "פעילה" : "לא פעילה"}
          tagStyle="sage"
        />

        {/* פרטי המטופל/ת */}
        <div className="patient-details-card">
          <div className="pd-header">
            <span className="pd-title">פרטי המטופל/ת</span>
            <span className="pd-date">{formatDate(client.created_at)}</span>
          </div>
          <div className="pd-grid">
            <div>
              <div className="pd-field-label">גיל</div>
              <div className="pd-field-val">{client.age || "—"}</div>
            </div>
            <div>
              <div className="pd-field-label">מגדר</div>
              <div className="pd-field-val">{client.gender === "female" ? "אישה" : client.gender === "male" ? "גבר" : "—"}</div>
            </div>
            <div>
              <div className="pd-field-label">טלפון</div>
              <div className="pd-field-val" dir="ltr">{client.phone || "—"}</div>
            </div>
            <div>
              <div className="pd-field-label">אימייל</div>
              <div className="pd-field-val" dir="ltr" style={{ fontSize: "10px" }}>{client.email || "—"}</div>
            </div>
          </div>
          {client.chief_complaint && (
            <div className="pd-complaint">
              <span className="pd-complaint-label">תלונה עיקרית</span>
              <span className="pd-complaint-val">{client.chief_complaint}</span>
            </div>
          )}
        </div>

        {/* Upcoming sessions — max 3 */}
        {upcomingLoading && (
          <div style={{ padding: "12px 14px 0" }}>
            <div className="section-title" style={{ marginBottom: "8px" }}>עתידי</div>
            {[...Array(2)].map((_, i) => (
              <div key={i} style={{ height: "52px", borderRadius: "var(--radius-md)", background: "var(--color-peach-tint)", opacity: 0.5, marginBottom: "5px", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        )}
        {!upcomingLoading && upcoming.length > 0 && (
          <div style={{ padding: "12px 14px 0" }}>
            <div className="section-title" style={{ marginBottom: "8px" }}>עתידי</div>
            {upcoming.map((ev) => (
              <div key={ev.id} className="session-row-upcoming">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "14px", color: "var(--color-text-primary)" }}>
                    {formatDate(ev.start)}
                  </span>
                  <StatusBadge status="upcoming" />
                </div>
                <div style={{ fontSize: "11px", color: "#3a7060", marginTop: "2px" }}>
                  {daysUntil(ev.start)}{ev.duration ? ` · ${ev.duration} דק׳` : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past sessions */}
        <div style={{ padding: "12px 14px 0" }}>
          <div className="section-title" style={{ marginBottom: "8px" }}>היסטוריית טיפולים</div>
          {pastLoading ? (
            <div style={{ textAlign: "center", padding: "12px", color: "var(--color-text-muted)", fontSize: 12 }}>
              טוען...
            </div>
          ) : pastSessions.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "20px 0", fontSize: "13px" }}>
              אין טיפולים קודמים
            </div>
          ) : (
            <>
              {numberedPast.map((s) => {
                const note = Array.isArray(s.notes) ? s.notes[0] : s.notes;
                const isIntake = note?.note_type === "intake";
                const hasNote = !!note?.id;
                const status = isIntake ? "intake" : hasNote ? "completed" : "needs-note";

                return (
                  <div
                    key={s.id}
                    className={`session-row-past ${status === "completed" ? "status-completed" : status === "needs-note" ? "status-needs-note" : ""}`}
                    style={isIntake ? { opacity: 0.45, overflow: "hidden", padding: 0 } : { overflow: "hidden", padding: 0 }}
                  >
                    {/* Top section — session info, tappable to view note */}
                    <div
                      onClick={!isIntake && hasNote ? () => router.push(`/patients/${id}/sessions/${s.id}/view`) : undefined}
                      style={{ padding: "10px 12px", cursor: !isIntake && hasNote ? "pointer" : "default" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "14px", color: "var(--color-text-primary)" }}>
                          טיפול {s.number}
                        </span>
                        <StatusBadge status={status} />
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                        {formatDate(s.date)}
                      </div>
                    </div>

                    {/* Bottom strip — write note action */}
                    {status === "needs-note" && (
                      <div
                        onClick={() => setNoteDrawerSession(s)}
                        style={{ borderTop: "0.5px solid #e0b8c8", background: "#f9f0f3", padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderRadius: "0 0 16px 16px" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#a05870", fontSize: "11px", fontWeight: 500 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                          <span>כתוב סיכום טיפול</span>
                        </div>
                        <span style={{ color: "rgba(160, 88, 112, 0.6)", fontSize: "14px" }}>←</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {pastSessions.length >= 50 && (
                <div style={{ textAlign: "center", padding: "12px", color: "#B8B4B0", fontSize: 11 }}>
                  מציג 50 טיפולים אחרונים
                </div>
              )}

              {pastSessions.length < 50 && (
                <div style={{ textAlign: "center", padding: "12px", color: "#B8B4B0", fontSize: 11 }}>
                  · סוף הרשימה ·
                </div>
              )}
            </>
          )}
        </div>

        {/* Full view ghost pill */}
        <div className="fullview-footer">
          <div className="fullview-btn" onClick={() => router.push(`/patients/${id}/full`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <span>תצוגת תיק מלאה</span>
          </div>
        </div>
      </div>

      {/* Session Note Drawer */}
      <SessionNoteDrawer
        open={!!noteDrawerSession}
        onClose={() => {
          setNoteDrawerSession(null);
          // Re-fetch past sessions to update status
          const supabase2 = supabase;
          supabase2
            .from("sessions")
            .select("id, date, session_number, duration, google_event_id, notes(id, note_type, created_at)", { count: "exact" })
            .eq("patient_id", id)
            .lte("date", new Date().toISOString())
            .order("date", { ascending: false })
            .range(0, 49)
            .then(({ data, count }) => {
              setPastSessions(data || []);
              setSessionCount(count || 0);
            });
        }}
        event={noteDrawerSession ? { id: noteDrawerSession.google_event_id, start: noteDrawerSession.date } : null}
        patient={client}
        sessionNumber={noteDrawerSession?.number}
        existingSessionId={noteDrawerSession?.id}
      />
    </div>
  );
}
