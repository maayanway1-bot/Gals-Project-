"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TopBar from "@/components/TopBar";
import ClientBanner from "@/components/ClientBanner";
import FormTextarea from "@/components/FormTextarea";
import PhotoAttachment from "@/components/PhotoAttachment";
import FormulaField from "@/components/FormulaField";
import { DAY_NAMES, uploadPhoto } from "@/lib/utils";

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="5.5" r="2.5" strokeWidth="1.5" stroke="currentColor" />
    <path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5" strokeWidth="1.5" strokeLinecap="round" stroke="currentColor" />
  </svg>
);

function IntakeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const eventTitle = searchParams.get("name") || "";
  const eventEmail = searchParams.get("email") || "";
  const eventId = searchParams.get("eventId") || "";
  const eventDate = searchParams.get("date") || new Date().toISOString();
  const eventTime = searchParams.get("time") || "";

  const [fullName, setFullName] = useState(eventTitle);
  const [gender, setGender] = useState(null);
  const [age, setAge] = useState(30);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(eventEmail);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentDone, setTreatmentDone] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [selectedFormulas, setSelectedFormulas] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const isValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    gender !== null &&
    chiefComplaint.trim().length > 0 &&
    treatmentDone.trim().length > 0;

  const dateObj = new Date(eventDate);
  const dayName = DAY_NAMES[dateObj.getDay()];
  const formattedDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
  const agePct = ((age - 1) / 89) * 100;

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .insert({
          full_name: fullName.trim(), gender, age,
          phone: phone.trim(), email: email.trim(),
          chief_complaint: chiefComplaint.trim(),
          diagnosis: diagnosis.trim() || null,
          treatment_plan: treatmentPlan.trim() || null,
          created_from: "intake",
          gcal_event_id: eventId || null,
        })
        .select().single();
      if (patientError) throw patientError;

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({ patient_id: patient.id, google_event_id: eventId || null, date: eventDate, session_number: 1 })
        .select().single();
      if (sessionError) throw sessionError;

      let photoUrls = [];
      if (photos.length > 0) {
        photoUrls = await Promise.all(photos.filter((p) => p.startsWith("data:")).map((p) => uploadPhoto(supabase, p, session.id)));
      }

      const { error: noteError } = await supabase.from("notes").insert({
        session_id: session.id, content: treatmentDone.trim(), note_type: "intake",
        chief_complaint: chiefComplaint.trim(), diagnosis: diagnosis.trim() || null,
        treatment_done: treatmentDone.trim(), treatment_plan: treatmentPlan.trim() || null,
        formulas: selectedFormulas.length > 0 ? selectedFormulas : null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
      });
      if (noteError) throw noteError;
      window.location.href = "/today";
    } catch (err) {
      setSaving(false);
      alert("שגיאה בשמירה: " + err.message);
    }
  }

  return (
    <div className="intake-screen">
      <TopBar
        title="אינטייק ראשוני"
        onBack={() => router.push("/today")}
        rightLabel={saving ? "שומר..." : "שמור"}
        onRight={handleSave}
        rightDisabled={!isValid || saving}
      />

      <div className="scroll-content">
        <ClientBanner
          variant="intake"
          clientName={eventTitle || "מטופל/ת חדש/ה"}
          sessionLabel={`מטופל/ת חדש/ה · ${dayName} ${formattedDate} ${eventTime}`}
          avatarContent={<PersonIcon />}
          tag="מטופל/ת חדש/ה"
        />

        {/* פרטים אישיים */}
        <div className="form-section">
          <div className="section-title">פרטים אישיים</div>
          <span className="field-label">שם מלא</span>
          <input className="form-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="שם פרטי ושם משפחה" dir="auto" />

          <span className="field-label">מגדר</span>
          <div className="gender-row">
            <div className={`gender-option ${gender === "female" ? "selected" : ""}`} onClick={() => setGender("female")}>
              <div style={{ width: "58px", height: "58px", borderRadius: "50%", background: "#FFF3EC", border: "0.5px solid #F5D0B4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','FangSong',Georgia,serif", fontSize: "32px", color: "#D4845A", lineHeight: 1 }}>女</span>
              </div>
              <span>אישה</span>
              <span style={{ fontSize: "10px", color: "#8A8680", fontStyle: "italic" }}>nǚ</span>
            </div>
            <div className={`gender-option ${gender === "male" ? "selected" : ""}`} onClick={() => setGender("male")}>
              <div style={{ width: "58px", height: "58px", borderRadius: "50%", background: "#F2F0EE", border: "0.5px solid #EDEAE4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','FangSong',Georgia,serif", fontSize: "32px", color: "#8A8680", lineHeight: 1 }}>男</span>
              </div>
              <span>גבר</span>
              <span style={{ fontSize: "10px", color: "#8A8680", fontStyle: "italic" }}>nán</span>
            </div>
          </div>

          <span className="field-label">גיל</span>
          <div className="age-row">
            <span className="age-value">{age}</span>
            <input type="range" min={1} max={90} step={1} value={age} onChange={(e) => setAge(Number(e.target.value))} style={{ direction: "ltr", background: `linear-gradient(to right, #282B30 0%, #282B30 ${agePct}%, #EDEAE4 ${agePct}%, #EDEAE4 100%)` }} />
          </div>
        </div>

        {/* פרטי קשר */}
        <div className="form-section">
          <div className="section-title">פרטי קשר</div>
          <div className="field-label-row"><span>טלפון</span>{phone === "" && <span className="prepop-badge">מגוגל</span>}</div>
          <input className={`form-input ${eventEmail ? "form-input-prepopulated" : ""}`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-000-0000" />
          <div className="field-label-row"><span>אימייל</span>{eventEmail && <span className="prepop-badge">מגוגל</span>}</div>
          <input className={`form-input ${eventEmail ? "form-input-prepopulated" : ""}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" style={{ textAlign: "left" }} />
        </div>

        {/* מצב קליני */}
        <div className="form-section">
          <div className="section-title">מצב קליני</div>
          <FormTextarea label="תלונה עיקרית *" placeholder="תאר את הסיבה העיקרית לפנייה..." value={chiefComplaint} onChange={setChiefComplaint} minHeight={70} />
          <FormTextarea label="אבחנה" placeholder="לפי RA״מ / TCM..." value={diagnosis} onChange={setDiagnosis} minHeight={52} />
        </div>

        {/* טיפול */}
        <div className="form-section">
          <div className="section-title">טיפול</div>
          <FormTextarea label="מה נעשה בטיפול *" placeholder="נקודות שנבחרו, שיטות, תצפיות..." value={treatmentDone} onChange={setTreatmentDone} minHeight={70} />
          <FormTextarea label="תכנית טיפול" placeholder="תדירות, מספר טיפולים, יעדים..." value={treatmentPlan} onChange={setTreatmentPlan} minHeight={52} />
        </div>

        {/* פורמולות */}
        <div className="form-section">
          <div className="section-title">פורמולות</div>
          <FormulaField selectedFormulas={selectedFormulas} onChange={setSelectedFormulas} />
        </div>

        {/* תמונות */}
        <div className="form-section">
          <div className="section-title">תמונות</div>
          <PhotoAttachment photos={photos} onChange={setPhotos} />
        </div>

        {/* Submit CTA */}
        <div style={{ padding: "16px 20px" }}>
          <div
            onClick={isValid && !saving ? handleSave : undefined}
            style={{ background: "#eef6f3", color: "#3a7060", border: "0.5px solid #a8d0c8", fontSize: "14px", fontWeight: 500, borderRadius: "12px", padding: "13px 0", width: "100%", display: "block", textAlign: "center", cursor: isValid && !saving ? "pointer" : "default", opacity: isValid && !saving ? 1 : 0.4, pointerEvents: isValid && !saving ? "auto" : "none", fontFamily: "var(--font-ui)" }}
          >
            {saving ? "שומר..." : "צור כרטיס מטופל/ת ושמור סיכום"}
          </div>
        </div>
        <div style={{ height: "40px" }} />
      </div>
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--color-bg)" }}><span style={{ color: "var(--color-text-muted)" }}>טוען...</span></div>}>
      <IntakeForm />
    </Suspense>
  );
}
