"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function PatientProfilePage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pastExpanded, setPastExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch patient + sessions with notes in parallel
    const [{ data: pat }, { data: sess }] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase
        .from("sessions")
        .select("id, session_number, date, duration, google_event_id, notes(id, content)")
        .eq("patient_id", id)
        .order("date", { ascending: false }),
    ]);

    setPatient(pat);
    setSessions(sess || []);

    // Fetch upcoming calendar events for this patient
    if (pat?.email) {
      try {
        const res = await fetch(
          `/api/calendar/patient?email=${encodeURIComponent(pat.email)}`
        );
        if (res.ok) {
          const data = await res.json();
          setUpcomingEvents(data.events || []);
        }
      } catch {
        // Calendar fetch failed silently — upcoming section will be empty
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !patient) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-slate-800" />
        <div className="h-8 animate-pulse rounded-xl bg-slate-800" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-800" />
      </div>
    );
  }

  const pastSessions = sessions.filter(
    (s) => new Date(s.date) <= new Date()
  );
  const pastCount = pastSessions.length;

  // Filter out calendar events that already have a session in DB (by google_event_id)
  const existingEventIds = new Set(
    sessions.map((s) => s.google_event_id).filter(Boolean)
  );
  const calendarEvents = upcomingEvents.filter(
    (e) => !existingEventIds.has(e.id)
  );

  // Split calendar events into today and upcoming
  const now = new Date();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const todayEvents = calendarEvents.filter(
    (e) => new Date(e.start) < startOfTomorrow
  );
  const futureEvents = calendarEvents.filter(
    (e) => new Date(e.start) >= startOfTomorrow
  );

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-xl font-semibold text-white">
          {patient.full_name}
        </h2>
        {patient.chief_complaint && (
          <p className="mt-1 text-sm text-slate-400" dir="auto">
            {patient.chief_complaint}
          </p>
        )}
        <div className="mt-3 flex gap-4 text-sm text-slate-500">
          <span>
            {pastCount} session{pastCount !== 1 ? "s" : ""}
          </span>
          <span>{patient.phone}</span>
        </div>
      </div>

      {/* Today */}
      {todayEvents.length > 0 && (
        <>
          <h3 className="mt-6 mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
            Today
          </h3>
          <div className="space-y-2">
            {todayEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-primary/30 bg-slate-900 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">
                      {formatTime(event.start)}
                      {event.duration ? ` · ${event.duration} min` : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upcoming */}
      {futureEvents.length > 0 && (
        <>
          <h3 className="mt-6 mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
            Upcoming
          </h3>
          <div className="space-y-2">
            {futureEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">
                      {formatDate(event.start)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatTime(event.start)}
                      {event.duration ? ` · ${event.duration} min` : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Past Sessions */}
      <button
        onClick={() => setPastExpanded((v) => !v)}
        className="mt-6 mb-3 flex w-full items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-500"
      >
        <svg
          className={`h-4 w-4 transition-transform ${pastExpanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        Past Sessions ({pastCount})
      </button>

      {pastExpanded && (pastCount === 0 ? (
        <p className="text-center text-slate-500 mt-4">No past sessions.</p>
      ) : (
        <div className="space-y-2">
          {pastSessions.map((session) => {
            const note = session.notes?.[0];
            const firstLine = note?.content
              ? note.content.split("\n")[0].slice(0, 80)
              : null;

            return (
              <Link
                key={session.id}
                href={`/patients/${id}/sessions/${session.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 active:bg-slate-800 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {session.session_number && (
                      <span className="text-xs font-medium text-primary-light">
                        #{session.session_number}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {formatDate(session.date)}
                    </span>
                  </div>
                  {firstLine ? (
                    <p
                      className="mt-0.5 truncate text-sm text-slate-300"
                      dir="auto"
                    >
                      {firstLine}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-slate-500 italic">
                      No note
                    </p>
                  )}
                </div>
                <svg
                  className="ml-2 h-5 w-5 shrink-0 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                  />
                </svg>
              </Link>
            );
          })}
        </div>
      ))}

      {/* FAB - New Session Note */}
      <Link
        href={`/patients/${id}/sessions/new`}
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/25 active:scale-95 transition-transform"
      >
        <svg
          className="h-7 w-7 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
      </Link>
    </div>
  );
}
