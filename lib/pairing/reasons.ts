import type { Item } from "../types";
import { harmony } from "./harmony";

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Template reason line built from tags, used in demo mode and whenever the
 * LLM re-rank is unavailable. Always 12 words or fewer.
 * Example: "Light blue and navy: classic contrast"
 */
export function templateReason(top: Item, bottom: Item): string {
  const { label } = harmony(top.primary_color, bottom.primary_color);
  if (top.primary_color === bottom.primary_color) {
    return `${capitalise(top.primary_color)} head to toe: ${label}`;
  }
  return `${capitalise(top.primary_color)} and ${bottom.primary_color}: ${label}`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
