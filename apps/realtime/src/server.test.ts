import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Server } from "@hocuspocus/server";
import { boardDocumentName } from "@planwerk/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createRealtimeServer } from "./server";

let server: Server;

beforeAll(async () => {
  server = createRealtimeServer({ port: 0, quiet: true, stopOnSignals: false });
  await server.listen();
});

afterAll(async () => {
  await server.destroy();
});

function connect(name: string) {
  const document = new Y.Doc();
  const provider = new HocuspocusProvider({ url: server.webSocketURL, name, document });
  const synced = new Promise<void>((resolve) => provider.on("synced", () => resolve()));
  return { document, provider, synced };
}

function waitFor(check: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error("Timed out"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe("realtime server", () => {
  it("answers the health check", async () => {
    const response = await fetch(`${server.httpURL}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("syncs a board document between two clients", async () => {
    const name = boardDocumentName(crypto.randomUUID());
    const alice = connect(name);
    const bob = connect(name);
    await Promise.all([alice.synced, bob.synced]);

    alice.document.getArray<string>("columns").push(["To do"]);

    await waitFor(() => bob.document.getArray("columns").length === 1);
    expect(bob.document.getArray<string>("columns").toArray()).toEqual(["To do"]);

    alice.provider.destroy();
    bob.provider.destroy();
  });

  it("refuses documents that are not boards", async () => {
    const document = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: server.webSocketURL,
      name: "secrets:everything",
      document,
    });
    const failed = new Promise<string>((resolve) =>
      provider.on("authenticationFailed", ({ reason }: { reason: string }) => resolve(reason)),
    );

    await expect(failed).resolves.toBeTypeOf("string");
    provider.destroy();
  });
});
