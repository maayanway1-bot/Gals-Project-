"use client";

import { useState, useEffect, useRef } from "react";

const STEPS = { CONFIRM: 0, PRICE: 1, SENDING: 2, SUCCESS: 3 };

const SERVICE_TYPES = [
  { value: "דיקור", label: "דיקור" },
  { value: "שיאצו", label: "שיאצו" },
];

export default function InvoiceFlowSheet({
  open,
  onClose,
  onJustMark,
  onSendInvoice,
  defaultPrice,
  initialStep, // "confirm" | "price" | "sending"
  patientName,
  patientEmail,
  practitionerName,
  sessionDate,
  sending,
  sendResult, // { success, invoiceId, warning } | null
}) {
  const [step, setStep] = useState(STEPS.CONFIRM);
  const [price, setPrice] = useState("");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0].value);
  const inputRef = useRef(null);

  // Reset when opened/closed
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const startStep = initialStep === "sending" ? STEPS.SENDING
        : initialStep === "price" ? STEPS.PRICE
        : STEPS.CONFIRM;
      setStep(startStep);
      setPrice(defaultPrice ? String(defaultPrice) : "");
      setServiceType(SERVICE_TYPES[0].value);
    } else {
      document.body.style.overflow = "";
      setPrice("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, defaultPrice, initialStep]);

  // Move to sending step when sending starts
  useEffect(() => {
    if (sending && (step === STEPS.PRICE || step === STEPS.CONFIRM)) {
      setStep(STEPS.SENDING);
    }
  }, [sending, step]);

  // Move to success step when result arrives
  useEffect(() => {
    if (sendResult?.success) {
      setStep(STEPS.SUCCESS);
    }
  }, [sendResult]);

  // Focus price input when entering step 2
  useEffect(() => {
    if (step === STEPS.PRICE) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [step]);

  const handleConfirmInvoice = () => {
    // Always show price step (pre-populated if available)
    setStep(STEPS.PRICE);
  };

  const handlePriceSubmit = () => {
    const num = parseInt(price, 10);
    if (num > 0) {
      // Let the parent's `sending` prop drive the step transition via the useEffect below.
      // Do not set SENDING here to avoid a double-transition race.
      onSendInvoice(num, serviceType);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!open) return null;

  const totalSteps = 3;
  // Map internal steps to dot index: CONFIRM=0, PRICE=1, SENDING/SUCCESS=2
  const dotIndex = step <= STEPS.PRICE ? step : 2;

  const priceNum = sendResult?.price || parseInt(price, 10) || defaultPrice || 0;

  return (
    <>
      <div className="drawer-overlay open" onClick={step === STEPS.SUCCESS ? handleClose : onClose} />
      <div className="invoice-flow-sheet">
        <div className="drawer-handle" />

        {/* Progress dots */}
        <div className="iflow-dots">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`iflow-dot${
                i < dotIndex ? " iflow-dot-done" :
                i === dotIndex ? " iflow-dot-active" : ""
              }`}
            />
          ))}
        </div>

        {/* ── Step 1: Confirm intent ── */}
        {step === STEPS.CONFIRM && (
          <div className="iflow-step">
            <h3 className="morning-modal-title">סומן כשולם</h3>
            <p className="morning-modal-desc">לשלוח חשבונית עכשיו?</p>

            <div className="payment-confirm-actions">
              <button className="morning-btn morning-btn-confirm-invoice" onClick={handleConfirmInvoice}>
                כן, שלח חשבונית
              </button>
              <button className="morning-btn morning-btn-skip" onClick={onJustMark}>
                לא עכשיו
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Price entry ── */}
        {step === STEPS.PRICE && (
          <div className="iflow-step">
            <h3 className="morning-modal-title">פרטי הטיפול</h3>
            <p className="morning-modal-desc">יש לבחור סוג טיפול ולהזין מחיר</p>

            <div className="iflow-service-toggle">
              {SERVICE_TYPES.map((st) => (
                <button
                  key={st.value}
                  className={`iflow-service-btn${serviceType === st.value ? " iflow-service-btn-active" : ""}`}
                  onClick={() => setServiceType(st.value)}
                  type="button"
                >
                  {st.label}
                </button>
              ))}
            </div>

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
                onClick={handlePriceSubmit}
                disabled={!price || parseInt(price, 10) <= 0}
              >
                המשך לשליחת חשבונית
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2.5: Sending ── */}
        {step === STEPS.SENDING && (
          <div className="iflow-step iflow-step-sending">
            <div className="iflow-spinner">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-sage-deep)" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <h3 className="morning-modal-title">שולח חשבונית...</h3>
            <p className="morning-modal-desc">יש להמתין</p>
          </div>
        )}

        {/* ── Step 3: Confirmation ── */}
        {step === STEPS.SUCCESS && sendResult && (
          <div className="iflow-step">
            <div className="iflow-success-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="16" fill="var(--color-sage-soft)" />
                <path d="M10 16L14.5 20.5L22 12.5" stroke="var(--color-sage-deep)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="morning-modal-title">החשבונית נשלחה</h3>
            <p className="morning-modal-desc">
              נשלחה אל {patientEmail}
            </p>

            {sendResult.warning && (
              <div className="morning-test-error" style={{ marginTop: "8px" }}>
                {sendResult.warning}
              </div>
            )}

            {/* Invoice summary card */}
            <div className="iflow-invoice-card">
              <div className="iflow-invoice-badge">נשלחה</div>

              <div className="iflow-invoice-header">
                <div className="iflow-invoice-title">חשבונית מס קבלה</div>
                {sendResult.invoiceId && (
                  <div className="iflow-invoice-num">#{sendResult.invoiceId}</div>
                )}
              </div>

              <div className="iflow-invoice-divider" />

              <div className="iflow-invoice-rows">
                {practitionerName && (
                  <div className="iflow-invoice-row">
                    <span className="iflow-invoice-label">מנפיק</span>
                    <span className="iflow-invoice-value">{practitionerName}</span>
                  </div>
                )}
                <div className="iflow-invoice-row">
                  <span className="iflow-invoice-label">מטופל</span>
                  <span className="iflow-invoice-value">{patientName}</span>
                </div>
                <div className="iflow-invoice-row">
                  <span className="iflow-invoice-label">תאריך</span>
                  <span className="iflow-invoice-value">{sessionDate}</span>
                </div>
                <div className="iflow-invoice-row">
                  <span className="iflow-invoice-label">מייל</span>
                  <span className="iflow-invoice-value" dir="ltr">{patientEmail}</span>
                </div>
              </div>

              <div className="iflow-invoice-divider" />

              <div className="iflow-invoice-rows">
                <div className="iflow-invoice-row">
                  <span className="iflow-invoice-label">טיפול {sendResult.serviceType || serviceType}</span>
                  <span className="iflow-invoice-value">₪{(priceNum / 1.18).toFixed(2)}</span>
                </div>
                <div className="iflow-invoice-row">
                  <span className="iflow-invoice-label">מע״מ (18%)</span>
                  <span className="iflow-invoice-value">₪{(priceNum - priceNum / 1.18).toFixed(2)}</span>
                </div>
              </div>

              <div className="iflow-invoice-divider" />

              <div className="iflow-invoice-row iflow-invoice-total">
                <span className="iflow-invoice-label">סה״כ</span>
                <span className="iflow-invoice-value">₪{priceNum}</span>
              </div>
            </div>

            <div className="morning-modal-actions" style={{ marginTop: "12px" }}>
              <button className="morning-btn morning-btn-save" onClick={handleClose}>
                סיום
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
