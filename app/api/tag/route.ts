import { z } from "zod";
import { modelName } from "@/lib/ai/client";
import { TagError, tagImage } from "@/lib/ai/tag";
import { aiClient, aiErrorMessage } from "@/lib/server/ai";
import { checkPasscode, rateLimiter } from "@/lib/server/guard";
import { HttpError, errorResponse, readBody } from "@/lib/server/http";

export const maxDuration = 60;

// A resized 1200px JPEG is ~100–400 KB; 4 MB of base64 leaves plenty of room.
const body = z.object({ image: z.string().min(100).max(4_000_000) }).strict();
const limit = rateLimiter(120, 60 * 60 * 1000);

/**
 * POST /api/tag { image: base64 JPEG } → { tags }
 * Tags one photo with Claude. The photo is not stored anywhere: it goes from
 * the phone to the model and the tags come back.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    checkPasscode(req);
    limit();
    const { image } = body.parse(await readBody(req));
    const ai = aiClient();
    if (!ai) throw new HttpError(503, "AI tagging isn't set up on this server: ANTHROPIC_API_KEY is missing.");
    try {
      const tags = await tagImage(ai, modelName(), image);
      return Response.json({ tags });
    } catch (e) {
      if (e instanceof TagError) {
        const message = e.kind === "not_one_item" ? `Skipped: ${e.message}` : "Couldn't tag this photo. Try a clearer one.";
        throw new HttpError(422, message);
      }
      throw new HttpError(502, aiErrorMessage(e));
    }
  } catch (e) {
    return errorResponse(e);
  }
}
