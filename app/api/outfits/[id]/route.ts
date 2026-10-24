import { routeId } from "@/lib/server/schemas";
import { route, runOp, type IdContext } from "@/lib/server/wardrobe";

/** DELETE /api/outfits/[id]: remove an outfit from the bank. */
export const DELETE = route<IdContext>(async (env, ctx) => {
  const { after } = await runOp(env, { type: "removeOutfit", outfitId: await routeId(ctx) });
  return Response.json({ snapshot: after });
});
