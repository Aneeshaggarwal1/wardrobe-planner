"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { OutfitCard } from "@/components/OutfitCard";
import { Button, EmptyState, SectionTitle, capitalise } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";
import { localDay } from "@/lib/dates";
import { closestOutfits, itemName, rankToday, wearableOutfits } from "@/lib/state/today";

/** Small seeded PRNG so a shuffle is stable across re-renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function TodayPage() {
  const { snapshot, itemsById, repo, run, busy } = useWardrobe();
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  const today = localDay();

  const outfits = useMemo(
    () =>
      rankToday(snapshot, {
        today,
        count: 4,
        random: shuffleSeed === null ? undefined : mulberry32(shuffleSeed),
      }),
    [snapshot, today, shuffleSeed],
  );
  const wearableCount = useMemo(() => wearableOutfits(snapshot).length, [snapshot]);
  const bankSize = snapshot.outfits.filter((o) => o.status === "approved").length;
  const lastWear = repo.lastWear();
  const wornToday = lastWear ? snapshot.outfits.find((o) => o.id === lastWear.outfitId) : undefined;

  const wear = (outfitId: string) =>
    run((r) => r.wear(outfitId), {
      message: "Logged. Have a good day.",
      actionLabel: "Undo",
      onAction: () => void run((r) => r.undoWear(), { message: "Wear undone" }),
    });

  return (
    <AppShell
      title="Today"
      action={
        wearableCount > 1 && (
          <Button variant="ghost" className="px-2 py-1" onClick={() => setShuffleSeed(Date.now())}>
            Shuffle
          </Button>
        )
      }
    >
      {wornToday && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-ready/30 bg-ready/5 px-3 py-2.5 text-sm">
          <span>
            Wearing today: <span className="font-medium">{wornToday.reason.split(":")[0]}</span>
          </span>
          <button className="font-semibold text-ink-soft" onClick={() => void run((r) => r.undoWear(), { message: "Wear undone" })}>
            Undo
          </button>
        </div>
      )}

      {snapshot.items.length === 0 ? (
        <EmptyState
          title="Let's set up your wardrobe"
          body="Photograph 15–25 office pieces, one per photo. AI tags them and pairs them into outfits for you to approve."
        >
          <Link href="/upload" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
            Add your clothes
          </Link>
        </EmptyState>
      ) : bankSize === 0 ? (
        <EmptyState title="No outfits yet" body="Approve a few AI-paired outfits and they'll show up here each morning.">
          <Link href="/curate" className="text-sm font-semibold underline">
            Find outfits
          </Link>
        </EmptyState>
      ) : outfits.length === 0 ? (
        <NothingReady />
      ) : (
        <>
          <SectionTitle count={wearableCount}>Ready to wear</SectionTitle>
          <div className="flex flex-col gap-3" data-testid="today-list">
            {outfits.map((o) => {
              const top = itemsById.get(o.top_id);
              const bottom = itemsById.get(o.bottom_id);
              if (!top || !bottom) return null;
              return (
                <OutfitCard key={o.id} outfit={o} top={top} bottom={bottom} testId="today-outfit">
                  <Button className="flex-1" disabled={busy} onClick={() => void wear(o.id)}>
                    Wear this
                  </Button>
                </OutfitCard>
              );
            })}
          </div>
          {wearableCount > outfits.length && (
            <Link href="/outfits" className="mt-4 block text-center text-sm font-medium text-ink-soft underline underline-offset-2">
              See all {wearableCount} wearable outfits
            </Link>
          )}
        </>
      )}
    </AppShell>
  );
}

function NothingReady() {
  const { snapshot, itemsById, run, busy } = useWardrobe();
  const closest = closestOutfits(snapshot, 3);
  return (
    <div data-testid="nothing-ready">
      <EmptyState title="Nothing fully ready" body="Every outfit in your bank has something in the wash or waiting to be ironed." />
      {closest.length > 0 && (
        <>
          <SectionTitle>One step away</SectionTitle>
          <ul className="flex flex-col gap-2">
            {closest.map(({ outfit, blocking, action }) => {
              const top = itemsById.get(outfit.top_id);
              const bottom = itemsById.get(outfit.bottom_id);
              return (
                <li key={outfit.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{action}</p>
                    <p className="truncate text-xs text-muted">
                      to wear {top && itemName(top)} with {bottom && itemName(bottom)}
                    </p>
                  </div>
                  {blocking.state === "needs_ironing" && (
                    <Button
                      variant="secondary"
                      className="shrink-0 px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void run((r) => r.ironed([blocking.id]), { message: `${capitalise(itemName(blocking))} is ready` })}
                    >
                      Ironed
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Link href="/laundry" className="mt-4 block text-center text-sm font-medium text-ink-soft underline underline-offset-2">
        Go to laundry
      </Link>
    </div>
  );
}
