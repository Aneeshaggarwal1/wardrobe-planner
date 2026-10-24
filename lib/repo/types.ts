import type { Decision, Item, WardrobeSnapshot } from "../types";

/** Fields the user may edit on an item (tags and care settings). */
export type ItemPatch = Partial<
  Pick<
    Item,
    | "category"
    | "subcategory"
    | "primary_color"
    | "secondary_color"
    | "pattern"
    | "formality"
    | "fit"
    | "wears_before_wash"
    | "ironing_required"
    | "tags_confirmed"
  >
>;

export interface LastWear {
  outfitId: string;
  worn_on: string;
}

/**
 * The only way screens touch data. LocalRepo serves demo mode from
 * localStorage; SupabaseRepo (phase 4) calls the API routes. Every mutation
 * resolves to the full, updated snapshot so screens simply re-render.
 */
export interface WardrobeRepo {
  readonly kind: "demo" | "supabase";
  load(): Promise<WardrobeSnapshot>;

  // Daily loop
  wear(outfitId: string): Promise<WardrobeSnapshot>;
  lastWear(): LastWear | null;
  undoWear(): Promise<WardrobeSnapshot>;
  laundryDone(): Promise<WardrobeSnapshot>;
  ironed(itemIds?: string[]): Promise<WardrobeSnapshot>;
  setUnavailable(itemId: string, unavailable: boolean): Promise<WardrobeSnapshot>;

  // Wardrobe
  updateItem(itemId: string, patch: ItemPatch): Promise<WardrobeSnapshot>;
  deleteItem(itemId: string): Promise<WardrobeSnapshot>;

  // Outfits
  generate(): Promise<WardrobeSnapshot>;
  feedback(outfitId: string, decision: Decision): Promise<WardrobeSnapshot>;
  createOutfit(topId: string, bottomId: string): Promise<WardrobeSnapshot>;
  removeOutfit(outfitId: string): Promise<WardrobeSnapshot>;

  /** Demo only: restore the seed wardrobe. */
  reset?(): Promise<WardrobeSnapshot>;
}
