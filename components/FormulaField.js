"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TCM_SEED = [
  "Gui Zhi Fu Ling Wan", "Xiao Yao San", "Liu Wei Di Huang Wan",
  "Ba Zhen Tang", "Si Ni San", "Chai Hu Shu Gan San",
  "Tian Wang Bu Xin Dan", "Er Chen Tang", "Zhi Bai Di Huang Wan", "Wen Jing Tang",
];

export default function FormulaField({ label = "פורמולות", triggerLabel = "הוסף פורמולה...", selectedFormulas, onChange }) {
  const supabase = createClient();
  const [presetList, setPresetList] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadPresets() {
      const { data } = await supabase
        .from("formula_presets")
        .select("name")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        setPresetList(data.map((p) => p.name));
      } else {
        for (const name of TCM_SEED) {
          await supabase.from("formula_presets").insert({ name }).select();
        }
        setPresetList([...TCM_SEED]);
      }
    }
    loadPresets();
  }, []);

  const filteredPresets = presetList.filter((f) =>
    f.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const exactPresetMatch = presetList.some(
    (f) => f.toLowerCase() === searchQuery.toLowerCase()
  );

  async function addNewToPreset() {
    const name = searchQuery.trim();
    if (!name || presetList.includes(name)) return;
    await supabase.from("formula_presets").insert({ name });
    setPresetList((prev) => [name, ...prev]);
    onChange([...selectedFormulas, name]);
    setSheetOpen(false);
    setSearchQuery("");
  }

  async function deleteFromPreset(name) {
    await supabase.from("formula_presets").update({ is_deleted: true }).eq("name", name);
    setPresetList((prev) => prev.filter((p) => p !== name));
    onChange(selectedFormulas.filter((s) => s !== name));
  }

  function selectFormula(name) {
    if (!selectedFormulas.includes(name)) {
      onChange([...selectedFormulas, name]);
    }
    setSheetOpen(false);
    setSearchQuery("");
  }

  function removeSelected(name) {
    onChange(selectedFormulas.filter((s) => s !== name));
  }

  return (
    <>
      <span className="field-label">{label}</span>

      {selectedFormulas.length > 0 && (
        <div className="formula-chips-row">
          {selectedFormulas.map((f) => (
            <div key={f} className="formula-chip">
              <span>{f}</span>
              <button onClick={() => removeSelected(f)} aria-label="הסר">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="formula-add-trigger" onClick={() => setSheetOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <span>{triggerLabel}</span>
      </div>

      {sheetOpen && (
        <>
          <div className="sheet-overlay" onClick={() => setSheetOpen(false)} />
          <div className="formula-sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span>בחר פורמולה</span>
              <button onClick={() => setSheetOpen(false)}>סגור</button>
            </div>
            <input
              className="sheet-search-input"
              placeholder="חפש או הוסף פורמולה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="sheet-scroll-list">
              {filteredPresets.map((f) => (
                <div key={f} className="sheet-list-item">
                  <span style={selectedFormulas.includes(f) ? { textDecoration: "line-through", color: "#8A8680" } : {}}>
                    {f}
                  </span>
                  <div className="sheet-item-actions">
                    {!selectedFormulas.includes(f) && (
                      <button onClick={() => selectFormula(f)}>הוסף</button>
                    )}
                    <button
                      className="sheet-item-delete"
                      onClick={() => deleteFromPreset(f)}
                      aria-label="מחק מהרשימה"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {searchQuery && !exactPresetMatch && (
              <div className="sheet-add-new" onClick={addNewToPreset}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <span>הוסף &quot;{searchQuery}&quot; לרשימה</span>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
