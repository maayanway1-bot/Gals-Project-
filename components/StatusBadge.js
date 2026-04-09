"use client";

const BADGE_STYLES = {
  completed: { background: "var(--color-sage-soft)", color: "var(--color-sage-text)" },
  "needs-note": { background: "var(--color-poppy-soft)", color: "var(--color-poppy-text)" },
  intake: { background: "var(--color-ink)", color: "#FAF9F6" },
  upcoming: { background: "var(--color-peach)", color: "var(--color-peach-deep)" },
};

const BADGE_LABELS = {
  completed: "הושלם",
  "needs-note": "נדרש סיכום",
  intake: "אינטייק",
  upcoming: "קרוב",
};

export default function StatusBadge({ status, label }) {
  const style = BADGE_STYLES[status] || BADGE_STYLES.completed;
  const text = label || BADGE_LABELS[status] || status;

  return (
    <span className="status-badge" style={style}>
      {text}
    </span>
  );
}
