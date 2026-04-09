import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google-auth";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email param required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = await getValidAccessToken(supabase, user.id);

    // Fetch events from start of today up to 6 months ahead (Israel timezone)
    const TZ = "Asia/Jerusalem";
    const now = new Date();
    const localDate = now.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
    const startOfDay = new Date(`${localDate}T00:00:00+03:00`);
    const future = new Date();
    future.setMonth(future.getMonth() + 6);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: future.toISOString(),
      timeZone: TZ,
      singleEvents: "true",
      orderBy: "startTime",
      q: email,
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      return NextResponse.json(
        { error: `Calendar API error: ${errText}` },
        { status: calRes.status }
      );
    }

    const MIN_DURATION_EXCLUSIVE = 15;  // minutes (exclusive — more than 15)
    const MAX_DURATION_EXCLUSIVE = 120; // minutes (exclusive — less than 2 hrs)

    const calData = await calRes.json();

    // Filter to events where this email is actually an attendee
    const events = (calData.items || [])
      // Skip all-day events (they only have .date, not .dateTime)
      .filter((event) => event.start?.dateTime && event.end?.dateTime)
      .filter((event) =>
        (event.attendees || []).some(
          (a) => a.email?.toLowerCase() === email.toLowerCase()
        )
      )
      .map((event) => {
        const start = event.start.dateTime;
        const end = event.end.dateTime;
        const duration = Math.round((new Date(end) - new Date(start)) / 60000);
        return {
          id: event.id,
          title: event.summary || "Untitled",
          start,
          end,
          duration,
        };
      })
      // Only keep events between 15 min and 2 hours
      .filter((event) => event.duration > MIN_DURATION_EXCLUSIVE && event.duration < MAX_DURATION_EXCLUSIVE);

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
