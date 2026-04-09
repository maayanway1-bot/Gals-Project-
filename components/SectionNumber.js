"use client";

const CIRCLED = ["①", "②", "③", "④", "⑤"];

export default function SectionNumber({ number, color, bg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: bg || "#ede8de",
        color: color || "#2e2a38",
        fontSize: "13px",
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {CIRCLED[number - 1] || number}
    </span>
  );
}
