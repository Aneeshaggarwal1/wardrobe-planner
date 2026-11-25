"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PasscodeForm } from "@/components/PasscodeForm";
import { Button, EmptyState, capitalise, plural } from "@/components/ui";
import { useWardrobe } from "@/components/WardrobeProvider";
import { AiError, getPasscode, setPasscode, tagPhoto } from "@/lib/client/ai";
import { blobToBase64, blobToDataUrl, mapLimit, resizeToJpeg } from "@/lib/image";
import { itemFromTags } from "@/lib/items";
import { newId } from "@/lib/repo/local";
import { itemName } from "@/lib/state/today";
import type { Item } from "@/lib/types";

type Status =
  | { kind: "waiting" }
  | { kind: "preparing" }
  | { kind: "tagging" }
  | { kind: "done"; item: Item; flagged: boolean }
  | { kind: "error"; message: string };

interface Entry {
  key: string;
  name: string;
  preview: string;
  file: File;
  status: Status;
}

const CONCURRENCY = 2;

export default function UploadPage() {
  const { isDemo } = useWardrobe();
  return <AppShell title="Add items">{isDemo ? <DemoUpload /> : <MineUpload />}</AppShell>;
}

function Picker({ onPick, disabled }: { onPick: (files: File[]) => void; disabled?: boolean }) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-ink/25 bg-card px-4 py-8 text-center ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <span className="text-sm font-semibold">Choose photos or take them now</span>
      <span className="text-xs text-faint">One item per photo · resized on your phone before tagging</span>
      <input
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        data-testid="photo-input"
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function Tips() {
  return (
    <p className="mb-4 text-sm text-muted">
      One item per photo, on a hanger or laid flat, in daylight. Start with 15–25 office pieces; you can add more any time.
    </p>
  );
}

function DemoUpload() {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <>
      <Tips />
      <Picker onPick={(files) => setPicked(files.map((f) => URL.createObjectURL(f)))} />
      {picked.length > 0 && (
        <>
          <ul className="mt-4 grid grid-cols-4 gap-2">
            {picked.map((url) => (
              <li key={url} className="garment-tile aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <EmptyState
              title="The demo doesn't tag photos"
              body="Set up your own wardrobe to have AI tag your clothes. The sample wardrobe shows what tagging produces."
            >
              <Link href="/review" className="text-sm font-semibold underline">
                See the sample wardrobe&apos;s tags
              </Link>
            </EmptyState>
          </div>
        </>
      )}
    </>
  );
}

function MineUpload() {
  const { repo, setSnapshot } = useWardrobe();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [hasPasscode, setHasPasscode] = useState(() => !!getPasscode());
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const stopped = useRef(false);
  const previews = useRef<string[]>([]);

  // Free the local preview images when leaving the screen.
  useEffect(() => {
    const list = previews.current;
    return () => list.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const update = (key: string, status: Status) =>
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, status } : e)));

  const start = async (files: File[]) => {
    if (files.length === 0) return;
    const fresh: Entry[] = files.map((file) => ({
      key: newId(),
      name: file.name,
      preview: URL.createObjectURL(file),
      file,
      status: { kind: "waiting" },
    }));
    previews.current.push(...fresh.map((e) => e.preview));
    setEntries((list) => [...list, ...fresh]);
    setRunning(true);
    stopped.current = false;

    await mapLimit(fresh, CONCURRENCY, async (entry) => {
      if (stopped.current) return update(entry.key, { kind: "error", message: "Not tagged (stopped)" });
      try {
        update(entry.key, { kind: "preparing" });
        const [forAi, thumb] = await Promise.all([resizeToJpeg(entry.file, 1200), resizeToJpeg(entry.file, 400, 0.75)]);
        const [base64, thumbUrl] = await Promise.all([blobToBase64(forAi), blobToDataUrl(thumb)]);

        update(entry.key, { kind: "tagging" });
        const tags = await tagPhoto(base64);
        const item = itemFromTags(newId(), tags, thumbUrl, new Date().toISOString());
        setSnapshot(await repo.addItem(item));
        update(entry.key, { kind: "done", item, flagged: !item.tags_confirmed });
      } catch (e) {
        if (e instanceof AiError && (e.status === 401 || e.status === 503 || e.status === 429)) {
          stopped.current = true;
          if (e.status === 401) {
            setPasscode(null);
            setHasPasscode(false);
            setPasscodeError("That passcode didn't work. Enter it again, then re-add the photos.");
          }
        }
        update(entry.key, { kind: "error", message: e instanceof Error ? e.message : "Something went wrong" });
      }
    });
    setRunning(false);
  };

  const done = entries.filter((e) => e.status.kind === "done");
  const errors = entries.filter((e) => e.status.kind === "error");
  const flagged = done.filter((e) => e.status.kind === "done" && e.status.flagged).length;

  return (
    <>
      <Tips />
      {!hasPasscode && !running ? (
        <PasscodeForm
          error={passcodeError}
          onSaved={() => {
            setPasscodeError(null);
            setHasPasscode(true);
          }}
        />
      ) : (
        <Picker onPick={(files) => void start(files)} disabled={running} />
      )}

      {entries.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-sm text-muted" aria-live="polite">
            {running ? "Tagging… keep this screen open." : `${plural(done.length, "item")} added`}
            {errors.length > 0 && ` · ${errors.length} skipped`}
            {flagged > 0 && ` · ${flagged} to check`}
          </p>
          <ul className="flex flex-col gap-2" data-testid="upload-list">
            {entries.map((e) => (
              <li key={e.key} className="flex items-center gap-3 rounded-xl border border-line bg-card p-2 pr-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={e.preview} alt="" className="garment-tile h-12 w-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1 text-sm">
                  <StatusLine status={e.status} name={e.name} />
                </div>
              </li>
            ))}
          </ul>
          {!running && done.length > 0 && (
            <Link
              href="/review"
              className="mt-5 block rounded-xl bg-ink py-3 text-center text-sm font-semibold text-white"
              data-testid="go-review"
            >
              Review tags{flagged > 0 ? ` (${flagged} to check)` : ""}
            </Link>
          )}
          {!running && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setEntries([])}>
              Clear list
            </Button>
          )}
        </>
      )}
    </>
  );
}

function StatusLine({ status, name }: { status: Status; name: string }) {
  switch (status.kind) {
    case "waiting":
      return <p className="truncate text-faint">Waiting · {name}</p>;
    case "preparing":
      return <p className="truncate text-muted">Resizing…</p>;
    case "tagging":
      return <p className="truncate text-muted">Reading the photo…</p>;
    case "done":
      return (
        <>
          <p className="truncate font-medium" data-testid="tagged-name">
            {capitalise(itemName(status.item))}
          </p>
          <p className={`text-xs ${status.flagged ? "text-ironing" : "text-faint"}`}>
            {status.flagged ? "Not sure about this one: check its tags" : `Formality ${status.item.formality}/5`}
          </p>
        </>
      );
    case "error":
      return <p className="text-xs text-danger">{status.message}</p>;
  }
}
