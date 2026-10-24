import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/server/supabase";

/**
 * Where Google sign-in and email links land. Exchanges the one-time code for a
 * session cookie, then opens the app.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const sb = await serverSupabase();
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/today", url.origin));
    } catch {
      // fall through to the error redirect
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
