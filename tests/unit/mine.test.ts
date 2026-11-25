import { describe, expect, it } from "vitest";
import { BackupError, backupFileName, makeBackup, parseBackup } from "../../lib/backup";
import { isPhotoTags, rerankWithAi, type PhotoTags } from "../../lib/client/ai";
import { itemFromTags } from "../../lib/items";
import { EMPTY_SNAPSHOT, LocalRepo } from "../../lib/repo/local";
import { memoryStore } from "../../lib/store";
import { loadSeed } from "./fixtures";

const TAGS: PhotoTags = {
  category: "top",
  subcategory: "Oxford Shirt",
  primary_color: "light blue",
  secondary_color: null,
  pattern: "textured",
  formality: 3,
  fit: "slim",
  confidence: 0.9,
};

function mine(store = memoryStore()) {
  return new LocalRepo({ kind: "mine", store, seed: async () => structuredClone(EMPTY_SNAPSHOT) });
}

describe("itemFromTags", () => {
  it("builds a ready item with care defaults and the thumbnail inline", () => {
    const item = itemFromTags("i1", TAGS, "data:image/jpeg;base64,AAA", "2026-11-25T00:00:00.000Z");
    expect(item).toMatchObject({
      id: "i1",
      subcategory: "oxford shirt",
      thumb_url: "data:image/jpeg;base64,AAA",
      state: "ready",
      wears_before_wash: 1,
      ironing_required: true,
      tags_confirmed: true,
    });
  });

  it("flags unsure tags for review", () => {
    expect(itemFromTags("i1", { ...TAGS, confidence: 0.4 }, "", "").tags_confirmed).toBe(false);
  });
});

describe("isPhotoTags", () => {
  it("accepts valid tags and rejects anything off-palette or malformed", () => {
    expect(isPhotoTags(TAGS)).toBe(true);
    expect(isPhotoTags({ ...TAGS, primary_color: "teal" })).toBe(false);
    expect(isPhotoTags({ ...TAGS, formality: 9 })).toBe(false);
    expect(isPhotoTags({ ...TAGS, category: "hat" })).toBe(false);
    expect(isPhotoTags(null)).toBe(false);
  });
});

describe("your wardrobe on this device", () => {
  it("starts empty and keeps added items across reloads", async () => {
    const store = memoryStore();
    const a = mine(store);
    expect((await a.load()).items).toEqual([]);
    await a.addItem(itemFromTags("i1", TAGS, "data:x", "2026-11-25T00:00:00.000Z"));
    const reloaded = await mine(store).load();
    expect(reloaded.items.map((i) => i.id)).toEqual(["i1"]);
  });

  it("keeps every item when several are added at the same moment", async () => {
    const store = memoryStore();
    const repo = mine(store);
    await repo.load();
    const ids = ["a", "b", "c", "d"];
    await Promise.all(ids.map((id) => repo.addItem(itemFromTags(id, TAGS, "data:x", "2026-11-25T00:00:00.000Z"))));
    expect((await repo.load()).items.map((i) => i.id).sort()).toEqual(ids);
    expect((await mine(store).load()).items.map((i) => i.id).sort()).toEqual(ids);
  });

  it("a failed change doesn't block the next one", async () => {
    const repo = mine();
    await repo.load();
    await expect(repo.deleteItem("missing")).rejects.toThrow();
    await repo.addItem(itemFromTags("ok", TAGS, "data:x", "2026-11-25T00:00:00.000Z"));
    expect((await repo.load()).items.map((i) => i.id)).toEqual(["ok"]);
  });

  it("generate uses the re-ranker when given, and records whether the AI was used", async () => {
    const seed = loadSeed();
    const repo = new LocalRepo({
      kind: "mine",
      store: memoryStore(seed),
      seed: async () => seed,
      rerank: async (pool, _items, keep) => ({ candidates: [...pool].reverse().slice(0, keep), usedModel: true }),
    });
    const before = await repo.load();
    const after = await repo.generate();
    const info = repo.lastGenerate()!;
    expect(info.usedModel).toBe(true);
    expect(info.added).toBe(after.outfits.length - before.outfits.length);
    expect(info.added).toBeGreaterThan(0);
  });

  it("reset on your wardrobe starts empty again", async () => {
    const repo = mine(memoryStore(loadSeed()));
    expect((await repo.load()).items.length).toBeGreaterThan(0);
    expect((await repo.reset()).items).toEqual([]);
  });
});

describe("rerankWithAi", () => {
  const seed = loadSeed();
  const pool = [...Array(5).keys()].map((n) => ({
    top_id: seed.items[n]!.id,
    bottom_id: "trousers-navy",
    score: 90 - n,
    reason: `rule ${n}`,
    breakdown: { color: 1, formality: 1, pattern: 1, taste: 0.5, total: 90 - n },
  }));

  const withPasscode = (value: string | null) => {
    const store = new Map<string, string>();
    if (value) store.set("wp-passcode", value);
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} },
    };
  };

  it("sends tags only, with the passcode, and applies the ranking", async () => {
    withPasscode("secret");
    let sent: { headers: Record<string, string>; body: { pairs: unknown[]; items: Array<Record<string, unknown>> } } | null = null;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent = { headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
      return new Response(JSON.stringify({ ranking: [{ i: 4, reason: "Model's favourite pair" }] }));
    }) as unknown as typeof fetch;
    const { candidates, usedModel } = await rerankWithAi(pool, seed.items, 3, fakeFetch);
    expect(usedModel).toBe(true);
    expect(candidates[0]).toMatchObject({ top_id: pool[4]!.top_id, reason: "Model's favourite pair" });
    expect(sent!.headers["x-app-passcode"]).toBe("secret");
    expect(sent!.body.pairs).toHaveLength(5);
    for (const item of sent!.body.items) expect(item).not.toHaveProperty("thumb_url");
  });

  it("keeps the rule order when the server fails or there is no passcode", async () => {
    withPasscode("secret");
    const failing = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    expect(await rerankWithAi(pool, seed.items, 3, failing)).toEqual({ candidates: pool.slice(0, 3), usedModel: false });
    withPasscode(null);
    expect((await rerankWithAi(pool, seed.items, 3, failing)).usedModel).toBe(false);
  });
});

describe("backup files", () => {
  it("round-trips a wardrobe", () => {
    const seed = loadSeed();
    const text = JSON.stringify(makeBackup(seed, new Date("2026-11-25T10:00:00Z")));
    expect(parseBackup(text)).toEqual(seed);
    expect(backupFileName(new Date("2026-11-25T10:00:00Z"))).toBe("wardrobe-backup-2026-11-25.json");
  });

  it("refuses files that aren't wardrobe backups or are inconsistent", () => {
    const seed = loadSeed();
    expect(() => parseBackup("not json")).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: "other" }))).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ ...makeBackup(seed), version: 2 }))).toThrow(/newer version/);
    const broken = makeBackup({ ...seed, items: seed.items.slice(1) });
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/missing item/);
  });
});
