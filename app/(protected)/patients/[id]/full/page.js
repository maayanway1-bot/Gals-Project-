"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import FormulaChip from "@/components/FormulaChip";
import { formatDateFull as formatDate } from "@/lib/utils";
import NoteField from "@/components/NoteField";

function buildExportHTML(client, sessions, allNotes) {
  const sessionBlocks = sessions
    .filter((s) => {
      const note = allNotes.find((n) => n.session_id === s.id);
      return note?.note_type !== "intake";
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((s, i, arr) => {
      const note = allNotes.find((n) => n.session_id === s.id);
      const num = arr.length - i;
      if (!note) return "";
      const fields = [
        note.client_report && `<div class="note-field"><div class="field-label">דיווח המטופל/ת</div><div class="field-val">${note.client_report}</div></div>`,
        note.tongue_and_pulse && `<div class="note-field"><div class="field-label">לשון ודופק</div><div class="field-val">${note.tongue_and_pulse}</div></div>`,
        note.treatment_done && `<div class="note-field"><div class="field-label">מה נעשה</div><div class="field-val">${note.treatment_done}</div></div>`,
        note.treatment_plan && `<div class="note-field"><div class="field-label">תכנית לטיפול הבא</div><div class="field-val">${note.treatment_plan}</div></div>`,
        note.homework && `<div class="note-field"><div class="field-label">שיעורי בית</div><div class="field-val">${note.homework}</div></div>`,
        note.formulas?.length > 0 && `<div class="note-field"><div class="field-label">פורמולות</div><div>${note.formulas.map((f) => `<span class="chip">${f}</span>`).join("")}</div></div>`,
      ].filter(Boolean).join("");

      return `<div class="session-header"><span class="session-num">טיפול ${num}</span><span class="session-date">${formatDate(s.date)}</span></div>${fields}`;
    })
    .join('<div class="divider"></div>');

  const nonIntakeCount = sessions.filter((s) => {
    const note = allNotes.find((n) => n.session_id === s.id);
    return note?.note_type !== "intake";
  }).length;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>תיק מטופל/ת · ${client.full_name}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Rubik&family=Cormorant+Garamond&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Rubik', sans-serif; direction: rtl; color: #282B30; background: #fff; padding: 32px; }
h1 { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 400; margin-bottom: 4px; }
.meta { font-size: 12px; color: #8A8680; margin-bottom: 20px; }
.intake-block { background: #FAF9F6; border: 0.5px solid #EDEAE4; border-radius: 8px; padding: 14px; margin-bottom: 24px; }
.intake-title { font-size: 10px; font-weight: 500; color: #8A8680; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.field-label { font-size: 10px; color: #8A8680; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 2px; }
.field-val { font-size: 13px; color: #282B30; white-space: pre-wrap; }
.session-num { font-family: 'Cormorant Garamond', serif; font-size: 18px; }
.session-date { font-size: 12px; color: #8A8680; margin-right: 10px; }
.session-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 0.5px solid #EDEAE4; }
.note-field { margin-bottom: 10px; }
.divider { height: 1px; background: #EDEAE4; margin: 20px 0; }
.chip { display: inline-block; background: #EAF0E6; color: #3D5630; font-size: 11px; font-weight: 500; padding: 2px 10px; border-radius: 100px; margin-left: 4px; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 0.5px solid #EDEAE4; text-align: center; font-size: 10px; color: #B8B4B0; }
@media print { body { padding: 20px; } @page { margin: 1.5cm; } }
</style>
</head>
<body>
<h1>${client.full_name}</h1>
<div class="meta">${client.age ? client.age + " · " : ""}${client.gender === "female" ? "אישה" : "גבר"} · ${nonIntakeCount} טיפולים · יוצא ${new Date().toLocaleDateString("he-IL")}</div>
<div class="intake-block">
<div class="intake-title">פרטי המטופל/ת · ${formatDate(client.created_at)}</div>
<div class="grid">
<div><div class="field-label">טלפון</div><div class="field-val" dir="ltr">${client.phone || "—"}</div></div>
<div><div class="field-label">אימייל</div><div class="field-val" dir="ltr" style="font-size:11px">${client.email || "—"}</div></div>
</div>
<div><div class="field-label">תלונה עיקרית</div><div class="field-val">${client.chief_complaint || "—"}</div></div>
${client.treatment_plan ? `<div style="margin-top:8px"><div class="field-label">תכנית טיפול</div><div class="field-val">${client.treatment_plan}</div></div>` : ""}
</div>
${sessionBlocks}
<div class="footer">תיק מלא · ${client.full_name} · יוצא ${new Date().toLocaleDateString("he-IL")}</div>
</body>
</html>`;
}

export default function FullViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase.from("sessions").select("id, date, session_number, google_event_id").eq("patient_id", id).order("date", { ascending: false }),
    ]).then(async ([{ data: pat }, { data: sess }]) => {
      setClient(pat);
      const sessionIds = (sess || []).map((s) => s.id);
      const { data: noteData } = await supabase.from("notes").select("*").in("session_id", sessionIds);
      // Number chronologically
      const chrono = [...(sess || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      const numbered = chrono.map((s, i) => ({ ...s, number: i + 1 }));
      setSessions(numbered.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setNotes(noteData || []);
      setLoading(false);
    });
  }, [id]);

  function handleExport() {
    if (!client) return;
    const html = buildExportHTML(client, sessions, notes);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  if (loading || !client) {
    return <div style={{ padding: "16px", background: "#f5f0e8", minHeight: "100vh" }} />;
  }

  return (
    <div style={{ background: "#f5f0e8", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar
        title="תיק מלא"
        onBack={() => router.push(`/patients/${id}`)}
        backLabel={client.full_name}
        rightLabel="ייצוא"
        onRight={handleExport}
      />

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
        {/* Patient details */}
        <div className="patient-details-card" style={{ margin: "12px 14px" }}>
          <div className="pd-header">
            <span className="pd-title">פרטי המטופל/ת</span>
            <span className="pd-date">{formatDate(client.created_at)}</span>
          </div>
          <div className="pd-grid">
            <div><div className="pd-field-label">טלפון</div><div className="pd-field-val" dir="ltr">{client.phone || "—"}</div></div>
            <div><div className="pd-field-label">אימייל</div><div className="pd-field-val" dir="ltr" style={{ fontSize: "10px" }}>{client.email || "—"}</div></div>
          </div>
          {client.chief_complaint && (
            <div className="pd-complaint">
              <span className="pd-complaint-label">תלונה עיקרית</span>
              <span className="pd-complaint-val">{client.chief_complaint}</span>
            </div>
          )}
        </div>

        {/* Sessions */}
        {sessions.map((s, idx) => {
          const note = notes.find((n) => n.session_id === s.id);
          const isIntake = note?.note_type === "intake";
          const hasNote = !!note;

          return (
            <div key={s.id}>
              {idx > 0 && <div className="session-divider" />}
              <div className="session-block">
                <div className="session-block-header">
                  <span className="sbh-number">{isIntake ? "אינטייק" : `טיפול ${s.number}`}</span>
                  <span className="sbh-date">{formatDate(s.date)}</span>
                  {hasNote && <StatusBadge status={isIntake ? "intake" : "completed"} />}
                </div>
                {note && (
                  <div>
                    <NoteField label="תלונה עיקרית" value={note.chief_complaint} />
                    <NoteField label="דיווח המטופל/ת" value={note.client_report} />
                    <NoteField label="לשון ודופק" value={note.tongue_and_pulse} />
                    <NoteField label="מה נעשה" value={note.treatment_done} />
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
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
