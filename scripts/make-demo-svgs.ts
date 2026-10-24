/**
 * Generates flat SVG garment silhouettes for the demo wardrobe from
 * public/demo/seed.json: shirt, polo, trousers or jeans, filled with the item's
 * palette colour, with a stripe, check or texture overlay for patterns.
 *
 *   bun scripts/make-demo-svgs.ts        (or: npx tsx scripts/make-demo-svgs.ts)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PALETTE_HEX } from "../lib/pairing/colors-hex";
import type { Item, WardrobeSnapshot } from "../lib/types";

const DEMO_DIR = join(dirname(new URL(import.meta.url).pathname), "..", "public", "demo");

/** Relative luminance, to pick a readable outline on light vs dark fabric. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}

const SHIRT =
  "M70 28 L100 18 Q120 30 140 18 L170 28 L214 66 L194 100 L172 86 L172 222 L68 222 L68 86 L46 100 L26 66 Z";
const POLO =
  "M72 30 L102 20 Q120 30 138 20 L168 30 L208 60 L190 92 L170 80 L170 222 L70 222 L70 80 L50 92 L32 60 Z";
const TROUSERS = "M74 18 L166 18 L176 226 L132 226 L120 96 L108 226 L64 226 Z";

function patternDefs(item: Item, line: string): { defs: string; fill: string } {
  const base = PALETTE_HEX[item.primary_color];
  const second = item.secondary_color ? PALETTE_HEX[item.secondary_color] : line;
  switch (item.pattern) {
    case "stripe":
      return {
        defs: `<pattern id="p" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${base}"/><rect width="3" height="10" fill="${second}"/></pattern>`,
        fill: "url(#p)",
      };
    case "check":
      return {
        defs: `<pattern id="p" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="${base}"/><rect width="22" height="7" fill="${second}" opacity="0.55"/><rect width="7" height="22" fill="${second}" opacity="0.55"/></pattern>`,
        fill: "url(#p)",
      };
    case "print":
      return {
        defs: `<pattern id="p" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="${base}"/><circle cx="9" cy="9" r="3" fill="${second}"/></pattern>`,
        fill: "url(#p)",
      };
    case "textured":
      return {
        defs: `<pattern id="p" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${base}"/><circle cx="1.5" cy="1.5" r="0.8" fill="${line}" opacity="0.18"/><circle cx="4.5" cy="4.5" r="0.8" fill="${line}" opacity="0.12"/></pattern>`,
        fill: "url(#p)",
      };
    default:
      return { defs: "", fill: base };
  }
}

function details(item: Item, line: string): string {
  const sub = item.subcategory;
  if (item.category === "bottom") {
    const waist = `<path d="M74 34 L166 34" stroke="${line}" stroke-width="2" opacity="0.5"/>`;
    const fly = `<path d="M120 34 L120 92" stroke="${line}" stroke-width="2" opacity="0.4"/>`;
    if (sub === "jeans") {
      return `${waist}${fly}<path d="M80 44 Q92 64 108 46 M160 44 Q148 64 132 46" stroke="#d6a648" stroke-width="2" fill="none" opacity="0.8"/>`;
    }
    return `${waist}${fly}<path d="M96 40 L92 220 M144 40 L148 220" stroke="${line}" stroke-width="1.5" opacity="0.25"/>`;
  }
  if (sub === "polo") {
    return `<path d="M102 20 L120 50 L138 20" stroke="${line}" stroke-width="3" fill="none" opacity="0.5"/><path d="M120 50 L120 78" stroke="${line}" stroke-width="2" opacity="0.4"/><circle cx="120" cy="60" r="2.5" fill="${line}" opacity="0.5"/><circle cx="120" cy="71" r="2.5" fill="${line}" opacity="0.5"/>`;
  }
  const buttons = [62, 98, 134, 170, 206]
    .map((y) => `<circle cx="120" cy="${y}" r="2.6" fill="${line}" opacity="0.45"/>`)
    .join("");
  return `<path d="M100 18 L112 46 L120 34 L128 46 L140 18" stroke="${line}" stroke-width="3" fill="none" opacity="0.55" stroke-linejoin="round"/><path d="M120 34 L120 222" stroke="${line}" stroke-width="1.5" opacity="0.3"/>${buttons}`;
}

export function garmentSvg(item: Item): string {
  const base = PALETTE_HEX[item.primary_color];
  const line = isLight(base) ? "#1f2f4f" : "#f4f1ea";
  const { defs, fill } = patternDefs(item, line);
  const shape = item.category === "bottom" ? TROUSERS : item.subcategory === "polo" ? POLO : SHIRT;
  const label = `${item.primary_color} ${item.subcategory}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${label}">`,
    defs ? `<defs>${defs}</defs>` : "",
    `<path d="${shape}" fill="${fill}" stroke="${line}" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round"/>`,
    details(item, line),
    `</svg>`,
  ].join("");
}

const seed = JSON.parse(readFileSync(join(DEMO_DIR, "seed.json"), "utf8")) as WardrobeSnapshot;
for (const item of seed.items) writeFileSync(join(DEMO_DIR, `${item.id}.svg`), `${garmentSvg(item)}\n`);
console.log(`Wrote ${seed.items.length} SVGs to ${DEMO_DIR}`);
