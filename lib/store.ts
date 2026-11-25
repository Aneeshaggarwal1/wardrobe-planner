import type { WardrobeSnapshot } from "./types";

/**
 * Where a wardrobe snapshot is kept on this device.
 * - Demo: localStorage (small, no photos).
 * - Your wardrobe: IndexedDB, which has room for photo thumbnails and is
 *   available to installed home-screen apps.
 */
export interface SnapshotStore {
  get(): Promise<WardrobeSnapshot | null>;
  set(snapshot: WardrobeSnapshot | null): Promise<void>;
}

export function localStorageStore(key: string): SnapshotStore {
  return {
    async get() {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as WardrobeSnapshot) : null;
      } catch {
        return null;
      }
    },
    async set(snapshot) {
      try {
        if (snapshot === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        // Private mode or storage full: the demo still works for this session.
      }
    },
  };
}

/** For tests and for when no storage is available at all. */
export function memoryStore(initial: WardrobeSnapshot | null = null): SnapshotStore {
  let value = initial ? structuredClone(initial) : null;
  return {
    async get() {
      return value ? structuredClone(value) : null;
    },
    async set(snapshot) {
      value = snapshot ? structuredClone(snapshot) : null;
    },
  };
}

const DB_NAME = "wardrobe-planner";
const DB_STORE = "snapshots";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Couldn't open on-device storage"));
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, mode);
        const req = action(tx.objectStore(DB_STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result as T);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("Saving on this device failed"));
        };
      }),
  );
}

export function indexedDbStore(key: string): SnapshotStore {
  return {
    async get() {
      const value = await run<WardrobeSnapshot | undefined>("readonly", (s) => s.get(key));
      return value ?? null;
    },
    async set(snapshot) {
      await run("readwrite", (s) => (snapshot === null ? s.delete(key) : s.put(snapshot, key)));
    },
  };
}

/**
 * Ask the browser not to clear this site's storage under storage pressure.
 * Browsers may say no; the backup file is the real safety net.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
