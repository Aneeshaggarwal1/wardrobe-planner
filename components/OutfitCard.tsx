"use client";

import { lastWornLabel } from "@/lib/dates";
import type { Item, Outfit } from "@/lib/types";
import { GarmentImage, StateBadge, capitalise } from "./ui";

export function OutfitCard({
  outfit,
  top,
  bottom,
  showStates = false,
  children,
  testId,
}: {
  outfit: Outfit;
  top: Item;
  bottom: Item;
  showStates?: boolean;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <article
      data-testid={testId}
      data-outfit-id={outfit.id}
      className="fade-in rounded-[var(--radius-card)] border border-line bg-card p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <figure>
          <GarmentImage item={top} className="aspect-square" />
          <figcaption className="mt-1.5 text-xs text-muted">{capitalise(`${top.primary_color} ${top.subcategory}`)}</figcaption>
          {showStates && <div className="mt-1"><StateBadge state={top.state} /></div>}
        </figure>
        <figure>
          <GarmentImage item={bottom} className="aspect-square" />
          <figcaption className="mt-1.5 text-xs text-muted">{capitalise(`${bottom.primary_color} ${bottom.subcategory}`)}</figcaption>
          {showStates && <div className="mt-1"><StateBadge state={bottom.state} /></div>}
        </figure>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{outfit.reason}</p>
        <p className="shrink-0 text-xs text-faint">{lastWornLabel(outfit.last_worn_at)}</p>
      </div>
      {children && <div className="mt-3 flex gap-2">{children}</div>}
    </article>
  );
}
