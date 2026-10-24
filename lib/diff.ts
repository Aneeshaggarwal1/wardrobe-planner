import type { Item, Outfit, PairFeedback, WardrobeSnapshot, WearLog } from "./types";

/**
 * The rows that changed between two snapshots: what wp_commit() writes in one
 * transaction. Rows are compared by id and by value (JSON), so unchanged rows
 * are never rewritten.
 */
export interface SnapshotDiff {
  upsert_items: Item[];
  delete_items: string[];
  upsert_outfits: Outfit[];
  delete_outfits: string[];
  insert_wear_logs: WearLog[];
  delete_wear_logs: string[];
  /** Wear logs whose undo payload changed (the previous one stops being undoable). */
  update_wear_logs: WearLog[];
  insert_feedback: PairFeedback[];
}

interface Row {
  id: string;
}

function split<T extends Row>(before: readonly T[], after: readonly T[]) {
  const old = new Map(before.map((r) => [r.id, r]));
  const now = new Map(after.map((r) => [r.id, r]));
  const added: T[] = [];
  const changed: T[] = [];
  for (const row of after) {
    const prev = old.get(row.id);
    if (!prev) added.push(row);
    else if (JSON.stringify(prev) !== JSON.stringify(row)) changed.push(row);
  }
  const removed = before.filter((r) => !now.has(r.id)).map((r) => r.id);
  return { added, changed, removed };
}

export function diffSnapshots(before: WardrobeSnapshot, after: WardrobeSnapshot): SnapshotDiff {
  const items = split(before.items, after.items);
  const outfits = split(before.outfits, after.outfits);
  const logs = split(before.wearLogs, after.wearLogs);
  const feedback = split(before.feedback, after.feedback);
  return {
    upsert_items: [...items.added, ...items.changed],
    delete_items: items.removed,
    upsert_outfits: [...outfits.added, ...outfits.changed],
    delete_outfits: outfits.removed,
    insert_wear_logs: logs.added,
    delete_wear_logs: logs.removed,
    update_wear_logs: logs.changed,
    insert_feedback: feedback.added,
  };
}

export function isEmptyDiff(d: SnapshotDiff): boolean {
  return Object.values(d).every((v) => v.length === 0);
}
