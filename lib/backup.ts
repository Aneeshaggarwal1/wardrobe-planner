import { PALETTE } from "./pairing/palette";
import type { WardrobeSnapshot } from "./types";

/**
 * Backup file format. Your wardrobe lives only on this device, so this file
 * (photos included, as thumbnails) is how it survives a cleared browser or a
 * new phone.
 */
export interface BackupFile {
  app: "wardrobe-planner";
  version: 1;
  exported_at: string;
  snapshot: WardrobeSnapshot;
}

export function makeBackup(snapshot: WardrobeSnapshot, now: Date = new Date()): BackupFile {
  return { app: "wardrobe-planner", version: 1, exported_at: now.toISOString(), snapshot };
}

export function backupFileName(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `wardrobe-backup-${day}.json`;
}

const CATEGORIES = new Set(["top", "bottom", "shoes", "belt", "layer"]);
const STATES = new Set(["ready", "needs_ironing", "in_laundry", "unavailable"]);
const PALETTE_SET: ReadonlySet<string> = new Set(PALETTE);

export class BackupError extends Error {}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Parse and sanity-check a backup before it replaces anything: right app,
 * known version, every item well-formed, and every outfit and wear pointing at
 * things that exist.
 */
export function parseBackup(text: string): WardrobeSnapshot {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't a wardrobe backup (not JSON).");
  }
  if (!isObj(data) || data.app !== "wardrobe-planner") throw new BackupError("That file isn't a wardrobe backup.");
  if (data.version !== 1) throw new BackupError("This backup is from a newer version of the app.");
  const s = data.snapshot;
  if (!isObj(s) || ![s.items, s.outfits, s.wearLogs, s.feedback].every(Array.isArray)) {
    throw new BackupError("The backup is incomplete.");
  }
  const snapshot = s as unknown as WardrobeSnapshot;
  const itemIds = new Set<string>();
  for (const item of snapshot.items) {
    const ok =
      isObj(item) &&
      typeof item.id === "string" &&
      CATEGORIES.has(item.category) &&
      PALETTE_SET.has(item.primary_color) &&
      STATES.has(item.state) &&
      Number.isInteger(item.formality);
    if (!ok) throw new BackupError("The backup has an item it can't read.");
    itemIds.add(item.id);
  }
  const outfitIds = new Set<string>();
  for (const o of snapshot.outfits) {
    if (!isObj(o) || typeof o.id !== "string" || !itemIds.has(o.top_id) || !itemIds.has(o.bottom_id)) {
      throw new BackupError("The backup has an outfit that points at a missing item.");
    }
    outfitIds.add(o.id);
  }
  for (const l of snapshot.wearLogs) {
    if (!isObj(l) || !outfitIds.has(l.outfit_id)) throw new BackupError("The backup's wear history doesn't match its outfits.");
  }
  return snapshot;
}
