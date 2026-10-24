"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { OutfitCard } from "@/components/OutfitCard";
import { Sheet } from "@/components/Sheet";
import { Button, EmptyState, GarmentImage, capitalise } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";
import { isWearable } from "@/lib/state/machine";
import { itemName } from "@/lib/state/today";
import type { Item } from "@/lib/types";

type Filter = "available" | "all";

export default function OutfitsPage() {
  const { snapshot, itemsById, run, busy } = useWardrobe();
  const [filter, setFilter] = useState<Filter>("available");
  const [creating, setCreating] = useState(false);

  const approved = useMemo(
    () =>
      snapshot.outfits
        .filter((o) => o.status === "approved")
        .sort((a, b) => b.times_worn - a.times_worn || b.score - a.score),
    [snapshot.outfits],
  );
  const shown = filter === "all" ? approved : approved.filter((o) => isWearable(o, itemsById));
  const queued = snapshot.outfits.filter((o) => o.status === "candidate").length;

  return (
    <AppShell
      title="Outfits"
      action={
        <Link href="/curate" className="rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold text-white">
          Find new{queued > 0 ? ` · ${queued}` : ""}
        </Link>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-card p-0.5 text-sm" role="tablist">
          {(["available", "all"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 font-medium ${filter === f ? "bg-ink text-white" : "text-muted"}`}
            >
              {f === "available" ? "Ready now" : `All ${approved.length}`}
            </button>
          ))}
        </div>
        <button className="text-sm font-medium text-ink-soft underline underline-offset-2" onClick={() => setCreating(true)}>
          Create your own
        </button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={approved.length === 0 ? "Your outfit bank is empty" : "Nothing ready right now"}
          body={approved.length === 0 ? "Review AI-paired outfits and keep the ones you like." : "Check the laundry, or switch to All."}
        >
          {approved.length === 0 && (
            <Link href="/curate" className="text-sm font-semibold underline">
              Start curating
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((o) => {
            const top = itemsById.get(o.top_id);
            const bottom = itemsById.get(o.bottom_id);
            if (!top || !bottom) return null;
            const wearable = isWearable(o, itemsById);
            return (
              <OutfitCard key={o.id} outfit={o} top={top} bottom={bottom} showStates={!wearable}>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busy || !wearable}
                  onClick={() => void run((r) => r.wear(o.id), { message: "Marked as worn today" })}
                >
                  {wearable ? "Mark worn" : "Not ready"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run((r) => r.removeOutfit(o.id), { message: "Removed from your bank" })}
                >
                  Remove
                </Button>
              </OutfitCard>
            );
          })}
        </div>
      )}

      <Sheet open={creating} title="Create an outfit" onClose={() => setCreating(false)}>
        <CreateOutfit onDone={() => setCreating(false)} />
      </Sheet>
    </AppShell>
  );
}

function Picker({ title, items, value, onPick }: { title: string; items: Item[]; value: string | null; onPick: (id: string) => void }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((i) => (
          <button
            key={i.id}
            onClick={() => onPick(i.id)}
            aria-pressed={value === i.id}
            aria-label={itemName(i)}
            className={`shrink-0 rounded-xl ${value === i.id ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""}`}
          >
            <GarmentImage item={i} className="h-20 w-20" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CreateOutfit({ onDone }: { onDone: () => void }) {
  const { snapshot, itemsById, run, busy } = useWardrobe();
  const [topId, setTopId] = useState<string | null>(null);
  const [bottomId, setBottomId] = useState<string | null>(null);
  const tops = snapshot.items.filter((i) => i.category === "top");
  const bottoms = snapshot.items.filter((i) => i.category === "bottom");
  const top = topId ? itemsById.get(topId) : undefined;
  const bottom = bottomId ? itemsById.get(bottomId) : undefined;

  return (
    <div>
      <Picker title="Top" items={tops} value={topId} onPick={setTopId} />
      <Picker title="Bottom" items={bottoms} value={bottomId} onPick={setBottomId} />
      <p className="mb-3 min-h-5 text-sm text-muted">
        {top && bottom ? `${capitalise(itemName(top))} with ${itemName(bottom)}` : "Pick a top and a bottom."}
      </p>
      <Button
        className="w-full"
        disabled={!topId || !bottomId || busy}
        onClick={async () => {
          if (!topId || !bottomId) return;
          const ok = await run((r) => r.createOutfit(topId, bottomId), { message: "Added to your bank" });
          if (ok) onDone();
        }}
      >
        Add to my outfits
      </Button>
    </div>
  );
}
