import { routeId } from "@/lib/server/schemas";
import { route, runOp, type IdContext } from "@/lib/server/wardrobe";

/** POST /api/outfits/[id]/wear: "Wear this". Updates items, outfit and wear log atomically. */
export const POST = route<IdContext>(async (env, ctx) => {
  const { after } = await runOp(env, { type: "wear", outfitId: await routeId(ctx) });
  return Response.json({ snapshot: after });
});
