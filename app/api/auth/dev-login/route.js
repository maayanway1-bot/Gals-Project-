import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: "Provide access_token and refresh_token query params" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Redirect to /today with the session cookies set
  const url = new URL("/today", request.url);
  return NextResponse.redirect(url);
}
