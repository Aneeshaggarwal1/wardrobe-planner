import type { SupabaseClient, User } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { diffSnapshots, isEmptyDiff } from "../diff";
import { applyOp, type Op, type OpContext } from "../ops";
import { BUCKET } from "../supabase/env";
import type { Item, Outfit, PairFeedback, WardrobeSnapshot, WearLog } from "../types";
import { HttpError, errorResponse, localDayFrom } from "./http";
import { requireUser, serverSupabase } from "./supabase";

const SIGNED_URL_SECONDS = 60 * 60;

/** Fill each item's display URL with a short-lived signed URL for its thumbnail. */
export async function signItems(sb: SupabaseClient, items: Item[]): Promise<Item[]> {
  const paths = items.map((i) => i.thumb_path).filter((p): p is string => !!p);
  if (paths.length === 0) return items;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw new Error(`Signing photo URLs failed: ${error.message}`);
  const urls = new Map<string | null, string>(
    (data ?? []).map((d: { path: string | null; signedUrl: string }) => [d.path, d.signedUrl] as const),
  );
  return items.map((i) => {
    const url = (i.thumb_path && urls.get(i.thumb_path)) || "";
    return { ...i, image_url: url, thumb_url: url };
  });
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Loading ${what} failed: ${res.error.message}`);
  return res.data as T;
}

/** The signed-in user's whole wardrobe. Row-level security scopes every query. */
export async function loadSnapshot(sb: SupabaseClient): Promise<WardrobeSnapshot> {
  const [items, outfits, wearLogs, feedback] = await Promise.all([
    sb.from("items").select("*").order("created_at"),
    sb.from("outfits").select("*").order("created_at"),
    sb.from("wear_logs").select("*").order("created_at"),
    sb.from("pair_feedback").select("*").order("created_at"),
  ]);
  return {
    items: await signItems(sb, check(items, "items") as Item[]),
    outfits: check(outfits, "outfits") as Outfit[],
    wearLogs: check(wearLogs, "wear history") as WearLog[],
    feedback: check(feedback, "feedback") as PairFeedback[],
  };
}

/** Write the difference between two snapshots in one transaction (wp_commit). */
export async function commit(sb: SupabaseClient, before: WardrobeSnapshot, after: WardrobeSnapshot): Promise<void> {
  const diff = diffSnapshots(before, after);
  if (isEmptyDiff(diff)) return;
  const { error } = await sb.rpc("wp_commit", { diff });
  if (error) throw new Error(`Saving failed: ${error.message}`);
}

export function opContext(user: User, req: Request): OpContext {
  return { userId: user.id, now: new Date().toISOString(), today: localDayFrom(req), newId: randomUUID };
}

export interface RouteEnv {
  req: Request;
  sb: SupabaseClient;
  user: User;
}

/** Signed-in route boilerplate: auth, then the handler, with errors mapped to JSON. */
export function route<C = unknown>(handler: (env: RouteEnv, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const sb = await serverSupabase();
      const user = await requireUser(sb);
      return await handler({ req, sb, user }, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export type IdContext = { params: Promise<{ id: string }> };

/** Load → apply one op → commit the diff → return the new snapshot. */
export async function runOp({ req, sb, user }: RouteEnv, op: Op): Promise<{ before: WardrobeSnapshot; after: WardrobeSnapshot }> {
  const before = await loadSnapshot(sb);
  const after = applyOp(before, op, opContext(user, req));
  await commit(sb, before, after);
  return { before, after };
}

const DAY_MS = 86_400_000;

/** Daily caps on AI calls (rolling 24 hours). Records the attempt when allowed. */
export async function spendQuota(sb: SupabaseClient, user: User, kind: "tag" | "generate", limit: number): Promise<void> {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error } = await sb
    .from("usage")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) throw new Error(`Checking usage failed: ${error.message}`);
  if ((count ?? 0) >= limit) {
    const what = kind === "tag" ? `${limit} photo tags` : `${limit} outfit generations`;
    throw new HttpError(429, `Daily limit reached (${what} per day). Try again tomorrow.`);
  }
  const insert = await sb.from("usage").insert({ user_id: user.id, kind });
  if (insert.error) throw new Error(`Recording usage failed: ${insert.error.message}`);
}

export const LIMITS = { tag: 60, generate: 10 } as const;
