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
  }, [content, existingNoteId, sessionId, patientId, draftKey, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950">
      {/* Toolbar */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-400 active:text-white transition-colors"
        >
          Cancel
        </button>
        <span className="text-sm text-slate-500">
          {existingNoteId
            ? "Edit Note"
            : lastSaved
              ? `Draft saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "New Note"}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="text-sm font-semibold text-primary-light disabled:opacity-40 active:opacity-70 transition-opacity"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        dir="auto"
        placeholder="Write your note..."
        className="flex-1 resize-none bg-transparent p-4 text-lg leading-relaxed text-white placeholder-slate-600 focus:outline-none"
      />
    </div>
  );
}
