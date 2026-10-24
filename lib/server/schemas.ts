import { z } from "zod";
import { PALETTE } from "../pairing/palette";

export const idParam = z.uuid();

export const itemPatchSchema = z
  .object({
    category: z.enum(["top", "bottom", "shoes", "belt", "layer"]),
    subcategory: z.string().trim().toLowerCase().min(2).max(40),
    primary_color: z.enum(PALETTE),
    secondary_color: z.enum(PALETTE).nullable(),
    pattern: z.enum(["solid", "stripe", "check", "print", "textured"]),
    formality: z.number().int().min(1).max(5),
    fit: z.enum(["slim", "regular", "relaxed"]).nullable(),
    wears_before_wash: z.number().int().min(1).max(999),
    ironing_required: z.boolean(),
    tags_confirmed: z.boolean(),
  })
  .partial()
  .strict();

/** PATCH /api/items/[id]: either tag edits or the unavailable toggle. */
export const itemPatchBody = z.union([
  z.object({ patch: itemPatchSchema }).strict(),
  z.object({ unavailable: z.boolean() }).strict(),
]);

export const createItemBody = z.object({ id: z.uuid() }).strict();
export const createOutfitBody = z.object({ topId: z.uuid(), bottomId: z.uuid() }).strict();
export const feedbackBody = z.object({ decision: z.enum(["approve", "reject"]) }).strict();
export const ironedBody = z.object({ itemIds: z.array(z.uuid()).max(500).optional() }).strict();

type RouteContext = { params: Promise<{ id: string }> };

/** Next.js 15+ passes dynamic params as a promise. */
export async function routeId(ctx: RouteContext): Promise<string> {
  return idParam.parse((await ctx.params).id);
}
