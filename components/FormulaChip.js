"use client";

export default function FormulaChip({ name, readOnly = false, onRemove }) {
  return (
    <div className="formula-chip">
      <span>{name}</span>
      {!readOnly && onRemove && (
        <button onClick={() => onRemove(name)} aria-label="הסר">×</button>
      )}
    </div>
  );
}
