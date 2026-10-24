import { readBody } from "@/lib/server/http";
import { createOutfitBody } from "@/lib/server/schemas";
import { route, runOp } from "@/lib/server/wardrobe";

/** POST /api/outfits: a manual outfit, approved straight away (and counted as an approve signal). */
export const POST = route(async (env) => {
  const { topId, bottomId } = createOutfitBody.parse(await readBody(env.req));
  const { after } = await runOp(env, { type: "createOutfit", topId, bottomId });
  return Response.json({ snapshot: after });
});
