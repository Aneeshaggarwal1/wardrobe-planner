import type { Candidate } from "../pairing/generate";
import { PALETTE, type PaletteColor } from "../pairing/palette";
import { applyRanking, toRankItem, type RankEntry } from "../pairing/ranking";
import type { Category, Fit, Item, Pattern } from "../types";

/** Tags as the /api/tag endpoint returns them. */
export interface PhotoTags {
  category: Category;
  subcategory: string;
  primary_color: PaletteColor;
  secondary_color: PaletteColor | null;
  pattern: Pattern;
  formality: number;
  fit: Fit | null;
  confidence: number;
}

export class AiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 means the request never reached the server. */
    readonly status: number,
  ) {
    super(message);
  }
}

const PASSCODE_KEY = "wp-passcode";

export function getPasscode(): string | null {
  try {
    return window.localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

export function setPasscode(value: string | null): void {
  try {
    if (value) window.localStorage.setItem(PASSCODE_KEY, value);
    else window.localStorage.removeItem(PASSCODE_KEY);
  } catch {
    // ignore
  }
}

async function post<T>(url: string, body: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-passcode": getPasscode() ?? "" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError("You're offline. Tagging needs a connection.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

const CATEGORIES: readonly string[] = ["top", "bottom", "shoes", "belt", "layer"];
const PATTERNS: readonly string[] = ["solid", "stripe", "check", "print", "textured"];
const PALETTE_SET: ReadonlySet<string> = new Set(PALETTE);

/** Defensive check of the server's reply before it becomes an item. */
export function isPhotoTags(x: unknown): x is PhotoTags {
  if (typeof x !== "object" || x === null) return false;
  const t = x as Record<string, unknown>;
  return (
    CATEGORIES.includes(t.category as string) &&
    typeof t.subcategory === "string" &&
    PALETTE_SET.has(t.primary_color as string) &&
    (t.secondary_color === null || PALETTE_SET.has(t.secondary_color as string)) &&
    PATTERNS.includes(t.pattern as string) &&
    Number.isInteger(t.formality) &&
    (t.formality as number) >= 1 &&
    (t.formality as number) <= 5 &&
    typeof t.confidence === "number"
  );
}

/** Send one photo (base64 JPEG) for tagging. The server does not keep it. */
export async function tagPhoto(imageBase64: string, fetchImpl?: typeof fetch): Promise<PhotoTags> {
  const { tags } = await post<{ tags: unknown }>("/api/tag", { image: imageBase64 }, fetchImpl);
  if (!isPhotoTags(tags)) throw new AiError("The tagger sent back something unexpected. Try again.", 502);
  return tags;
}

/**
 * Re-rank rule candidates with the AI stylist, sending tags only. Any failure
 * keeps the rule order, so generating outfits always works.
 */
export async function rerankWithAi(
  pool: readonly Candidate[],
  items: readonly Item[],
  keep: number,
  fetchImpl?: typeof fetch,
): Promise<{ candidates: Candidate[]; usedModel: boolean }> {
  const fallback = { candidates: pool.slice(0, keep), usedModel: false };
  if (pool.length === 0 || !getPasscode()) return fallback;
  const used = new Set(pool.flatMap((c) => [c.top_id, c.bottom_id]));
  try {
    const { ranking } = await post<{ ranking: RankEntry[] | null }>(
      "/api/rerank",
      {
        pairs: pool.map((c) => ({ top_id: c.top_id, bottom_id: c.bottom_id, score: c.score })),
        items: items.filter((i) => used.has(i.id)).map(toRankItem),
        keep,
      },
      fetchImpl,
    );
    if (!Array.isArray(ranking) || ranking.length === 0) return fallback;
    return { candidates: applyRanking(pool, ranking, keep), usedModel: true };
  } catch {
    return fallback;
  }
}
