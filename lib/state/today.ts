import type { Item, ItemState, Outfit, WardrobeSnapshot } from "../types";
import { isWearable } from "./machine";

export interface TodayOptions {
  /** Today's calendar day, YYYY-MM-DD. */
  today: string;
  /** How many outfits to show (default 4; the brief allows 3–5). */
  count?: number;
  /** Shuffle samples from the top `shufflePool` ranked outfits (default 10). */
  shufflePool?: number;
  /** Random source in [0, 1). Pass to shuffle; omit for the stable ranking. */
  random?: () => number;
}

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toDay: string): number {
  return Math.floor((Date.parse(toDay) - Date.parse(fromIso.slice(0, 10))) / DAY_MS);
}

/** Approved outfits whose every item is ready. */
export function wearableOutfits(snapshot: WardrobeSnapshot): Outfit[] {
  const itemsById = new Map(snapshot.items.map((i) => [i.id, i]));
  return snapshot.outfits.filter((o) => o.status === "approved" && isWearable(o, itemsById));
}

/**
 * Rank wearable outfits for the Today screen:
 *  1. never-worn first, then least recently worn
 *  2. outfits whose top was worn in the last 3 days sink below the rest
 * With `random`, picks `count` outfits at random from the top of the ranking.
 */
export function rankToday(snapshot: WardrobeSnapshot, options: TodayOptions): Outfit[] {
  const itemsById = new Map(snapshot.items.map((i) => [i.id, i]));
  const count = options.count ?? 4;

  const recentTop = (o: Outfit): boolean => {
    const worn = itemsById.get(o.top_id)?.last_worn_at;
    return worn !== null && worn !== undefined && daysBetween(worn, options.today) < 3;
  };

  const ranked = wearableOutfits(snapshot).sort((a, b) => {
    const ra = Number(recentTop(a));
    const rb = Number(recentTop(b));
    if (ra !== rb) return ra - rb;
    if (a.last_worn_at === null && b.last_worn_at !== null) return -1;
    if (b.last_worn_at === null && a.last_worn_at !== null) return 1;
    if (a.last_worn_at !== null && b.last_worn_at !== null && a.last_worn_at !== b.last_worn_at) {
      return a.last_worn_at < b.last_worn_at ? -1 : 1;
    }
    return b.score - a.score || a.id.localeCompare(b.id);
  });

  if (!options.random) return ranked.slice(0, count);

  const pool = ranked.slice(0, options.shufflePool ?? 10);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(options.random() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}

export interface ClosestOutfit {
  outfit: Outfit;
  blocking: Item;
  action: string;
}

/** Plain-language name for an item, e.g. "light blue formal shirt". */
export function itemName(item: Item): string {
  return `${item.primary_color} ${item.subcategory}`;
}

const ACTION_VERB: Record<Exclude<ItemState, "ready">, string> = {
  needs_ironing: "Iron the",
  in_laundry: "Wash the",
  unavailable: "Get back the",
};

/**
 * For the "nothing fully ready" empty state: approved outfits blocked by
 * exactly one item, with the action that unblocks each. Ironing first (the
 * quickest fix), then the most-worn outfits.
 */
export function closestOutfits(snapshot: WardrobeSnapshot, limit = 3): ClosestOutfit[] {
  const itemsById = new Map(snapshot.items.map((i) => [i.id, i]));
  const result: ClosestOutfit[] = [];
  for (const outfit of snapshot.outfits) {
    if (outfit.status !== "approved") continue;
    const ids = [outfit.top_id, outfit.bottom_id, outfit.shoes_id, outfit.belt_id, outfit.layer_id].filter(
      (id): id is string => id !== null,
    );
    const notReady = ids.map((id) => itemsById.get(id)).filter((i): i is Item => !!i && i.state !== "ready");
    if (notReady.length !== 1) continue;
    const blocking = notReady[0]!;
    const verb = ACTION_VERB[blocking.state as Exclude<ItemState, "ready">];
    result.push({ outfit, blocking, action: `${verb} ${itemName(blocking)}` });
  }
  const priority: Record<ItemState, number> = { needs_ironing: 0, in_laundry: 1, unavailable: 2, ready: 3 };
  return result
    .sort(
      (a, b) =>
        priority[a.blocking.state] - priority[b.blocking.state] ||
        b.outfit.times_worn - a.outfit.times_worn ||
        a.outfit.id.localeCompare(b.outfit.id),
    )
    .slice(0, limit);
}
