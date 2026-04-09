"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import SessionNoteDrawer from "@/components/SessionNoteDrawer";

// ── Hebrew strings ──────────────────────────────────────
const DAY_NAMES = ["יום א׳","יום ב׳","יום ג׳","יום ד׳","יום ה׳","יום ו׳","שבת"];
const MONTH_NAMES = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];
const PERIOD_LABELS = { morning: "בוקר", afternoon: "צהריים", evening: "ערב" };
const BREAK_KEYWORDS = ["הפסקה", "break"];

// ── Helpers ─────────────────────────────────────────────
function formatHebDate(date) {
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ב${MONTH_NAMES[date.getMonth()]}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function getPeriod(dateStr) {
  const hour = new Date(dateStr).getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0];
  return parts[0][0] + parts[parts.length - 1][0];
}

function isBreakEvent(title) {
  return BREAK_KEYWORDS.some((kw) => title.toLowerCase().includes(kw.toLowerCase()));
}

function deriveStatus(event, patientMatch, sessionLookup) {
  if (!patientMatch?.id) return "new-client";
  const isPast = new Date(event.end) < new Date();
  if (!isPast) return "completed";
  const hasNote = sessionLookup.get(event.id);
  return hasNote ? "completed" : "needs-note";
}

// ── Component ───────────────────────────────────────────
export default function TodayPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [patients, setPatients] = useState([]);
  const [sessionLookup, setSessionLookup] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noteDrawerEvent, setNoteDrawerEvent] = useState(null);

  const isToday = isSameDay(selectedDate, new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const dateStr = toDateStr(selectedDate);

      const [calRes, { data: patientList }, { data: sessionsData }] = await Promise.all([
        fetch(`/api/calendar/today?date=${dateStr}`),
        supabase.from("patients").select("id, full_name, email, chief_complaint"),
        supabase
          .from("sessions")
          .select("id, google_event_id, notes(id)")
          .not("google_event_id", "is", null),
      ]);

      const calData = await calRes.json();
      if (!calRes.ok) {
        setError(calData.error);
        setLoading(false);
        return;
      }

      // Build lookup: google_event_id → hasNote
      // notes is an object (not array) due to unique constraint on session_id
      const lookup = new Map();
      (sessionsData || []).forEach((s) => {
        if (s.google_event_id) {
          const hasNote = Array.isArray(s.notes) ? s.notes.length > 0 : !!s.notes?.id;
          lookup.set(s.google_event_id, hasNote);
        }
      });

      setEvents(calData.events || []);
      setPatients(patientList || []);
      setSessionLookup(lookup);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Patient matching ──────────────────────────────────
  const matchPatient = (event) => {
    const attendees = event.attendees || [];
    for (const att of attendees) {
      const match = patients.find((p) => p.email?.toLowerCase() === att.email);
      if (match) return match;
    }
    // Try name match
    const nameMatch = patients.find(
      (p) => p.full_name?.toLowerCase() === event.title?.toLowerCase()
    );
    if (nameMatch) return nameMatch;
    return attendees.length > 0
      ? { id: null, full_name: null, email: attendees[0].email, attendeeName: attendees[0].name }
      : { id: null, full_name: null, email: null };
  };

  // ── Compute counts ────────────────────────────────────
  let needsNoteCount = 0;
  let newClientCount = 0;
  const enriched = events.map((event) => {
    if (isBreakEvent(event.title)) return { ...event, _type: "break" };
    // Solo event (no other attendees) → non-actionable block
    if (!event.attendees || event.attendees.length === 0) {
      return { ...event, _type: "block" };
    }
    const patient = matchPatient(event);
    const status = deriveStatus(event, patient, sessionLookup);
    if (status === "needs-note") needsNoteCount++;
    if (status === "new-client") newClientCount++;
    return { ...event, _type: "session", _status: status, _patient: patient };
  });

  // ── Group by period ───────────────────────────────────
  const groups = {};
  for (const ev of enriched) {
    const period = getPeriod(ev.start);
    if (!groups[period]) groups[period] = [];
    groups[period].push(ev);
  }
  const orderedPeriods = ["morning", "afternoon", "evening"].filter((p) => groups[p]);

  // ── Navigation ────────────────────────────────────────
  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };
  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const goToToday = () => setSelectedDate(new Date());

  // ── Card handlers ─────────────────────────────────────
  const handleCardClick = (ev) => {
    if (ev._status === "completed" && ev._patient?.id) {
      router.push(`/patients/${ev._patient.id}`);
    } else if (ev._status === "needs-note") {
      handleWriteNote(ev);
    } else if (ev._status === "new-client") {
      handleStartIntake(ev);
    }
  };

  const handleWriteNote = (ev) => {
    setNoteDrawerEvent(ev);
  };

  const handleNoteDrawerClose = () => {
    setNoteDrawerEvent(null);
    fetchData(); // re-fetch to update card status
  };

  const handleStartIntake = (ev) => {
    const att = ev.attendees?.[0];
    const params = new URLSearchParams();
    params.set("name", att?.name || ev.title);
    if (att?.email) params.set("email", att.email);
    if (ev.id) params.set("eventId", ev.id);
    if (ev.start) params.set("date", ev.start);
    const time = formatTime(ev.start);
    if (time) params.set("time", time);
    router.push(`/intake?${params.toString()}`);
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Day Header */}
      <div className="day-header">
        <div className="nav-row">
          <div className="arr" onClick={goToNextDay}>›</div>
          <div className="date-center">
            {isToday && <span className="today-tag">היום</span>}
            <span className="date-main">{formatHebDate(selectedDate)}</span>
          </div>
          <div className="arr" onClick={goPrevDay}>‹</div>
        </div>

        <div className="meta-pills">
          {needsNoteCount > 0 && (
            <span className="pill pill-note">{needsNoteCount} נדרשים סיכום</span>
          )}
          {newClientCount > 0 && (
            <span className="pill pill-new">{newClientCount} לקוחות חדשים</span>
          )}
          {!isToday && (
            <span className="pill pill-jump" onClick={goToToday}>חזרה להיום ←</span>
          )}
        </div>
      </div>

      {/* Session List */}
      <div className="session-list">
        {error && (
          <div style={{ background: "var(--color-poppy-tint)", border: "1px solid var(--color-poppy-mid)", borderRadius: "var(--radius-md)", padding: "12px", marginBottom: "12px", fontSize: "12px", color: "var(--color-poppy-text)" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: "60px", borderRadius: "var(--radius-md)", background: "var(--color-border)", opacity: 0.5 }} />
            ))}
          </div>
        ) : enriched.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "60px", fontSize: "14px" }}>
            אין תורים ביום זה
          </div>
        ) : (
          orderedPeriods.map((period) => (
            <div key={period}>
              <div className="period-label">{PERIOD_LABELS[period]}</div>
              {groups[period].map((ev) => (
                <div className="session-row" key={ev.id}>
                  <div className="time-col">
                    <div className="time-value">{formatTime(ev.start)}</div>
                  </div>

                  {ev._type === "break" ? (
                    <div className="break-slot">
                      <span className="break-label">הפסקה</span>
                    </div>
                  ) : ev._type === "block" ? (
                    <div className="block-slot">
                      <div className="block-title">{ev.title}</div>
                      <div className="block-meta">{ev.duration} דק׳</div>
                    </div>
                  ) : (
                    <div
                      className={`session-card ${
                        ev._status === "completed" ? "card-completed" :
                        ev._status === "needs-note" ? "card-needs-note" :
                        "card-new-client"
                      }`}
                      style={{ padding: 0, overflow: "hidden" }}
                    >
                      {/* Top section — name + badge, always tappable */}
                      <div
                        onClick={() => handleCardClick(ev)}
                        style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      >
                        <span className="patient-name">
                          {ev._patient?.full_name || ev.title}
                        </span>
                        <span className="status-badge">
                          {ev._status === "completed" ? "הושלם" :
                           ev._status === "needs-note" ? "נדרש סיכום" :
                           "לקוח חדש"}
                        </span>
                      </div>

                      {/* Bottom strip — only for actionable states */}
                      {ev._status === "needs-note" && (
                        <div
                          onClick={(e) => { e.stopPropagation(); handleWriteNote(ev); }}
                          style={{ borderTop: "0.5px solid #F5C4A8", background: "#FFFFFF", padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#C93E2C", fontSize: "11px", fontWeight: 500 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                            </svg>
                            <span>כתוב סיכום טיפול</span>
                          </div>
                          <span style={{ color: "rgba(197, 62, 44, 0.6)", fontSize: "14px" }}>←</span>
                        </div>
                      )}
                      {ev._status === "new-client" && (
                        <div
                          onClick={(e) => { e.stopPropagation(); handleStartIntake(ev); }}
                          style={{ borderTop: "0.5px solid #EDEAE4", background: "#FFFFFF", padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#282B30", fontSize: "11px", fontWeight: 500 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                            </svg>
                            <span>התחל אינטייק</span>
                          </div>
                          <span style={{ color: "rgba(40, 43, 48, 0.6)", fontSize: "14px" }}>←</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <SessionNoteDrawer
        open={!!noteDrawerEvent}
        onClose={handleNoteDrawerClose}
        event={noteDrawerEvent}
        patient={noteDrawerEvent?._patient}
      />
    </div>
  );
}
