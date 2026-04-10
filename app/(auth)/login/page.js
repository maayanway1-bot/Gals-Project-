"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  return (
    <div className="login-screen">
      {/* Logo + greeting */}
      <div className="login-header">
        <img
          src="/logo.png"
          width={100}
          height={100}
          alt="Private Clinic App"
          className="login-logo"
        />
        <div className="login-greeting">
          <h1 className="login-greeting-text">Private Clinic App</h1>
          <p className="login-greeting-sub">A private patient management tool for acupuncture and Chinese medicine practitioners.</p>
        </div>
      </div>

      {/* Google button */}
      <div className="login-button-area">
        <button
          className="login-google-btn"
          onClick={handleLogin}
          disabled={loading}
          style={loading ? { pointerEvents: "none" } : undefined}
        >
          {loading ? (
            <div className="login-spinner" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              <span>המשך עם Google</span>
            </>
          )}
        </button>

        {error === "unauthorized" && (
          <div className="login-error">
            הגישה מוגבלת. אנא פני למנהל המערכת.
          </div>
        )}

        {error === "auth" && (
          <div className="login-error">
            שגיאה בהתחברות. נסי שוב.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="login-legal-links">
        <a href="/privacy.html">Privacy Policy</a>
        <span>·</span>
        <a href="/terms.html">Terms of Service</a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f0e8" }}>
          <span style={{ color: "#b8b0b8", fontFamily: "var(--font-ui)" }}>טוען...</span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
