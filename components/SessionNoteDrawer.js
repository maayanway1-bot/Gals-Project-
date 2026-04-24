"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/Toast";
import TopBar from "@/components/TopBar";
import ClientBanner from "@/components/ClientBanner";
import FormTextarea from "@/components/FormTextarea";
import PhotoAttachment from "@/components/PhotoAttachment";
import FormulaField from "@/components/FormulaField";
import SectionNumber from "@/components/SectionNumber";
import { getInitials, formatTime, DAY_NAMES, uploadPhoto } from "@/lib/utils";

function formatHebDate(dateStr) {
  const d = new Date(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default function SessionNoteDrawer({ open, onClose, event, patient, sessionNumber, existingSessionId }) {
  const supabase = createClient();

  const [clientReport, setClientReport] = useState("");
  const [tongueAndPulse, setTongueAndPulse] = useState("");
  const [treatmentDone, setTreatmentDone] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [homework, setHomework] = useState("");
  const [selectedFormulas, setSelectedFormulas] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Reset state when drawer opens with new event
  useEffect(() => {
    if (open && event) {
      setClientReport("");
      setTongueAndPulse("");
      setTreatmentDone("");
      setTreatmentPlan("");
      setHomework("");
      setSelectedFormulas([]);
      setPhotos([]);
      setExistingPhotoUrls([]);
      setSaving(false);
      setSessionId(null);

      // Check if session already exists for this event
      async function loadExisting() {
        if (!existingSessionId && (!event.id || !patient?.id)) return;

        let query = supabase
          .from("sessions")
          .select("id, notes(id, client_report, tongue_and_pulse, treatment_done, treatment_plan, homework, formulas, photo_urls)");

        if (existingSessionId) {
          query = query.eq("id", existingSessionId);
        } else {
          query = query.eq("google_event_id", event.id);
        }

        const { data: existingSession } = await query.maybeSingle();

        if (existingSession) {
          setSessionId(existingSession.id);
          const note = Array.isArray(existingSession.notes) ? existingSession.notes[0] : existingSession.notes;
          if (note) {
            setClientReport(note.client_report || "");
            setTongueAndPulse(note.tongue_and_pulse || "");
            setTreatmentDone(note.treatment_done || "");
            setTreatmentPlan(note.treatment_plan || "");
            setHomework(note.homework || "");
            setSelectedFormulas(note.formulas || []);
            setExistingPhotoUrls(note.photo_urls || []);
          }
        }
      }
      loadExisting();
    }
  }, [open, event?.id, patient?.id, existingSessionId]);

  // --- Dictation state ---
  const [dictationState, setDictationState] = useState("idle"); // idle | recording | paused | processing | done | error
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [highlightedFields, setHighlightedFields] = useState(new Set());
  const [showAiHint, setShowAiHint] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const streamRef = useRef(null);
  const wakeLockRef = useRef(null);
  const lastBlobRef = useRef(null);
  const formulaPresetsRef = useRef([]);

  // Load formula presets for AI context
  useEffect(() => {
    async function loadPresets() {
      const { data } = await supabase
        .from("formula_presets")
        .select("name")
        .eq("is_deleted", false);
      if (data) formulaPresetsRef.current = data.map((p) => p.name);
    }
    loadPresets();
  }, []);

  // Reset dictation state when drawer opens
  useEffect(() => {
    if (open) {
      setDictationState("idle");
      setElapsedSeconds(0);
      setShowAiHint(false);
      setHighlightedFields(new Set());
    }
  }, [open]);

  // Timer for recording
  useEffect(() => {
    if (dictationState === "recording") {
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);
        if (elapsedRef.current >= 240) {
          stopRecording();
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dictationState]);

  // Visibility change handler — pause when app goes to background
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden" && dictationState === "recording") {
        pauseRecording();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [dictationState]);

  async function acquireWakeLock() {
    try {
      if (navigator.wakeLock) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch { /* fail silently */ }
  }

  function releaseWakeLock() {
    try {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    } catch { /* fail silently */ }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(1000); // collect chunks every second
      elapsedRef.current = 0;
      setElapsedSeconds(0);
      setDictationState("recording");
      setShowAiHint(false);
      acquireWakeLock();
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        showToast("לא ניתן לגשת למיקרופון — בדקי הגדרות הרשאות", "error");
      } else {
        showToast("לא ניתן להפעיל את המיקרופון — נסי שוב", "error");
      }
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setDictationState("paused");
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setDictationState("recording");
    }
  }

  async function stopRecording() {
    releaseWakeLock();
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    return new Promise((resolve) => {
      const originalOnStop = recorder.onstop;
      recorder.onstop = (e) => {
        originalOnStop?.(e);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });

        if (blob.size < 1000 || elapsedRef.current < 1) {
          showToast("ההקלטה קצרה מדי — נסי שוב", "error");
          setDictationState("idle");
          resolve();
          return;
        }

        setDictationState("processing");
        sendToApi(blob).then(resolve);
      };
      recorder.stop();
    });
  }

  async function sendToApi(blob) {
    lastBlobRef.current = blob;
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("chiefComplaint", patient?.chief_complaint || "");
      formData.append("formulas", JSON.stringify(formulaPresetsRef.current));

      const res = await fetch("/api/ai/dictate-note", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[dictation] API error:", res.status, errBody);
        throw new Error(errBody.error || "API error");
      }

      const data = await res.json();
      populateFields(data);
      lastBlobRef.current = null; // success — discard audio
      setDictationState("done");
      setShowAiHint(true);
    } catch (err) {
      console.error("[dictation] Failed:", err);
      showToast("לא הצלחנו לעבד את ההקלטה — לחצי לנסות שוב", "error");
      setDictationState("error"); // keep blob for retry
    }
  }

  async function retryDictation() {
    if (!lastBlobRef.current) return;
    setDictationState("processing");
    await sendToApi(lastBlobRef.current);
  }

  function populateFields(data) {
    const newHighlights = new Set();

    const fieldMap = [
      { key: "client_report", value: data.client_report, setter: setClientReport, getter: clientReport },
      { key: "tongue_and_pulse", value: data.tongue_and_pulse, setter: setTongueAndPulse, getter: tongueAndPulse },
      { key: "treatment_done", value: data.treatment_done, setter: setTreatmentDone, getter: treatmentDone },
      { key: "treatment_plan", value: data.treatment_plan, setter: setTreatmentPlan, getter: treatmentPlan },
      { key: "homework", value: data.homework, setter: setHomework, getter: homework },
    ];

    for (const { key, value, setter, getter } of fieldMap) {
      if (value == null) continue;
      newHighlights.add(key);
      if (!getter || getter.trim() === "") {
        setter(value);
      } else {
        setter(getter + "\n" + value);
      }
    }

    // Formula matching
    if (Array.isArray(data.formulas) && data.formulas.length > 0) {
      const presets = formulaPresetsRef.current;
      const matched = data.formulas.filter((f) =>
        presets.some((p) => p.toLowerCase() === f.toLowerCase())
      ).map((f) => {
        const exact = presets.find((p) => p.toLowerCase() === f.toLowerCase());
        return exact || f;
      });

      if (matched.length > 0) {
        setSelectedFormulas((prev) => {
          const existing = new Set(prev.map((p) => p.toLowerCase()));
          const toAdd = matched.filter((m) => !existing.has(m.toLowerCase()));
          return [...prev, ...toAdd];
        });
      }
    }

    setHighlightedFields(newHighlights);
    setTimeout(() => setHighlightedFields(new Set()), 3000);
  }

  function formatTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function discardRecording() {
    releaseWakeLock();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorder.stop();
    }
    audioChunksRef.current = [];
    lastBlobRef.current = null;
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setDictationState("idle");
  }

  function resetDictation() {
    lastBlobRef.current = null;
    setDictationState("idle");
    setElapsedSeconds(0);
  }

  const isRecordingActive = dictationState === "recording" || dictationState === "paused";
  const isDictationBusy = isRecordingActive || dictationState === "processing";

  const hasAnyText = [clientReport, tongueAndPulse, treatmentDone, treatmentPlan, homework].some(
    (f) => f.trim().length > 0
  );

  async function handleSave() {
    if (!hasAnyText || saving) return;
    setSaving(true);

    try {
      let sid = sessionId;

      // Create session if it doesn't exist
      if (!sid) {
        const { data: newSession, error: sessErr } = await supabase
          .from("sessions")
          .insert({
            patient_id: patient.id,
            google_event_id: event.id,
            date: event.start,
            session_number: sessionNumber || null,
          })
          .select()
          .single();
        if (sessErr) throw sessErr;
        sid = newSession.id;
      }

      // Upload only new base64 photos
      const newPhotoUrls = await Promise.all(
        photos.filter((p) => p.startsWith("data:")).map((p) => uploadPhoto(supabase, p, sid))
      );
      const allPhotoUrls = [...existingPhotoUrls, ...newPhotoUrls];

      // Upsert note
      const { error: noteErr } = await supabase
        .from("notes")
        .upsert(
          {
            session_id: sid,
            content: treatmentDone.trim() || clientReport.trim(),
            note_type: "session",
            client_report: clientReport.trim() || null,
            tongue_and_pulse: tongueAndPulse.trim() || null,
            treatment_done: treatmentDone.trim() || null,
            treatment_plan: treatmentPlan.trim() || null,
            homework: homework.trim() || null,
            formulas: selectedFormulas.length > 0 ? selectedFormulas : null,
            photo_urls: allPhotoUrls.length > 0 ? allPhotoUrls : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );
      if (noteErr) throw noteErr;

      onClose();
    } catch (err) {
      setSaving(false);
      alert("שגיאה בשמירה: " + err.message);
    }
  }

  const sessionLabel = patient
    ? `טיפול מספר ${sessionNumber || "?"} · ${formatHebDate(event?.start)} · ${formatTime(event?.start)}`
    : "";

  return (
    <>
      <div className={`drawer-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`note-drawer ${open ? "open" : ""}`}>
        <div className="drawer-handle" />

        <TopBar
          title="סיכום טיפול"
          onBack={onClose}
          backLabel="היום"
          rightLabel={saving ? "שומר..." : "שמור"}
          onRight={handleSave}
          rightDisabled={!hasAnyText || saving}
        />

        {patient && (
          <ClientBanner
            variant="session"
            clientName={patient.full_name}
            sessionLabel={sessionLabel}
            avatarContent={getInitials(patient.full_name)}
            tag="סיכום"
          />
        )}

        <div className="scroll-content">
          {/* Section 1 — הדיווח */}
          <div className="form-section">
            <div className="section-header">
              <SectionNumber number={1} color="#D4845A" bg="#FFF3EC" />
              <span>הדיווח — מה מביא המטופל/ת</span>
            </div>
            <div className={highlightedFields.has("client_report") ? "ai-highlight" : ""} style={{ transition: "background-color 0.6s ease" }}>
              <FormTextarea
                label="דיווח המטופל/ת"
                placeholder="מה מדווח/ת המטופל/ת? תסמינים, שינויים, תחושות, שינה, אנרגיה..."
                value={clientReport}
                onChange={setClientReport}
                minHeight={80}
              />
            </div>
            <div className={highlightedFields.has("tongue_and_pulse") ? "ai-highlight" : ""} style={{ transition: "background-color 0.6s ease" }}>
              <FormTextarea
                label="לשון ודופק"
                placeholder="תצפיות: לשון, דופק, מראה כללי..."
                value={tongueAndPulse}
                onChange={setTongueAndPulse}
                minHeight={52}
              />
            </div>
          </div>

          {/* Section 2 — הטיפול */}
          <div className="form-section">
            <div className="section-header">
              <SectionNumber number={2} color="#C93E2C" bg="#FDEAE6" />
              <span>הטיפול — מה נעשה</span>
            </div>
            <div className={highlightedFields.has("treatment_done") ? "ai-highlight" : ""} style={{ transition: "background-color 0.6s ease" }}>
              <FormTextarea
                label="מה נעשה בטיפול"
                placeholder="נקודות דיקור, שיאצו, מוקסה, כוסות, שיטות..."
                value={treatmentDone}
                onChange={setTreatmentDone}
                minHeight={80}
              />
            </div>
            <PhotoAttachment label="תמונות" photos={[...existingPhotoUrls, ...photos.filter((p) => p.startsWith("data:"))]} onChange={setPhotos} />
          </div>

          {/* Section 3 — המשך */}
          <div className="form-section">
            <div className="section-header">
              <SectionNumber number={3} color="#4A5E4A" bg="#EAF0E6" />
              <span>המשך — תכנית ושיעורי בית</span>
            </div>
            <div className={highlightedFields.has("treatment_plan") ? "ai-highlight" : ""} style={{ transition: "background-color 0.6s ease" }}>
              <FormTextarea
                label="תכנית לטיפול הבא"
                placeholder="מה יהיה בפגישה הבאה? כיוון, שינויים בגישה..."
                value={treatmentPlan}
                onChange={setTreatmentPlan}
                minHeight={68}
              />
            </div>
            <div className={highlightedFields.has("homework") ? "ai-highlight" : ""} style={{ transition: "background-color 0.6s ease" }}>
              <FormTextarea
                label="שיעורי בית"
                placeholder="המלצות תזונה, תרגילים, שינויים באורח חיים, תה..."
                value={homework}
                onChange={setHomework}
                minHeight={68}
              />
            </div>
            <FormulaField
              label="פורמולות"
              triggerLabel="הוסף פורמולה לטיפול זה..."
              selectedFormulas={selectedFormulas}
              onChange={setSelectedFormulas}
            />
          </div>

          {/* Bottom spacer for sticky bar */}
          <div style={{ height: "90px" }} />
        </div>

        {/* AI hint line above sticky bar */}
        {showAiHint && (
          <div style={{
            textAlign: "right", padding: "0 16px 4px", fontSize: "10px",
            color: "#8A6A9A", fontFamily: "var(--font-ui)",
          }}>
            ✦ הופק מהכתבה
          </div>
        )}

        {/* Sticky bottom bar — dictation on right (RTL first), save on left (RTL last) */}
        <div style={{
          borderTop: "0.5px solid #E4DDD3", background: "#F5F0E8",
          padding: "12px 14px 16px", display: "flex", gap: "10px",
          alignItems: "center",
        }}>
          {/* Dictation button area — first in DOM = right side in RTL */}
          {dictationState === "idle" && (
            <button
              onClick={startRecording}
              style={{
                width: 50, height: 50, minWidth: 50, borderRadius: 12,
                border: "1.5px solid #C0BBB4", background: "transparent",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                position: "relative", cursor: "pointer", padding: 0,
              }}
              aria-label="הכתבה"
            >
              {/* AI lightning icon above mic */}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#FA523C">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" />
              </svg>
              {/* Microphone icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1 }}>
                <rect x="9" y="1" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="21" />
                <line x1="8" y1="21" x2="16" y2="21" />
              </svg>
            </button>
          )}

          {isRecordingActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              {/* Pause/Resume button — first in DOM = right in RTL */}
              <button
                onClick={dictationState === "recording" ? pauseRecording : resumeRecording}
                style={{
                  width: 50, height: 50, minWidth: 50, borderRadius: 12,
                  border: "1.5px solid #E03030", background: "#FFF0F0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0,
                }}
                aria-label={dictationState === "recording" ? "השהה" : "המשך"}
              >
                {dictationState === "recording" ? (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#E03030">
                    <rect x="3" y="2" width="3.5" height="12" rx="1" />
                    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#E03030">
                    <polygon points="4,2 14,8 4,14" />
                  </svg>
                )}
              </button>

              {/* Stop button (recording) / Discard button (paused) */}
              {dictationState === "recording" ? (
                <button
                  onClick={stopRecording}
                  style={{
                    width: 50, height: 50, minWidth: 50, borderRadius: 12,
                    border: "1.5px solid #E03030", background: "#E03030",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                  }}
                  aria-label="עצור"
                >
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="#fff">
                    <rect x="1" y="1" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={discardRecording}
                  style={{
                    width: 50, height: 50, minWidth: 50, borderRadius: 12,
                    border: "1.5px solid #999", background: "#f5f5f5",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                  }}
                  aria-label="מחק הקלטה"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              )}

              {/* Pulsing dot + timer — last in DOM = left in RTL */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
                <span style={{
                  fontVariantNumeric: "tabular-nums", color: "#C02020",
                  fontSize: 15, fontWeight: 500,
                }}>
                  {formatTimer(elapsedSeconds)}
                </span>
                <span style={{
                  width: 9, height: 9, borderRadius: "50%", background: "#C02020",
                  display: "inline-block",
                  animation: dictationState === "recording" ? "dictPulse 1s ease-in-out infinite" : "none",
                }} />
              </div>
            </div>
          )}

          {dictationState === "processing" && (
            <div style={{
              width: 50, height: 50, minWidth: 50, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                width: 20, height: 20, border: "2px solid #D4CBBF",
                borderTopColor: "#FA523C", borderRadius: "50%",
                display: "inline-block", animation: "dictSpin 0.8s linear infinite",
              }} />
            </div>
          )}

          {dictationState === "done" && (
            <button
              onClick={resetDictation}
              style={{
                width: 50, height: 50, minWidth: 50, borderRadius: 12,
                border: "1.5px solid #7AB870", background: "#EEF7EC",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0,
              }}
              aria-label="אפס הכתבה"
            >
              <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="#4A8A40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 9 7 13 15 5" />
              </svg>
            </button>
          )}

          {dictationState === "error" && (
            <button
              onClick={retryDictation}
              style={{
                width: 50, height: 50, minWidth: 50, borderRadius: 12,
                border: "1.5px solid #E03030", background: "#FFF0F0",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0,
              }}
              aria-label="נסי שוב"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E03030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          )}

          {/* Save button — last in DOM = left side in RTL */}
          <div
            onClick={hasAnyText && !saving && !isDictationBusy ? handleSave : undefined}
            style={{
              background: "#eef6f3", color: "#3a7060", border: "0.5px solid #a8d0c8",
              fontSize: "14px", fontWeight: 500, borderRadius: "12px", padding: "14px 0",
              flex: isRecordingActive ? undefined : 1,
              maxWidth: isRecordingActive ? 70 : undefined,
              width: isRecordingActive ? 70 : undefined,
              textAlign: "center",
              cursor: hasAnyText && !saving && !isDictationBusy ? "pointer" : "default",
              opacity: hasAnyText && !saving && !isDictationBusy ? 1 : 0.3,
              pointerEvents: hasAnyText && !saving && !isDictationBusy ? "auto" : "none",
              fontFamily: "var(--font-ui)",
              transition: "max-width 0.3s ease, opacity 0.3s ease",
            }}
          >
            {saving ? "שומר..." : "שמור"}
          </div>
        </div>

        {/* Dictation CSS animations + field highlights */}
        <style>{`
          @keyframes dictPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @keyframes dictSpin {
            to { transform: rotate(360deg); }
          }
          .ai-highlight textarea,
          .ai-highlight .form-textarea {
            background-color: #FEF9EC !important;
            transition: background-color 0.6s ease;
          }
        `}</style>
      </div>
    </>
  );
}
