import { describe, expect, it } from "vitest";
import { extractJson, type MessagesClient } from "../../lib/ai/client";
import { applyRanking, rerank } from "../../lib/ai/rerank";
import { TagError, parseTagReply, tagImage } from "../../lib/ai/tag";
import { ruleCandidates } from "../../lib/ops";
import { loadSeed } from "./fixtures";

const GOOD = {
  category: "top",
  subcategory: "Formal Shirt",
  primary_color: "light blue",
  secondary_color: null,
  pattern: "solid",
  formality: 4,
  fit: "slim",
  confidence: 0.92,
};

/** A fake Claude client that returns the given replies in order. */
function fakeClient(...replies: Array<string | Error>): MessagesClient & { calls: number } {
  const fake = {
    calls: 0,
    messages: {
      create: async () => {
        const reply = replies[Math.min(fake.calls, replies.length - 1)];
        fake.calls++;
        if (reply instanceof Error) throw reply;
        return { content: [{ type: "text", text: reply ?? "" }] };
      },
    },
  };
  return fake;
}

describe("extractJson", () => {
  it("handles code fences and surrounding prose", () => {
    expect(extractJson('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
  it("throws without an object", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("parseTagReply", () => {
  it("accepts valid tags and normalises the subcategory", () => {
    const tags = parseTagReply(JSON.stringify(GOOD));
    expect(tags.subcategory).toBe("formal shirt");
    expect(tags.primary_color).toBe("light blue");
  });

  it("rejects colours outside the palette", () => {
    expect(() => parseTagReply(JSON.stringify({ ...GOOD, primary_color: "teal" }))).toThrow(TagError);
  });

  it("rejects out-of-range formality", () => {
    expect(() => parseTagReply(JSON.stringify({ ...GOOD, formality: 7 }))).toThrow(TagError);
  });

  it("turns a refusal into a not_one_item error", () => {
    try {
      parseTagReply('{"error": "two shirts in the photo"}');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TagError);
      expect((e as TagError).kind).toBe("not_one_item");
      expect((e as TagError).message).toBe("two shirts in the photo");
    }
  });
});

describe("tagImage", () => {
  it("retries once after an invalid reply", async () => {
    const client = fakeClient("not json", JSON.stringify(GOOD));
    const tags = await tagImage(client, "m", "base64");
    expect(tags.formality).toBe(4);
    expect(client.calls).toBe(2);
  });

  it("gives up after two invalid replies", async () => {
    const client = fakeClient("nope", "still nope");
    await expect(tagImage(client, "m", "base64")).rejects.toBeInstanceOf(TagError);
    expect(client.calls).toBe(2);
  });

  it("does not retry a refusal", async () => {
    const client = fakeClient('{"error":"no clothing"}', JSON.stringify(GOOD));
    await expect(tagImage(client, "m", "base64")).rejects.toMatchObject({ kind: "not_one_item" });
    expect(client.calls).toBe(1);
  });
});

describe("rerank", () => {
  const seed = loadSeed();
  const items = new Map(seed.items.map((i) => [i.id, i]));
  const pool = ruleCandidates(seed, 30);

  it("follows the model's order and keeps its reasons", async () => {
    const reply = JSON.stringify({
      ranking: [
        { i: 3, reason: "Soft blue lifts the beige" },
        { i: 0, reason: "Sharp, classic and safe" },
      ],
    });
    const { candidates, usedModel } = await rerank(fakeClient(reply), "m", pool, items, 5);
    expect(usedModel).toBe(true);
    expect(candidates).toHaveLength(5);
    expect(candidates[0]).toMatchObject({ top_id: pool[3]!.top_id, reason: "Soft blue lifts the beige" });
    expect(candidates[1]).toMatchObject({ top_id: pool[0]!.top_id, reason: "Sharp, classic and safe" });
  });

  it("falls back to rule order when the model errors", async () => {
    const { candidates, usedModel } = await rerank(fakeClient(new Error("timeout")), "m", pool, items, 20);
    expect(usedModel).toBe(false);
    expect(candidates).toEqual(pool.slice(0, 20));
  });

  it("falls back when there is no client", async () => {
    const { usedModel } = await rerank(null, "m", pool, items, 20);
    expect(usedModel).toBe(false);
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
