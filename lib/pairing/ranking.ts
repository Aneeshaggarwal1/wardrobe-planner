import { itemName } from "../state/today";
import type { Item } from "../types";
import type { Candidate } from "./generate";
import { wordCount } from "./reasons";

/** The tags the stylist model sees for an item: no photos, no ids it could leak. */
export type RankItem = Pick<Item, "id" | "primary_color" | "subcategory" | "pattern" | "formality">;

/** One candidate as sent for re-ranking. */
export type RankPair = Pick<Candidate, "top_id" | "bottom_id" | "score">;

export interface RankEntry {
  /** Index into the pairs that were sent. */
  i: number;
  reason: string;
}

function describe(item: RankItem): string {
  return `${itemName(item)} (formality ${item.formality})`;
}

export function rerankPrompt(pairs: readonly RankPair[], items: ReadonlyMap<string, RankItem>, keep: number): string {
  const lines = pairs.map((c, i) => {
    const top = items.get(c.top_id);
    const bottom = items.get(c.bottom_id);
    return `[${i}] ${top ? describe(top) : "?"} + ${bottom ? describe(bottom) : "?"} · rule score ${Math.round(c.score)}`;
  });
  return `You are a stylist helping someone choose office outfits from their own wardrobe.
Below are candidate top + bottom pairings, pre-scored by colour and formality rules.
Pick the ${keep} best for a modern office and order them best first. Judge overall style, not only the rule score.
For each, write a reason of at most 12 words, specific to the pair (e.g. "Crisp contrast; the navy grounds the pale blue").
Return ONLY JSON: {"ranking": [{"i": <index>, "reason": "<text>"}, ...]}

${lines.join("\n")}`;
}

/**
 * Merge the model's ranking with the rule order: valid, unique indices in the
 * model's order first (with its reasons when they fit in 12 words), then the
 * remaining candidates by rule score with their template reasons.
 */
export function applyRanking(candidates: readonly Candidate[], ranking: readonly RankEntry[], keep: number): Candidate[] {
  const used = new Set<number>();
  const out: Candidate[] = [];
  for (const { i, reason } of ranking) {
    const c = candidates[i];
    if (!c || used.has(i)) continue;
    used.add(i);
    out.push({ ...c, reason: wordCount(reason) <= 12 ? reason : c.reason });
  }
  candidates.forEach((c, i) => {
    if (!used.has(i)) out.push(c);
  });
  return out.slice(0, keep);
}

export function toRankItem(item: Item): RankItem {
  return {
    id: item.id,
    primary_color: item.primary_color,
    subcategory: item.subcategory,
    pattern: item.pattern,
    formality: item.formality,
  };
}
