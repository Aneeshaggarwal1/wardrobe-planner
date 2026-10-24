import { generateCandidates, type Candidate } from "./pairing/generate";
import { featuresOf } from "./pairing/score";
import type { ItemPatch, LastWear } from "./repo/types";
import { TransitionError, ironed, laundryDone, setUnavailable, undoWear, wearOutfit } from "./state/machine";
import type { Decision, Item, Outfit, PairFeedback, WardrobeSnapshot, WearLog } from "./types";

/**
 * Every change a user can make, as data. The same `applyOp` runs in the
 * browser for demo mode (LocalRepo) and on the server for accounts, where the
 * before/after snapshots are diffed and committed in one transaction. One set
 * of rules, tested once.
 */
export type Op =
  | { type: "wear"; outfitId: string }
  | { type: "undoWear" }
  | { type: "laundryDone" }
  | { type: "ironed"; itemIds?: string[] }
  | { type: "setUnavailable"; itemId: string; unavailable: boolean }
  | { type: "updateItem"; itemId: string; patch: ItemPatch }
  | { type: "deleteItem"; itemId: string }
  | { type: "addItem"; item: Item }
  | { type: "addCandidates"; candidates: Candidate[] }
  | { type: "feedback"; outfitId: string; decision: Decision }
  | { type: "createOutfit"; topId: string; bottomId: string }
  | { type: "removeOutfit"; outfitId: string };

export interface OpContext {
  userId: string;
  /** Current time, ISO. */
  now: string;
  /** The user's local calendar day, YYYY-MM-DD. */
  today: string;
  newId: () => string;
}

/** The day's latest undoable wear, if any. */
function latestUndoableWear(s: WardrobeSnapshot, today: string): WearLog | undefined {
  return s.wearLogs
    .filter((l) => l.worn_on === today && l.undo)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))[0];
}

export function lastWear(s: WardrobeSnapshot, today: string): LastWear | null {
  const log = latestUndoableWear(s, today);
  return log ? { outfitId: log.outfit_id, worn_on: log.worn_on } : null;
}

function newOutfit(ctx: OpContext, topId: string, bottomId: string, fields: Partial<Outfit>): Outfit {
  return {
    id: ctx.newId(),
    user_id: ctx.userId,
    top_id: topId,
    bottom_id: bottomId,
    shoes_id: null,
    belt_id: null,
    layer_id: null,
    status: "candidate",
    score: 0,
    reason: "",
    times_worn: 0,
    last_worn_at: null,
    ...fields,
  };
}

function usesItem(o: Outfit, itemId: string): boolean {
  return [o.top_id, o.bottom_id, o.shoes_id, o.belt_id, o.layer_id].includes(itemId);
}

function recordFeedback(s: WardrobeSnapshot, outfitId: string, decision: Decision, ctx: OpContext): WardrobeSnapshot {
  const outfit = s.outfits.find((o) => o.id === outfitId);
  if (!outfit) throw new TransitionError("Outfit not found");
  const top = s.items.find((i) => i.id === outfit.top_id);
  const bottom = s.items.find((i) => i.id === outfit.bottom_id);
  if (!top || !bottom) throw new TransitionError("Outfit items not found");
  const row: PairFeedback = {
    id: ctx.newId(),
    user_id: ctx.userId,
    outfit_id: outfitId,
    decision,
    features: featuresOf(top, bottom),
    top_id: top.id,
    bottom_id: bottom.id,
    created_at: ctx.now,
  };
  const status = decision === "approve" ? ("approved" as const) : ("rejected" as const);
  return {
    ...s,
    outfits: s.outfits.map((o) => (o.id === outfitId ? { ...o, status } : o)),
    feedback: [...s.feedback, row],
  };
}

export function applyOp(s: WardrobeSnapshot, op: Op, ctx: OpContext): WardrobeSnapshot {
  switch (op.type) {
    case "wear": {
      const id = ctx.newId();
      const { snapshot, undo } = wearOutfit(s, op.outfitId, ctx.now, id, ctx.today);
      // Only the newest wear stays undoable.
      return {
        ...snapshot,
        wearLogs: snapshot.wearLogs.map((l) => (l.id === id ? { ...l, undo } : l.undo ? { ...l, undo: null } : l)),
      };
    }
    case "undoWear": {
      const log = latestUndoableWear(s, ctx.today);
      if (!log?.undo) throw new TransitionError("Nothing to undo today");
      return undoWear(s, log.undo, ctx.today);
    }
    case "laundryDone":
      return laundryDone(s);
    case "ironed":
      return ironed(s, op.itemIds);
    case "setUnavailable":
      return setUnavailable(s, op.itemId, op.unavailable);
    case "updateItem": {
      if (!s.items.some((i) => i.id === op.itemId)) throw new TransitionError("Item not found");
      return {
        ...s,
        items: s.items.map((i) => (i.id === op.itemId ? { ...i, ...op.patch, tags_confirmed: true } : i)),
      };
    }
    case "deleteItem": {
      if (!s.items.some((i) => i.id === op.itemId)) throw new TransitionError("Item not found");
      const gone = new Set(s.outfits.filter((o) => usesItem(o, op.itemId)).map((o) => o.id));
      return {
        ...s,
        items: s.items.filter((i) => i.id !== op.itemId),
        outfits: s.outfits.filter((o) => !gone.has(o.id)),
        wearLogs: s.wearLogs.filter((l) => !gone.has(l.outfit_id)),
      };
    }
    case "addItem": {
      if (s.items.some((i) => i.id === op.item.id)) throw new TransitionError("Item already exists");
      return { ...s, items: [...s.items, op.item] };
    }
    case "addCandidates": {
      const taken = new Set(s.outfits.map((o) => `${o.top_id}__${o.bottom_id}`));
      const fresh = op.candidates
        .filter((c) => !taken.has(`${c.top_id}__${c.bottom_id}`))
        .map((c) => newOutfit(ctx, c.top_id, c.bottom_id, { score: c.score, reason: c.reason }));
      return { ...s, outfits: [...s.outfits, ...fresh] };
    }
    case "feedback":
      return recordFeedback(s, op.outfitId, op.decision, ctx);
    case "createOutfit": {
      const top = s.items.find((i) => i.id === op.topId);
      const bottom = s.items.find((i) => i.id === op.bottomId);
      if (top?.category !== "top" || bottom?.category !== "bottom") {
        throw new TransitionError("Pick one top and one bottom");
      }
      const existing = s.outfits.find((o) => o.top_id === op.topId && o.bottom_id === op.bottomId);
      if (existing) return recordFeedback(s, existing.id, "approve", ctx);
      const outfit = newOutfit(ctx, op.topId, op.bottomId, { reason: "Your own pick" });
      // A manual outfit counts as an approve signal.
      return recordFeedback({ ...s, outfits: [...s.outfits, outfit] }, outfit.id, "approve", ctx);
    }
    case "removeOutfit":
      return {
        ...s,
        outfits: s.outfits.filter((o) => o.id !== op.outfitId),
        wearLogs: s.wearLogs.filter((l) => l.outfit_id !== op.outfitId),
      };
  }
}

/** Rule-based candidates for the "generate" action (the server may re-rank them with the LLM). */
export function ruleCandidates(s: WardrobeSnapshot, limit: number): Candidate[] {
  return generateCandidates(s.items, { feedback: s.feedback, existing: s.outfits, limit }).candidates;
}
