"use client";

import { clearDocument } from "y-indexeddb";

/**
 * Boards are kept in IndexedDB so edits made while the connection is down
 * survive closing or reloading the tab. Each user gets separate databases,
 * and everything is deleted on sign-out, so a shared computer never shows
 * one person's boards to the next.
 */

const PREFIX = "planwerk:";
const REGISTRY_KEY = "planwerk:offline-docs";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const offlineDocName = (userId: string, boardId: string) => `${PREFIX}${userId}:${boardId}`;

function defaultStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // e.g. storage disabled in private mode
  }
}

function readRegistry(storage: KeyValueStorage | null): string[] {
  try {
    const value = JSON.parse(storage?.getItem(REGISTRY_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

/** Remembers a database name so sign-out can delete it later. */
export function rememberOfflineDoc(name: string, storage = defaultStorage()): void {
  const names = new Set(readRegistry(storage));
  if (names.has(name)) return;
  names.add(name);
  try {
    storage?.setItem(REGISTRY_KEY, JSON.stringify([...names]));
  } catch {
    // Storage full or disabled: sign-out still finds databases via indexedDB.databases().
  }
}

interface ClearOptions {
  storage?: KeyValueStorage | null;
  clear?: (name: string) => Promise<unknown>;
  listDatabases?: () => Promise<{ name?: string }[]>;
}

/** Deletes every Planwerk board stored on this device. */
export async function clearOfflineData({
  storage = defaultStorage(),
  clear = clearDocument,
  listDatabases = async () => (await globalThis.indexedDB?.databases?.()) ?? [],
}: ClearOptions = {}): Promise<void> {
  const known = await listDatabases().catch(() => []);
  const names = new Set([
    ...readRegistry(storage),
    ...known.map((db) => db.name).filter((name): name is string => !!name?.startsWith(PREFIX)),
  ]);
  await Promise.all([...names].map((name) => clear(name).catch(() => undefined)));
  try {
    storage?.removeItem(REGISTRY_KEY);
  } catch {
    // ignore
  }
}
