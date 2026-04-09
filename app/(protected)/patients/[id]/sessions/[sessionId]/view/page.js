"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TopBar from "@/components/TopBar";
import SectionNumber from "@/components/SectionNumber";
import FormulaChip from "@/components/FormulaChip";
import PhotoThumbnail from "@/components/PhotoThumbnail";

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function NoteField({ label, value }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="note-field">
      <div className="note-field-label">{label}</div>
      <div className="note-field-val">{value}</div>
    </div>
  );
}

export default function ReadOnlyNotePage() {
  const { id: patientId, sessionId } = useParams();
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [note, setNote] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("patients").select("full_name").eq("id", patientId).single(),
      supabase.from("sessions").select("id, date, session_number").eq("id", sessionId).single(),
      supabase.from("notes").select("*").eq("session_id", sessionId).maybeSingle(),
    ]).then(([{ data: pat }, { data: sess }, { data: noteData }]) => {
      setClient(pat);
      setSession(sess);
      setNote(noteData);
      setLoading(false);
    });
  }, [patientId, sessionId]);

  if (loading) {
    return <div style={{ padding: "16px", background: "var(--color-bg)", minHeight: "100vh" }} />;
  }

  if (!note) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <TopBar title="סיכום" onBack={() => router.back()} backLabel={client?.full_name || "חזרה"} rightLabel="" onRight={() => {}} rightDisabled />
        <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "40px 16px", fontSize: "14px" }}>
          אין סיכום לטיפול זה
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar
        title="סיכום טיפול"
        onBack={() => router.push(`/patients/${patientId}`)}
        backLabel={client?.full_name || "חזרה"}
        rightLabel=""
        onRight={() => {}}
        rightDisabled
      />

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
        {/* Signed stamp */}
        <div className="signed-stamp">
          <div className="stamp-dot" />
          <span className="stamp-text">סוכם</span>
          <span className="stamp-date">{formatDateTime(note.created_at)}</span>
        </div>

        {/* Section 1 — הדיווח */}
        <div className="form-section">
          <div className="section-header">
            <SectionNumber number={1} color="#D4845A" bg="#FFF3EC" />
            <span>הדיווח</span>
          </div>
          <NoteField label="דיווח הלקוח" value={note.client_report} />
          <NoteField label="לשון ודופק" value={note.tongue_and_pulse} />
        </div>

        {/* Section 2 — הטיפול */}
        <div className="form-section">
          <div className="section-header">
            <SectionNumber number={2} color="#C93E2C" bg="#FDEAE6" />
            <span>הטיפול</span>
          </div>
          <NoteField label="מה נעשה" value={note.treatment_done} />
          {note.photo_urls?.length > 0 && (
            <div className="note-field">
              <div className="note-field-label">תמונות</div>
              <div className="photo-thumbnails">
                {note.photo_urls.map((url, i) => (
                  <PhotoThumbnail key={i} src={url} index={i} readOnly />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3 — המשך */}
        <div className="form-section">
          <div className="section-header">
            <SectionNumber number={3} color="#4A5E4A" bg="#EAF0E6" />
            <span>המשך</span>
          </div>
          <NoteField label="תכנית לטיפול הבא" value={note.treatment_plan} />
          <NoteField label="שיעורי בית" value={note.homework} />
          {note.formulas?.length > 0 && (
            <div className="note-field">
              <div className="note-field-label">פורמולות</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {note.formulas.map((f) => <FormulaChip key={f} name={f} readOnly />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
