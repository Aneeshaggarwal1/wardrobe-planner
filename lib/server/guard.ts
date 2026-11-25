import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors";

/**
 * The AI endpoints are the only part of the app that costs money, and the
 * site is public, so they require a passcode only the owner knows
 * (APP_PASSCODE). The app sends it in the x-app-passcode header.
 */
export function checkPasscode(req: Request, expected: string | undefined = process.env.APP_PASSCODE): void {
  const want = expected?.trim();
  if (!want) throw new HttpError(503, "AI tagging isn't set up on this server: APP_PASSCODE is missing.");
  const got = req.headers.get("x-app-passcode")?.trim() ?? "";
  // Compare digests so the comparison takes the same time whatever the input.
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(want).digest();
  if (!got || !timingSafeEqual(a, b)) throw new HttpError(401, "Wrong passcode");
}

/**
 * A small per-server-instance limit as a second line of defence. Serverless
 * instances come and go, so this is best effort: the hard cap is the monthly
 * spend limit set in the Anthropic console.
 */
export function rateLimiter(limit: number, windowMs: number) {
  const hits: number[] = [];
  return (now: number = Date.now()): void => {
    while (hits.length > 0 && hits[0]! <= now - windowMs) hits.shift();
    if (hits.length >= limit) throw new HttpError(429, "Too many requests. Try again in a little while.");
    hits.push(now);
  };
}
