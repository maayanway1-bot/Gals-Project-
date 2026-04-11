"use client";

export default function NoteField({ label, value }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="note-field">
      <div className="note-field-label">{label}</div>
      <div className="note-field-val">{value}</div>
    </div>
  );
}
