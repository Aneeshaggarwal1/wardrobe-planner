import { ZodError } from "zod";
import { TransitionError } from "../state/machine";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Map any thrown error to a JSON response with a message safe to show the user. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof TransitionError) return Response.json({ error: e.message }, { status: 409 });
  if (e instanceof ZodError) return Response.json({ error: "Invalid request" }, { status: 400 });
  console.error(e);
  return Response.json({ error: "Something went wrong on the server" }, { status: 500 });
}

export async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

/** The user's local calendar day, sent by the app so "today" matches their timezone. */
export function localDayFrom(req: Request): string {
  const day = req.headers.get("x-local-day") ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
}
