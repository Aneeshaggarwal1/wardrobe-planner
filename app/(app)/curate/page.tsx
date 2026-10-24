"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, EmptyState, GarmentImage, capitalise } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";
import type { Decision } from "@/lib/types";

const SWIPE_PX = 80;

export default function CuratePage() {
  const { snapshot, itemsById, run, busy } = useWardrobe();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);

  const queue = snapshot.outfits
    .filter((o) => o.status === "candidate")
    .sort((a, b) => Number(skipped.includes(a.id)) - Number(skipped.includes(b.id)) || skipped.indexOf(a.id) - skipped.indexOf(b.id) || b.score - a.score);
  const current = queue[0];
  const top = current ? itemsById.get(current.top_id) : undefined;
  const bottom = current ? itemsById.get(current.bottom_id) : undefined;
  const approvedCount = snapshot.outfits.filter((o) => o.status === "approved").length;

  const decide = (decision: Decision) => {
    if (!current) return;
    setDx(0);
    void run((r) => r.feedback(current.id, decision));
  };
  const skip = () => {
    if (!current) return;
    setDx(0);
    setSkipped((s) => [...s.filter((id) => id !== current.id), current.id]);
  };
  const generate = () => run((r) => r.generate(), { message: "New outfits ready to review" });

  return (
    <AppShell
      title="Curate"
      action={<span className="text-sm text-muted">{approvedCount} in bank</span>}
    >
      {!current || !top || !bottom ? (
        <EmptyState title="All caught up" body="Generate fresh pairings from your wardrobe. Your approvals and rejections shape what comes next.">
          <Button disabled={busy} onClick={() => void generate()} data-testid="generate">
            {busy ? "Pairing…" : "Generate outfits"}
          </Button>
          <Link href="/outfits" className="text-sm text-muted underline">
            Back to my outfits
          </Link>
        </EmptyState>
      ) : (
        <div>
          <p className="mb-3 text-sm text-muted">
            {queue.length} to review · swipe right to keep, left to skip forever
          </p>
          <article
            data-testid="candidate"
            className="touch-pan-y select-none rounded-[var(--radius-card)] border border-line bg-card p-3 transition-transform"
            style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)` }}
            onPointerDown={(e) => (startX.current = e.clientX)}
            onPointerMove={(e) => startX.current !== null && setDx(e.clientX - startX.current)}
            onPointerUp={() => {
              startX.current = null;
              if (dx > SWIPE_PX) decide("approve");
              else if (dx < -SWIPE_PX) decide("reject");
              else setDx(0);
            }}
            onPointerCancel={() => {
              startX.current = null;
              setDx(0);
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <GarmentImage item={top} className="aspect-[3/4]" />
              <GarmentImage item={bottom} className="aspect-[3/4]" />
            </div>
            <p className="mt-3 text-base font-semibold">{current.reason}</p>
            <p className="mt-0.5 text-sm text-muted">
              {capitalise(`${top.primary_color} ${top.subcategory}`)} with {bottom.primary_color} {bottom.subcategory}
            </p>
            <p className="mt-1 text-xs text-faint">Match score {Math.round(current.score)}/100</p>
          </article>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="danger" disabled={busy} onClick={() => decide("reject")} aria-label="Reject">
              ✕ Reject
            </Button>
            <Button variant="ghost" disabled={busy} onClick={skip}>
              Skip
            </Button>
            <Button disabled={busy} onClick={() => decide("approve")} aria-label="Approve" data-testid="approve">
              ✓ Keep
            </Button>
          </div>
          <button className="mt-5 w-full text-center text-sm text-muted underline underline-offset-2" disabled={busy} onClick={() => void generate()}>
            Generate more
          </button>
        </div>
      )}
    </AppShell>
  );
}
