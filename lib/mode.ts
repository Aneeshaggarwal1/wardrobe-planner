/**
 * Which wardrobe the app is showing:
 * - "demo": the sample wardrobe, seeded from public/demo/seed.json
 * - "mine": your own clothes, stored only on this device
 */
export type AppMode = "demo" | "mine";

const KEY = "wp-mode";

export function getMode(): AppMode | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "demo" || value === "mine" ? value : null;
  } catch {
    return null;
  }
}

export function setMode(mode: AppMode | null): void {
  try {
    if (mode) window.localStorage.setItem(KEY, mode);
    else window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
