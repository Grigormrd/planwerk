import {
  applyBoardTemplate,
  BoardTemplate,
  canEditBoard,
  initializeBoard,
  WorkspaceRole,
} from "@planwerk/shared";
import type { Connection, ConnectionContext } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { ROLE_HEADER, TEMPLATE_HEADER, USER_HEADER } from "./auth-headers";

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

  /**
   * The Worker verified the token and put the role in a header. Keep it in
   * the connection state, which survives hibernation.
   */
  override onConnect(connection: Connection, ctx: ConnectionContext) {
    const role = WorkspaceRole.safeParse(ctx.request.headers.get(ROLE_HEADER));
    const userId = ctx.request.headers.get(USER_HEADER);
    connection.setState((previous: unknown) => ({
      ...(typeof previous === "object" && previous !== null ? previous : {}),
      role: role.success ? role.data : null,
      userId,
    }));

    // A board created from a template (the demo) gets its cards from the
    // room on the first connection, before the client's initial sync, so
    // they arrive together with the columns. The creator gets the assigned
    // cards when they may edit.
    const template = BoardTemplate.safeParse(ctx.request.headers.get(TEMPLATE_HEADER));
    if (template.success) {
      const ownerId = role.success && canEditBoard(role.data) ? userId : null;
      const today = new Date().toISOString().slice(0, 10);
      if (applyBoardTemplate(this.document, template.data, { ownerId, today })) {
        this.saveSnapshot();
      }
    }

    return super.onConnect(connection, ctx);
  }

  /**
   * Document updates from read-only connections are dropped by y-partyserver;
   * presence (awareness) still goes through. Anything but a role that may
   * edit is read-only, including a missing role.
   */
  override isReadOnly(connection: Connection): boolean {
    const state = connection.state as { role?: WorkspaceRole | null } | null;
    return !state?.role || !canEditBoard(state.role);
  }

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
