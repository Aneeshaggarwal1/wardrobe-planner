"use client";

import { AppShell } from "@/components/AppShell";
import { Button, GarmentImage, SectionTitle, StateBadge, capitalise, plural } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";
import { itemName } from "@/lib/state/today";
import type { Item, ItemState } from "@/lib/types";

const GROUPS: Array<{ state: ItemState; title: string }> = [
  { state: "in_laundry", title: "In laundry" },
  { state: "needs_ironing", title: "Needs ironing" },
  { state: "ready", title: "Ready" },
  { state: "unavailable", title: "Unavailable" },
];

export default function LaundryPage() {
  const { snapshot, run, busy } = useWardrobe();
  const byState = (s: ItemState) => snapshot.items.filter((i) => i.state === s);
  const inLaundry = byState("in_laundry");
  const toIron = byState("needs_ironing");

  return (
    <AppShell title="Laundry">
      <div className="grid grid-cols-2 gap-2">
        <Button
          data-testid="laundry-done"
          disabled={busy || inLaundry.length === 0}
          onClick={() => void run((r) => r.laundryDone(), { message: `${plural(inLaundry.length, "item")} back from the wash` })}
          className="flex-col gap-0.5 py-3"
        >
          Laundry done
          <span className="text-xs font-normal opacity-75">{plural(inLaundry.length, "item")}</span>
        </Button>
        <Button
          data-testid="all-ironed"
          variant="secondary"
          disabled={busy || toIron.length === 0}
          onClick={() => void run((r) => r.ironed(), { message: `${plural(toIron.length, "item")} ironed` })}
          className="flex-col gap-0.5 py-3"
        >
          All ironed
          <span className="text-xs font-normal text-muted">{plural(toIron.length, "item")}</span>
        </Button>
      </div>
      <p className="mt-2 text-xs text-faint">
        Laundry done moves washed clothes to ironing (jeans and polos go straight to ready).
      </p>

      {GROUPS.map(({ state, title }) => {
        const items = byState(state);
        if (items.length === 0 && state === "unavailable") return null;
        return (
          <section key={state} data-testid={`group-${state}`} className="mt-6">
            <SectionTitle count={items.length}>{title}</SectionTitle>
            {items.length === 0 ? (
              <p className="text-sm text-faint">Nothing here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <LaundryRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </AppShell>
  );
}

function LaundryRow({ item }: { item: Item }) {
  const { run, busy } = useWardrobe();
  const name = capitalise(itemName(item));
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-card p-2 pr-3" data-item-id={item.id}>
      <GarmentImage item={item} className="h-12 w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-faint">
          {item.state === "ready" && item.wears_before_wash < 50
            ? `Worn ${item.wears_since_wash} of ${item.wears_before_wash} before washing`
            : <StateBadge state={item.state} />}
        </p>
      </div>
      {item.state === "needs_ironing" && (
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => void run((r) => r.ironed([item.id]), { message: `${name} is ready` })}
        >
          Ironed
        </Button>
      )}
      {item.state === "unavailable" && (
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={busy}
          onClick={() => void run((r) => r.setUnavailable(item.id, false), { message: `${name} is back` })}
        >
          Back
        </Button>
      )}
    </li>
  );
}
