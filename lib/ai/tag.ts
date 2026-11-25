import { z } from "zod";
import { PALETTE } from "../pairing/palette";
import type { Category, Fit, Pattern } from "../types";
import { extractJson, textOf, type MessagesClient } from "./client";

export const SUBCATEGORIES = [
  "formal shirt",
  "oxford shirt",
  "casual shirt",
  "linen shirt",
  "polo",
  "t-shirt",
  "formal trousers",
  "chinos",
  "jeans",
  "blazer",
  "sweater",
  "shoes",
  "belt",
] as const;

export const tagSchema = z.object({
  category: z.enum(["top", "bottom", "shoes", "belt", "layer"]),
  subcategory: z.string().trim().toLowerCase().min(2).max(40),
  primary_color: z.enum(PALETTE),
  secondary_color: z.enum(PALETTE).nullable(),
  pattern: z.enum(["solid", "stripe", "check", "print", "textured"]),
  formality: z.number().int().min(1).max(5),
  fit: z.enum(["slim", "regular", "relaxed"]).nullable(),
  confidence: z.number().min(0).max(1),
});

const refusalSchema = z.object({ error: z.string().min(1) });

export type Tags = z.infer<typeof tagSchema> & {
  category: Category;
  pattern: Pattern;
  fit: Fit | null;
};


export class TagError extends Error {
  constructor(
    message: string,
    readonly kind: "not_one_item" | "invalid",
  ) {
    super(message);
  }
}

export const TAG_PROMPT = `You are tagging a single clothing item for an office wardrobe app.
Look at the photo and return ONLY a JSON object, no prose, matching:
{
  "category": "top" | "bottom" | "shoes" | "belt" | "layer",
  "subcategory": one of ${JSON.stringify(SUBCATEGORIES)} (closest match),
  "primary_color": one of PALETTE,
  "secondary_color": one of PALETTE, or null if the item is a single colour,
  "pattern": "solid" | "stripe" | "check" | "print" | "textured",
  "formality": 1-5 (1 = casual Friday, 3 = smart casual, 5 = boardroom),
  "fit": "slim" | "regular" | "relaxed" | null,
  "confidence": 0-1, how sure you are of the colour and category
}
PALETTE = ${JSON.stringify(PALETTE)}
Rules:
- Pick the palette colour closest to the fabric in neutral light; ignore background and hanger.
- "textured" is a subtle weave such as linen or oxford; "stripe"/"check"/"print" are visible patterns.
- Blazers and sweaters are "layer".
If the photo shows no clothing, or clearly more than one garment, return {"error": "<short reason>"} instead.`;

/** Parse and validate one model reply. Throws TagError. */
export function parseTagReply(text: string): Tags {
  let json: unknown;
  try {
    json = extractJson(text);
  } catch {
    throw new TagError("The tagger's reply wasn't JSON", "invalid");
  }
  const refusal = refusalSchema.safeParse(json);
  if (refusal.success) throw new TagError(refusal.data.error, "not_one_item");
  const parsed = tagSchema.safeParse(json);
  if (!parsed.success) throw new TagError("The tagger returned tags outside the allowed values", "invalid");
  return parsed.data as Tags;
}

/**
 * Tag one photo with the Claude API. Retries once on an invalid reply; a
 * "not one garment" refusal is final.
 */
export async function tagImage(client: MessagesClient, model: string, jpegBase64: string): Promise<Tags> {
  let lastError: TagError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await client.messages.create(
      {
        model,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
              { type: "text", text: TAG_PROMPT },
            ],
          },
        ],
      },
      { timeout: 30_000 },
    );
    try {
      return parseTagReply(textOf(reply.content));
    } catch (e) {
      if (!(e instanceof TagError) || e.kind === "not_one_item") throw e;
      lastError = e;
    }
  }
  throw lastError ?? new TagError("Tagging failed", "invalid");
}
