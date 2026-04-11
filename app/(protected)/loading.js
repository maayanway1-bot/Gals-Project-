export default function ProtectedLoading() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px", gap: "8px" }}>
      <div style={{ height: "48px", borderRadius: "12px", background: "var(--color-border)", opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ height: "64px", borderRadius: "12px", background: "var(--color-border)", opacity: 0.4, animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.1s" }} />
      <div style={{ height: "64px", borderRadius: "12px", background: "var(--color-border)", opacity: 0.3, animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.2s" }} />
      <div style={{ height: "64px", borderRadius: "12px", background: "var(--color-border)", opacity: 0.3, animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.3s" }} />
    </div>
  );
}
