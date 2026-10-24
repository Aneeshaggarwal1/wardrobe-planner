import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "../supabase/env";
import { HttpError } from "./http";

/**
 * A Supabase client acting as the signed-in user (session from cookies), so
 * every query runs under row-level security. No service-role key is used.
 */
export async function serverSupabase(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured()) throw new HttpError(503, "Accounts aren't set up on this server yet");
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component render: cookies are read-only there.
        }
      },
    },
  });
}

export async function requireUser(sb: SupabaseClient): Promise<User> {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Please sign in again");
  return data.user;
}
