"use client";

import { useState, useEffect, useCallback } from "react";

let showToastFn = null;

export function showToast(message, type = "success") {
  showToastFn?.(message, type);
}

export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("success");

  const show = useCallback((msg, t) => {
    setMessage(msg);
    setType(t);
    setVisible(true);
  }, []);

  useEffect(() => {
    showToastFn = show;
    return () => { showToastFn = null; };
  }, [show]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={`toast toast-${type}`}>
      {type === "success" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="8" fill="#3a7060"/>
          <path d="M5 8L7 10L11 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {type === "error" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="8" fill="#b03020"/>
          <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
      <span>{message}</span>
    </div>
  );
}
