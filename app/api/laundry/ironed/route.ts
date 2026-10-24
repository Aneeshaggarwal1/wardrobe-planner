import { readBody } from "@/lib/server/http";
import { ironedBody } from "@/lib/server/schemas";
import { route, runOp } from "@/lib/server/wardrobe";

/** POST /api/laundry/ironed: listed items (or all) move from needs ironing to ready. */
export const POST = route(async (env) => {
  const { itemIds } = ironedBody.parse(await readBody(env.req));
  const { after } = await runOp(env, { type: "ironed", itemIds });
  return Response.json({ snapshot: after });
});
