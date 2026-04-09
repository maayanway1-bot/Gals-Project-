"use client";

const BANNER_VARIANTS = {
  intake: {
    bg: "#FFF3EC",
    border: "#F5D0B4",
    avatarBg: "#FFC6AD",
    avatarColor: "#A05020",
    labelColor: "#D4845A",
  },
  session: {
    bg: "#FCEEE4",
    border: "#EDD8CC",
    avatarBg: "#F5C4A8",
    avatarColor: "#A05020",
    labelColor: "#C07848",
  },
  profile: {
    bg: "#FCEEE4",
    border: "#EDD8CC",
    avatarBg: "#F5C4A8",
    avatarColor: "#A05020",
    labelColor: "#C07848",
  },
};

export default function ClientBanner({ variant = "intake", clientName, sessionLabel, avatarContent, tag, tagStyle }) {
  const v = BANNER_VARIANTS[variant] || BANNER_VARIANTS.intake;

  return (
    <div
      className="client-banner"
      style={{ background: v.bg, borderBottomColor: v.border }}
    >
      <div
        className="client-banner-avatar"
        style={{ background: v.avatarBg, color: v.avatarColor }}
      >
        {typeof avatarContent === "string" ? (
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{avatarContent}</span>
        ) : (
          avatarContent
        )}
      </div>
      <div className="client-banner-info">
        <span className="client-banner-label" style={{ color: v.labelColor }}>
          {sessionLabel}
        </span>
        <span className="client-banner-name">{clientName}</span>
      </div>
      <span
        className="client-banner-tag"
        style={tagStyle === "sage" ? { background: "var(--color-sage-soft)", color: "var(--color-sage-text)" } : undefined}
      >
        {tag}
      </span>
    </div>
  );
}
