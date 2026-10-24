/** Which backend the app is using. Set on the Landing screen. */
export type AppMode = "demo" | "account";

const KEY = "wp-mode";

export function getMode(): AppMode | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "demo" || value === "account" ? value : null;
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
