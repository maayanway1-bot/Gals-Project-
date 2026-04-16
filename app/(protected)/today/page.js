"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import SessionNoteDrawer from "@/components/SessionNoteDrawer";
import CalendarNavModal from "@/components/CalendarNavModal";
import CalendarNavIcon from "@/components/CalendarNavIcon";
import MorningSetupModal from "@/components/MorningSetupModal";
import InvoiceFlowSheet from "@/components/InvoiceFlowSheet";
import Toast, { showToast } from "@/components/Toast";
import { formatHebDate, formatTime, DAY_NAMES } from "@/lib/utils";

const PERIOD_LABELS = { morning: "בוקר", afternoon: "צהריים", evening: "ערב" };
const BREAK_KEYWORDS = ["הפסקה", "break"];

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

function isBreakEvent(title) {
  return BREAK_KEYWORDS.some((kw) => title.toLowerCase().includes(kw.toLowerCase()));
}

function deriveStatus(event, patientMatch, sessionLookup, invoiceLookup) {
  if (!patientMatch?.id) return "new-client";
  const hasNote = sessionLookup.get(event.id);
  if (!hasNote) return "needs-note";
  const inv = invoiceLookup.get(event.id);
  if (inv?.invoiceSent) return "completed";
  if (inv?.paid) return "needs-invoice";
  return "needs-payment";
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
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Invoice flow state
  const [morningModalOpen, setMorningModalOpen] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState(null); // { patientId, sessionId, price }
  const [invoiceLookup, setInvoiceLookup] = useState(new Map()); // google_event_id → { invoiceSent, paid, sessionId }
  const [sendingInvoice, setSendingInvoice] = useState(null); // sessionId being sent
  const [suggestedPrice, setSuggestedPrice] = useState(null);
  const [invoiceFlowOpen, setInvoiceFlowOpen] = useState(false);
  const invoiceFlowOpenRef = useRef(false); // mirrors invoiceFlowOpen — safe to read inside async callbacks
  // Wrapper that keeps the ref and state in sync
  const setInvoiceFlowOpenSync = useCallback((val) => {
    invoiceFlowOpenRef.current = val;
    setInvoiceFlowOpen(val);
  }, []);
  const [invoiceFlowEvent, setInvoiceFlowEvent] = useState(null); // event for the flow sheet
  const [invoiceFlowInitialStep, setInvoiceFlowInitialStep] = useState("confirm");
  const [sendResult, setSendResult] = useState(null); // { success, invoiceId, price, warning }
  const [practitionerName, setPractitionerName] = useState(null);

  const isToday = isSameDay(selectedDate, new Date());

  // Derive unique dates that have sessions (for calendar dots)
  const sessionDates = useMemo(
    () => events.map((ev) => new Date(ev.start)),
    [events]
  );

  // ── Pull-to-refresh ──────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const listRef = useRef(null);

  const PULL_THRESHOLD = 60;

  const handleTouchStart = useCallback((e) => {
    const el = listRef.current;
    if (el && el.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling.current || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      // Dampen the pull (feels more natural)
      setPullDistance(Math.min(delta * 0.5, 100));
    } else {
      isPulling.current = false;
      setPullDistance(0);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing]);

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
          .select("id, google_event_id, paid, invoice_sent, invoice_id, price, notes(id)")
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
      const invLookup = new Map();
      (sessionsData || []).forEach((s) => {
        if (s.google_event_id) {
          const hasNote = Array.isArray(s.notes) ? s.notes.length > 0 : !!s.notes?.id;
          lookup.set(s.google_event_id, hasNote);
          invLookup.set(s.google_event_id, {
            sessionId: s.id,
            paid: !!s.paid,
            invoiceSent: !!s.invoice_sent,
            price: s.price,
          });
        }
      });

      setEvents(calData.events || []);
      setPatients(patientList || []);
      setSessionLookup(lookup);
      setInvoiceLookup(invLookup);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Trigger refresh when pull completes
  useEffect(() => {
    if (!refreshing) return;
    fetchData().then(() => {
      setRefreshing(false);
      setPullDistance(0);
    });
  }, [refreshing, fetchData]);

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
    const status = deriveStatus(event, patient, sessionLookup, invoiceLookup);
    return { ...event, _type: "session", _status: status, _patient: patient };
  });

  // ── Counts ────────────────────────────────────────────
  const sessions = enriched.filter((ev) => ev._type === "session");
  const intakeCount = sessions.filter((ev) => ev._status === "new-client").length;
  const noteCount = sessions.filter((ev) => ev._status === "needs-note").length;
  const paymentCount = sessions.filter((ev) => ev._status === "needs-payment").length;
  const invoiceCount = sessions.filter((ev) => ev._status === "needs-invoice").length;
  const doneCount = sessions.filter((ev) => ev._status === "completed").length;
  const totalSessions = sessions.length;
  const actionNeededCount = intakeCount + noteCount + paymentCount + invoiceCount;

  // ── Filter ────────────────────────────────────────────
  const filtered = statusFilter
    ? enriched.filter((ev) => {
        if (ev._type !== "session") return false;
        if (statusFilter === "intake") return ev._status === "new-client";
        if (statusFilter === "note") return ev._status === "needs-note";
        if (statusFilter === "payment") return ev._status === "needs-payment" || ev._status === "needs-invoice";
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
    } else if (ev._status === "needs-payment" && ev._patient?.id) {
      router.push(`/patients/${ev._patient.id}`);
    } else if (ev._status === "needs-invoice" && ev._patient?.id) {
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

  // ── Payment flow ───────────────────────────────────────
  const handleMarkAsPaid = async (ev) => {
    const invInfo = invoiceLookup.get(ev.id);
    if (!invInfo?.sessionId || !ev._patient?.id) return;

    // Mark as paid in DB first
    const marked = await doMarkPaid(ev);
    if (!marked) return;

    // Check if patient has email (required for invoice)
    if (!ev._patient?.email) {
      showToast("סומן כשולם. לא קיים מייל עבור מטופל זה — לא ניתן לשלוח חשבונית.", "error");
      return;
    }

    // Check credentials before opening the flow
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("morning_api_key_id, full_name, clinic_name")
      .eq("id", user.id)
      .single();

    if (!practitioner?.morning_api_key_id) {
      setInvoiceTarget({
        patientId: ev._patient.id,
        sessionId: invInfo.sessionId,
        price: invInfo.price,
        eventId: ev.id,
      });
      setMorningModalOpen(true);
      return;
    }

    // Fetch suggested price if needed
    if (!invInfo.price) {
      await fetchSuggestedPrice(ev._patient.id);
    }

    setPractitionerName(practitioner.clinic_name || practitioner.full_name || null);
    setSendResult(null);
    setInvoiceFlowInitialStep("confirm");
    setInvoiceFlowEvent(ev);
    setInvoiceFlowOpenSync(true);
  };

  const handleFlowJustMark = () => {
    // Already marked as paid in handleMarkAsPaid — just close
    setInvoiceFlowOpenSync(false);
    setInvoiceFlowEvent(null);
  };

  const handleFlowSendInvoice = async (priceValue) => {
    const ev = invoiceFlowEvent;
    if (!ev) return;
    const invInfo = invoiceLookup.get(ev.id);
    if (!invInfo?.sessionId || !ev._patient?.id) return;
    await doSendInvoice(ev._patient.id, invInfo.sessionId, priceValue, ev.id);
  };

  const handleFlowClose = () => {
    setInvoiceFlowOpenSync(false);
    setInvoiceFlowEvent(null);
    setSendResult(null);
  };

  // Returns true on success, false on failure.
  const doMarkPaid = async (ev) => {
    const invInfo = invoiceLookup.get(ev.id);
    if (!invInfo?.sessionId) return false;

    const supabase = createClient();
    const { error } = await supabase
      .from("sessions")
      .update({ paid: true })
      .eq("id", invInfo.sessionId);

    if (error) {
      showToast("שגיאה בסימון התשלום. יש לנסות שוב.", "error");
      return false;
    }

    // Update local state only after confirmed DB write
    setInvoiceLookup((prev) => {
      const next = new Map(prev);
      const existing = next.get(ev.id) || {};
      next.set(ev.id, { ...existing, paid: true });
      return next;
    });
    return true;
  };

  // ── Invoice flow ──────────────────────────────────────
  const fetchSuggestedPrice = async (patientId) => {
    const supabase = createClient();
    // 1. Check this patient's last session price
    const { data: patientSession } = await supabase
      .from("sessions")
      .select("price")
      .eq("patient_id", patientId)
      .not("price", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (patientSession?.price) {
      setSuggestedPrice(patientSession.price);
      return;
    }

    // 2. Fall back to practitioner's most recent invoiced price
    const { data: anySession } = await supabase
      .from("sessions")
      .select("price")
      .not("price", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    setSuggestedPrice(anySession?.price || null);
  };

  const handleSendInvoice = async (ev) => {
    const invInfo = invoiceLookup.get(ev.id);
    if (!invInfo?.sessionId || !ev._patient?.id) return;

    // Check if patient has email
    if (!ev._patient?.email) {
      showToast("לא קיים מייל עבור מטופל זה. יש להוסיף מייל בפרופיל המטופל.", "error");
      return;
    }

    // Check if practitioner has Morning credentials
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("morning_api_key_id, full_name, clinic_name")
      .eq("id", user.id)
      .single();

    if (!practitioner?.morning_api_key_id) {
      setInvoiceTarget({
        patientId: ev._patient.id,
        sessionId: invInfo.sessionId,
        price: invInfo.price,
        eventId: ev.id,
      });
      setMorningModalOpen(true);
      return;
    }

    setPractitionerName(practitioner.clinic_name || practitioner.full_name || null);
    setSendResult(null);

    // Always show price step — pre-populated if price exists, otherwise fetch suggestion
    if (!invInfo.price) {
      await fetchSuggestedPrice(ev._patient.id);
    }
    setInvoiceFlowInitialStep("price");
    setInvoiceFlowEvent(ev);
    setInvoiceFlowOpenSync(true);
  };

  const handleMorningSaved = async () => {
    setMorningModalOpen(false);
    if (!invoiceTarget) return;
    // After saving credentials, open the invoice flow sheet
    if (!invoiceTarget.price) {
      await fetchSuggestedPrice(invoiceTarget.patientId);
    }
    // Re-fetch practitioner name
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prac } = await supabase
      .from("practitioners")
      .select("full_name, clinic_name")
      .eq("id", user.id)
      .single();
    setPractitionerName(prac?.clinic_name || prac?.full_name || null);

    // Find the event that matches this invoiceTarget
    const ev = enriched.find((e) => e.id === invoiceTarget.eventId);
    setSendResult(null);
    setInvoiceFlowInitialStep("price");
    setInvoiceFlowEvent(ev || null);
    setInvoiceFlowOpenSync(true);
  };

  const doSendInvoice = async (patientId, sessionId, price, eventId) => {
    setSendingInvoice(sessionId);
    setSendResult(null);
    try {
      const res = await fetch("/api/morning/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, sessionId, price }),
      });

      if (res.ok || res.status === 409) {
        const data = await res.json().catch(() => null);
        const isDuplicate = res.status === 409;
        // Update local state so card reflects sent status
        setInvoiceLookup((prev) => {
          const next = new Map(prev);
          const existing = next.get(eventId) || {};
          next.set(eventId, { ...existing, sessionId, invoiceSent: true, price });
          return next;
        });
        // If flow sheet is open, show confirmation step; otherwise toast
        if (invoiceFlowOpenRef.current) {
          setSendResult({
            success: true,
            invoiceId: data?.invoiceId,
            price,
            // Surface the duplicate-invoice message as a warning so the user understands
            warning: isDuplicate ? (data?.error || "החשבונית כבר נשלחה קודם לכן.") : (data?.warning || null),
          });
        } else {
          const msg = isDuplicate
            ? (data?.error || "החשבונית כבר נשלחה קודם לכן.")
            : (data?.warning || "החשבונית נשלחה בהצלחה");
          showToast(msg, isDuplicate || data?.warning ? "error" : "success");
        }
      } else {
        const data = await res.json();
        if (data.error === "MISSING_CREDENTIALS") {
          setInvoiceTarget({ patientId, sessionId, price, eventId });
          setInvoiceFlowOpenSync(false);
          setMorningModalOpen(true);
        } else {
          showToast(data.error || "שגיאה בשליחת החשבונית", "error");
          setInvoiceFlowOpenSync(false);
        }
      }
    } catch {
      showToast("לא ניתן להתחבר למורנינג כרגע. יש לנסות שוב.", "error");
      setInvoiceFlowOpenSync(false);
    }
    setSendingInvoice(null);
    setInvoiceTarget(null);
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
            <button
              className={`cal-trigger${calendarOpen ? " cal-trigger-open" : ""}`}
              onClick={() => setCalendarOpen(true)}
              aria-label="פתח לוח שנה"
            >
              <span className="cal-trigger-label">
                {isToday ? "היום" : DAY_NAMES[selectedDate.getDay()]}
              </span>
              <CalendarNavIcon size={14} color="#c07088" />
            </button>
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
      {!loading && (intakeCount > 0 || noteCount > 0 || doneCount > 0 || paymentCount > 0 || invoiceCount > 0) && (
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
            {(paymentCount + invoiceCount) > 0 && (
              <button
                className={`today-pill${statusFilter === "payment" ? " today-pill-active today-pill-payment-active" : ""}`}
                onClick={() => toggleFilter("payment")}
              >
                <span className="today-pill-num" style={{ color: "#6a4888" }}>{paymentCount + invoiceCount}</span>
                <span className="today-pill-label">תשלום</span>
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
      <div
        className="today-session-list"
        ref={listRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="ptr-indicator"
          style={{
            height: pullDistance > 0 ? `${pullDistance}px` : 0,
            opacity: pullDistance > 0 ? Math.min(pullDistance / PULL_THRESHOLD, 1) : 0,
          }}
        >
          <div className={`ptr-spinner${refreshing ? " ptr-spinning" : ""}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        </div>

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
                /* ── Completed Session — invoice sent (GREEN) ── */
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
                /* ── Actionable Session — all non-completed states ── */
                {
                  const invInfo = invoiceLookup.get(ev.id);
                  const isSending = sendingInvoice === invInfo?.sessionId;

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
                      {ev._status === "needs-payment" && (
                        <button className="today-cta today-cta-payment" onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(ev); }}>
                          סמן כשולם
                        </button>
                      )}
                      {ev._status === "needs-invoice" && (
                        <button
                          className="today-cta today-cta-invoice"
                          onClick={(e) => { e.stopPropagation(); handleSendInvoice(ev); }}
                          disabled={isSending}
                        >
                          {isSending ? "שולח..." : "שלח חשבונית"}
                        </button>
                      )}
                    </div>
                  );
                }
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

      <CalendarNavModal
        isOpen={calendarOpen}
        currentDate={selectedDate}
        onClose={() => setCalendarOpen(false)}
        onSelectDate={setSelectedDate}
        sessionDates={sessionDates}
      />

      <MorningSetupModal
        open={morningModalOpen}
        onClose={() => { setMorningModalOpen(false); setInvoiceTarget(null); }}
        onSaved={handleMorningSaved}
      />

      <InvoiceFlowSheet
        open={invoiceFlowOpen}
        onClose={handleFlowClose}
        onJustMark={handleFlowJustMark}
        onSendInvoice={handleFlowSendInvoice}
        initialStep={invoiceFlowInitialStep}
        defaultPrice={invoiceFlowEvent ? (invoiceLookup.get(invoiceFlowEvent.id)?.price || suggestedPrice) : suggestedPrice}
        patientName={invoiceFlowEvent?._patient?.full_name || ""}
        patientEmail={invoiceFlowEvent?._patient?.email || ""}
        practitionerName={practitionerName}
        sessionDate={invoiceFlowEvent ? formatHebDate(new Date(invoiceFlowEvent.start)) : ""}
        sending={!!sendingInvoice}
        sendResult={sendResult}
      />

      <Toast />
    </div>
  );
}
