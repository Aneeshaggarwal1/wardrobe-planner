"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, EmptyState } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";

interface Picked {
  name: string;
  url: string;
}

export default function UploadPage() {
  const { isDemo } = useWardrobe();
  const [picked, setPicked] = useState<Picked[]>([]);

  return (
    <AppShell title="Add items">
      <p className="mb-4 text-sm text-muted">
        One item per photo, on a hanger or laid flat, in daylight. Pick 15–25 to start; you can add more any time.
      </p>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-ink/25 bg-card px-4 py-8 text-center">
        <span className="text-sm font-semibold">Choose photos or take them now</span>
        <span className="text-xs text-faint">JPEG, PNG or HEIC · resized on your phone before upload</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            setPicked(files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
          }}
        />
      </label>

      {picked.length > 0 && (
        <>
          <ul className="mt-4 grid grid-cols-4 gap-2">
            {picked.map((p) => (
              <li key={p.url} className="garment-tile aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
          {isDemo ? (
            <div className="mt-4">
              <EmptyState
                title="Photo tagging needs an account"
                body="In demo mode nothing leaves your phone, so new photos can't be tagged by AI. The sample wardrobe shows what tagging produces."
              >
                <Link href="/review" className="text-sm font-semibold underline">
                  See the sample wardrobe&apos;s tags
                </Link>
              </EmptyState>
            </div>
          ) : (
            <Button className="mt-4 w-full" disabled>
              Upload and tag {picked.length} items
            </Button>
          )}
        </>
      )}
    </AppShell>
  );
}
