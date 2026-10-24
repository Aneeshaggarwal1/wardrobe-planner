import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Item, Outfit, PairFeedback, WardrobeSnapshot } from "../../lib/types";
import { featuresOf } from "../../lib/pairing/score";

export function makeItem(overrides: Partial<Item> & Pick<Item, "id">): Item {
  return {
    user_id: "u1",
    image_url: "",
    thumb_url: "",
    category: "top",
    subcategory: "formal shirt",
    primary_color: "white",
    secondary_color: null,
    pattern: "solid",
    formality: 4,
    fit: null,
    state: "ready",
    wears_before_wash: 1,
    wears_since_wash: 0,
    ironing_required: true,
    last_worn_at: null,
    tags_confirmed: true,
    created_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeOutfit(overrides: Partial<Outfit> & Pick<Outfit, "id" | "top_id" | "bottom_id">): Outfit {
  return {
    user_id: "u1",
    shoes_id: null,
    belt_id: null,
    layer_id: null,
    status: "approved",
    score: 80,
    reason: "",
    times_worn: 0,
    last_worn_at: null,
    ...overrides,
  };
}

export function makeFeedback(top: Item, bottom: Item, decision: "approve" | "reject", n = 1): PairFeedback {
  return {
    id: `fb-${top.id}-${bottom.id}-${decision}-${n}`,
    user_id: "u1",
    outfit_id: `${top.id}__${bottom.id}`,
    decision,
    features: featuresOf(top, bottom),
    top_id: top.id,
    bottom_id: bottom.id,
    created_at: "2026-10-01T00:00:00.000Z",
  };
}

export function loadSeed(): WardrobeSnapshot {
  const path = join(import.meta.dirname, "..", "..", "public", "demo", "seed.json");
  return JSON.parse(readFileSync(path, "utf8")) as WardrobeSnapshot;
}
