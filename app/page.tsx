"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { getMode, setMode } from "@/lib/mode";
import { LocalRepo } from "@/lib/repo/local";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function Landing() {
  const router = useRouter();
  const [resetDone, setResetDone] = useState(false);
  const accounts = isSupabaseConfigured();

  // Signed-in users go straight to their wardrobe.
  useEffect(() => {
    if (getMode() === "account") router.replace("/today");
  }, [router]);

  const tryDemo = () => {
    setMode("demo");
    router.push("/today");
  };

  const resetDemo = async () => {
    await new LocalRepo().reset();
    setResetDone(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-[calc(48px+env(safe-area-inset-top))]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Wardrobe Planner</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
        Pick today&apos;s outfit in one tap.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Photograph your office clothes once. AI pairs them into outfits you approve, and each morning you only see
        what&apos;s actually washed and ironed.
      </p>

      {/* A miniature of the Today screen, drawn in markup rather than a screenshot. */}
      <div aria-hidden className="mt-8 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span className="font-semibold text-ink">Today</span>
          <span>3 ready</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="garment-tile flex aspect-square items-center justify-center rounded-xl">
            <svg viewBox="0 0 240 240" className="h-4/5 w-4/5">
              <path d="M70 28 L100 18 Q120 30 140 18 L170 28 L214 66 L194 100 L172 86 L172 222 L68 222 L68 86 L46 100 L26 66 Z" fill="#b9d3ec" stroke="#1f2f4f" strokeOpacity="0.3" strokeWidth="2" />
            </svg>
          </div>
          <div className="garment-tile flex aspect-square items-center justify-center rounded-xl">
            <svg viewBox="0 0 240 240" className="h-4/5 w-4/5">
              <path d="M74 18 L166 18 L176 226 L132 226 L120 96 L108 226 L64 226 Z" fill="#1f2f4f" />
            </svg>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium">Light blue and navy: classic contrast</p>
        <div className="mt-3 rounded-xl bg-ink py-2 text-center text-sm font-semibold text-white">Wear this</div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-10">
        <Button onClick={tryDemo} className="py-3.5 text-base" data-testid="try-demo">
          Try the demo
        </Button>
        {accounts && (
          <Button variant="secondary" onClick={() => router.push("/login")} data-testid="sign-in">
            Sign in to your wardrobe
          </Button>
        )}
        <p className="text-center text-xs text-faint">
          The demo uses a sample wardrobe stored in this browser. No sign-up, nothing sent anywhere.
        </p>
        <button onClick={resetDemo} className="text-center text-xs text-muted underline underline-offset-2">
          {resetDone ? "Demo reset to the sample wardrobe" : "Reset demo"}
        </button>
      </div>
    </main>
  );
}
