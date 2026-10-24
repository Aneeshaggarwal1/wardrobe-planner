/**
 * The slice of the Claude Messages API this app uses. Typed narrowly so tests
 * can pass a fake, and so nothing else from the SDK leaks into app code.
 */
export interface ContentBlock {
  type: string;
  text?: string;
}

export interface MessagesClient {
  messages: {
    create(
      params: {
        model: string;
        max_tokens: number;
        system?: string;
        messages: Array<{ role: "user" | "assistant"; content: unknown }>;
      },
      options?: { timeout?: number },
    ): Promise<{ content: ContentBlock[] }>;
  };
}

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function modelName(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function textOf(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

/** Pull the first JSON object out of a model reply, tolerating code fences or stray prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in the reply");
  return JSON.parse(text.slice(start, end + 1));
}
