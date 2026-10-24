import Anthropic from "@anthropic-ai/sdk";
import type { MessagesClient } from "../ai/client";

let client: MessagesClient | null | undefined;

/** The Claude API client, or null when ANTHROPIC_API_KEY isn't set. Server only. */
export function aiClient(): MessagesClient | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  client = apiKey ? (new Anthropic({ apiKey, maxRetries: 1 }) as unknown as MessagesClient) : null;
  return client;
}

/** A user-safe message for an error thrown by the Claude API. */
export function aiErrorMessage(e: unknown): string {
  const status = typeof e === "object" && e !== null && "status" in e ? (e as { status: unknown }).status : undefined;
  if (status === 401 || status === 403) return "The AI key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
  if (status === 429) return "The AI service is busy or the spend limit was reached. Try again in a minute.";
  if (status === 400) return "The AI service couldn't read this photo. Try a different one.";
  return "The AI service didn't respond. Try again.";
}
