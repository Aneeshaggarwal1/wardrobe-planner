import { route, runOp } from "@/lib/server/wardrobe";

/** POST /api/wear/undo: revert today's latest "Wear this". */
export const POST = route(async (env) => {
  const { after } = await runOp(env, { type: "undoWear" });
  return Response.json({ snapshot: after });
});
