/**
 * The fixed, normalised colour palette. The tagging model must map every item
 * to one of these names; open-ended colour names would break the harmony table.
 */
export const PALETTE = [
  "white",
  "off-white",
  "light blue",
  "sky blue",
  "navy",
  "royal blue",
  "black",
  "charcoal",
  "grey",
  "light grey",
  "beige",
  "khaki",
  "olive",
  "brown",
  "tan",
  "maroon",
  "burgundy",
  "pink",
  "lavender",
  "green",
  "mustard",
  "rust",
] as const;

export type PaletteColor = (typeof PALETTE)[number];

export type ColorGroup =
  | "light-neutral" // white, off-white, light grey
  | "dark-neutral" // navy, black, charcoal
  | "mid-neutral" // grey
  | "earth" // beige, khaki, olive, brown, tan
  | "soft-blue" // light blue, sky blue
  | "bold-blue" // royal blue
  | "pastel" // pink, lavender
  | "rich"; // maroon, burgundy, green, mustard, rust

export const COLOR_GROUP: Record<PaletteColor, ColorGroup> = {
  white: "light-neutral",
  "off-white": "light-neutral",
  "light grey": "light-neutral",
  navy: "dark-neutral",
  black: "dark-neutral",
  charcoal: "dark-neutral",
  grey: "mid-neutral",
  beige: "earth",
  khaki: "earth",
  olive: "earth",
  brown: "earth",
  tan: "earth",
  "light blue": "soft-blue",
  "sky blue": "soft-blue",
  "royal blue": "bold-blue",
  pink: "pastel",
  lavender: "pastel",
  maroon: "rich",
  burgundy: "rich",
  green: "rich",
  mustard: "rich",
  rust: "rich",
};

/** Colours light enough that pairing them with a dark one reads as contrast. */
export const LIGHT_COLORS: ReadonlySet<PaletteColor> = new Set<PaletteColor>([
  "white",
  "off-white",
  "light grey",
  "light blue",
  "sky blue",
  "pink",
  "lavender",
  "beige",
]);

export function isPaletteColor(value: string): value is PaletteColor {
  return (PALETTE as readonly string[]).includes(value);
}
