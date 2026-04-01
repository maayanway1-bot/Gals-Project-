"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("patients")
      .select("id, full_name, phone, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPatients(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = patients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4">
      {/* Search bar */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search patients..."
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
      />

      {/* Patient list */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-slate-800"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-center text-slate-500">
            {search ? "No patients match your search." : "No patients yet."}
          </p>
        ) : (
          filtered.map((patient) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 active:bg-slate-800 transition-colors"
            >
              <div>
                <p className="font-medium text-white">{patient.full_name}</p>
                <p className="text-sm text-slate-400">{patient.phone}</p>
              </div>
              <svg
                className="h-5 w-5 text-slate-600"
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
          ))
        )}
      </div>

      {/* FAB */}
      <Link
        href="/patients/new"
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
