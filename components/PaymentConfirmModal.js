"use client";

import { useEffect } from "react";

export default function PaymentConfirmModal({ open, onClose, onSendInvoice, onJustMark }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="payment-confirm-modal">
        <div className="payment-confirm-header">
          <button className="payment-undo-btn" onClick={onClose}>ביטול</button>
        </div>
        <div className="payment-confirm-content">
          <h3 className="morning-modal-title">סומן כשולם</h3>
          <p className="morning-modal-desc">לשלוח חשבונית עכשיו?</p>

          <div className="payment-confirm-actions">
            <button className="morning-btn morning-btn-confirm-invoice" onClick={onSendInvoice}>
              כן, שלח חשבונית
            </button>
            <button className="morning-btn morning-btn-skip" onClick={onJustMark}>
              לא עכשיו
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
