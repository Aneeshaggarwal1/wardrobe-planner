import type { Item, PairFeatures } from "../types";
import { harmony } from "./harmony";

/** Component weights. They sum to 100 so a score reads as a percentage. */
export const WEIGHTS = { color: 40, formality: 25, pattern: 15, taste: 20 } as const;

export interface ScoreBreakdown {
  color: number; // 0–1
  formality: number; // 0–1
  pattern: number; // 0–1
  taste: number; // 0–1
  total: number; // 0–100
}

export interface TasteSignal {
  approved: readonly PairFeatures[];
  rejected: readonly PairFeatures[];
}

/**
 * Colour harmony of the pair. For a patterned item the secondary colour also
 * touches the other garment, so it is blended in at a quarter weight.
 */
export function colorScore(top: Item, bottom: Item): number {
  const base = harmony(top.primary_color, bottom.primary_color).score;
  const extras: number[] = [];
  if (top.secondary_color) extras.push(harmony(top.secondary_color, bottom.primary_color).score);
  if (bottom.secondary_color) extras.push(harmony(top.primary_color, bottom.secondary_color).score);
  if (extras.length === 0) return base;
  const extra = extras.reduce((sum, v) => sum + v, 0) / extras.length;
  return 0.75 * base + 0.25 * extra;
}

/** 1.0 at the same level, 0.6 one apart, 0.2 two apart, 0 beyond (filtered anyway). */
export function formalityScore(top: Item, bottom: Item): number {
  const gap = Math.abs(top.formality - bottom.formality);
  if (gap === 0) return 1;
  if (gap === 1) return 0.6;
  if (gap === 2) return 0.2;
  return 0;
}

/**
 * 1.0 for solid + solid or solid + pattern; 0.5 for textured + pattern;
 * 0.8 for textured + textured. Two busy patterns are filtered out before this.
 */
export function patternScore(top: Item, bottom: Item): number {
  const a = top.pattern;
  const b = bottom.pattern;
  if (a === "solid" || b === "solid") return 1;
  if (a === "textured" && b === "textured") return 0.8;
  if (a === "textured" || b === "textured") return 0.5;
  return 0;
}

export function featuresOf(top: Item, bottom: Item): PairFeatures {
  return {
    top_color: top.primary_color,
    bottom_color: bottom.primary_color,
    top_subcategory: top.subcategory,
    bottom_subcategory: bottom.subcategory,
  };
}

/** Similarity of two pairs, 0–1, weighted towards colour. */
export function pairSimilarity(p: PairFeatures, q: PairFeatures): number {
  return (
    0.4 * Number(p.top_color === q.top_color) +
    0.4 * Number(p.bottom_color === q.bottom_color) +
    0.1 * Number(p.top_subcategory === q.top_subcategory) +
    0.1 * Number(p.bottom_subcategory === q.bottom_subcategory)
  );
}

/** Mean similarity to the three closest pairs in a set; 0 for an empty set. */
function closeness(p: PairFeatures, set: readonly PairFeatures[]): number {
  if (set.length === 0) return 0;
  const sims = set.map((q) => pairSimilarity(p, q)).sort((x, y) => y - x);
  const top = sims.slice(0, 3);
  return top.reduce((sum, v) => sum + v, 0) / top.length;
}

/**
 * Taste signal: 0.5 at cold start, moving up with similarity to approved pairs
 * and down with similarity to rejected ones.
 */
export function tasteScore(features: PairFeatures, signal: TasteSignal): number {
  const value = 0.5 + 0.5 * (closeness(features, signal.approved) - closeness(features, signal.rejected));
  return Math.min(1, Math.max(0, value));
}

export function scorePair(top: Item, bottom: Item, signal: TasteSignal): ScoreBreakdown {
  const color = colorScore(top, bottom);
  const formality = formalityScore(top, bottom);
  const pattern = patternScore(top, bottom);
  const taste = tasteScore(featuresOf(top, bottom), signal);
  const total =
    WEIGHTS.color * color +
    WEIGHTS.formality * formality +
    WEIGHTS.pattern * pattern +
    WEIGHTS.taste * taste;
  return { color, formality, pattern, taste, total: Math.round(total * 10) / 10 };
}
