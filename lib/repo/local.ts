import { localDay } from "../dates";
import { applyOp, lastWear, ruleCandidates, type Op } from "../ops";
import type { Decision, WardrobeSnapshot } from "../types";
import type { ItemPatch, LastWear, WardrobeRepo } from "./types";

const SNAPSHOT_KEY = "wp-demo-snapshot-v1";
const SEED_URL = "/demo/seed.json";

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the demo still works for this session.
  }
}

/**
 * Demo-mode repository: the whole wardrobe lives in localStorage, seeded from
 * public/demo/seed.json. Never calls Supabase or the Claude API.
 */
export class LocalRepo implements WardrobeRepo {
  readonly kind = "demo" as const;
  private snapshot: WardrobeSnapshot | null = null;

  constructor(private readonly fetchSeed: () => Promise<WardrobeSnapshot> = defaultFetchSeed) {}

  async load(): Promise<WardrobeSnapshot> {
    if (this.snapshot) return this.snapshot;
    this.snapshot = readJson<WardrobeSnapshot>(SNAPSHOT_KEY) ?? (await this.fetchSeed());
    writeJson(SNAPSHOT_KEY, this.snapshot);
    return this.snapshot;
  }

  private async apply(op: Op): Promise<WardrobeSnapshot> {
    const current = this.snapshot ?? (await this.load());
    const next = applyOp(current, op, {
      userId: "demo",
      now: new Date().toISOString(),
      today: localDay(),
      newId,
    });
    this.snapshot = next;
    writeJson(SNAPSHOT_KEY, next);
    return next;
  }

  wear(outfitId: string) {
    return this.apply({ type: "wear", outfitId });
  }
  lastWear(): LastWear | null {
    return this.snapshot ? lastWear(this.snapshot, localDay()) : null;
  }
  undoWear() {
    return this.apply({ type: "undoWear" });
  }
  laundryDone() {
    return this.apply({ type: "laundryDone" });
  }
  ironed(itemIds?: string[]) {
    return this.apply({ type: "ironed", itemIds });
  }
  setUnavailable(itemId: string, unavailable: boolean) {
    return this.apply({ type: "setUnavailable", itemId, unavailable });
  }
  updateItem(itemId: string, patch: ItemPatch) {
    return this.apply({ type: "updateItem", itemId, patch });
  }
  deleteItem(itemId: string) {
    return this.apply({ type: "deleteItem", itemId });
  }
  async generate() {
    const current = this.snapshot ?? (await this.load());
    return this.apply({ type: "addCandidates", candidates: ruleCandidates(current, 20) });
  }
  feedback(outfitId: string, decision: Decision) {
    return this.apply({ type: "feedback", outfitId, decision });
  }
  createOutfit(topId: string, bottomId: string) {
    return this.apply({ type: "createOutfit", topId, bottomId });
  }
  removeOutfit(outfitId: string) {
    return this.apply({ type: "removeOutfit", outfitId });
  }

  async reset(): Promise<WardrobeSnapshot> {
    writeJson(SNAPSHOT_KEY, null);
    try {
      window.localStorage.removeItem("wp-demo-undo-v1"); // pre-phase-4 key
    } catch {
      // ignore
    }
    this.snapshot = null;
    return this.load();
  }
}

async function defaultFetchSeed(): Promise<WardrobeSnapshot> {
  const res = await fetch(SEED_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load the demo wardrobe (${res.status})`);
  return (await res.json()) as WardrobeSnapshot;
}
