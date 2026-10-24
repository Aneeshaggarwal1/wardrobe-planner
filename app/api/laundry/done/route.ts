import { route, runOp } from "@/lib/server/wardrobe";

/** POST /api/laundry/done: everything in the laundry moves to ironing (or straight to ready). */
export const POST = route(async (env) => {
  const { after } = await runOp(env, { type: "laundryDone" });
  return Response.json({ snapshot: after });
});
