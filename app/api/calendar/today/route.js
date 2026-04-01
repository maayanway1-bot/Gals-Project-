import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google-auth";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = await getValidAccessToken(supabase, user.id);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      if (calRes.status === 401) {
        return NextResponse.json(
          { error: "Google token expired. Please sign out and sign in again." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Calendar API error: ${errText}` },
        { status: calRes.status }
      );
    }

    const calData = await calRes.json();
    const events = (calData.items || []).map((event) => ({
      id: event.id,
      title: event.summary || "Untitled",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      attendees: (event.attendees || [])
        .filter((a) => !a.self)
        .map((a) => ({
          email: a.email?.toLowerCase(),
          name: a.displayName || null,
        })),
    }));

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
