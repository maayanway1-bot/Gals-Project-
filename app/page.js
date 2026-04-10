"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const minDelay = new Promise((r) => setTimeout(r, 2000));

    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      return !!user;
    };

    Promise.all([minDelay, checkAuth()]).then(([, isAuthed]) => {
      router.replace(isAuthed ? "/today" : "/login");
    });
  }, [router]);

  return (
    <div className="splash-screen">
      {/* Logo */}
      <img
        src="/logo.png"
        width={200}
        height={200}
        alt="Private Clinic App"
        className="splash-logo"
      />

      {/* Wordmark */}
      <div className="splash-wordmark">
        <h1 className="splash-title">
          Private <em>Clinic</em> App
        </h1>
        <div className="splash-divider" />
        <p className="splash-tagline">Patient Management</p>
      </div>

      {/* Loading dots */}
      <div className="splash-dots">
        <span className="splash-dot" style={{ animationDelay: "0ms" }} />
        <span className="splash-dot" style={{ animationDelay: "220ms" }} />
        <span className="splash-dot" style={{ animationDelay: "440ms" }} />
      </div>
    </div>
  );
}
