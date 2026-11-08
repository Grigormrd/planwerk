import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { clearOfflineData, offlineDocName, rememberOfflineDoc } from "./offline-storage";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

/** Writes a board to IndexedDB the way the app does and returns its name. */
async function storeBoard(userId: string, boardId: string, text: string) {
  const name = offlineDocName(userId, boardId);
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(name, doc);
  await persistence.whenSynced;
  doc.getMap("cards").set("card", text);
  await new Promise((resolve) => setTimeout(resolve, 50)); // let the write land
  await persistence.destroy();
  return name;
}

async function readBoard(name: string) {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(name, doc);
  await persistence.whenSynced;
  const value = doc.getMap("cards").get("card");
  await persistence.destroy();
  return value;
}

describe("offline storage", () => {
  it("keeps boards separate per user", () => {
    expect(offlineDocName("alice", "board-1")).not.toBe(offlineDocName("bob", "board-1"));
  });

  it("restores a board after the tab is gone", async () => {
    const name = await storeBoard("alice", "board-1", "Buy milk");
    expect(await readBoard(name)).toBe("Buy milk");
  });

  it("deletes every remembered board on sign-out", async () => {
    const storage = memoryStorage();
    const first = await storeBoard("alice", "board-2", "one");
    const second = await storeBoard("alice", "board-3", "two");
    rememberOfflineDoc(first, storage);
    rememberOfflineDoc(second, storage);

    await clearOfflineData({ storage, listDatabases: async () => [] });

    expect(await readBoard(first)).toBeUndefined();
    expect(await readBoard(second)).toBeUndefined();
    expect(storage.getItem("planwerk:offline-docs")).toBeNull();
  });

  it("also finds boards the registry missed, but leaves other databases alone", async () => {
    const forgotten = await storeBoard("bob", "board-4", "missed");
    const cleared: string[] = [];

    await clearOfflineData({
      storage: memoryStorage(),
      listDatabases: async () => [{ name: forgotten }, { name: "some-other-app" }],
      clear: async (name) => void cleared.push(name),
    });

    expect(cleared).toEqual([forgotten]);
  });
});
