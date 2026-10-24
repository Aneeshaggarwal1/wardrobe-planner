import { describe, expect, it } from "vitest";
import {
  TransitionError,
  ironed,
  laundryDone,
  setUnavailable,
  undoWear,
  wearOutfit,
} from "../../lib/state/machine";
import { closestOutfits, rankToday, wearableOutfits } from "../../lib/state/today";
import type { WardrobeSnapshot } from "../../lib/types";
import { loadSeed, makeItem, makeOutfit } from "./fixtures";

const NOW = "2026-10-26T08:00:00.000Z";
const TODAY = "2026-10-26";

function wardrobe(): WardrobeSnapshot {
  return {
    items: [
      makeItem({ id: "shirt", category: "top", wears_before_wash: 1 }),
      makeItem({ id: "shirt2", category: "top", primary_color: "light blue", wears_before_wash: 1 }),
      makeItem({ id: "trousers", category: "bottom", primary_color: "navy", wears_before_wash: 3 }),
      makeItem({
        id: "jeans",
        category: "bottom",
        subcategory: "jeans",
        primary_color: "black",
        wears_before_wash: 5,
        ironing_required: false,
      }),
    ],
    outfits: [
      makeOutfit({ id: "o1", top_id: "shirt", bottom_id: "trousers" }),
      makeOutfit({ id: "o2", top_id: "shirt2", bottom_id: "trousers" }),
      makeOutfit({ id: "o3", top_id: "shirt2", bottom_id: "jeans" }),
    ],
    wearLogs: [],
    feedback: [],
  };
}

const item = (s: WardrobeSnapshot, id: string) => s.items.find((i) => i.id === id)!;

describe("wear this", () => {
  it("sends a shirt to the laundry after one wear; trousers stay ready until the third", () => {
    let s = wardrobe();
    s = wearOutfit(s, "o1", NOW, "w1").snapshot;
    expect(item(s, "shirt").state).toBe("in_laundry");
    expect(item(s, "trousers").state).toBe("ready");
    expect(item(s, "trousers").wears_since_wash).toBe(1);

    s = wearOutfit(s, "o2", NOW, "w2").snapshot;
    expect(item(s, "trousers").state).toBe("ready");
    s = { ...s, items: s.items.map((i) => (i.id === "shirt2" ? { ...i, state: "ready" as const } : i)) };
    s = wearOutfit(s, "o2", NOW, "w3").snapshot;
    expect(item(s, "trousers").state).toBe("in_laundry");
    expect(item(s, "trousers").wears_since_wash).toBe(3);
  });

  it("updates counters, last-worn dates and the wear log", () => {
    const { snapshot } = wearOutfit(wardrobe(), "o1", NOW, "w1");
    const outfit = snapshot.outfits.find((o) => o.id === "o1")!;
    expect(outfit.times_worn).toBe(1);
    expect(outfit.last_worn_at).toBe(NOW);
    expect(item(snapshot, "shirt").last_worn_at).toBe(NOW);
    expect(snapshot.wearLogs).toEqual([
      { id: "w1", user_id: "u1", outfit_id: "o1", worn_on: TODAY, created_at: NOW },
    ]);
  });

  it("refuses an outfit with any item not ready, and does not mutate its input", () => {
    const s = wardrobe();
    const worn = wearOutfit(s, "o1", NOW, "w1").snapshot;
    expect(() => wearOutfit(worn, "o1", NOW, "w2")).toThrow(TransitionError);
    expect(item(s, "shirt").state).toBe("ready");
    expect(s.wearLogs).toHaveLength(0);
  });

  it("refuses unapproved outfits", () => {
    const s = wardrobe();
    s.outfits[0] = { ...s.outfits[0]!, status: "candidate" };
    expect(() => wearOutfit(s, "o1", NOW, "w1")).toThrow(TransitionError);
  });
});

describe("undo", () => {
  it("restores the exact prior state on the same day", () => {
    const original = wardrobe();
    const { snapshot, undo } = wearOutfit(original, "o1", NOW, "w1");
    expect(undoWear(snapshot, undo, TODAY)).toEqual(original);
  });

  it("is refused on a later day or a second time", () => {
    const { snapshot, undo } = wearOutfit(wardrobe(), "o1", NOW, "w1");
    expect(() => undoWear(snapshot, undo, "2026-10-27")).toThrow(TransitionError);
    const undone = undoWear(snapshot, undo, TODAY);
    expect(() => undoWear(undone, undo, TODAY)).toThrow(TransitionError);
  });
});

describe("laundry", () => {
  it("laundry done moves washed items to needs ironing, or ready if no ironing is needed", () => {
    let s = wardrobe();
    s = wearOutfit(s, "o1", NOW, "w1").snapshot;
    s = { ...s, items: s.items.map((i) => (i.id === "jeans" ? { ...i, state: "in_laundry" as const, wears_since_wash: 5 } : i)) };
    s = laundryDone(s);
    expect(item(s, "shirt").state).toBe("needs_ironing");
    expect(item(s, "shirt").wears_since_wash).toBe(0);
    expect(item(s, "jeans").state).toBe("ready");
    expect(item(s, "jeans").wears_since_wash).toBe(0);
    // A ready item that was worn but not washed keeps its count.
    expect(item(s, "trousers").wears_since_wash).toBe(1);
  });

  it("ironed moves all, or only the listed, items to ready", () => {
    let s = wardrobe();
    s = { ...s, items: s.items.map((i) => (i.category === "top" ? { ...i, state: "needs_ironing" as const } : i)) };
    const one = ironed(s, ["shirt"]);
    expect(item(one, "shirt").state).toBe("ready");
    expect(item(one, "shirt2").state).toBe("needs_ironing");
    const all = ironed(s);
    expect(item(all, "shirt2").state).toBe("ready");
  });
});

describe("unavailable toggle", () => {
  it("works from any state and back to ready", () => {
    let s = setUnavailable(wardrobe(), "shirt", true);
    expect(item(s, "shirt").state).toBe("unavailable");
    s = setUnavailable(s, "shirt", false);
    expect(item(s, "shirt").state).toBe("ready");
  });

  it("refuses making a non-unavailable item available", () => {
    expect(() => setUnavailable(wardrobe(), "shirt", false)).toThrow(TransitionError);
  });
});

describe("today ranking", () => {
  it("shows only approved outfits whose every item is ready", () => {
    let s = wardrobe();
    s = wearOutfit(s, "o1", NOW, "w1").snapshot; // shirt goes to laundry
    s.outfits.push(makeOutfit({ id: "o4", top_id: "shirt2", bottom_id: "trousers", status: "candidate" }));
    expect(wearableOutfits(s).map((o) => o.id).sort()).toEqual(["o2", "o3"]);
  });

  it("puts never-worn first, then least recently worn", () => {
    const s = wardrobe();
    s.outfits[0] = { ...s.outfits[0]!, last_worn_at: "2026-10-01T08:00:00.000Z" };
    s.outfits[1] = { ...s.outfits[1]!, last_worn_at: "2026-10-10T08:00:00.000Z" };
    expect(rankToday(s, { today: TODAY }).map((o) => o.id)).toEqual(["o3", "o1", "o2"]);
  });

  it("sinks outfits whose top was worn in the last 3 days", () => {
    const s = wardrobe();
    s.items = s.items.map((i) => (i.id === "shirt2" ? { ...i, last_worn_at: "2026-10-25T08:00:00.000Z" } : i));
    expect(rankToday(s, { today: TODAY }).map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
  });

  it("caps the count and shuffles only within the pool", () => {
    const seed = loadSeed();
    const top4 = rankToday(seed, { today: TODAY, count: 4 });
    expect(top4).toHaveLength(4);
    let n = 0;
    const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const pool = new Set(rankToday(seed, { today: TODAY, count: 10 }).map((o) => o.id));
    const shuffled = rankToday(seed, { today: TODAY, count: 4, random: rng });
    expect(shuffled).toHaveLength(4);
    for (const o of shuffled) expect(pool.has(o.id)).toBe(true);
  });
});

describe("closest outfits (empty state)", () => {
  it("names the single blocking item and the action that unblocks it", () => {
    let s = wardrobe();
    s = { ...s, items: s.items.map((i) => (i.category === "top" ? { ...i, state: "needs_ironing" as const } : i)) };
    expect(wearableOutfits(s)).toHaveLength(0);
    const closest = closestOutfits(s);
    expect(closest.length).toBeGreaterThan(0);
    expect(closest[0]!.action).toMatch(/^Iron the (white|light blue) formal shirt$/);
  });

  it("skips outfits blocked by more than one item", () => {
    let s = wardrobe();
    s = { ...s, items: s.items.map((i) => ({ ...i, state: "in_laundry" as const })) };
    expect(closestOutfits(s)).toEqual([]);
  });

  it("finds something to unblock in the demo wardrobe", () => {
    const seed = loadSeed();
    expect(wearableOutfits(seed).length).toBeGreaterThan(0);
    expect(closestOutfits(seed).length).toBeGreaterThan(0);
  });
});
