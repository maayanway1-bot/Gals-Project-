import { NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `אתה עוזר קליני לרופא/ת רפואה סינית, דיקור ושיאצו.
קיבלת הקלטת שמע בעברית של סיכום טיפול שנאמר בקול חופשי על ידי המטפל/ת.
המשימה שלך: לחלץ מהדיקטציה את המידע הקליני הרלוונטי ולארגן אותו בשדות המתאימים.

החזר אך ורק JSON תקני, ללא הסבר, ללא markdown, ללא גרשיים כפולים מיותרים, בפורמט הבא:
{
  "client_report": "...",
  "tongue_and_pulse": "...",
  "treatment_done": "...",
  "treatment_plan": "...",
  "homework": "...",
  "formulas": []
}

כללים:
- אל תמציא מידע שלא הוזכר בהקלטה.
- שדה שלא הוזכר כלל יקבל ערך null — לא מחרוזת ריקה.
- נסח מחדש את הטקסט בכל שדה כך שיהיה תקין דקדוקית בעברית, ברור וקריא, תוך שמירה על המשמעות המקורית. אל תוסיף מידע — רק שפר את הניסוח.
- formulas הוא מערך של שמות פורמולות בלבד (מחרוזות קצרות). השתמש אך ורק בשמות המדויקים מהרשימה שסופקה. אם פורמולה הוזכרה אך לא נמצאת ברשימה — אל תכלול אותה במערך.
- כתוב את כל הטקסט בעברית.
- אל תכלול שום דבר מחוץ ל-JSON.`;

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "gemini_error" }, { status: 500 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "no_audio" }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  if (!audioFile || !(audioFile instanceof Blob) || audioFile.size === 0) {
    return NextResponse.json({ error: "no_audio" }, { status: 400 });
  }

  const chiefComplaint = formData.get("chiefComplaint") || "";
  const formulasRaw = formData.get("formulas") || "[]";

  let formulasList;
  try {
    formulasList = JSON.parse(formulasRaw);
  } catch {
    formulasList = [];
  }

  // Convert audio to base64
  const audioBuffer = await audioFile.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  // Determine MIME type
  const mimeType = audioFile.type || "audio/webm";

  const userText = `התלונה העיקרית של המטופל/ת: ${chiefComplaint}\nרשימת פורמולות קיימות: ${formulasList.join(", ")}`;

  const geminiBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: audioBase64,
            },
          },
          { text: userText },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  let geminiResponse;
  try {
    geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch (err) {
    return NextResponse.json({ error: "gemini_error", detail: "network_failure", message: err.message }, { status: 500 });
  }

  if (!geminiResponse.ok) {
    let detail = "";
    try { detail = await geminiResponse.text(); } catch {}
    return NextResponse.json({ error: "gemini_error", detail, status: geminiResponse.status }, { status: 500 });
  }

  let geminiData;
  try {
    geminiData = await geminiResponse.json();
  } catch (err) {
    return NextResponse.json({ error: "parse_error", detail: "json_decode", message: err.message }, { status: 500 });
  }

  // Extract text from Gemini response
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    const finishReason = geminiData?.candidates?.[0]?.finishReason;
    return NextResponse.json({ error: "parse_error", detail: "no_text", finishReason, candidates: geminiData?.candidates?.length ?? 0 }, { status: 500 });
  }

  // Strip markdown code fences if present
  const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return NextResponse.json({ error: "parse_error", detail: "invalid_json", message: err.message, rawText: cleaned.slice(0, 200) }, { status: 500 });
  }

  // Validate expected shape
  const expectedFields = ["client_report", "tongue_and_pulse", "treatment_done", "treatment_plan", "homework", "formulas"];
  for (const field of expectedFields) {
    if (!(field in parsed)) {
      parsed[field] = field === "formulas" ? [] : null;
    }
  }

  if (!Array.isArray(parsed.formulas)) {
    parsed.formulas = [];
  }

  return NextResponse.json(parsed);
}
