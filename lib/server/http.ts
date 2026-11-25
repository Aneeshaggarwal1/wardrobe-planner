import { ZodError } from "zod";
import { TransitionError } from "../state/machine";
import { HttpError } from "./errors";

export { HttpError };

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
