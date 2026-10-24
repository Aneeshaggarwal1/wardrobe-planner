"use client";

import type { ButtonHTMLAttributes } from "react";
import { itemName } from "@/lib/state/today";
import type { Item, ItemState } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft disabled:bg-faint",
  secondary: "border border-line bg-card text-ink hover:border-ink/30 disabled:text-faint",
  ghost: "text-ink-soft hover:bg-line/50 disabled:text-faint",
  danger: "border border-danger/30 bg-card text-danger hover:bg-danger/5",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export const STATE_LABEL: Record<ItemState, string> = {
  ready: "Ready",
  needs_ironing: "Needs ironing",
  in_laundry: "In laundry",
  unavailable: "Unavailable",
};

const STATE_STYLE: Record<ItemState, string> = {
  ready: "bg-ready/10 text-ready",
  needs_ironing: "bg-ironing/10 text-ironing",
  in_laundry: "bg-laundry/10 text-laundry",
  unavailable: "bg-away/10 text-away",
};

export function StateBadge({ state }: { state: ItemState }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_STYLE[state]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATE_LABEL[state]}
    </span>
  );
}

export function GarmentImage({ item, className = "" }: { item: Item; className?: string }) {
  return (
    <div className={`garment-tile overflow-hidden rounded-xl ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- demo SVGs and user photos from signed URLs */}
      <img
        src={item.thumb_url}
        alt={itemName(item)}
        className="h-full w-full object-contain p-2"
        loading="lazy"
      />
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-card/60 px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      {children && <div className="mt-4 flex flex-col items-center gap-2">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="mb-2 mt-6 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-muted first:mt-0">
      {children}
      {count !== undefined && <span className="font-normal text-faint">{count}</span>}
    </h2>
  );
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
