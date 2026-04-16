"use client";

import { useState, useEffect } from "react";

export default function MorningSetupModal({ open, onClose, onSaved }) {
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null); // "success" | "error" | null
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      // Reset state when closed
      setKeyId("");
      setSecret("");
      setTesting(false);
      setSaving(false);
      setTestResult(null);
      setErrorMsg("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/morning/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, secret }),
      });

      if (res.ok) {
        setTestResult("success");
      } else {
        const data = await res.json();
        setTestResult("error");
        setErrorMsg(data.error || "שגיאה בבדיקת החיבור");
      }
    } catch {
      setTestResult("error");
      setErrorMsg("לא ניתן להתחבר למורנינג כרגע. יש לנסות שוב.");
    }

    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Credentials were already saved during test-connection
    // Just notify parent and close
    setSaving(false);
    onSaved?.();
  };

  if (!open) return null;

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="morning-modal">
        <div className="drawer-handle" />

        <div className="morning-modal-content">
          <h3 className="morning-modal-title">חיבור חשבון מורנינג</h3>
          <p className="morning-modal-desc">
            כדי לשלוח חשבוניות, יש לחבר את חשבון המורנינג שלך.
          </p>
          <p className="morning-modal-hint">
            ניתן למצוא את מפתחות ה-API בהגדרות → כלי מפתח → מפתחות API
          </p>

          <label className="field-label">Key ID</label>
          <input
            className="form-input"
            type="text"
            dir="ltr"
            placeholder="API Key ID"
            value={keyId}
            onChange={(e) => { setKeyId(e.target.value); setTestResult(null); }}
            style={{ fontSize: "16px" }}
          />

          <label className="field-label" style={{ marginTop: "12px" }}>Secret</label>
          <input
            className="form-input"
            type="password"
            dir="ltr"
            placeholder="API Secret"
            value={secret}
            onChange={(e) => { setSecret(e.target.value); setTestResult(null); }}
            style={{ fontSize: "16px" }}
          />

          {testResult === "success" && (
            <div className="morning-test-success">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="7" fill="#3a7060"/>
                <path d="M4 7L6 9L10 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              החיבור תקין
            </div>
          )}

          {testResult === "error" && (
            <div className="morning-test-error">{errorMsg}</div>
          )}

          <div className="morning-modal-actions">
            <button
              className="morning-btn morning-btn-test"
              onClick={handleTest}
              disabled={!keyId || !secret || testing}
            >
              {testing ? "בודק..." : "בדוק חיבור"}
            </button>

            <button
              className="morning-btn morning-btn-save"
              onClick={handleSave}
              disabled={testResult !== "success" || saving}
            >
              {saving ? "שומר..." : "שמור ושלח"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
