import type { Item, Pattern } from "../types";

/** Patterns that are visually busy. "textured" is a subtle weave and does not count. */
const BUSY: ReadonlySet<Pattern> = new Set<Pattern>(["stripe", "check", "print"]);

export type FilterReason =
  | "formality_gap"
  | "double_pattern"
  | "monochrome"
  | "previously_rejected";

export interface FilterContext {
  /** Pair keys (see pairKey) the user rejected before. */
  rejectedPairs: ReadonlySet<string>;
  /** True once the user has approved at least one same-colour outfit. */
  allowMonochrome: boolean;
}

export function pairKey(topId: string, bottomId: string): string {
  return `${topId}__${bottomId}`;
}

/**
 * Hard filters from the brief. Returns the first reason the pair is dropped,
 * or null if the pair may be scored.
 */
export function hardFilter(top: Item, bottom: Item, ctx: FilterContext): FilterReason | null {
  if (ctx.rejectedPairs.has(pairKey(top.id, bottom.id))) return "previously_rejected";
  if (Math.abs(top.formality - bottom.formality) > 2) return "formality_gap";
  if (BUSY.has(top.pattern) && BUSY.has(bottom.pattern)) return "double_pattern";
  if (!ctx.allowMonochrome && top.primary_color === bottom.primary_color) return "monochrome";
  return null;
}
