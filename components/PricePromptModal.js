"use client";

import { useState, useEffect, useRef } from "react";

export default function PricePromptModal({ open, onClose, onSubmit, defaultPrice }) {
  const [price, setPrice] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setPrice(defaultPrice ? String(defaultPrice) : "");
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    } else {
      document.body.style.overflow = "";
      setPrice("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, defaultPrice]);

  const handleSubmit = () => {
    const num = parseInt(price, 10);
    if (num > 0) {
      onSubmit(num);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="price-modal">
        <div className="drawer-handle" />
        <div className="price-modal-content">
          <h3 className="morning-modal-title">מחיר הטיפול</h3>
          <p className="morning-modal-desc">
            יש להזין את מחיר הטיפול לחשבונית
          </p>

          <div className="price-input-row">
            <input
              ref={inputRef}
              className="form-input price-input"
              type="number"
              inputMode="numeric"
              dir="ltr"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{ fontSize: "16px" }}
            />
            <span className="price-currency">₪</span>
          </div>

          <div className="morning-modal-actions">
            <button
              className="morning-btn morning-btn-save"
              onClick={handleSubmit}
              disabled={!price || parseInt(price, 10) <= 0}
            >
              המשך לשליחת חשבונית
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
