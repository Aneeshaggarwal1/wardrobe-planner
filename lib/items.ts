import { CONFIDENCE_THRESHOLD } from "./constants";
import type { PhotoTags } from "./client/ai";
import { careDefaults } from "./defaults";
import type { Item } from "./types";

/**
 * Turn AI tags for a photo into a wardrobe item. The thumbnail is kept inside
 * the item as a data: URL, so the saved wardrobe (and its backup file) carries
 * its own photos. Unsure tags are flagged "Check me" in Tag review.
 */
export function itemFromTags(id: string, tags: PhotoTags, thumbDataUrl: string, now: string): Item {
  const subcategory = tags.subcategory.trim().toLowerCase();
  const care = careDefaults(tags.category, subcategory);
  return {
    id,
    user_id: "mine",
    image_url: thumbDataUrl,
    thumb_url: thumbDataUrl,
    category: tags.category,
    subcategory,
    primary_color: tags.primary_color,
    secondary_color: tags.secondary_color,
    pattern: tags.pattern,
    formality: tags.formality,
    fit: tags.fit,
    state: "ready",
    wears_before_wash: care.wears_before_wash,
    wears_since_wash: 0,
    ironing_required: care.ironing_required,
    last_worn_at: null,
    tags_confirmed: tags.confidence >= CONFIDENCE_THRESHOLD,
    created_at: now,
  };
}
