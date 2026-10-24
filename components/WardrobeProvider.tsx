"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getMode } from "@/lib/mode";
import { LocalRepo } from "@/lib/repo/local";
import type { WardrobeRepo } from "@/lib/repo/types";
import type { Item, WardrobeSnapshot } from "@/lib/types";

export interface Toast {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface WardrobeContextValue {
  repo: WardrobeRepo;
  snapshot: WardrobeSnapshot;
  itemsById: ReadonlyMap<string, Item>;
  isDemo: boolean;
  busy: boolean;
  /** Run a repo mutation; the returned snapshot replaces the current one. */
  run: (action: (repo: WardrobeRepo) => Promise<WardrobeSnapshot>, toast?: Toast) => Promise<boolean>;
  showToast: (toast: Toast) => void;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

export function useWardrobe(): WardrobeContextValue {
  const value = useContext(WardrobeContext);
  if (!value) throw new Error("useWardrobe must be used inside WardrobeProvider");
  return value;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; repo: WardrobeRepo; snapshot: WardrobeSnapshot }
  | { kind: "error"; message: string }
  | { kind: "account-pending" };

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mode = getMode();
    if (mode === null) {
      router.replace("/");
      return;
    }
    if (mode === "account") {
      // The real backend (SupabaseRepo) arrives in phase 4.
      setState({ kind: "account-pending" });
      return;
    }
    const repo = new LocalRepo();
    repo
      .load()
      .then((snapshot) => setState({ kind: "ready", repo, snapshot }))
      .catch((e: unknown) => setState({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
  }, [router]);

  const showToast = useCallback((next: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), next.onAction ? 6000 : 2500);
  }, []);

  const run = useCallback<WardrobeContextValue["run"]>(
    async (action, successToast) => {
      if (state.kind !== "ready") return false;
      setBusy(true);
      try {
        const snapshot = await action(state.repo);
        setState({ kind: "ready", repo: state.repo, snapshot });
        if (successToast) showToast(successToast);
        return true;
      } catch (e) {
        showToast({ message: e instanceof Error ? e.message : "Something went wrong" });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [state, showToast],
  );

  const value = useMemo<WardrobeContextValue | null>(() => {
    if (state.kind !== "ready") return null;
    return {
      repo: state.repo,
      snapshot: state.snapshot,
      itemsById: new Map(state.snapshot.items.map((i) => [i.id, i])),
      isDemo: state.repo.kind === "demo",
      busy,
      run,
      showToast,
    };
  }, [state, busy, run, showToast]);

  if (state.kind === "loading") {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted">Loading your wardrobe…</div>;
  }
  if (state.kind === "error") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">Couldn&apos;t load your wardrobe</p>
        <p className="text-sm text-muted">{state.message}</p>
        <button className="text-sm underline" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  if (state.kind === "account-pending") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">Accounts are coming soon</p>
        <p className="text-sm text-muted">Sign-in arrives with the real backend. Try the demo meanwhile.</p>
        <a className="text-sm underline" href="/">
          Back
        </a>
      </div>
    );
  }

  return (
    <WardrobeContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fade-in fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto flex w-[calc(100%-32px)] max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.onAction && (
            <button
              className="font-semibold text-accent"
              onClick={() => {
                setToast(null);
                toast.onAction?.();
              }}
            >
              {toast.actionLabel ?? "Undo"}
            </button>
          )}
        </div>
      )}
    </WardrobeContext.Provider>
  );
}
