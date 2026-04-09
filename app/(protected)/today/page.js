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
  const [statusFilter, setStatusFilter] = useState(null);

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
    const nameMatch = patients.find(
      (p) => p.full_name?.toLowerCase() === event.title?.toLowerCase()
    );
    if (nameMatch) return nameMatch;
    return attendees.length > 0
      ? { id: null, full_name: null, email: attendees[0].email, attendeeName: attendees[0].name }
      : { id: null, full_name: null, email: null };
  };

  // ── Enrich events ─────────────────────────────────────
  const enriched = events.map((event) => {
    if (isBreakEvent(event.title)) return { ...event, _type: "break" };
    if (!event.attendees || event.attendees.length === 0) {
      return { ...event, _type: "block" };
    }
    const patient = matchPatient(event);
    const status = deriveStatus(event, patient, sessionLookup);
    return { ...event, _type: "session", _status: status, _patient: patient };
  });

  // ── Counts ────────────────────────────────────────────
  const sessions = enriched.filter((ev) => ev._type === "session");
  const intakeCount = sessions.filter((ev) => ev._status === "new-client").length;
  const noteCount = sessions.filter((ev) => ev._status === "needs-note").length;
  const doneCount = sessions.filter((ev) => ev._status === "completed").length;
  const totalSessions = sessions.length;
  const actionNeededCount = intakeCount + noteCount;

  // ── Filter ────────────────────────────────────────────
  const filtered = statusFilter
    ? enriched.filter((ev) => {
        if (ev._type !== "session") return false;
        if (statusFilter === "intake") return ev._status === "new-client";
        if (statusFilter === "note") return ev._status === "needs-note";
        if (statusFilter === "done") return ev._status === "completed";
        return true;
      })
    : enriched;

  // ── Group by period ───────────────────────────────────
  const groups = {};
  for (const ev of filtered) {
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

  const toggleFilter = (status) => {
    setStatusFilter((prev) => (prev === status ? null : status));
  };

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
    <div className="today-view">
      {/* ── Sticky Header (§3) ─────────────────────────── */}
      <header className="today-header">
        <div className="today-nav-row">
          <button className="today-chevron" onClick={goToNextDay} aria-label="יום הבא">
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
              <path d="M1.5 1.5L6.5 7L1.5 12.5" stroke="#2a2a35" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="today-center">
            {isToday && <span className="today-eyebrow">היום</span>}
            <div className="today-date">{formatHebDate(selectedDate)}</div>
            {!loading && totalSessions > 0 && (
              <div className="today-subtitle">
                {totalSessions} פגישות{actionNeededCount > 0 ? ` · ${actionNeededCount} דורשות פעולה` : ""}
              </div>
            )}
          </div>
          <button className="today-chevron" onClick={goPrevDay} aria-label="יום קודם">
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
              <path d="M6.5 1.5L1.5 7L6.5 12.5" stroke="#2a2a35" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Filter Pills (§4) ──────────────────────────── */}
      {!loading && (intakeCount > 0 || noteCount > 0 || doneCount > 0) && (
        <div className="today-pills-wrapper">
          <div className="today-pills-row">
            {intakeCount > 0 && (
              <button
                className={`today-pill${statusFilter === "intake" ? " today-pill-active today-pill-intake-active" : ""}`}
                onClick={() => toggleFilter("intake")}
              >
                <span className="today-pill-num" style={{ color: "#4a8a78" }}>{intakeCount}</span>
                <span className="today-pill-label">אינטייק</span>
              </button>
            )}
            {noteCount > 0 && (
              <button
                className={`today-pill${statusFilter === "note" ? " today-pill-active today-pill-note-active" : ""}`}
                onClick={() => toggleFilter("note")}
              >
                <span className="today-pill-num" style={{ color: "#c07088" }}>{noteCount}</span>
                <span className="today-pill-label">סיכום</span>
              </button>
            )}
            {doneCount > 0 && (
              <button
                className={`today-pill${statusFilter === "done" ? " today-pill-active today-pill-done-active" : ""}`}
                onClick={() => toggleFilter("done")}
              >
                <span className="today-pill-num" style={{ color: "#6888a0" }}>{doneCount}</span>
                <span className="today-pill-label">הושלם</span>
              </button>
            )}
          </div>
          {statusFilter && (
            <button className="today-clear-filter" onClick={() => setStatusFilter(null)}>
              נקה סינון ✕
            </button>
          )}
        </div>
      )}

      {/* ── Session List ───────────────────────────────── */}
      <div className="today-session-list">
        {error && <div className="today-error">{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: "60px", borderRadius: "16px", background: "#e8e0d4", opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : filtered.length === 0 && !statusFilter ? (
          <div style={{ textAlign: "center", color: "#b8b0b8", marginTop: "60px", fontSize: "14px", fontFamily: "var(--font-ui)" }}>
            אין תורים ביום זה
          </div>
        ) : filtered.length === 0 && statusFilter ? (
          <div style={{ textAlign: "center", color: "#b8b0b8", marginTop: "60px", fontSize: "14px", fontFamily: "var(--font-ui)" }}>
            אין פגישות מסוג זה
          </div>
        ) : (
          orderedPeriods.map((period) => (
            <div key={period}>
              <div className="today-period-label">{PERIOD_LABELS[period]}</div>
              {groups[period].map((ev) => {
                /* ── Break ─────────────────────────────── */
                if (ev._type === "break") {
                  return (
                    <div className="today-card today-card-break" key={ev.id}>
                      <div className="today-card-row">
                        <div className="today-card-time">{formatTime(ev.start)}</div>
                        <div className="today-card-divider" />
                        <div className="today-card-content">
                          <div className="today-card-name">הפסקה</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                /* ── Block (solo event) ────────────────── */
                if (ev._type === "block") {
                  return (
                    <div className="today-card today-card-block" key={ev.id}>
                      <div className="today-card-row">
                        <div className="today-card-time">{formatTime(ev.start)}</div>
                        <div className="today-card-divider" />
                        <div className="today-card-content">
                          <div className="today-card-name">{ev.title}</div>
                          <div className="today-card-meta">{ev.duration} דק׳</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                /* ── Completed Session (§6) ────────────── */
                if (ev._status === "completed") {
                  return (
                    <div
                      className="today-card-done"
                      key={ev.id}
                      onClick={() => handleCardClick(ev)}
                      style={{ cursor: ev._patient?.id ? "pointer" : "default" }}
                    >
                      <div className="today-done-time">{formatTime(ev.start)}</div>
                      <div className="today-done-divider" />
                      <div className="today-done-body">
                        <div className="today-done-name">{ev._patient?.full_name || ev.title}</div>
                        <div className="today-done-meta">הושלם</div>
                      </div>
                      <div className="today-done-check">
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                          <path d="M1 5L4.5 8.5L11 1.5" stroke="#4a9070" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  );
                }
                /* ── Actionable Session (§5) ───────────── */
                return (
                  <div className="today-card" key={ev.id}>
                    <div className="today-card-row" onClick={() => handleCardClick(ev)} style={{ cursor: "pointer" }}>
                      <div className="today-card-time">{formatTime(ev.start)}</div>
                      <div className="today-card-divider" />
                      <div className="today-card-content">
                        <div className="today-card-name">{ev._patient?.full_name || ev.title}</div>
                        <div className="today-card-meta">{ev.duration} דק׳</div>
                      </div>
                    </div>
                    {ev._status === "new-client" && (
                      <button className="today-cta today-cta-intake" onClick={(e) => { e.stopPropagation(); handleStartIntake(ev); }}>
                        התחל אינטייק
                      </button>
                    )}
                    {ev._status === "needs-note" && (
                      <button className="today-cta today-cta-note" onClick={(e) => { e.stopPropagation(); handleWriteNote(ev); }}>
                        כתוב סיכום
                      </button>
                    )}
                  </div>
                );
              })}
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
