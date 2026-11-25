"use client";

import { useState } from "react";
import { setPasscode } from "@/lib/client/ai";
import { Button } from "./ui";

/**
 * The AI endpoints cost money and the site is public, so they need the
 * passcode set on the server (APP_PASSCODE). Asked once; kept on this device.
 */
export function PasscodeForm({ error, onSaved }: { error?: string | null; onSaved: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="rounded-[var(--radius-card)] border border-line bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setPasscode(value.trim());
        onSaved();
      }}
    >
      <label htmlFor="passcode" className="text-sm font-semibold">
        AI passcode
      </label>
      <p className="mt-1 text-xs text-muted">
        The passcode you set as <code>APP_PASSCODE</code> on the server. It stops strangers using your AI credits. You
        enter it once on this phone.
      </p>
      <input
        id="passcode"
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-3 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base outline-none focus:border-ink"
        data-testid="passcode-input"
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-3 w-full" data-testid="passcode-save">
        Save passcode
      </Button>
    </form>
  );
}
