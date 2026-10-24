import { modelName } from "@/lib/ai/client";
import { CONFIDENCE_THRESHOLD, TagError, tagImage } from "@/lib/ai/tag";
import { careDefaults } from "@/lib/defaults";
import { aiClient, aiErrorMessage } from "@/lib/server/ai";
import { HttpError, readBody } from "@/lib/server/http";
import { createItemBody } from "@/lib/server/schemas";
import { LIMITS, route, runOp, signItems, spendQuota } from "@/lib/server/wardrobe";
import { BUCKET, photoPaths } from "@/lib/supabase/env";
import type { Item } from "@/lib/types";

export const maxDuration = 60;

/**
 * POST /api/items { id }: the browser has already uploaded {user}/{id}.jpg and
 * {user}/{id}_thumb.jpg to the private bucket. Tag the photo with Claude and
 * add the item. Paths come from the session, never from the request.
 */
export const POST = route(async (env) => {
  const { sb, user } = env;
  const { id } = createItemBody.parse(await readBody(env.req));
  const ai = aiClient();
  if (!ai) throw new HttpError(503, "AI tagging isn't set up: add ANTHROPIC_API_KEY to .env.local and restart.");

  const paths = photoPaths(user.id, id);
  const discard = () => sb.storage.from(BUCKET).remove([paths.image, paths.thumb]);

  await spendQuota(sb, user, "tag", LIMITS.tag);

  const download = await sb.storage.from(BUCKET).download(paths.image);
  if (download.error || !download.data) throw new HttpError(404, "Upload not found. Try adding the photo again.");
  const base64 = Buffer.from(await download.data.arrayBuffer()).toString("base64");

  let tags;
  try {
    tags = await tagImage(ai, modelName(), base64);
  } catch (e) {
    await discard();
    if (e instanceof TagError) {
      throw new HttpError(422, e.kind === "not_one_item" ? `Skipped: ${e.message}` : "Couldn't tag this photo. Try a clearer one.");
    }
    throw new HttpError(502, aiErrorMessage(e));
  }

  const care = careDefaults(tags.category, tags.subcategory);
  const item: Item = {
    id,
    user_id: user.id,
    image_url: "",
    thumb_url: "",
    image_path: paths.image,
    thumb_path: paths.thumb,
    category: tags.category,
    subcategory: tags.subcategory,
    primary_color: tags.primary_color,
    secondary_color: tags.secondary_color,
    pattern: tags.pattern,
    formality: tags.formality,
    fit: tags.fit,
    state: "ready",
    wears_before_wash: care.wears_before_wash,
    wears_since_wash: 0,
    ironing_required: care.ironing_required,
    last_worn_at: null,
    // Confident tags are trusted; the rest are flagged "Check me" in Tag review.
    tags_confirmed: tags.confidence >= CONFIDENCE_THRESHOLD,
    created_at: new Date().toISOString(),
  };

  const { after } = await runOp(env, { type: "addItem", item });
  const [signed] = await signItems(sb, [item]);
  const snapshot = { ...after, items: after.items.map((i) => (i.id === id && signed ? signed : i)) };
  return Response.json({ snapshot, item: signed, confidence: tags.confidence });
});
