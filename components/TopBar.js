"use client";

export default function TopBar({ title, onBack, backLabel = "היום", rightLabel = "שמור", onRight, rightDisabled = false }) {
  return (
    <div className="topbar">
      <button className="back-btn" onClick={onBack}>
        › {backLabel}
      </button>
      <h1 className="topbar-title">{title}</h1>
      <button className="save-btn" onClick={onRight} disabled={rightDisabled}>
        {rightLabel}
      </button>
    </div>
  );
}
