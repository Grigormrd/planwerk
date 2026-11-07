"use client";

import { BOARD_ROOM_PARTY, readBoard, type BoardSnapshot } from "@planwerk/shared";
import { useEffect, useState, useSyncExternalStore } from "react";
import YProvider from "y-partyserver/provider";
import * as Y from "yjs";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

// Inlined at build time by Next.js.
const REALTIME_HOST = process.env.NEXT_PUBLIC_REALTIME_HOST;

/** Turns a Y.Doc into an external store React can subscribe to. */
function createBoardStore(doc: Y.Doc) {
  let snapshot = readBoard(doc);
  const listeners = new Set<() => void>();
  doc.on("update", () => {
    snapshot = readBoard(doc);
    for (const listener of listeners) listener();
  });
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}

const EMPTY_BOARD: BoardSnapshot = { columns: [] };

/**
 * Connects to the board's room on the realtime Worker. All edits go into the
 * local Y.Doc first, so the UI never waits for the network; the provider syncs
 * them in the background and reconnects automatically.
 */
export function useBoard(boardId: string) {
  const [{ doc, store }] = useState(() => {
    const doc = new Y.Doc();
    return { doc, store: createBoardStore(doc) };
  });
  const [status, setStatus] = useState<ConnectionStatus>(
    REALTIME_HOST ? "connecting" : "disconnected",
  );
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (!REALTIME_HOST) {
      console.error("NEXT_PUBLIC_REALTIME_HOST is not set");
      return;
    }
    const host = REALTIME_HOST;
    let provider: YProvider | undefined;

    // YProvider connects asynchronously. If it were destroyed before that
    // finished (React mounts effects twice in development), the pending
    // connect would revive it. Creating it on the next tick lets an
    // immediate cleanup cancel it before it ever starts.
    const start = setTimeout(() => {
      provider = new YProvider(host, boardId, doc, { party: BOARD_ROOM_PARTY });
      provider.on("status", ({ status }: { status: ConnectionStatus }) => setStatus(status));
      provider.on("synced", (synced: boolean) => {
        if (synced) setHasSynced(true);
      });
    });

    return () => {
      clearTimeout(start);
      provider?.destroy();
    };
  }, [boardId, doc]);

  const board = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_BOARD);

  return { doc, board, status, hasSynced, getBoard: store.getSnapshot };
}
