import { initializeBoard } from "@planwerk/shared";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

/**
 * One Durable Object instance per board. Every client editing the same board
 * is routed to the same instance, which holds the Yjs document in memory and
 * persists it to the object's own SQLite storage.
 */
export class BoardRoom extends YServer {
  // Hibernation lets idle rooms sleep without dropping WebSocket connections.
  // On wake-up, onLoad() runs again on a fresh document.
  static override options = { hibernate: true };

  static override callbackOptions = {
    debounceWait: 2000,
    debounceMaxWait: 10_000,
    timeout: 5000,
  };

  override async onLoad(): Promise<void> {
    const sql = this.ctx.storage.sql;
    sql.exec(
      `CREATE TABLE IF NOT EXISTS snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state BLOB NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );

    const [row] = sql
      .exec<{ state: ArrayBuffer }>("SELECT state FROM snapshot WHERE id = 1")
      .toArray();
    if (row) {
      Y.applyUpdate(this.document, new Uint8Array(row.state));
      return;
    }

    // Only the room itself seeds a new board: if clients did it, two people
    // opening a fresh board at once would each create a set of columns.
    initializeBoard(this.document);
    // Persist right away. onLoad runs before the debounced save is wired up,
    // so without this the seed would only live in memory; after hibernation
    // the room would seed again and clients would receive deletions for the
    // columns they have, without the replacements.
    this.saveSnapshot();
  }

  override async onSave(): Promise<void> {
    this.saveSnapshot();
  }

  private saveSnapshot(): void {
    const state = Y.encodeStateAsUpdate(this.document);
    this.ctx.storage.sql.exec(
      `INSERT INTO snapshot (id, state, updated_at) VALUES (1, ?, ?)
       ON CONFLICT (id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
      state,
      Date.now(),
    );
  }
}
