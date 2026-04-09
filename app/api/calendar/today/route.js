import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google-auth";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = await getValidAccessToken(supabase, user.id);

    // Use Israel timezone for day boundaries
    const TZ = "Asia/Jerusalem";

    // Accept optional ?date=YYYY-MM-DD param for day navigation
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    let localDate;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      localDate = dateParam;
    } else {
      const now = new Date();
      localDate = now.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
    }

    const startOfDay = new Date(`${localDate}T00:00:00+03:00`);
    const endOfDay = new Date(`${localDate}T23:59:59+03:00`);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      timeZone: TZ,
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

    const MIN_DURATION_EXCLUSIVE = 15;
    const MAX_DURATION_EXCLUSIVE = 120;

    const calData = await calRes.json();
    const events = (calData.items || [])
      .filter((event) => event.start?.dateTime && event.end?.dateTime)
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
          attendees: (event.attendees || [])
            .filter((a) => !a.self)
            .map((a) => ({
              email: a.email?.toLowerCase(),
              name: a.displayName || null,
            })),
        };
      })
      // Only keep events between 15 min and 2 hours
      .filter((event) => event.duration > MIN_DURATION_EXCLUSIVE && event.duration < MAX_DURATION_EXCLUSIVE)
      // Filter out group meetings (5+ non-self attendees)
      .filter((event) => event.attendees.length <= 4);

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
