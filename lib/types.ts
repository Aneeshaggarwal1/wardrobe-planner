/**
 * Core domain types. These mirror the database tables in
 * demo seed in public/demo/seed.json and the backup file format (lib/backup.ts).
 * Dates are ISO strings: timestamps as full ISO, calendar days as YYYY-MM-DD.
 */

import type { PaletteColor } from "./pairing/palette";

export type Category = "top" | "bottom" | "shoes" | "belt" | "layer";
export type Pattern = "solid" | "stripe" | "check" | "print" | "textured";
export type Fit = "slim" | "regular" | "relaxed";
export type ItemState = "ready" | "needs_ironing" | "in_laundry" | "unavailable";
export type OutfitStatus = "candidate" | "approved" | "rejected";
export type Decision = "approve" | "reject";

export interface Item {
  id: string;
  user_id: string;
  /** Display URLs: a static path in demo mode; a data: URL thumbnail for your own photos. */
  image_url: string;
  thumb_url: string;
  /** Storage paths, used only by the cloud backend kept on the supabase-backend branch. */
  image_path?: string | null;
  thumb_path?: string | null;
  category: Category;
  subcategory: string;
  primary_color: PaletteColor;
  secondary_color: PaletteColor | null;
  pattern: Pattern;
  /** 1 = casual Friday, 5 = boardroom */
  formality: number;
  fit: Fit | null;
  state: ItemState;
  wears_before_wash: number;
  wears_since_wash: number;
  ironing_required: boolean;
  last_worn_at: string | null;
  tags_confirmed: boolean;
  created_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  top_id: string;
  bottom_id: string;
  shoes_id: string | null;
  belt_id: string | null;
  layer_id: string | null;
  status: OutfitStatus;
  score: number;
  reason: string;
  times_worn: number;
  last_worn_at: string | null;
}

/** What "Undo" needs to put back after a wear. */
export interface WearUndo {
  wearLogId: string;
  worn_on: string;
  previousItems: Array<Pick<Item, "id" | "state" | "wears_since_wash" | "last_worn_at">>;
  previousOutfit: Pick<Outfit, "id" | "times_worn" | "last_worn_at">;
}

export interface WearLog {
  id: string;
  user_id: string;
  outfit_id: string;
  /** Calendar day, YYYY-MM-DD */
  worn_on: string;
  created_at: string;
  /** Present on the day's latest wear so it can be undone. */
  undo?: WearUndo | null;
}

/**
 * Snapshot of the tags that matter for taste learning. Stored on the feedback
 * row so the signal survives the item being deleted later.
 */
export interface PairFeatures {
  top_color: PaletteColor;
  bottom_color: PaletteColor;
  top_subcategory: string;
  bottom_subcategory: string;
}

export interface PairFeedback {
  id: string;
  user_id: string;
  outfit_id: string;
  decision: Decision;
  features: PairFeatures;
  top_id: string;
  bottom_id: string;
  created_at: string;
}

/** Everything the app holds for one user. Demo mode keeps this in localStorage. */
export interface WardrobeSnapshot {
  items: Item[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  feedback: PairFeedback[];
}
