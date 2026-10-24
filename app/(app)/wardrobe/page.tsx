"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ItemEditor } from "@/components/ItemEditor";
import { Sheet } from "@/components/Sheet";
import { Button, GarmentImage, SectionTitle, StateBadge, capitalise } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";
import { itemName } from "@/lib/state/today";
import type { Category, Item } from "@/lib/types";

const SECTIONS: Array<{ title: string; categories: Category[] }> = [
  { title: "Tops", categories: ["top"] },
  { title: "Bottoms", categories: ["bottom"] },
  { title: "Shoes, belts and layers", categories: ["shoes", "belt", "layer"] },
];

export default function WardrobePage() {
  const { snapshot } = useWardrobe();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? snapshot.items.find((i) => i.id === openId) : undefined;
  const outfitCount = (id: string) =>
    snapshot.outfits.filter((o) => o.status === "approved" && (o.top_id === id || o.bottom_id === id)).length;

  return (
    <AppShell
      title="Wardrobe"
      action={
        <Link href="/upload" className="rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold text-white">
          Add items
        </Link>
      }
    >
      <p className="mb-2 text-sm text-muted">
        {snapshot.items.length} items ·{" "}
        <Link href="/review" className="underline underline-offset-2">
          Review tags
        </Link>
      </p>
      {SECTIONS.map(({ title, categories }) => {
        const items = snapshot.items.filter((i) => categories.includes(i.category));
        if (items.length === 0) return null;
        return (
          <section key={title}>
            <SectionTitle count={items.length}>{title}</SectionTitle>
            <ul className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setOpenId(item.id)}
                    className="w-full rounded-[var(--radius-card)] border border-line bg-card p-2 text-left"
                  >
                    <GarmentImage item={item} className="aspect-square" />
                    <p className="mt-1.5 truncate text-sm font-medium">{capitalise(itemName(item))}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <StateBadge state={item.state} />
                      <span className="text-[11px] text-faint">{outfitCount(item.id)} outfits</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Sheet open={!!open} title={open ? capitalise(itemName(open)) : ""} onClose={() => setOpenId(null)}>
        {open && <ItemDetail item={open} onClose={() => setOpenId(null)} />}
      </Sheet>
    </AppShell>
  );
}

function ItemDetail({ item, onClose }: { item: Item; onClose: () => void }) {
  const { snapshot, itemsById, run, busy } = useWardrobe();
  const [editing, setEditing] = useState(false);
  const outfits = snapshot.outfits.filter(
    (o) => o.status === "approved" && (o.top_id === item.id || o.bottom_id === item.id),
  );

  if (editing) {
    return (
      <ItemEditor
        item={item}
        onSave={async (patch) => {
          if (await run((r) => r.updateItem(item.id, patch), { message: "Tags saved" })) setEditing(false);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <GarmentImage item={item} className="h-24 w-24 shrink-0" />
        <div className="text-sm">
          <StateBadge state={item.state} />
          <p className="mt-2 text-muted">
            Formality {item.formality}/5 · {item.pattern}
            <br />
            Worn {item.wears_since_wash} of {item.wears_before_wash > 50 ? "∞" : item.wears_before_wash} before washing
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.state === "needs_ironing" && (
          <Button variant="secondary" disabled={busy} onClick={() => void run((r) => r.ironed([item.id]), { message: "Marked ironed" })}>
            Mark ironed
          </Button>
        )}
        {item.state === "unavailable" ? (
          <Button variant="secondary" disabled={busy} onClick={() => void run((r) => r.setUnavailable(item.id, false), { message: "Back in rotation" })}>
            Make available
          </Button>
        ) : (
          <Button variant="secondary" disabled={busy} onClick={() => void run((r) => r.setUnavailable(item.id, true), { message: "Marked unavailable" })}>
            Mark unavailable
          </Button>
        )}
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit tags
        </Button>
      </div>

      <SectionTitle count={outfits.length}>Outfits using this</SectionTitle>
      {outfits.length === 0 ? (
        <p className="text-sm text-faint">Not in any approved outfit yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {outfits.map((o) => {
            const otherId = o.top_id === item.id ? o.bottom_id : o.top_id;
            const other = itemsById.get(otherId);
            return (
              <li key={o.id} className="flex items-center gap-2 text-sm">
                {other && <GarmentImage item={other} className="h-9 w-9 shrink-0" />}
                <span>{o.reason}</span>
              </li>
            );
          })}
        </ul>
      )}

      <button
        className="mt-6 text-sm text-danger underline underline-offset-2"
        disabled={busy}
        onClick={async () => {
          if (!confirm("Delete this item? Outfits using it are removed from your bank.")) return;
          if (await run((r) => r.deleteItem(item.id), { message: "Item deleted" })) onClose();
        }}
      >
        Delete item
      </button>
    </div>
  );
}
