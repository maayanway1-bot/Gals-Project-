"use client";

import { useState } from "react";
import { DAY_NAMES, MONTH_NAMES } from "@/lib/utils";

const SHORT_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun

  const cells = [];

  // Previous month trailing days
  const prevMonthLast = new Date(year, month, 0);
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthLast.getDate() - i),
      otherMonth: true,
    });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({
      date: new Date(year, month, d),
      otherMonth: false,
    });
  }

  // Next month leading days (fill to complete 6 rows max, or at least full last row)
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        date: new Date(year, month + 1, d),
        otherMonth: true,
      });
    }
  }

  return cells;
}

export default function CalendarNavModal({ isOpen, currentDate, onClose, onSelectDate, sessionDates = [] }) {
  const [displayMonth, setDisplayMonth] = useState(() => ({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  }));

  // Sync displayMonth when modal opens with a new currentDate
  const [lastCurrentDate, setLastCurrentDate] = useState(currentDate);
  if (currentDate !== lastCurrentDate) {
    setLastCurrentDate(currentDate);
    if (isOpen) {
      setDisplayMonth({ year: currentDate.getFullYear(), month: currentDate.getMonth() });
    }
  }

  if (!isOpen) return null;

  const today = new Date();
  const isViewingToday = isSameDay(currentDate, today);
  const cells = buildCalendarGrid(displayMonth.year, displayMonth.month);
  const monthLabel = `${MONTH_NAMES[displayMonth.month]} ${displayMonth.year}`;

  // Build a set of date strings that have sessions for quick lookup
  const sessionDateSet = new Set(
    sessionDates.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  );

  const hasSession = (date) =>
    sessionDateSet.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);

  const goToPrevMonth = () => {
    setDisplayMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  };

  const goToNextMonth = () => {
    setDisplayMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  };

  const handleSelectDate = (date) => {
    onSelectDate(date);
    onClose();
  };

  const handleGoToToday = () => {
    onSelectDate(new Date());
    onClose();
  };

  return (
    <>
      <div className="cal-modal-backdrop" onClick={onClose} />
      <div className="cal-modal-card">
        {/* Header row */}
        <div className="cal-modal-header">
          <span className="cal-modal-month-label">{monthLabel}</span>
          <div className="cal-modal-nav-buttons">
            <button className="cal-modal-nav-btn" onClick={goToNextMonth} aria-label="חודש הבא">
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path d="M1.5 1.5L6.5 7L1.5 12.5" stroke="#2a2a35" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="cal-modal-nav-btn" onClick={goToPrevMonth} aria-label="חודש קודם">
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path d="M6.5 1.5L1.5 7L6.5 12.5" stroke="#2a2a35" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Day-of-week header */}
        <div className="cal-modal-dow-row">
          {SHORT_DAYS.map((d) => (
            <span key={d} className="cal-modal-dow">{d}</span>
          ))}
        </div>

        {/* Day grid */}
        <div className="cal-modal-grid">
          {cells.map((cell, i) => {
            const isToday = isSameDay(cell.date, today);
            const isSelected = isSameDay(cell.date, currentDate);
            const hasDot = hasSession(cell.date);

            let cls = "cal-modal-cell";
            if (cell.otherMonth) cls += " cal-modal-cell-other";
            if (isToday && !isSelected) cls += " cal-modal-cell-today";
            if (isSelected) cls += " cal-modal-cell-selected";

            return (
              <button
                key={i}
                className={cls}
                onClick={cell.otherMonth ? undefined : () => handleSelectDate(cell.date)}
                disabled={cell.otherMonth}
              >
                <span>{cell.date.getDate()}</span>
                {hasDot && (
                  <span className={`cal-modal-dot${isSelected ? " cal-modal-dot-selected" : ""}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer — go to today */}
        {!isViewingToday && (
          <div className="cal-modal-footer">
            <button className="cal-modal-today-pill" onClick={handleGoToToday}>
              חזור להיום
            </button>
          </div>
        )}
      </div>
    </>
  );
}
