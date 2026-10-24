import { z } from "zod";
import type { Candidate } from "../pairing/generate";
import { wordCount } from "../pairing/reasons";
import { itemName } from "../state/today";
import type { Item } from "../types";
import { extractJson, textOf, type MessagesClient } from "./client";

const rerankSchema = z.object({
  ranking: z
    .array(z.object({ i: z.number().int().min(0), reason: z.string().trim().min(3).max(120) }))
    .min(1),
});

function describe(item: Item): string {
  return `${itemName(item)} (formality ${item.formality})`;
}

export function rerankPrompt(candidates: readonly Candidate[], items: ReadonlyMap<string, Item>, keep: number): string {
  const lines = candidates.map((c, i) => {
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
export function applyRanking(candidates: readonly Candidate[], ranking: Array<{ i: number; reason: string }>, keep: number): Candidate[] {
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

/**
 * Re-rank rule candidates with the LLM. Any failure (timeout, bad JSON, API
 * error) falls back to the rule order and template reasons, so generation
 * never fails because of the model.
 */
export async function rerank(
  client: MessagesClient | null,
  model: string,
  candidates: readonly Candidate[],
  items: ReadonlyMap<string, Item>,
  keep = 20,
): Promise<{ candidates: Candidate[]; usedModel: boolean }> {
  const fallback = { candidates: candidates.slice(0, keep), usedModel: false };
  if (!client || candidates.length === 0) return fallback;
  try {
    const reply = await client.messages.create(
      { model, max_tokens: 1500, messages: [{ role: "user", content: rerankPrompt(candidates, items, keep) }] },
      { timeout: 20_000 },
    );
    const parsed = rerankSchema.safeParse(extractJson(textOf(reply.content)));
    if (!parsed.success) return fallback;
    return { candidates: applyRanking(candidates, parsed.data.ranking, keep), usedModel: true };
  } catch {
    return fallback;
  }
}
