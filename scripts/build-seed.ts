/**
 * Builds public/demo/seed.json: a 20-item sample office wardrobe and a bank of
 * 15 approved outfits chosen by the real pairing engine.
 *
 *   bun scripts/build-seed.ts        (or: npx tsx scripts/build-seed.ts)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { careDefaults } from "../lib/defaults";
import { generateCandidates } from "../lib/pairing/generate";
import type { PaletteColor } from "../lib/pairing/palette";
import type { Category, Item, ItemState, Outfit, Pattern, WardrobeSnapshot, WearLog } from "../lib/types";

const USER = "demo";
const CREATED = "2026-10-01T09:00:00.000Z";

interface Spec {
  id: string;
  category: Category;
  subcategory: string;
  primary: PaletteColor;
  secondary?: PaletteColor;
  pattern?: Pattern;
  formality: number;
  state?: ItemState;
  wears?: number;
}

const SPECS: Spec[] = [
  // 9 shirts
  { id: "shirt-white", category: "top", subcategory: "formal shirt", primary: "white", formality: 4 },
  { id: "shirt-light-blue", category: "top", subcategory: "formal shirt", primary: "light blue", formality: 4 },
  { id: "shirt-sky-oxford", category: "top", subcategory: "oxford shirt", primary: "sky blue", formality: 3 },
  { id: "shirt-pink", category: "top", subcategory: "formal shirt", primary: "pink", formality: 4, state: "in_laundry", wears: 1 },
  { id: "shirt-lavender", category: "top", subcategory: "formal shirt", primary: "lavender", formality: 4, state: "needs_ironing" },
  { id: "shirt-blue-stripe", category: "top", subcategory: "formal shirt", primary: "white", secondary: "light blue", pattern: "stripe", formality: 4 },
  { id: "shirt-blue-check", category: "top", subcategory: "casual shirt", primary: "sky blue", secondary: "navy", pattern: "check", formality: 3 },
  { id: "shirt-linen", category: "top", subcategory: "linen shirt", primary: "off-white", pattern: "textured", formality: 3 },
  { id: "shirt-charcoal", category: "top", subcategory: "formal shirt", primary: "charcoal", formality: 4 },
  // 2 polos
  { id: "polo-navy", category: "top", subcategory: "polo", primary: "navy", formality: 2 },
  { id: "polo-olive", category: "top", subcategory: "polo", primary: "olive", formality: 2 },
  // 7 trousers and chinos
  { id: "trousers-navy", category: "bottom", subcategory: "formal trousers", primary: "navy", formality: 4, wears: 1 },
  { id: "trousers-charcoal", category: "bottom", subcategory: "formal trousers", primary: "charcoal", formality: 5 },
  { id: "trousers-grey", category: "bottom", subcategory: "formal trousers", primary: "grey", formality: 4, state: "in_laundry", wears: 3 },
  { id: "trousers-black", category: "bottom", subcategory: "formal trousers", primary: "black", formality: 5 },
  { id: "chinos-beige", category: "bottom", subcategory: "chinos", primary: "beige", formality: 3, wears: 2 },
  { id: "chinos-khaki", category: "bottom", subcategory: "chinos", primary: "khaki", formality: 3 },
  { id: "chinos-brown", category: "bottom", subcategory: "chinos", primary: "brown", formality: 3 },
  // 2 jeans
  { id: "jeans-navy", category: "bottom", subcategory: "jeans", primary: "navy", formality: 2 },
  { id: "jeans-black", category: "bottom", subcategory: "jeans", primary: "black", formality: 2 },
];

function toItem(spec: Spec): Item {
  const care = careDefaults(spec.category, spec.subcategory);
  return {
    id: spec.id,
    user_id: USER,
    image_url: `/demo/${spec.id}.svg`,
    thumb_url: `/demo/${spec.id}.svg`,
    category: spec.category,
    subcategory: spec.subcategory,
    primary_color: spec.primary,
    secondary_color: spec.secondary ?? null,
    pattern: spec.pattern ?? "solid",
    formality: spec.formality,
    fit: "regular",
    state: spec.state ?? "ready",
    wears_before_wash: care.wears_before_wash,
    wears_since_wash: spec.wears ?? 0,
    ironing_required: care.ironing_required,
    last_worn_at: null,
    tags_confirmed: true,
    created_at: CREATED,
  };
}

/** Pick a varied bank: highest scores first, each top at most twice, each bottom at most three times. */
function pickBank(items: Item[], size: number): Outfit[] {
  const { candidates } = generateCandidates(items, { feedback: [], existing: [], limit: 200 });
  const topUses = new Map<string, number>();
  const bottomUses = new Map<string, number>();
  const bank: Outfit[] = [];
  for (const c of candidates) {
    if (bank.length === size) break;
    if ((topUses.get(c.top_id) ?? 0) >= 2 || (bottomUses.get(c.bottom_id) ?? 0) >= 3) continue;
    topUses.set(c.top_id, (topUses.get(c.top_id) ?? 0) + 1);
    bottomUses.set(c.bottom_id, (bottomUses.get(c.bottom_id) ?? 0) + 1);
    bank.push({
      id: `outfit-${String(bank.length + 1).padStart(2, "0")}`,
      user_id: USER,
      top_id: c.top_id,
      bottom_id: c.bottom_id,
      shoes_id: null,
      belt_id: null,
      layer_id: null,
      status: "approved",
      score: c.score,
      reason: c.reason,
      times_worn: 0,
      last_worn_at: null,
    });
  }
  return bank;
}

/** Give the bank a short wear history so rotation is visible on first open. */
function addHistory(snapshot: WardrobeSnapshot): void {
  const days = ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-20", "2026-10-21"];
  const logs: WearLog[] = [];
  days.forEach((day, i) => {
    const outfit = snapshot.outfits[(i * 2) % snapshot.outfits.length]!;
    const at = `${day}T08:30:00.000Z`;
    outfit.times_worn += 1;
    outfit.last_worn_at = at;
    for (const id of [outfit.top_id, outfit.bottom_id]) {
      const item = snapshot.items.find((x) => x.id === id)!;
      item.last_worn_at = at;
    }
    logs.push({ id: `wear-${i + 1}`, user_id: USER, outfit_id: outfit.id, worn_on: day, created_at: at });
  });
  snapshot.wearLogs = logs;
}

const items = SPECS.map(toItem);
const outfits = pickBank(items, 15);
if (outfits.length < 15) throw new Error(`Only ${outfits.length} outfits picked for the demo bank`);
const snapshot: WardrobeSnapshot = { items, outfits, wearLogs: [], feedback: [] };
addHistory(snapshot);

const out = join(dirname(new URL(import.meta.url).pathname), "..", "public", "demo", "seed.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${items.length} items, ${outfits.length} outfits, ${snapshot.wearLogs.length} wears → ${out}`);
