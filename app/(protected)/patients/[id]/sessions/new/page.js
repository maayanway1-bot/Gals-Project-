"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewSessionPage() {
  const router = useRouter();
  const { id: patientId } = useParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function createSession() {
      const supabase = createClient();

      // Get next session number
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patientId);

      const sessionNumber = (count ?? 0) + 1;

      const { data, error: insertError } = await supabase
        .from("sessions")
        .insert({
          patient_id: patientId,
          session_number: sessionNumber,
          date: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      // Redirect to note editor for this new session
      router.replace(`/patients/${patientId}/sessions/${data.id}/note`);
    }

    createSession();
  }, [patientId, router]);

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          Error creating session: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-slate-500">Creating session...</p>
    </div>
  );
}
