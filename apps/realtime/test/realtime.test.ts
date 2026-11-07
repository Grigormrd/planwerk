import { BOARD_ROOM_PARTY } from "@planwerk/shared";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import YProvider from "y-partyserver/provider";
import * as Y from "yjs";

// Runs the Worker locally in workerd, the same runtime Cloudflare uses in production.
const harness = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)),
  workers: [{ configPath: "./wrangler.jsonc" }],
});

let baseUrl: URL;
const providers: YProvider[] = [];

beforeAll(async () => {
  ({ url: baseUrl } = await harness.listen());
}, 60_000);

afterAll(async () => {
  for (const provider of providers) provider.destroy();
  await harness.close();
});

function connect(boardId: string) {
  const document = new Y.Doc();
  const provider = new YProvider(baseUrl.host, boardId, document, {
    party: BOARD_ROOM_PARTY,
    protocol: "ws",
    // Without this, providers in the same process would sync over BroadcastChannel
    // instead of through the server, and the test would prove nothing.
    disableBc: true,
  });
  providers.push(provider);
  const synced = new Promise<void>((resolve) => {
    provider.on("synced", (state: boolean) => state && resolve());
  });
  return { document, provider, synced };
}

function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await check()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error("Timed out"));
      setTimeout(tick, 25);
    };
    void tick();
  });
}

describe("realtime worker", () => {
  it("answers the health check", async () => {
    const response = await fetch(new URL("/health", baseUrl));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it.each([
    // Our own guard: the room name must be a board id.
    ["an invalid board id", `/parties/${BOARD_ROOM_PARTY}/not-a-board`, 404],
    // partyserver itself refuses parties without a Durable Object binding.
    ["an unknown party", `/parties/secrets/${crypto.randomUUID()}`, 400],
  ])("rejects WebSocket connections to %s", async (_label, path, status) => {
    // Node's fetch refuses Upgrade headers, so dispatch through the harness.
    const response = await harness.fetch(path, { headers: { Upgrade: "websocket" } });
    expect(response.status).toBe(status);
  });

  it("rejects plain HTTP requests to invalid rooms", async () => {
    const response = await fetch(new URL(`/parties/${BOARD_ROOM_PARTY}/not-a-board`, baseUrl));
    expect(response.status).toBe(404);
  });

  it("syncs a board between two clients and persists it", async () => {
    const boardId = crypto.randomUUID();
    const alice = connect(boardId);
    const bob = connect(boardId);
    await Promise.all([alice.synced, bob.synced]);

    alice.document.getArray<string>("columns").push(["To do"]);

    await waitFor(() => bob.document.getArray("columns").length === 1);
    expect(bob.document.getArray<string>("columns").toArray()).toEqual(["To do"]);

    // When the room empties, the Durable Object writes a snapshot to its SQLite storage.
    alice.provider.destroy();
    bob.provider.destroy();

    const storage = await harness
      .getWorker()
      .getDurableObjectStorage("BoardRoom", { name: boardId });
    const readSnapshot = async () => {
      const tables = await storage.exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'snapshot'",
      );
      if (tables.length === 0) return null;
      const [row] = await storage.exec<{ state: ArrayBuffer }>("SELECT state FROM snapshot");
      return row ?? null;
    };

    let snapshot: { state: ArrayBuffer } | null = null;
    await waitFor(async () => (snapshot = await readSnapshot()) !== null, 15_000);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(snapshot!.state));
    expect(restored.getArray<string>("columns").toArray()).toEqual(["To do"]);
  }, 30_000);
});
