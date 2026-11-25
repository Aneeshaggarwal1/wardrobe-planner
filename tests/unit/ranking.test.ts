import { describe, expect, it } from "vitest";
import { ruleCandidates } from "../../lib/ops";
import { applyRanking, rerankPrompt, toRankItem } from "../../lib/pairing/ranking";
import { loadSeed } from "./fixtures";

const seed = loadSeed();
const pool = ruleCandidates(seed, 30);

describe("applyRanking", () => {
  it("follows the model's order and keeps its reasons", () => {
    const merged = applyRanking(
      pool,
      [
        { i: 3, reason: "Soft blue lifts the beige" },
        { i: 0, reason: "Sharp, classic and safe" },
      ],
      5,
    );
    expect(merged).toHaveLength(5);
    expect(merged[0]).toMatchObject({ top_id: pool[3]!.top_id, reason: "Soft blue lifts the beige" });
    expect(merged[1]).toMatchObject({ top_id: pool[0]!.top_id, reason: "Sharp, classic and safe" });
    expect(merged[2]).toEqual(pool[1]);
  });

  it("ignores bad indices and duplicates; replaces over-long reasons", () => {
    const merged = applyRanking(
      pool,
      [
        { i: 999, reason: "out of range" },
        { i: 2, reason: "one two three four five six seven eight nine ten eleven twelve thirteen" },
        { i: 2, reason: "duplicate" },
      ],
      3,
    );
    expect(merged[0]).toEqual(pool[2]);
    expect(merged.slice(1)).toEqual([pool[0], pool[1]]);
  });
});

describe("rerankPrompt", () => {
  it("describes pairs by tags only", () => {
    const items = new Map(seed.items.map((i) => [i.id, toRankItem(i)]));
    const prompt = rerankPrompt(pool.slice(0, 2), items, 2);
    expect(prompt).toContain("[0] ");
    expect(prompt).toContain("formality");
    expect(prompt).not.toContain("/demo/");
  });

  it("toRankItem keeps no photo or state", () => {
    expect(Object.keys(toRankItem(seed.items[0]!)).sort()).toEqual(["formality", "id", "pattern", "primary_color", "subcategory"]);
  });
});
