import { beforeEach, describe, expect, it } from "vitest";
import { LocalRepo } from "../../lib/repo/local";
import { wearableOutfits } from "../../lib/state/today";
import { loadSeed } from "./fixtures";

/** Minimal localStorage stand-in for the node test environment. */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = { localStorage: new MemoryStorage() };
});

const repo = () => new LocalRepo(async () => loadSeed());

describe("LocalRepo (demo mode)", () => {
  it("loads the seed and persists changes across instances", async () => {
    const a = repo();
    const s = await a.load();
    const outfit = wearableOutfits(s)[0]!;
    await a.wear(outfit.id);
    const b = repo();
    const reloaded = await b.load();
    expect(reloaded.wearLogs.length).toBe(s.wearLogs.length + 1);
    expect(b.lastWear()?.outfitId).toBe(outfit.id);
  });

  it("undo restores the snapshot", async () => {
    const r = repo();
    const s = await r.load();
    await r.wear(wearableOutfits(s)[0]!.id);
    expect(await r.undoWear()).toEqual(s);
    expect(r.lastWear()).toBeNull();
  });

  it("generate adds candidates; feedback approves and records taste", async () => {
    const r = repo();
    const s = await r.load();
    const g = await r.generate();
    const candidates = g.outfits.filter((o) => o.status === "candidate");
    expect(candidates.length).toBeGreaterThan(0);
    const after = await r.feedback(candidates[0]!.id, "approve");
    expect(after.outfits.filter((o) => o.status === "approved").length).toBe(
      s.outfits.filter((o) => o.status === "approved").length + 1,
    );
    expect(after.feedback).toHaveLength(1);
  });

  it("deleting an item removes the outfits and wear history that use it", async () => {
    const r = repo();
    const s = await r.load();
    const used = s.outfits[0]!.top_id;
    const after = await r.deleteItem(used);
    expect(after.items.some((i) => i.id === used)).toBe(false);
    expect(after.outfits.some((o) => o.top_id === used || o.bottom_id === used)).toBe(false);
    const outfitIds = new Set(after.outfits.map((o) => o.id));
    for (const log of after.wearLogs) expect(outfitIds.has(log.outfit_id)).toBe(true);
  });

  it("a manual outfit is approved and counts as an approve signal", async () => {
    const r = repo();
    await r.load();
    const after = await r.createOutfit("polo-olive", "chinos-khaki");
    const o = after.outfits.find((x) => x.top_id === "polo-olive" && x.bottom_id === "chinos-khaki")!;
    expect(o.status).toBe("approved");
    expect(after.feedback.at(-1)?.decision).toBe("approve");
  });

  it("reset restores the seed", async () => {
    const r = repo();
    const s = await r.load();
    await r.laundryDone();
    expect(await r.reset()).toEqual(s);
  });
});
