"use client";

import { useState } from "react";
import { PALETTE_HEX } from "@/lib/pairing/colors-hex";
import { PALETTE, type PaletteColor } from "@/lib/pairing/palette";
import type { ItemPatch } from "@/lib/repo/types";
import type { Category, Item, Pattern } from "@/lib/types";
import { Button, GarmentImage, capitalise } from "./ui";

const CATEGORIES: Category[] = ["top", "bottom", "shoes", "belt", "layer"];
const PATTERNS: Pattern[] = ["solid", "stripe", "check", "print", "textured"];
const SUBCATEGORIES: Record<Category, string[]> = {
  top: ["formal shirt", "oxford shirt", "casual shirt", "linen shirt", "polo", "t-shirt"],
  bottom: ["formal trousers", "chinos", "jeans"],
  shoes: ["shoes"],
  belt: ["belt"],
  layer: ["blazer", "sweater"],
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      {children}
    </div>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  render = (v) => capitalise(String(v)),
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`rounded-full border px-3 py-1 text-sm ${o === value ? "border-ink bg-ink text-white" : "border-line bg-card"}`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
  allowNone = false,
}: {
  value: PaletteColor | null;
  onChange: (v: PaletteColor | null) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={`rounded-full border px-3 py-1 text-xs ${value === null ? "border-ink" : "border-line"}`}
        >
          None
        </button>
      )}
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          aria-pressed={c === value}
          onClick={() => onChange(c)}
          className={`h-8 w-8 rounded-full border ${c === value ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "border-line"}`}
          style={{ background: PALETTE_HEX[c] }}
        />
      ))}
    </div>
  );
}

/** Edit an item's tags and care settings. */
export function ItemEditor({
  item,
  onSave,
  onDelete,
}: {
  item: Item;
  onSave: (patch: ItemPatch) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<ItemPatch>({});
  const v = { ...item, ...draft };
  const set = (patch: ItemPatch) => setDraft((d) => ({ ...d, ...patch }));
  const subOptions = Array.from(new Set([...SUBCATEGORIES[v.category], v.subcategory]));

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <GarmentImage item={item} className="h-20 w-20 shrink-0" />
        <p className="text-sm text-muted">
          {capitalise(`${v.primary_color} ${v.subcategory}`)}
          <br />
          Fix anything the tagger got wrong; pairing uses these tags.
        </p>
      </div>
      <Field label="Category">
        <Chips
          options={CATEGORIES}
          value={v.category}
          onChange={(category) => set({ category, subcategory: SUBCATEGORIES[category][0]! })}
        />
      </Field>
      <Field label="Type">
        <Chips options={subOptions} value={v.subcategory} onChange={(subcategory) => set({ subcategory })} />
      </Field>
      <Field label={`Main colour · ${v.primary_color}`}>
        <ColorPicker value={v.primary_color} onChange={(c) => c && set({ primary_color: c })} />
      </Field>
      <Field label={`Second colour · ${v.secondary_color ?? "none"}`}>
        <ColorPicker allowNone value={v.secondary_color} onChange={(secondary_color) => set({ secondary_color })} />
      </Field>
      <Field label="Pattern">
        <Chips options={PATTERNS} value={v.pattern} onChange={(pattern) => set({ pattern })} />
      </Field>
      <Field label="Formality (1 casual Friday · 5 boardroom)">
        <Chips options={[1, 2, 3, 4, 5] as const} value={v.formality as 1 | 2 | 3 | 4 | 5} onChange={(formality) => set({ formality })} />
      </Field>
      <Field label="Wears before washing">
        <Chips options={[1, 2, 3, 4, 5, 8] as const} value={v.wears_before_wash as 1} onChange={(wears_before_wash) => set({ wears_before_wash })} />
      </Field>
      <Field label="Needs ironing after a wash">
        <Chips
          options={["yes", "no"] as const}
          value={v.ironing_required ? "yes" : "no"}
          onChange={(x) => set({ ironing_required: x === "yes" })}
        />
      </Field>
      <div className="mt-6 flex gap-2">
        <Button className="flex-1" onClick={() => onSave({ ...draft, tags_confirmed: true })}>
          Save tags
        </Button>
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
