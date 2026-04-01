import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function SessionDetailPage({ params }) {
  const { id: patientId, sessionId } = await params;
  const supabase = await createClient();

  const [{ data: session }, { data: patient }, { data: note }] =
    await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase
        .from("patients")
        .select("full_name")
        .eq("id", patientId)
        .single(),
      supabase
        .from("notes")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle(),
    ]);

  if (!session) {
    notFound();
  }

  const dateStr = new Date(session.date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeStr = new Date(session.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="p-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">{patient?.full_name}</p>
        <div className="mt-1 flex items-center gap-2">
          {session.session_number && (
            <span className="text-sm font-medium text-primary-light">
              Session #{session.session_number}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">{dateStr}</p>
        <p className="text-sm text-slate-500">
          {timeStr}
          {session.duration ? ` · ${session.duration} min` : ""}
        </p>
      </div>

      {/* Note */}
      <h3 className="mt-6 mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
        Note
      </h3>

      {note ? (
        <>
          <div
            className="whitespace-pre-wrap text-base leading-relaxed text-slate-200"
            dir="auto"
          >
            {note.content}
          </div>
          <Link
            href={`/patients/${patientId}/sessions/${sessionId}/note`}
            className="mt-4 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white active:bg-slate-700 transition-colors"
          >
            Edit Note
          </Link>
        </>
      ) : (
        <Link
          href={`/patients/${patientId}/sessions/${sessionId}/note`}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 py-8 text-slate-400 active:bg-slate-800/50 transition-colors"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Add Note
        </Link>
      )}
    </div>
  );
}
