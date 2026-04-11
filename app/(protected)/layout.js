import BottomNav from "./bottom-nav";

export default function ProtectedLayout({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--color-bg)" }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</main>
      <BottomNav />
    </div>
  );
}
