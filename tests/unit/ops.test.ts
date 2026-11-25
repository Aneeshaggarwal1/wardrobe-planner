import { describe, expect, it } from "vitest";
import { applyOp, lastWear, ruleCandidates, type OpContext } from "../../lib/ops";
import { TransitionError } from "../../lib/state/machine";
import { wearableOutfits } from "../../lib/state/today";
import { loadSeed } from "./fixtures";

const TODAY = "2026-10-26";

function ctx(today = TODAY): OpContext {
  let n = 0;
  return { userId: "u1", now: `${today}T03:00:00.000Z`, today, newId: () => `new-${++n}` };
}

describe("applyOp", () => {
  it("wear stores an undo payload on the log; only the newest wear keeps it", () => {
    const seed = loadSeed();
    const [a, b] = wearableOutfits(seed);
    const once = applyOp(seed, { type: "wear", outfitId: a!.id }, ctx());
    expect(once.wearLogs.at(-1)?.undo?.previousOutfit.id).toBe(a!.id);
    expect(lastWear(once, TODAY)?.outfitId).toBe(a!.id);

    const c2: OpContext = { ...ctx(), now: `${TODAY}T04:00:00.000Z`, newId: () => "second" };
    const twice = applyOp(once, { type: "wear", outfitId: b!.id }, c2);
    expect(twice.wearLogs.filter((l) => l.undo)).toHaveLength(1);
    expect(lastWear(twice, TODAY)?.outfitId).toBe(b!.id);
  });

  it("undoWear reverts today's wear exactly, and refuses on another day", () => {
    const seed = loadSeed();
    const outfit = wearableOutfits(seed)[0]!;
    const worn = applyOp(seed, { type: "wear", outfitId: outfit.id }, ctx());
    expect(applyOp(worn, { type: "undoWear" }, ctx())).toEqual(seed);
    expect(() => applyOp(worn, { type: "undoWear" }, ctx("2026-10-27"))).toThrow(TransitionError);
    expect(lastWear(worn, "2026-10-27")).toBeNull();
  });

  it("undo keeps tag edits made after the wear", () => {
    const seed = loadSeed();
    const outfit = wearableOutfits(seed)[0]!;
    let s = applyOp(seed, { type: "wear", outfitId: outfit.id }, ctx());
    s = applyOp(s, { type: "updateItem", itemId: outfit.top_id, patch: { formality: 2 } }, ctx());
    s = applyOp(s, { type: "undoWear" }, ctx());
    const top = s.items.find((i) => i.id === outfit.top_id)!;
    expect(top.formality).toBe(2);
    expect(top.state).toBe("ready");
  });

  it("addCandidates skips pairs already in the bank", () => {
    const seed = loadSeed();
    const existing = seed.outfits[0]!;
    const fresh = ruleCandidates(seed, 5);
    const dup = { ...fresh[0]!, top_id: existing.top_id, bottom_id: existing.bottom_id };
    const s = applyOp(seed, { type: "addCandidates", candidates: [dup, ...fresh] }, ctx());
    expect(s.outfits.length).toBe(seed.outfits.length + fresh.length);
  });

  it("createOutfit approves an existing candidate instead of duplicating it", () => {
    const seed = loadSeed();
    const c = ruleCandidates(seed, 1)[0]!;
    const queued = applyOp(seed, { type: "addCandidates", candidates: [c] }, ctx());
    const s = applyOp(queued, { type: "createOutfit", topId: c.top_id, bottomId: c.bottom_id }, ctx());
    const matches = s.outfits.filter((o) => o.top_id === c.top_id && o.bottom_id === c.bottom_id);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.status).toBe("approved");
  });

  it("createOutfit rejects a pair that isn't top + bottom", () => {
    const seed = loadSeed();
    expect(() => applyOp(seed, { type: "createOutfit", topId: "jeans-navy", bottomId: "jeans-black" }, ctx())).toThrow(
      TransitionError,
    );
  });

  it("addItem refuses a duplicate id", () => {
    const seed = loadSeed();
    expect(() => applyOp(seed, { type: "addItem", item: seed.items[0]! }, ctx())).toThrow(TransitionError);
  });
});
