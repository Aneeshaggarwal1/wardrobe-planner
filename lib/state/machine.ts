import type { Item, ItemState, Outfit, WardrobeSnapshot, WearLog, WearUndo } from "../types";

export type { WearUndo };

/**
 * Item state machine. Every function is pure: it takes a snapshot and returns
 * a new one, never mutating its input. lib/ops.ts wraps them as the app's
 * operations.
 *
 *   ready ──wear (limit reached)──▶ in_laundry ──laundry done──▶ needs_ironing ──ironed──▶ ready
 *     ▲  └─wear (under limit)─┘                    └─(no ironing needed)──────────────────▶ ┘
 *     └──────────── unavailable ◀── manual toggle from any state
 */

export class TransitionError extends Error {}

export interface WearResult {
  snapshot: WardrobeSnapshot;
  undo: WearUndo;
}

function outfitItemIds(outfit: Outfit): string[] {
  return [outfit.top_id, outfit.bottom_id, outfit.shoes_id, outfit.belt_id, outfit.layer_id].filter(
    (id): id is string => id !== null,
  );
}

export function isWearable(outfit: Outfit, itemsById: ReadonlyMap<string, Item>): boolean {
  return outfitItemIds(outfit).every((id) => itemsById.get(id)?.state === "ready");
}

/**
 * "Wear this": +1 wear on every item; an item that reaches its re-wear limit
 * goes to the laundry. Logs the wear and returns what undo needs.
 */
export function wearOutfit(
  snapshot: WardrobeSnapshot,
  outfitId: string,
  now: string,
  wearLogId: string,
  /** The wearer's local calendar day; defaults to the UTC day of `now`. */
  today: string = now.slice(0, 10),
): WearResult {
  const outfit = snapshot.outfits.find((o) => o.id === outfitId);
  if (!outfit) throw new TransitionError(`Unknown outfit ${outfitId}`);
  if (outfit.status !== "approved") throw new TransitionError("Only approved outfits can be worn");
  const itemsById = new Map(snapshot.items.map((i) => [i.id, i]));
  if (!isWearable(outfit, itemsById)) throw new TransitionError("Every item must be ready to wear");

  const ids = new Set(outfitItemIds(outfit));
  const previousItems = snapshot.items
    .filter((i) => ids.has(i.id))
    .map(({ id, state, wears_since_wash, last_worn_at }) => ({ id, state, wears_since_wash, last_worn_at }));
  const items = snapshot.items.map((item) => {
    if (!ids.has(item.id)) return item;
    const wears = item.wears_since_wash + 1;
    const state: ItemState = wears >= item.wears_before_wash ? "in_laundry" : "ready";
    return { ...item, wears_since_wash: wears, last_worn_at: now, state };
  });
  const outfits = snapshot.outfits.map((o) =>
    o.id === outfitId ? { ...o, times_worn: o.times_worn + 1, last_worn_at: now } : o,
  );
  const log: WearLog = {
    id: wearLogId,
    user_id: outfit.user_id,
    outfit_id: outfitId,
    worn_on: today,
    created_at: now,
  };
  return {
    snapshot: { ...snapshot, items, outfits, wearLogs: [...snapshot.wearLogs, log] },
    undo: {
      wearLogId,
      worn_on: log.worn_on,
      previousItems,
      previousOutfit: { id: outfit.id, times_worn: outfit.times_worn, last_worn_at: outfit.last_worn_at },
    },
  };
}

/** Revert the last "Wear this". Allowed only on the day it happened. */
export function undoWear(snapshot: WardrobeSnapshot, undo: WearUndo, today: string): WardrobeSnapshot {
  if (undo.worn_on !== today) throw new TransitionError("A wear can only be undone on the same day");
  if (!snapshot.wearLogs.some((l) => l.id === undo.wearLogId)) {
    throw new TransitionError("That wear has already been undone");
  }
  // Restore only what the wear changed, so tag edits made since are kept.
  const restore = new Map(undo.previousItems.map((i) => [i.id, i]));
  const prevOutfit = undo.previousOutfit;
  return {
    ...snapshot,
    items: snapshot.items.map((i) => {
      const prev = restore.get(i.id);
      return prev ? { ...i, ...prev } : i;
    }),
    outfits: snapshot.outfits.map((o) =>
      o.id === prevOutfit.id ? { ...o, times_worn: prevOutfit.times_worn, last_worn_at: prevOutfit.last_worn_at } : o,
    ),
    wearLogs: snapshot.wearLogs.filter((l) => l.id !== undo.wearLogId),
  };
}

/** Bulk "Laundry done": in_laundry → needs_ironing, or straight to ready if no ironing needed. */
export function laundryDone(snapshot: WardrobeSnapshot): WardrobeSnapshot {
  return {
    ...snapshot,
    items: snapshot.items.map((item) =>
      item.state === "in_laundry"
        ? {
            ...item,
            wears_since_wash: 0,
            state: item.ironing_required ? ("needs_ironing" as const) : ("ready" as const),
          }
        : item,
    ),
  };
}

/** "Ironed": needs_ironing → ready, for the listed items or for all of them. */
export function ironed(snapshot: WardrobeSnapshot, itemIds?: readonly string[]): WardrobeSnapshot {
  const only = itemIds ? new Set(itemIds) : null;
  return {
    ...snapshot,
    items: snapshot.items.map((item) =>
      item.state === "needs_ironing" && (!only || only.has(item.id))
        ? { ...item, state: "ready" as const }
        : item,
    ),
  };
}

/** Manual toggle: any state → unavailable, unavailable → ready. */
export function setUnavailable(
  snapshot: WardrobeSnapshot,
  itemId: string,
  unavailable: boolean,
): WardrobeSnapshot {
  const item = snapshot.items.find((i) => i.id === itemId);
  if (!item) throw new TransitionError(`Unknown item ${itemId}`);
  if (!unavailable && item.state !== "unavailable") {
    throw new TransitionError("Only an unavailable item can be made available");
  }
  const state: ItemState = unavailable ? "unavailable" : "ready";
  return {
    ...snapshot,
    items: snapshot.items.map((i) => (i.id === itemId ? { ...i, state } : i)),
  };
}
