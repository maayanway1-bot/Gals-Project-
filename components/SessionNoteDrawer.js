"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import TopBar from "@/components/TopBar";
import ClientBanner from "@/components/ClientBanner";
import FormTextarea from "@/components/FormTextarea";
import PhotoAttachment from "@/components/PhotoAttachment";
import FormulaField from "@/components/FormulaField";
import SectionNumber from "@/components/SectionNumber";

const DAY_NAMES = ["יום א׳","יום ב׳","יום ג׳","יום ד׳","יום ה׳","יום ו׳","שבת"];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0];
  return parts[0][0] + parts[parts.length - 1][0];
}

function formatHebDate(dateStr) {
  const d = new Date(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
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

  const hasAnyText = [clientReport, tongueAndPulse, treatmentDone, treatmentPlan, homework].some(
    (f) => f.trim().length > 0
  );

  async function uploadPhoto(dataUrl, sid) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type.split("/")[1] || "jpg";
    const filename = `${sid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("session-photos")
      .upload(filename, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("session-photos").getPublicUrl(filename);
    return urlData.publicUrl;
  }

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
        photos.filter((p) => p.startsWith("data:")).map((p) => uploadPhoto(p, sid))
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
              <span>הדיווח — מה מביא הלקוח</span>
            </div>
            <FormTextarea
              label="דיווח הלקוח"
              placeholder="מה מדווח הלקוח? תסמינים, שינויים, תחושות, שינה, אנרגיה..."
              value={clientReport}
              onChange={setClientReport}
              minHeight={80}
            />
            <FormTextarea
              label="לשון ודופק"
              placeholder="תצפיות: לשון, דופק, מראה כללי..."
              value={tongueAndPulse}
              onChange={setTongueAndPulse}
              minHeight={52}
            />
          </div>

          {/* Section 2 — הטיפול */}
          <div className="form-section">
            <div className="section-header">
              <SectionNumber number={2} color="#C93E2C" bg="#FDEAE6" />
              <span>הטיפול — מה נעשה</span>
            </div>
            <FormTextarea
              label="מה נעשה בטיפול"
              placeholder="נקודות דיקור, שיאצו, מוקסה, כוסות, שיטות..."
              value={treatmentDone}
              onChange={setTreatmentDone}
              minHeight={80}
            />
            <PhotoAttachment label="תמונות" photos={[...existingPhotoUrls, ...photos.filter((p) => p.startsWith("data:"))]} onChange={setPhotos} />
          </div>

          {/* Section 3 — המשך */}
          <div className="form-section">
            <div className="section-header">
              <SectionNumber number={3} color="#4A5E4A" bg="#EAF0E6" />
              <span>המשך — תכנית ושיעורי בית</span>
            </div>
            <FormTextarea
              label="תכנית לטיפול הבא"
              placeholder="מה יהיה בפגישה הבאה? כיוון, שינויים בגישה..."
              value={treatmentPlan}
              onChange={setTreatmentPlan}
              minHeight={68}
            />
            <FormTextarea
              label="שיעורי בית"
              placeholder="המלצות תזונה, תרגילים, שינויים באורח חיים, תה..."
              value={homework}
              onChange={setHomework}
              minHeight={68}
            />
            <FormulaField
              label="פורמולות"
              triggerLabel="הוסף פורמולה לטיפול זה..."
              selectedFormulas={selectedFormulas}
              onChange={setSelectedFormulas}
            />
          </div>

          {/* Submit CTA */}
          <div style={{ padding: "16px 20px" }}>
            <div
              onClick={hasAnyText && !saving ? handleSave : undefined}
              style={{
                background: "#eef6f3", color: "#3a7060", border: "0.5px solid #a8d0c8", fontSize: "14px", fontWeight: 500,
                borderRadius: "12px", padding: "13px 0", width: "100%", display: "block",
                textAlign: "center", cursor: hasAnyText && !saving ? "pointer" : "default",
                opacity: hasAnyText && !saving ? 1 : 0.3,
                pointerEvents: hasAnyText && !saving ? "auto" : "none",
                fontFamily: "var(--font-ui)",
              }}
            >
              {saving ? "שומר..." : "שמור סיכום"}
            </div>
          </div>
          <div style={{ height: "40px" }} />
        </div>
      </div>
    </>
  );
}
