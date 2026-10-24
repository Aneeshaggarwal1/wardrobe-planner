"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

let client: SupabaseClient | null = null;

/** The browser Supabase client (sign-in and photo uploads). Null when not configured. */
export function browserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
