import { COLOR_GROUP, LIGHT_COLORS, PALETTE, type ColorGroup, type PaletteColor } from "./palette";

/**
 * Colour harmony for every pair of palette colours, rated 0–1, plus a short
 * human label used in template reason lines.
 *
 * Built in two layers so it stays readable and complete:
 *  1. a group-by-group default (light neutral × dark neutral, pastel × earth …)
 *  2. explicit overrides for pairs that matter most in office wear
 * The full symmetric table is materialised once at module load.
 */

export type HarmonyLabel =
  | "classic contrast"
  | "easy neutral"
  | "tonal"
  | "smart pairing"
  | "balanced"
  | "bold mix";

export interface Harmony {
  score: number;
  label: HarmonyLabel;
}

const GROUPS: ColorGroup[] = [
  "light-neutral",
  "dark-neutral",
  "mid-neutral",
  "earth",
  "soft-blue",
  "bold-blue",
  "pastel",
  "rich",
];

/** Upper triangle of the group matrix, in GROUPS order. */
const GROUP_MATRIX: Record<ColorGroup, Partial<Record<ColorGroup, number>>> = {
  "light-neutral": {
    "light-neutral": 0.5,
    "dark-neutral": 0.95,
    "mid-neutral": 0.85,
    earth: 0.85,
    "soft-blue": 0.75,
    "bold-blue": 0.8,
    pastel: 0.6,
    rich: 0.8,
  },
  "dark-neutral": {
    "dark-neutral": 0.4,
    "mid-neutral": 0.6,
    earth: 0.6,
    "soft-blue": 0.95,
    "bold-blue": 0.6,
    pastel: 0.9,
    rich: 0.65,
  },
  "mid-neutral": {
    "mid-neutral": 0.4,
    earth: 0.5,
    "soft-blue": 0.85,
    "bold-blue": 0.75,
    pastel: 0.85,
    rich: 0.7,
  },
  earth: { earth: 0.55, "soft-blue": 0.85, "bold-blue": 0.6, pastel: 0.6, rich: 0.6 },
  "soft-blue": { "soft-blue": 0.4, "bold-blue": 0.5, pastel: 0.35, rich: 0.5 },
  "bold-blue": { "bold-blue": 0.4, pastel: 0.35, rich: 0.35 },
  pastel: { pastel: 0.3, rich: 0.3 },
  rich: { rich: 0.3 },
};

function groupScore(a: ColorGroup, b: ColorGroup): number {
  const [x, y] = GROUPS.indexOf(a) <= GROUPS.indexOf(b) ? [a, b] : [b, a];
  const value = GROUP_MATRIX[x][y];
  if (value === undefined) throw new Error(`Missing group score ${x} × ${y}`);
  return value;
}

/** Office-wear specific ratings that override the group default. */
const OVERRIDES: Array<[PaletteColor, PaletteColor, number]> = [
  ["white", "navy", 1.0],
  ["light blue", "navy", 1.0],
  ["sky blue", "navy", 1.0],
  ["white", "charcoal", 0.95],
  ["white", "black", 0.85],
  ["white", "off-white", 0.4],
  ["pink", "navy", 0.95],
  ["pink", "charcoal", 0.95],
  ["lavender", "charcoal", 0.95],
  ["lavender", "navy", 0.9],
  ["light blue", "khaki", 0.9],
  ["light blue", "beige", 0.9],
  ["light blue", "brown", 0.8],
  ["light blue", "black", 0.7],
  ["sky blue", "black", 0.65],
  ["pink", "khaki", 0.7],
  ["pink", "beige", 0.75],
  ["beige", "navy", 0.9],
  ["khaki", "navy", 0.9],
  ["tan", "navy", 0.8],
  ["brown", "navy", 0.7],
  ["brown", "black", 0.2],
  ["navy", "black", 0.3],
  ["charcoal", "black", 0.5],
  ["navy", "charcoal", 0.45],
  ["navy", "grey", 0.85],
  ["charcoal", "grey", 0.5],
  ["olive", "black", 0.4],
  ["olive", "khaki", 0.55],
  ["olive", "beige", 0.75],
  ["olive", "grey", 0.6],
  ["olive", "brown", 0.5],
  ["burgundy", "grey", 0.8],
  ["burgundy", "navy", 0.75],
  ["mustard", "navy", 0.8],
  ["rust", "navy", 0.75],
  ["green", "khaki", 0.7],
  ["maroon", "beige", 0.75],
];

const DARK_COLORS: ReadonlySet<PaletteColor> = new Set<PaletteColor>([
  "navy",
  "black",
  "charcoal",
  "brown",
  "burgundy",
  "maroon",
  "green",
]);

const NEUTRAL_GROUPS: ReadonlySet<ColorGroup> = new Set<ColorGroup>([
  "light-neutral",
  "dark-neutral",
  "mid-neutral",
]);

function labelFor(a: PaletteColor, b: PaletteColor, score: number): HarmonyLabel {
  const ga = COLOR_GROUP[a];
  const gb = COLOR_GROUP[b];
  if (a === b || (ga === gb && !NEUTRAL_GROUPS.has(ga))) return "tonal";
  const contrast =
    (LIGHT_COLORS.has(a) && DARK_COLORS.has(b)) || (LIGHT_COLORS.has(b) && DARK_COLORS.has(a));
  if (contrast && score >= 0.85) return "classic contrast";
  if ((a === "white" || a === "off-white" || b === "white" || b === "off-white") && score >= 0.8) {
    return "easy neutral";
  }
  if (score >= 0.8) return "smart pairing";
  if (score >= 0.6) return "balanced";
  return "bold mix";
}

function pairKey(a: PaletteColor, b: PaletteColor): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildTable(): ReadonlyMap<string, Harmony> {
  const overrides = new Map<string, number>();
  for (const [a, b, score] of OVERRIDES) {
    const key = pairKey(a, b);
    if (overrides.has(key)) throw new Error(`Duplicate harmony override ${key}`);
    overrides.set(key, score);
  }
  const table = new Map<string, Harmony>();
  for (const a of PALETTE) {
    for (const b of PALETTE) {
      const key = pairKey(a, b);
      if (table.has(key)) continue;
      const score = a === b ? 0.3 : (overrides.get(key) ?? groupScore(COLOR_GROUP[a], COLOR_GROUP[b]));
      table.set(key, { score, label: labelFor(a, b, score) });
    }
  }
  return table;
}

/** Symmetric harmony table keyed "a|b" (alphabetical). Covers every palette pair. */
export const HARMONY: ReadonlyMap<string, Harmony> = buildTable();

export function harmony(a: PaletteColor, b: PaletteColor): Harmony {
  const value = HARMONY.get(pairKey(a, b));
  if (!value) throw new Error(`No harmony entry for ${a} × ${b}`);
  return value;
}
