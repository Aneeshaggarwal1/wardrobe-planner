import { localDay } from "../dates";
import { generateCandidates } from "../pairing/generate";
import { featuresOf } from "../pairing/score";
import {
  ironed,
  laundryDone,
  setUnavailable,
  undoWear,
  wearOutfit,
  type WearUndo,
} from "../state/machine";
import type { Decision, Outfit, PairFeedback, WardrobeSnapshot } from "../types";
import type { ItemPatch, LastWear, WardrobeRepo } from "./types";

const SNAPSHOT_KEY = "wp-demo-snapshot-v1";
const UNDO_KEY = "wp-demo-undo-v1";
const SEED_URL = "/demo/seed.json";

function newId(): string {
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
  private undo: WearUndo | null = null;

  constructor(private readonly fetchSeed: () => Promise<WardrobeSnapshot> = defaultFetchSeed) {}

  async load(): Promise<WardrobeSnapshot> {
    if (this.snapshot) return this.snapshot;
    this.snapshot = readJson<WardrobeSnapshot>(SNAPSHOT_KEY) ?? (await this.fetchSeed());
    this.undo = readJson<WearUndo>(UNDO_KEY);
    writeJson(SNAPSHOT_KEY, this.snapshot);
    return this.snapshot;
  }

  private async commit(next: WardrobeSnapshot): Promise<WardrobeSnapshot> {
    this.snapshot = next;
    writeJson(SNAPSHOT_KEY, next);
    return next;
  }

  private async current(): Promise<WardrobeSnapshot> {
    return this.snapshot ?? this.load();
  }

  async wear(outfitId: string): Promise<WardrobeSnapshot> {
    const { snapshot, undo } = wearOutfit(
      await this.current(),
      outfitId,
      new Date().toISOString(),
      newId(),
      localDay(),
    );
    this.undo = undo;
    writeJson(UNDO_KEY, undo);
    return this.commit(snapshot);
  }

  lastWear(): LastWear | null {
    if (!this.undo || this.undo.worn_on !== localDay()) return null;
    return { outfitId: this.undo.previousOutfit.id, worn_on: this.undo.worn_on };
  }

  async undoWear(): Promise<WardrobeSnapshot> {
    if (!this.undo) throw new Error("Nothing to undo");
    const next = undoWear(await this.current(), this.undo, localDay());
    this.undo = null;
    writeJson(UNDO_KEY, null);
    return this.commit(next);
  }

  async laundryDone(): Promise<WardrobeSnapshot> {
    return this.commit(laundryDone(await this.current()));
  }

  async ironed(itemIds?: string[]): Promise<WardrobeSnapshot> {
    return this.commit(ironed(await this.current(), itemIds));
  }

  async setUnavailable(itemId: string, unavailable: boolean): Promise<WardrobeSnapshot> {
    return this.commit(setUnavailable(await this.current(), itemId, unavailable));
  }

  async updateItem(itemId: string, patch: ItemPatch): Promise<WardrobeSnapshot> {
    const s = await this.current();
    return this.commit({
      ...s,
      items: s.items.map((i) => (i.id === itemId ? { ...i, ...patch, tags_confirmed: true } : i)),
    });
  }

  async deleteItem(itemId: string): Promise<WardrobeSnapshot> {
    const s = await this.current();
    const uses = (o: Outfit) =>
      [o.top_id, o.bottom_id, o.shoes_id, o.belt_id, o.layer_id].includes(itemId);
    return this.commit({
      ...s,
      items: s.items.filter((i) => i.id !== itemId),
      outfits: s.outfits.map((o) => (uses(o) ? { ...o, status: "rejected" as const } : o)),
    });
  }

  async generate(): Promise<WardrobeSnapshot> {
    const s = await this.current();
    const { candidates } = generateCandidates(s.items, {
      feedback: s.feedback,
      existing: s.outfits,
      limit: 20,
    });
    const fresh: Outfit[] = candidates.map((c) => ({
      id: newId(),
      user_id: "demo",
      top_id: c.top_id,
      bottom_id: c.bottom_id,
      shoes_id: null,
      belt_id: null,
      layer_id: null,
      status: "candidate",
      score: c.score,
      reason: c.reason,
      times_worn: 0,
      last_worn_at: null,
    }));
    return this.commit({ ...s, outfits: [...s.outfits, ...fresh] });
  }

  async feedback(outfitId: string, decision: Decision): Promise<WardrobeSnapshot> {
    const s = await this.current();
    const outfit = s.outfits.find((o) => o.id === outfitId);
    if (!outfit) throw new Error("Outfit not found");
    const top = s.items.find((i) => i.id === outfit.top_id);
    const bottom = s.items.find((i) => i.id === outfit.bottom_id);
    if (!top || !bottom) throw new Error("Outfit items not found");
    const row: PairFeedback = {
      id: newId(),
      user_id: "demo",
      outfit_id: outfitId,
      decision,
      features: featuresOf(top, bottom),
      top_id: top.id,
      bottom_id: bottom.id,
      created_at: new Date().toISOString(),
    };
    const status = decision === "approve" ? ("approved" as const) : ("rejected" as const);
    return this.commit({
      ...s,
      outfits: s.outfits.map((o) => (o.id === outfitId ? { ...o, status } : o)),
      feedback: [...s.feedback, row],
    });
  }

  async createOutfit(topId: string, bottomId: string): Promise<WardrobeSnapshot> {
    const s = await this.current();
    const existing = s.outfits.find((o) => o.top_id === topId && o.bottom_id === bottomId);
    const id = existing?.id ?? newId();
    const base: WardrobeSnapshot = existing
      ? s
      : {
          ...s,
          outfits: [
            ...s.outfits,
            {
              id,
              user_id: "demo",
              top_id: topId,
              bottom_id: bottomId,
              shoes_id: null,
              belt_id: null,
              layer_id: null,
              status: "candidate",
              score: 0,
              reason: "Your own pick",
              times_worn: 0,
              last_worn_at: null,
            },
          ],
        };
    this.snapshot = base;
    // A manual outfit counts as an approve signal.
    return this.feedback(id, "approve");
  }

  async removeOutfit(outfitId: string): Promise<WardrobeSnapshot> {
    const s = await this.current();
    return this.commit({ ...s, outfits: s.outfits.filter((o) => o.id !== outfitId) });
  }

  async reset(): Promise<WardrobeSnapshot> {
    writeJson(SNAPSHOT_KEY, null);
    writeJson(UNDO_KEY, null);
    this.snapshot = null;
    this.undo = null;
    return this.load();
  }
}

async function defaultFetchSeed(): Promise<WardrobeSnapshot> {
  const res = await fetch(SEED_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load the demo wardrobe (${res.status})`);
  return (await res.json()) as WardrobeSnapshot;
}
