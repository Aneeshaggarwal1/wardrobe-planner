import { localDay } from "../dates";
import { applyOp, lastWear, ruleCandidates, type Op } from "../ops";
import type { Candidate } from "../pairing/generate";
import { localStorageStore, type SnapshotStore } from "../store";
import type { Decision, Item, WardrobeSnapshot } from "../types";
import type { GenerateInfo, ItemPatch, LastWear, WardrobeRepo } from "./types";

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const EMPTY_SNAPSHOT: WardrobeSnapshot = { items: [], outfits: [], wearLogs: [], feedback: [] };

export type Reranker = (
  pool: readonly Candidate[],
  items: readonly Item[],
  keep: number,
) => Promise<{ candidates: Candidate[]; usedModel: boolean }>;

export interface LocalRepoOptions {
  kind: "demo" | "mine";
  store: SnapshotStore;
  /** The wardrobe to start from when the store is empty. */
  seed: () => Promise<WardrobeSnapshot>;
  /** Optional AI re-rank for "generate"; without it the rule order is used. */
  rerank?: Reranker;
}

/**
 * Keeps a wardrobe on this device and applies the same rules everywhere
 * (lib/ops.ts). Serves both the demo (localStorage, seeded) and your own
 * wardrobe (IndexedDB, starts empty). Never sends your wardrobe anywhere.
 */
export class LocalRepo implements WardrobeRepo {
  readonly kind: "demo" | "mine";
  private snapshot: WardrobeSnapshot | null = null;
  private generated: GenerateInfo | null = null;
  /** Changes run one at a time, so two photos tagged at once can't overwrite each other. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: LocalRepoOptions) {
    this.kind = options.kind;
  }

  async load(): Promise<WardrobeSnapshot> {
    if (this.snapshot) return this.snapshot;
    const stored = await this.options.store.get();
    this.snapshot = stored ?? (await this.options.seed());
    if (!stored) await this.options.store.set(this.snapshot);
    return this.snapshot;
  }

  /** Run `task` after every change already queued has finished. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async save(next: WardrobeSnapshot): Promise<WardrobeSnapshot> {
    await this.options.store.set(next);
    this.snapshot = next;
    return next;
  }

  /** Apply one op to the latest saved snapshot. Call only inside `exclusive`. */
  private async applyNow(op: Op): Promise<WardrobeSnapshot> {
    const current = this.snapshot ?? (await this.load());
    const next = applyOp(current, op, {
      userId: this.kind,
      now: new Date().toISOString(),
      today: localDay(),
      newId,
    });
    return this.save(next);
  }

  private apply(op: Op): Promise<WardrobeSnapshot> {
    return this.exclusive(() => this.applyNow(op));
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
  addItem(item: Item) {
    return this.apply({ type: "addItem", item });
  }
  updateItem(itemId: string, patch: ItemPatch) {
    return this.apply({ type: "updateItem", itemId, patch });
  }
  deleteItem(itemId: string) {
    return this.apply({ type: "deleteItem", itemId });
  }

  generate() {
    return this.exclusive(async () => {
      const current = this.snapshot ?? (await this.load());
      const pool = ruleCandidates(current, 30);
      const { candidates, usedModel } = this.options.rerank
        ? await this.options.rerank(pool, current.items, 20)
        : { candidates: pool.slice(0, 20), usedModel: false };
      const next = await this.applyNow({ type: "addCandidates", candidates });
      this.generated = { added: next.outfits.length - current.outfits.length, usedModel };
      return next;
    });
  }
  lastGenerate(): GenerateInfo | null {
    return this.generated;
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

  replaceAll(snapshot: WardrobeSnapshot) {
    return this.exclusive(() => this.save(snapshot));
  }

  reset(): Promise<WardrobeSnapshot> {
    return this.exclusive(async () => {
      await this.options.store.set(null);
      this.snapshot = null;
      return this.load();
    });
  }
}

const DEMO_KEY = "wp-demo-snapshot-v1";

async function fetchDemoSeed(): Promise<WardrobeSnapshot> {
  const res = await fetch("/demo/seed.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load the demo wardrobe (${res.status})`);
  return (await res.json()) as WardrobeSnapshot;
}

/** The sample wardrobe: localStorage, seeded from public/demo/seed.json, rules only. */
export function demoRepo(): LocalRepo {
  return new LocalRepo({ kind: "demo", store: localStorageStore(DEMO_KEY), seed: fetchDemoSeed });
}
