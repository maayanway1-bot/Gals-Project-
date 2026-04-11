export const DAY_NAMES = ["יום א׳","יום ב׳","יום ג׳","יום ד׳","יום ה׳","יום ו׳","שבת"];

export const MONTH_NAMES = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0];
  return parts[0][0] + parts[parts.length - 1][0];
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export function formatDateFull(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatHebDate(date) {
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ב${MONTH_NAMES[date.getMonth()]}`;
}

export function formatMonthYear(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export async function uploadPhoto(supabase, dataUrl, sessionId) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.split("/")[1] || "jpg";
  const filename = `${sessionId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("session-photos")
    .upload(filename, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("session-photos").getPublicUrl(filename);
  return urlData.publicUrl;
}
