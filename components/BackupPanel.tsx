"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { BackupError, backupFileName, makeBackup, parseBackup } from "@/lib/backup";
import { getPasscode, setPasscode } from "@/lib/client/ai";
import { setMode } from "@/lib/mode";
import { plural } from "./ui";
import { useWardrobe } from "./WardrobeProvider";

const LAST_BACKUP_KEY = "wp-last-backup";

function lastBackupLabel(): string {
  try {
    const at = window.localStorage.getItem(LAST_BACKUP_KEY);
    if (!at) return "Never backed up";
    return `Last backup ${new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  } catch {
    return "";
  }
}

/** Your wardrobe lives only on this phone: back it up, restore it, or switch to the demo. */
export function BackupPanel() {
  const { snapshot, isDemo, run, showToast } = useWardrobe();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  if (isDemo) {
    return (
      <div className="mt-10 text-center">
        <button
          className="text-sm text-muted underline underline-offset-2"
          onClick={() => {
            setMode(null);
            router.replace("/");
          }}
          data-testid="leave-demo"
        >
          Leave the demo
        </button>
      </div>
    );
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(makeBackup(snapshot))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    showToast({ message: "Backup saved. Keep it somewhere safe, like iCloud Drive or Google Drive." });
  };

  const restore = async (file: File) => {
    try {
      const next = parseBackup(await file.text());
      const ok = confirm(
        `Replace this phone's wardrobe with the backup (${plural(next.items.length, "item")}, ${plural(
          next.outfits.filter((o) => o.status === "approved").length,
          "outfit",
        )})? What's here now will be overwritten.`,
      );
      if (ok) await run((r) => r.replaceAll(next), { message: "Wardrobe restored from backup" });
    } catch (e) {
      showToast({ message: e instanceof BackupError ? e.message : "Couldn't read that file" });
    }
  };

  return (
    <section className="mt-10 rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="backup-panel">
      <h2 className="text-sm font-semibold">Your wardrobe lives on this phone</h2>
      <p className="mt-1 text-xs text-muted">
        Nothing is stored online. Back it up now and then, so clearing the browser or changing phones doesn&apos;t lose it.
        <span className="block text-faint">{lastBackupLabel()}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white disabled:bg-faint"
          onClick={download}
          disabled={snapshot.items.length === 0}
          data-testid="backup"
        >
          Back up
        </button>
        <button
          className="rounded-xl border border-line px-3 py-2.5 text-sm font-semibold"
          onClick={() => fileInput.current?.click()}
          data-testid="restore"
        >
          Restore
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        data-testid="restore-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void restore(file);
        }}
      />
      <div className="mt-4 flex justify-between text-xs">
        <button
          className="text-muted underline underline-offset-2"
          onClick={() => {
            setMode("demo");
            // A full reload, so the app opens the demo's storage instead of yours.
            window.location.href = "/today";
          }}
        >
          Look at the demo
        </button>
        {getPasscode() && (
          <button
            className="text-muted underline underline-offset-2"
            onClick={() => {
              setPasscode(null);
              showToast({ message: "AI passcode forgotten on this phone" });
            }}
          >
            Forget AI passcode
          </button>
        )}
      </div>
    </section>
  );
}
