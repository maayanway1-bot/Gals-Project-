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

    // Fetch events from start of today up to 6 months ahead
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const future = new Date();
    future.setMonth(future.getMonth() + 6);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: future.toISOString(),
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

    const calData = await calRes.json();

    // Filter to events where this email is actually an attendee
    const events = (calData.items || [])
      .filter((event) =>
        (event.attendees || []).some(
          (a) => a.email?.toLowerCase() === email.toLowerCase()
        )
      )
      .map((event) => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        let duration = null;
        if (start && end) {
          duration = Math.round((new Date(end) - new Date(start)) / 60000);
        }
        return {
          id: event.id,
          title: event.summary || "Untitled",
          start,
          end,
          duration,
        };
      });

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
