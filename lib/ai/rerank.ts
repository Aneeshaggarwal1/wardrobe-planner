import { z } from "zod";
import { rerankPrompt, type RankEntry, type RankItem, type RankPair } from "../pairing/ranking";
import { extractJson, textOf, type MessagesClient } from "./client";

const rerankSchema = z.object({
  ranking: z
    .array(z.object({ i: z.number().int().min(0), reason: z.string().trim().min(3).max(120) }))
    .min(1),
});

/**
 * Ask the model to order the pairs and write reasons. Returns null on any
 * failure (timeout, bad JSON, API error); the app then keeps the rule order
 * and template reasons, so generation never fails because of the model.
 */
export async function requestRanking(
  client: MessagesClient,
  model: string,
  pairs: readonly RankPair[],
  items: ReadonlyMap<string, RankItem>,
  keep: number,
): Promise<RankEntry[] | null> {
  if (pairs.length === 0) return null;
  try {
    const reply = await client.messages.create(
      { model, max_tokens: 1500, messages: [{ role: "user", content: rerankPrompt(pairs, items, keep) }] },
      { timeout: 20_000 },
    );
    const parsed = rerankSchema.safeParse(extractJson(textOf(reply.content)));
    if (!parsed.success) return null;
    return parsed.data.ranking.filter((r: RankEntry) => r.i < pairs.length);
  } catch {
    return null;
  }
}
