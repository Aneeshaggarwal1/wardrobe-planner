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

/** What the last "generate" did, so the screen can say whether the AI was used. */
export interface GenerateInfo {
  added: number;
  usedModel: boolean;
}

/**
 * The only way screens touch data. Both the demo and your own wardrobe are
 * served by LocalRepo, from storage on this device. Every mutation resolves to
 * the full, updated snapshot so screens simply re-render.
 */
export interface WardrobeRepo {
  readonly kind: "demo" | "mine";
  load(): Promise<WardrobeSnapshot>;

  // Daily loop
  wear(outfitId: string): Promise<WardrobeSnapshot>;
  lastWear(): LastWear | null;
  undoWear(): Promise<WardrobeSnapshot>;
  laundryDone(): Promise<WardrobeSnapshot>;
  ironed(itemIds?: string[]): Promise<WardrobeSnapshot>;
  setUnavailable(itemId: string, unavailable: boolean): Promise<WardrobeSnapshot>;

  // Wardrobe
  addItem(item: Item): Promise<WardrobeSnapshot>;
  updateItem(itemId: string, patch: ItemPatch): Promise<WardrobeSnapshot>;
  deleteItem(itemId: string): Promise<WardrobeSnapshot>;

  // Outfits
  generate(): Promise<WardrobeSnapshot>;
  lastGenerate(): GenerateInfo | null;
  feedback(outfitId: string, decision: Decision): Promise<WardrobeSnapshot>;
  createOutfit(topId: string, bottomId: string): Promise<WardrobeSnapshot>;
  removeOutfit(outfitId: string): Promise<WardrobeSnapshot>;

  /** Replace everything (restore from a backup file). */
  replaceAll(snapshot: WardrobeSnapshot): Promise<WardrobeSnapshot>;
  /** Demo: restore the seed. Yours: start empty. */
  reset(): Promise<WardrobeSnapshot>;
}
