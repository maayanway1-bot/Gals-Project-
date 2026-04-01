"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function TodayPage() {
  const [events, setEvents] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch calendar events and patients in parallel
      const [calRes, supabase] = await Promise.all([
        fetch("/api/calendar/today"),
        Promise.resolve(createClient()),
      ]);

      const calData = await calRes.json();
      if (!calRes.ok) {
        setError(calData.error);
        setLoading(false);
        return;
      }

      const { data: patientList } = await supabase
        .from("patients")
        .select("id, full_name, email");

      setEvents(calData.events || []);
      setPatients(patientList || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Match attendee emails to patients
  const matchPatient = (attendees) => {
    if (!attendees?.length) return null;
    for (const att of attendees) {
      const match = patients.find(
        (p) => p.email.toLowerCase() === att.email
      );
      if (match) return { ...match, attendeeEmail: att.email, attendeeName: att.name };
    }
    // No match — return first attendee info for pre-fill
    return {
      id: null,
      attendeeEmail: attendees[0].email,
      attendeeName: attendees[0].name,
    };
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Today</h2>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-sm text-primary-light active:opacity-70 disabled:opacity-40 transition-opacity"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-slate-800"
            />
          ))
        ) : events.length === 0 ? (
          <p className="mt-8 text-center text-slate-500">
            No appointments today.
          </p>
        ) : (
          events.map((event) => {
            const match = matchPatient(event.attendees);
            const hasAttendees = event.attendees?.length > 0;
            const isKnown = match?.id;

            // Determine card content and link
            let href;
            let badge = null;

            if (isKnown) {
              href = `/patients/${match.id}`;
            } else if (hasAttendees) {
              const params = new URLSearchParams();
              if (match.attendeeName) params.set("name", match.attendeeName);
              if (match.attendeeEmail) params.set("email", match.attendeeEmail);
              href = `/patients/new?${params.toString()}`;
              badge = "New Patient";
            } else {
              const params = new URLSearchParams();
              params.set("name", event.title);
              href = `/patients/new?${params.toString()}`;
              badge = "No Email";
            }

            return (
              <Link
                key={event.id}
                href={href}
                className="block rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 active:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">
                    {formatTime(event.start)}
                    {event.end ? ` – ${formatTime(event.end)}` : ""}
                  </span>
                  {badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        badge === "New Patient"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-medium text-white">
                  {isKnown ? match.full_name : event.title}
                </p>
                {isKnown && (
                  <p className="text-xs text-slate-500">Existing patient</p>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
