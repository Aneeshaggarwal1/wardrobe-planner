"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWardrobe } from "./WardrobeProvider";

const TABS = [
  { href: "/today", label: "Today", icon: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z" },
  { href: "/outfits", label: "Outfits", icon: "M4 5h7v14H4zM13 5h7v14h-7z" },
  { href: "/wardrobe", label: "Wardrobe", icon: "M8 3l4 2 4-2 4 4-3 2v12H7V9L4 7z" },
  { href: "/laundry", label: "Laundry", icon: "M5 3h14v18H5zM5 7h14M12 10a4 4 0 100 8 4 4 0 000-8z" },
] as const;

export function AppShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isDemo } = useWardrobe();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {isDemo && (
            <Link
              href="/"
              className="rounded-full border border-accent/50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-accent"
              title="You're exploring sample data. Tap to reset or sign in."
            >
              Demo
            </Link>
          )}
        </div>
        {action}
      </header>

      <main className="flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4">{children}</main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-ink" : "text-faint"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                    <path d={tab.icon} />
                  </svg>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
