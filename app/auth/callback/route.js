import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // Store Google tokens for Calendar API access
      const session = data.session;
      if (session.provider_token) {
        await supabase.from("google_tokens").upsert(
          {
            user_id: session.user.id,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || "",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
          { onConflict: "user_id" }
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
