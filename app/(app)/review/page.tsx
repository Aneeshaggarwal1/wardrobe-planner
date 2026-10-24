"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ItemEditor } from "@/components/ItemEditor";
import { Sheet } from "@/components/Sheet";
import { Button, GarmentImage, capitalise } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";
import { itemName } from "@/lib/state/today";

export default function ReviewPage() {
  const router = useRouter();
  const { snapshot, run, busy } = useWardrobe();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? snapshot.items.find((i) => i.id === openId) : undefined;
  // Unconfirmed (low-confidence) tags first.
  const items = [...snapshot.items].sort((a, b) => Number(a.tags_confirmed) - Number(b.tags_confirmed));
  const unconfirmed = items.filter((i) => !i.tags_confirmed).length;

  const confirm = async () => {
    const hasQueue = snapshot.outfits.some((o) => o.status === "candidate");
    if (!hasQueue) await run((r) => r.generate());
    router.push("/curate");
  };

  return (
    <AppShell title="Review tags">
      <p className="mb-3 text-sm text-muted">
        {unconfirmed > 0
          ? `${unconfirmed} items need a check. Tap any item to fix its tags.`
          : "Tap any item to fix its tags. Pairing quality depends on them."}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => setOpenId(item.id)}
              className={`w-full rounded-xl border bg-card p-1.5 text-left ${item.tags_confirmed ? "border-line" : "border-ironing"}`}
            >
              <GarmentImage item={item} className="aspect-square" />
              <p className="mt-1 truncate text-[11px] font-medium">{capitalise(item.primary_color)}</p>
              <p className="truncate text-[11px] text-faint">
                {item.subcategory} · F{item.formality}
              </p>
              {!item.tags_confirmed && <p className="text-[11px] font-medium text-ironing">Check me</p>}
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full py-3" disabled={busy} onClick={() => void confirm()}>
        Confirm wardrobe and pair outfits
      </Button>

      <Sheet open={!!open} title={open ? capitalise(itemName(open)) : ""} onClose={() => setOpenId(null)}>
        {open && (
          <ItemEditor
            key={open.id}
            item={open}
            onSave={async (patch) => {
              if (await run((r) => r.updateItem(open.id, patch), { message: "Tags saved" })) setOpenId(null);
            }}
            onDelete={async () => {
              if (await run((r) => r.deleteItem(open.id), { message: "Item deleted" })) setOpenId(null);
            }}
          />
        )}
      </Sheet>
    </AppShell>
  );
}
