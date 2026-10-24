import { readBody } from "@/lib/server/http";
import { feedbackBody, routeId } from "@/lib/server/schemas";
import { route, runOp, type IdContext } from "@/lib/server/wardrobe";

/** POST /api/outfits/[id]/feedback: approve or reject a candidate; feeds the taste signal. */
export const POST = route<IdContext>(async (env, ctx) => {
  const outfitId = await routeId(ctx);
  const { decision } = feedbackBody.parse(await readBody(env.req));
  const { after } = await runOp(env, { type: "feedback", outfitId, decision });
  return Response.json({ snapshot: after });
});
