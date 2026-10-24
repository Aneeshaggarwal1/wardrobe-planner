import { describe, expect, it } from "vitest";
import { hardFilter, pairKey } from "../../lib/pairing/filters";
import { generateCandidates } from "../../lib/pairing/generate";
import { HARMONY, harmony } from "../../lib/pairing/harmony";
import { PALETTE } from "../../lib/pairing/palette";
import { templateReason, wordCount } from "../../lib/pairing/reasons";
import {
  WEIGHTS,
  colorScore,
  featuresOf,
  formalityScore,
  patternScore,
  scorePair,
  tasteScore,
} from "../../lib/pairing/score";
import { loadSeed, makeFeedback, makeItem } from "./fixtures";

const noCtx = { rejectedPairs: new Set<string>(), allowMonochrome: false };
const shirt = (o: Parameters<typeof makeItem>[0]) => makeItem({ category: "top", ...o });
const trousers = (o: Parameters<typeof makeItem>[0]) =>
  makeItem({ category: "bottom", subcategory: "formal trousers", primary_color: "navy", ...o });

describe("harmony table", () => {
  it("covers every palette pair, including same-colour pairs", () => {
    const n = PALETTE.length;
    expect(HARMONY.size).toBe((n * (n + 1)) / 2);
    for (const a of PALETTE) for (const b of PALETTE) expect(() => harmony(a, b)).not.toThrow();
  });

  it("is symmetric and bounded 0–1", () => {
    for (const a of PALETTE) {
      for (const b of PALETTE) {
        const h = harmony(a, b);
        expect(h).toEqual(harmony(b, a));
        expect(h.score).toBeGreaterThanOrEqual(0);
        expect(h.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rates the classic office pairs high and clashes low", () => {
    expect(harmony("light blue", "navy")).toEqual({ score: 1, label: "classic contrast" });
    expect(harmony("white", "khaki").score).toBeGreaterThanOrEqual(0.85);
    expect(harmony("white", "khaki").label).toBe("easy neutral");
    expect(harmony("brown", "black").score).toBe(0.2);
    expect(harmony("navy", "navy").label).toBe("tonal");
  });
});

describe("hard filters", () => {
  it("drops a formality gap greater than 2", () => {
    const top = shirt({ id: "t", formality: 5 });
    expect(hardFilter(top, trousers({ id: "b", formality: 2 }), noCtx)).toBe("formality_gap");
    expect(hardFilter(top, trousers({ id: "b", formality: 3 }), noCtx)).toBeNull();
  });

  it("drops two busy patterns but lets a textured weave through", () => {
    const stripe = shirt({ id: "t", pattern: "stripe" });
    expect(hardFilter(stripe, trousers({ id: "b", pattern: "check" }), noCtx)).toBe("double_pattern");
    expect(hardFilter(stripe, trousers({ id: "b", pattern: "print" }), noCtx)).toBe("double_pattern");
    expect(hardFilter(stripe, trousers({ id: "b", pattern: "textured" }), noCtx)).toBeNull();
  });

  it("drops same-colour pairs until the user approves one", () => {
    const top = shirt({ id: "t", primary_color: "navy" });
    const bottom = trousers({ id: "b", primary_color: "navy" });
    expect(hardFilter(top, bottom, noCtx)).toBe("monochrome");
    expect(hardFilter(top, bottom, { ...noCtx, allowMonochrome: true })).toBeNull();
  });

  it("drops a pair the user rejected", () => {
    const top = shirt({ id: "t" });
    const bottom = trousers({ id: "b" });
    const ctx = { rejectedPairs: new Set([pairKey("t", "b")]), allowMonochrome: false };
    expect(hardFilter(top, bottom, ctx)).toBe("previously_rejected");
  });
});

describe("score components", () => {
  it("weights sum to 100", () => {
    expect(WEIGHTS.color + WEIGHTS.formality + WEIGHTS.pattern + WEIGHTS.taste).toBe(100);
  });

  it("colour uses harmony and blends a pattern's secondary colour at 25%", () => {
    const solid = shirt({ id: "t", primary_color: "light blue" });
    expect(colorScore(solid, trousers({ id: "b" }))).toBe(1);
    const stripe = shirt({ id: "t2", primary_color: "white", secondary_color: "light blue", pattern: "stripe" });
    expect(colorScore(stripe, trousers({ id: "b" }))).toBeCloseTo(0.75 * 1 + 0.25 * 1);
    const brownStripe = shirt({ id: "t3", primary_color: "white", secondary_color: "brown" });
    const black = trousers({ id: "b2", primary_color: "black" });
    expect(colorScore(brownStripe, black)).toBeCloseTo(0.75 * 0.85 + 0.25 * 0.2);
  });

  it("formality: 1.0 same level, 0.6 one apart, 0.2 two apart", () => {
    const top = shirt({ id: "t", formality: 4 });
    expect(formalityScore(top, trousers({ id: "b", formality: 4 }))).toBe(1);
    expect(formalityScore(top, trousers({ id: "b", formality: 3 }))).toBe(0.6);
    expect(formalityScore(top, trousers({ id: "b", formality: 2 }))).toBe(0.2);
  });

  it("pattern: solid pairs 1.0, textured with a pattern 0.5", () => {
    expect(patternScore(shirt({ id: "t" }), trousers({ id: "b" }))).toBe(1);
    expect(patternScore(shirt({ id: "t", pattern: "stripe" }), trousers({ id: "b" }))).toBe(1);
    expect(patternScore(shirt({ id: "t", pattern: "textured" }), trousers({ id: "b", pattern: "check" }))).toBe(0.5);
    expect(patternScore(shirt({ id: "t", pattern: "textured" }), trousers({ id: "b", pattern: "textured" }))).toBe(0.8);
  });

  it("taste is 0.5 at cold start and follows approvals and rejections", () => {
    const top = shirt({ id: "t", primary_color: "pink" });
    const bottom = trousers({ id: "b", primary_color: "khaki" });
    const f = featuresOf(top, bottom);
    expect(tasteScore(f, { approved: [], rejected: [] })).toBe(0.5);
    expect(tasteScore(f, { approved: [f], rejected: [] })).toBe(1);
    expect(tasteScore(f, { approved: [], rejected: [f] })).toBe(0);
  });

  it("combines components into a 0–100 total", () => {
    const s = scorePair(shirt({ id: "t", primary_color: "light blue" }), trousers({ id: "b" }), {
      approved: [],
      rejected: [],
    });
    expect(s.total).toBe(40 + 25 + 15 + 10);
  });
});

describe("template reasons", () => {
  it("stays within 12 words for every colour pair", () => {
    for (const a of PALETTE) {
      for (const b of PALETTE) {
        const r = templateReason(shirt({ id: "t", primary_color: a }), trousers({ id: "b", primary_color: b }));
        expect(wordCount(r)).toBeLessThanOrEqual(12);
      }
    }
  });

  it("reads naturally", () => {
    expect(templateReason(shirt({ id: "t", primary_color: "light blue" }), trousers({ id: "b" }))).toBe(
      "Light blue and navy: classic contrast",
    );
  });
});

describe("candidate generation on the demo wardrobe", () => {
  const seed = loadSeed();
  const byId = new Map(seed.items.map((i) => [i.id, i]));

  it("yields at least 15 candidates, none breaking a hard filter", () => {
    const { candidates } = generateCandidates(seed.items, { feedback: [], existing: [] });
    expect(candidates.length).toBeGreaterThanOrEqual(15);
    for (const c of candidates) {
      expect(hardFilter(byId.get(c.top_id)!, byId.get(c.bottom_id)!, noCtx)).toBeNull();
      expect(byId.get(c.top_id)!.category).toBe("top");
      expect(byId.get(c.bottom_id)!.category).toBe("bottom");
      expect(wordCount(c.reason)).toBeLessThanOrEqual(12);
    }
  });

  it("actually exercises the filters on real data", () => {
    const { dropped } = generateCandidates(seed.items, { feedback: [], existing: [] });
    expect(dropped.formality_gap).toBeGreaterThan(0);
    expect(dropped.monochrome).toBeGreaterThan(0);
  });

  it("is sorted by score and deterministic", () => {
    const a = generateCandidates(seed.items, { feedback: [], existing: [], limit: 200 }).candidates;
    const b = generateCandidates(seed.items, { feedback: [], existing: [], limit: 200 }).candidates;
    expect(a).toEqual(b);
    for (let i = 1; i < a.length; i++) expect(a[i - 1]!.score).toBeGreaterThanOrEqual(a[i]!.score);
  });

  it("never re-proposes a pair already in the bank", () => {
    const { candidates } = generateCandidates(seed.items, { feedback: [], existing: seed.outfits, limit: 200 });
    const banked = new Set(seed.outfits.map((o) => pairKey(o.top_id, o.bottom_id)));
    for (const c of candidates) expect(banked.has(pairKey(c.top_id, c.bottom_id))).toBe(false);
  });

  it("learns from feedback: a rejected pair is gone and its colour combo ranks lower", () => {
    const top = byId.get("shirt-light-blue")!;
    const bottom = byId.get("trousers-navy")!;
    const before = generateCandidates(seed.items, { feedback: [], existing: [], limit: 200 }).candidates;
    const feedback = [makeFeedback(top, bottom, "reject")];
    const after = generateCandidates(seed.items, { feedback, existing: [], limit: 200 }).candidates;

    expect(after.some((c) => c.top_id === top.id && c.bottom_id === bottom.id)).toBe(false);
    // The sky blue oxford with the same navy trousers is a similar pair: it should lose taste points.
    const scoreOf = (list: typeof before, t: string, b: string) =>
      list.find((c) => c.top_id === t && c.bottom_id === b)!.breakdown.taste;
    expect(scoreOf(after, "shirt-sky-oxford", "trousers-navy")).toBeLessThan(
      scoreOf(before, "shirt-sky-oxford", "trousers-navy"),
    );
  });
});
