"use client";

export default function PhotoThumbnail({ src, index = 0, readOnly = false, onRemove }) {
  return (
    <div className="photo-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`תמונה ${index + 1}`} />
      {!readOnly && onRemove && (
        <button className="photo-thumb-delete" onClick={() => onRemove(index)} aria-label="הסר תמונה">
          ×
        </button>
      )}
    </div>
  );
}
