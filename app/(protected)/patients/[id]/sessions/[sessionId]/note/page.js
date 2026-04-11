"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NoteEditorPage() {
  const router = useRouter();
  const { id: patientId, sessionId } = useParams();
  const [content, setContent] = useState("");
  const [existingNoteId, setExistingNoteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const textareaRef = useRef(null);

  const draftKey = `note-draft-${sessionId}`;

  // Load existing note or draft
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("notes")
      .select("id, content")
      .eq("session_id", sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingNoteId(data.id);
          setContent(data.content);
        } else {
          // Load draft if no existing note
          const draft = localStorage.getItem(draftKey);
          if (draft) setContent(draft);
        }
        setLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 100);
      });
  }, [sessionId, draftKey]);

  // Auto-save draft every 5 seconds (only for new notes)
  useEffect(() => {
    if (existingNoteId) return;
    const interval = setInterval(() => {
      if (content) {
        localStorage.setItem(draftKey, content);
        setLastSaved(new Date());
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [content, draftKey, existingNoteId]);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    setSaving(true);

    const supabase = createClient();

    if (existingNoteId) {
      // Update existing note
      const { error } = await supabase
        .from("notes")
        .update({
          content: content.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingNoteId);

      if (error) {
        setSaving(false);
        alert("Error saving note: " + error.message);
        return;
      }
    } else {
      // Create new note
      const { error } = await supabase.from("notes").insert({
        session_id: sessionId,
        content: content.trim(),
      });

      if (error) {
        setSaving(false);
        alert("Error saving note: " + error.message);
        return;
      }

      localStorage.removeItem(draftKey);
    }

    router.push(`/today`);
  }, [content, existingNoteId, sessionId, draftKey, router]);

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8" }}>
        <p style={{ color: "#b8b0b8" }}>טוען...</p>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "#f5f0e8" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", height: "52px", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid #e0d8cc", padding: "0 16px", background: "#f5f0e8" }}>
        <button
          onClick={() => router.back()}
          style={{ fontSize: "13px", fontWeight: 500, color: "#c07088", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
        >
          ביטול
        </button>
        <span style={{ fontSize: "11px", color: "#b8b0b8", fontFamily: "var(--font-ui)" }}>
          {existingNoteId
            ? "עריכת סיכום"
            : lastSaved
              ? `טיוטה נשמרה ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "סיכום חדש"}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          style={{ fontSize: "13px", fontWeight: 500, color: "#3a7060", background: "#eef6f3", border: "0.5px solid #a8d0c8", borderRadius: "8px", padding: "5px 14px", cursor: saving || !content.trim() ? "default" : "pointer", opacity: saving || !content.trim() ? 0.4 : 1, fontFamily: "var(--font-ui)" }}
        >
          {saving ? "שומר..." : "שמור"}
        </button>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        dir="auto"
        placeholder="כתוב את הסיכום כאן..."
        style={{ flex: 1, resize: "none", background: "#fdfaf6", margin: "12px", borderRadius: "16px", border: "0.5px solid #e8e0d4", padding: "16px", fontSize: "13px", lineHeight: 1.7, color: "#2e2a38", fontFamily: "var(--font-ui)", outline: "none" }}
      />
    </div>
  );
}
