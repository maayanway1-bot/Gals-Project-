"use client";

export default function FormTextarea({ label, placeholder, value, onChange, minHeight = 70 }) {
  return (
    <>
      <span className="field-label">{label}</span>
      <textarea
        className="form-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="auto"
        style={{ minHeight: `${minHeight}px` }}
      />
    </>
  );
}
