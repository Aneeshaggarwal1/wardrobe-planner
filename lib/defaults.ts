import type { Category } from "./types";

/**
 * Per-subcategory defaults. The user can override both values per item.
 * Unknown subcategories fall back to their category default.
 */
export interface CareDefaults {
  wears_before_wash: number;
  ironing_required: boolean;
}

export const SUBCATEGORY_DEFAULTS: Record<string, CareDefaults> = {
  "formal shirt": { wears_before_wash: 1, ironing_required: true },
  "oxford shirt": { wears_before_wash: 1, ironing_required: true },
  "casual shirt": { wears_before_wash: 1, ironing_required: true },
  "linen shirt": { wears_before_wash: 1, ironing_required: true },
  polo: { wears_before_wash: 1, ironing_required: false },
  "t-shirt": { wears_before_wash: 1, ironing_required: false },
  "formal trousers": { wears_before_wash: 3, ironing_required: true },
  chinos: { wears_before_wash: 3, ironing_required: true },
  jeans: { wears_before_wash: 5, ironing_required: false },
  blazer: { wears_before_wash: 8, ironing_required: false },
  sweater: { wears_before_wash: 4, ironing_required: false },
  shoes: { wears_before_wash: 999, ironing_required: false },
  belt: { wears_before_wash: 999, ironing_required: false },
};

const CATEGORY_DEFAULTS: Record<Category, CareDefaults> = {
  top: { wears_before_wash: 1, ironing_required: true },
  bottom: { wears_before_wash: 3, ironing_required: true },
  layer: { wears_before_wash: 8, ironing_required: false },
  shoes: { wears_before_wash: 999, ironing_required: false },
  belt: { wears_before_wash: 999, ironing_required: false },
};

export function careDefaults(category: Category, subcategory: string): CareDefaults {
  return SUBCATEGORY_DEFAULTS[subcategory.toLowerCase()] ?? CATEGORY_DEFAULTS[category];
}
