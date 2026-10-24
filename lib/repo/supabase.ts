import { localDay } from "../dates";
import { lastWear } from "../ops";
import type { Decision, WardrobeSnapshot } from "../types";
import type { ItemPatch, LastWear, WardrobeRepo } from "./types";

const CACHE_KEY = "wp-account-snapshot-v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Account-mode repository: every change goes through the app's API routes,
 * which apply the same rules as demo mode and commit them in one transaction.
 * The last snapshot is cached so the app still opens offline (read-only).
 */
export class SupabaseRepo implements WardrobeRepo {
  readonly kind = "supabase" as const;
  private snapshot: WardrobeSnapshot | null = null;
  private loadedAt = 0;

  private async call(method: string, url: string, body?: unknown): Promise<WardrobeSnapshot> {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "content-type": "application/json", "x-local-day": localDay() },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new ApiError("You're offline. Changes need a connection.", 0);
    }
    const data = (await res.json().catch(() => ({}))) as { snapshot?: WardrobeSnapshot; error?: string };
    if (!res.ok || !data.snapshot) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
    this.keep(data.snapshot);
    return data.snapshot;
  }

  private keep(snapshot: WardrobeSnapshot) {
    this.snapshot = snapshot;
    this.loadedAt = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      // storage full or blocked: fine, the cache is a convenience
    }
  }

  async load(): Promise<WardrobeSnapshot> {
    try {
      return await this.call("GET", "/api/wardrobe");
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) return (this.snapshot = JSON.parse(cached) as WardrobeSnapshot);
        } catch {
          // fall through
        }
      }
      throw e;
    }
  }

  /** Photo URLs are signed for an hour; refresh well before they expire. */
  isStale(): boolean {
    return Date.now() - this.loadedAt > 30 * 60 * 1000;
  }

  /** Called by the upload screen after each tagged photo. */
  adopt(snapshot: WardrobeSnapshot): WardrobeSnapshot {
    this.keep(snapshot);
    return snapshot;
  }

  wear(outfitId: string) {
    return this.call("POST", `/api/outfits/${outfitId}/wear`);
  }
  lastWear(): LastWear | null {
    return this.snapshot ? lastWear(this.snapshot, localDay()) : null;
  }
  undoWear() {
    return this.call("POST", "/api/wear/undo");
  }
  laundryDone() {
    return this.call("POST", "/api/laundry/done");
  }
  ironed(itemIds?: string[]) {
    return this.call("POST", "/api/laundry/ironed", itemIds ? { itemIds } : {});
  }
  setUnavailable(itemId: string, unavailable: boolean) {
    return this.call("PATCH", `/api/items/${itemId}`, { unavailable });
  }
  updateItem(itemId: string, patch: ItemPatch) {
    return this.call("PATCH", `/api/items/${itemId}`, { patch });
  }
  deleteItem(itemId: string) {
    return this.call("DELETE", `/api/items/${itemId}`);
  }
  generate() {
    return this.call("POST", "/api/outfits/generate");
  }
  feedback(outfitId: string, decision: Decision) {
    return this.call("POST", `/api/outfits/${outfitId}/feedback`, { decision });
  }
  createOutfit(topId: string, bottomId: string) {
    return this.call("POST", "/api/outfits", { topId, bottomId });
  }
  removeOutfit(outfitId: string) {
    return this.call("DELETE", `/api/outfits/${outfitId}`);
  }

  static clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
  }
}
