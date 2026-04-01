async function refreshGoogleToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
  };
}

export async function getValidAccessToken(supabase, userId) {
  const { data: tokens } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokens) {
    throw new Error("No Google tokens found. Please sign out and sign in again.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at - now < 300 && tokens.refresh_token) {
    const refreshed = await refreshGoogleToken(tokens.refresh_token);
    await supabase
      .from("google_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: refreshed.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return refreshed.access_token;
  }

  return tokens.access_token;
}
