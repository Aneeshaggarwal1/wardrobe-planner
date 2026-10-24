import { modelName } from "@/lib/ai/client";
import { rerank } from "@/lib/ai/rerank";
import { applyOp, ruleCandidates } from "@/lib/ops";
import { aiClient } from "@/lib/server/ai";
import { LIMITS, commit, loadSnapshot, opContext, route, spendQuota } from "@/lib/server/wardrobe";

export const maxDuration = 60;

/**
 * POST /api/outfits/generate: rule-score every top × bottom pair, let Claude
 * re-rank the best 30 and write the reasons, queue the top 20 for curation.
 * If the model fails or isn't configured, the rule order and template reasons
 * are used instead.
 */
export const POST = route(async (env) => {
  const { sb, user, req } = env;
  await spendQuota(sb, user, "generate", LIMITS.generate);
  const before = await loadSnapshot(sb);
  const pool = ruleCandidates(before, 30);
  const itemsById = new Map(before.items.map((i) => [i.id, i]));
  const { candidates, usedModel } = await rerank(aiClient(), modelName(), pool, itemsById, 20);
  const after = applyOp(before, { type: "addCandidates", candidates }, opContext(user, req));
  await commit(sb, before, after);
  return Response.json({ snapshot: after, usedModel, added: candidates.length });
});
