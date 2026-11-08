import {
  addCard,
  BOARD_ROOM_PARTY,
  DEFAULT_COLUMNS,
  readBoard,
  signBoardToken,
  type WorkspaceRole,
} from "@planwerk/shared";
import { exportJWK, generateKeyPair } from "jose";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import YProvider from "y-partyserver/provider";
import * as Y from "yjs";

// A key pair just for this test run; the Worker gets the public half.
const keys = await generateKeyPair("ES256", { extractable: true });
const privateKey = await exportJWK(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);

// Runs the Worker locally in workerd, the same runtime Cloudflare uses in production.
const harness = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)),
  workers: [
    {
      configPath: "./wrangler.jsonc",
      vars: { REALTIME_TOKEN_PUBLIC_KEY: JSON.stringify(publicKey) },
    },
  ],
});

const tokenFor = (boardId: string, role: WorkspaceRole = "member", now?: Date) =>
  signBoardToken(privateKey, { userId: `user-${role}`, boardId, role }, now);

let baseUrl: URL;
const providers: YProvider[] = [];

beforeAll(async () => {
  ({ url: baseUrl } = await harness.listen());
}, 60_000);

afterAll(async () => {
  for (const provider of providers) provider.destroy();
  await harness.close();
});

function connect(boardId: string, role: WorkspaceRole = "member") {
  const document = new Y.Doc();
  const provider = new YProvider(baseUrl.host, boardId, document, {
    party: BOARD_ROOM_PARTY,
    protocol: "ws",
    params: async () => ({ token: await tokenFor(boardId, role) }),
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

  describe("authorization", () => {
    const upgrade = (path: string) => harness.fetch(path, { headers: { Upgrade: "websocket" } });
    const room = (boardId: string, token?: string) =>
      `/parties/${BOARD_ROOM_PARTY}/${boardId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    it("refuses connections without a token", async () => {
      expect((await upgrade(room(crypto.randomUUID()))).status).toBe(401);
    });

    it("refuses a token issued for another board", async () => {
      const token = await tokenFor(crypto.randomUUID());
      expect((await upgrade(room(crypto.randomUUID(), token))).status).toBe(401);
    });

    it("refuses an expired token", async () => {
      const boardId = crypto.randomUUID();
      const token = await tokenFor(boardId, "owner", new Date(Date.now() - 60 * 60 * 1000));
      expect((await upgrade(room(boardId, token))).status).toBe(401);
    });

    it("refuses a token signed with another key", async () => {
      const boardId = crypto.randomUUID();
      const foreign = await exportJWK(
        (await generateKeyPair("ES256", { extractable: true })).privateKey,
      );
      const token = await signBoardToken(foreign, { userId: "mallory", boardId, role: "owner" });
      expect((await upgrade(room(boardId, token))).status).toBe(401);
    });

    it("refuses a token whose role was edited", async () => {
      const boardId = crypto.randomUUID();
      const [header, payload, signature] = (await tokenFor(boardId, "viewer")).split(".") as [
        string,
        string,
        string,
      ];
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      const promoted = Buffer.from(JSON.stringify({ ...claims, role: "owner" })).toString(
        "base64url",
      );
      expect((await upgrade(room(boardId, `${header}.${promoted}.${signature}`))).status).toBe(401);
    });

    it("accepts a valid token", async () => {
      const boardId = crypto.randomUUID();
      expect((await upgrade(room(boardId, await tokenFor(boardId)))).status).toBe(101);
    });
  });

  it("ignores edits from a viewer, even from a tampered client", async () => {
    // The viewer's client writes to its document as if the UI allowed it.
    const boardId = crypto.randomUUID();
    const member = connect(boardId, "member");
    const viewer = connect(boardId, "viewer");
    await Promise.all([member.synced, viewer.synced]);
    const todo = readBoard(member.document).columns[0]!.id;

    addCard(viewer.document, todo, "Sneaky edit");
    addCard(member.document, todo, "Real edit");

    // The viewer still receives everyone else's changes...
    const cards = (doc: Y.Doc) => readBoard(doc).columns[0]?.cards.map((c) => c.title) ?? [];
    await waitFor(() => cards(viewer.document).includes("Real edit"));
    // ...but its own change never reaches the member or the stored snapshot.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(cards(member.document)).toEqual(["Real edit"]);

    const fresh = connect(boardId, "member");
    await fresh.synced;
    expect(cards(fresh.document)).toEqual(["Real edit"]);
  });

  it("rejects plain HTTP requests to invalid rooms", async () => {
    const response = await fetch(new URL(`/parties/${BOARD_ROOM_PARTY}/not-a-board`, baseUrl));
    expect(response.status).toBe(404);
  });

  it("gives a new board the default columns, exactly once", async () => {
    const boardId = crypto.randomUUID();
    const alice = connect(boardId);
    const bob = connect(boardId);
    await Promise.all([alice.synced, bob.synced]);

    expect(readBoard(alice.document).columns.map((c) => c.title)).toEqual([...DEFAULT_COLUMNS]);
    expect(readBoard(bob.document)).toEqual(readBoard(alice.document));
  });

  it("persists the seeded columns immediately, before anyone edits", async () => {
    // Regression: the seed used to live only in memory. After hibernation the
    // room seeded again, and clients received deletions for "their" columns
    // without the replacements, leaving them with an empty board.
    const boardId = crypto.randomUUID();
    const alice = connect(boardId);
    await alice.synced;

    const storage = await harness
      .getWorker()
      .getDurableObjectStorage("BoardRoom", { name: boardId });
    const [row] = await storage.exec<{ state: ArrayBuffer }>("SELECT state FROM snapshot");
    expect(row).toBeDefined();

    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(row!.state));
    expect(readBoard(restored)).toEqual(readBoard(alice.document));
  });

  it("syncs a board between two clients and persists it", async () => {
    const boardId = crypto.randomUUID();
    const alice = connect(boardId);
    const bob = connect(boardId);
    await Promise.all([alice.synced, bob.synced]);

    const todo = readBoard(alice.document).columns[0]!.id;
    addCard(alice.document, todo, "Buy milk");

    const bobsCards = () => readBoard(bob.document).columns[0]?.cards.map((c) => c.title);
    await waitFor(() => bobsCards()?.length === 1);
    expect(bobsCards()).toEqual(["Buy milk"]);

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
      if (!row) return null;
      const restored = new Y.Doc();
      Y.applyUpdate(restored, new Uint8Array(row.state));
      return readBoard(restored);
    };

    let snapshot: Awaited<ReturnType<typeof readSnapshot>> = null;
    await waitFor(async () => {
      snapshot = await readSnapshot();
      return snapshot?.columns[0]?.cards.length === 1;
    }, 15_000);
    expect(snapshot!.columns[0]!.cards.map((c) => c.title)).toEqual(["Buy milk"]);
  }, 30_000);
});
