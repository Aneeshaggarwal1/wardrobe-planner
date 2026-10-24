/**
 * Supabase settings. NEXT_PUBLIC_ values are baked into the app at build time,
 * so after changing .env.local run `npm run build` again.
 * The key is the project's public key: "anon" (legacy) or "Publishable" (new).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_KEY.length > 20;
}

export const BUCKET = "wardrobe";

/** Storage paths for an item's photos: one folder per user, enforced by storage policies. */
export function photoPaths(userId: string, itemId: string): { image: string; thumb: string } {
  return { image: `${userId}/${itemId}.jpg`, thumb: `${userId}/${itemId}_thumb.jpg` };
}
