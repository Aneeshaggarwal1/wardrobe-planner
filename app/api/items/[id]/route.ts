import { readBody } from "@/lib/server/http";
import { itemPatchBody, routeId } from "@/lib/server/schemas";
import { route, runOp, type IdContext } from "@/lib/server/wardrobe";
import { BUCKET } from "@/lib/supabase/env";

/** PATCH /api/items/[id]: edit tags and care settings, or toggle unavailable. */
export const PATCH = route<IdContext>(async (env, ctx) => {
  const itemId = await routeId(ctx);
  const body = itemPatchBody.parse(await readBody(env.req));
  const op =
    "patch" in body
      ? ({ type: "updateItem", itemId, patch: body.patch } as const)
      : ({ type: "setUnavailable", itemId, unavailable: body.unavailable } as const);
  const { after } = await runOp(env, op);
  return Response.json({ snapshot: after });
});

/** DELETE /api/items/[id]: delete the item, its photos and the outfits that use it. */
export const DELETE = route<IdContext>(async (env, ctx) => {
  const itemId = await routeId(ctx);
  const { before, after } = await runOp(env, { type: "deleteItem", itemId });
  const item = before.items.find((i) => i.id === itemId);
  const paths = [item?.image_path, item?.thumb_path].filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { error } = await env.sb.storage.from(BUCKET).remove(paths);
    if (error) console.error("Photo cleanup failed", error.message);
  }
  return Response.json({ snapshot: after });
});
