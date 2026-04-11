"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    id: "today",
    label: "היום",
    href: "/today",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    id: "clients",
    label: "מטופלים",
    href: "/patients",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "התראות",
    href: "/notifications",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const active =
          tab.href === "/today"
            ? pathname === "/today" || pathname === "/"
            : pathname.startsWith(tab.href);
        const disabled = tab.id === "notifications";
        if (disabled) {
          return (
            <div key={tab.id} className="nav-tab" style={{ opacity: 0.4, cursor: "default" }}>
              <div style={{ color: "#a8a0a8", position: "relative" }}>
                {tab.icon}
              </div>
              <span className="nav-tab-label">{tab.label}</span>
            </div>
          );
        }
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`nav-tab ${active ? "active" : ""}`}
          >
            <div style={{ color: active ? "#c07088" : "#a8a0a8", position: "relative" }}>
              {tab.icon}
            </div>
            <span className="nav-tab-label">{tab.label}</span>
            {active && <div className="nav-pip" />}
          </Link>
        );
      })}
    </nav>
  );
}
