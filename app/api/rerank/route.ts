import { z } from "zod";
import { modelName } from "@/lib/ai/client";
import { requestRanking } from "@/lib/ai/rerank";
import { PALETTE } from "@/lib/pairing/palette";
import type { RankItem } from "@/lib/pairing/ranking";
import { aiClient } from "@/lib/server/ai";
import { checkPasscode, rateLimiter } from "@/lib/server/guard";
import { errorResponse, readBody } from "@/lib/server/http";

export const maxDuration = 60;

const id = z.string().min(1).max(64);
const body = z
  .object({
    pairs: z.array(z.object({ top_id: id, bottom_id: id, score: z.number() }).strict()).min(1).max(40),
    items: z
      .array(
        z
          .object({
            id,
            primary_color: z.enum(PALETTE),
            subcategory: z.string().min(1).max(40),
            pattern: z.enum(["solid", "stripe", "check", "print", "textured"]),
            formality: z.number().int().min(1).max(5),
          })
          .strict(),
      )
      .max(200),
    keep: z.number().int().min(1).max(30),
  })
  .strict();
const limit = rateLimiter(30, 60 * 60 * 1000);

/**
 * POST /api/rerank { pairs, items, keep } → { ranking: [{ i, reason }] | null }
 * Only tags are sent, never photos. A null ranking means "keep the rule order".
 */
export async function POST(req: Request): Promise<Response> {
  try {
    checkPasscode(req);
    limit();
    const { pairs, items, keep } = body.parse(await readBody(req));
    const ai = aiClient();
    if (!ai) return Response.json({ ranking: null });
    const byId = new Map<string, RankItem>(items.map((i: RankItem) => [i.id, i]));
    return Response.json({ ranking: await requestRanking(ai, modelName(), pairs, byId, keep) });
  } catch (e) {
    return errorResponse(e);
  }
}
