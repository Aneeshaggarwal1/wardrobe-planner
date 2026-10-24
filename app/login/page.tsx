"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase/browser";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

function LoginForm() {
  const params = useSearchParams();
  const linkFailed = params.get("error") === "link";
  const sb = browserSupabase();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(
    linkFailed ? { kind: "error", message: "That sign-in link expired or was opened in another browser. Send a new one." } : { kind: "idle" },
  );

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setStatus({ kind: "sending" });
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent", email: email.trim() });
  };

  const google = async () => {
    if (!sb) return;
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setStatus({ kind: "error", message: error.message });
  };

  if (!sb) {
    return (
      <p className="mt-6 text-sm text-muted">
        Sign-in isn&apos;t set up on this copy of the app yet (no Supabase settings).{" "}
        <Link href="/" className="underline">
          Try the demo
        </Link>{" "}
        instead.
      </p>
    );
  }

  if (status.kind === "sent") {
    return (
      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-card p-5">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-muted">
          We sent a sign-in link to <span className="font-medium text-ink">{status.email}</span>. Open it on this device, in this
          browser.
        </p>
        <button className="mt-4 text-sm underline" onClick={() => setStatus({ kind: "idle" })}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={sendLink} className="mt-8 flex flex-col gap-3">
        <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-ink"
        />
        <Button type="submit" disabled={status.kind === "sending"} className="py-3">
          {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" onClick={() => void google()} className="py-3">
        Continue with Google
      </Button>
      {status.kind === "error" && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {status.message}
        </p>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-[calc(48px+env(safe-area-inset-top))]">
      <Link href="/" className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Wardrobe Planner
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in to your wardrobe</h1>
      <p className="mt-2 text-[15px] text-muted">Your photos and outfits are private to your account.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
