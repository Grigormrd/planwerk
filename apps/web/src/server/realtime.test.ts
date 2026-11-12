import { verifyBoardToken } from "@planwerk/shared";
import { exportJWK, generateKeyPair, type JWK } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./db";
import { DomainError } from "./errors";
import { issueRealtimeToken } from "./realtime";
import { createTestDb, createUser } from "./test-db";
import {
  acceptInvitation,
  changeMemberRole,
  createBoard,
  createInvitation,
  createWorkspace,
  openDemoBoard,
} from "./workspaces";

let privateKey: JWK;
let publicKey: JWK;
let db: Database;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  privateKey = await exportJWK(pair.privateKey);
  publicKey = await exportJWK(pair.publicKey);
});

beforeEach(async () => {
  db = await createTestDb();
});

async function boardWithViewer() {
  const owner = await createUser(db, "Olga");
  const viewer = await createUser(db, "Vic");
  const ws = await createWorkspace(db, owner.id, "Team");
  const board = await createBoard(db, owner.id, ws.id, "Plans");
  const { token } = await createInvitation(db, owner.id, ws.id, "viewer");
  await acceptInvitation(db, viewer.id, token);
  return { owner, viewer, ws, board };
}

describe("issueRealtimeToken", () => {
  it("passes the board template on, so the room can fill a demo board", async () => {
    const owner = await createUser(db, "Olga");
    const demo = await openDemoBoard(db, owner.id);
    const ws = await createWorkspace(db, owner.id, "Team");
    const plain = await createBoard(db, owner.id, ws.id, "Plans");

    const forDemo = await issueRealtimeToken(db, owner.id, demo.id, privateKey);
    const forPlain = await issueRealtimeToken(db, owner.id, plain.id, privateKey);

    expect(await verifyBoardToken(publicKey, forDemo.token, demo.id)).toMatchObject({
      template: "demo",
    });
    expect(await verifyBoardToken(publicKey, forPlain.token, plain.id)).not.toHaveProperty(
      "template",
    );
  });

  it("encodes the member's current role", async () => {
    const { owner, viewer, board } = await boardWithViewer();

    const forOwner = await issueRealtimeToken(db, owner.id, board.id, privateKey);
    const forViewer = await issueRealtimeToken(db, viewer.id, board.id, privateKey);

    expect(await verifyBoardToken(publicKey, forOwner.token, board.id)).toMatchObject({
      userId: owner.id,
      role: "owner",
    });
    expect(await verifyBoardToken(publicKey, forViewer.token, board.id)).toMatchObject({
      userId: viewer.id,
      role: "viewer",
    });
  });

  it("follows role changes for the next token", async () => {
    const { owner, viewer, ws, board } = await boardWithViewer();
    await changeMemberRole(db, owner.id, ws.id, viewer.id, "member");

    const { token } = await issueRealtimeToken(db, viewer.id, board.id, privateKey);
    expect((await verifyBoardToken(publicKey, token, board.id))?.role).toBe("member");
  });

  it("refuses people outside the workspace", async () => {
    const { board } = await boardWithViewer();
    const stranger = await createUser(db, "Stranger");

    await expect(issueRealtimeToken(db, stranger.id, board.id, privateKey)).rejects.toSatisfy(
      (error: unknown) => error instanceof DomainError && error.code === "not_found",
    );
  });

  it("reports when the token expires", async () => {
    const { owner, board } = await boardWithViewer();
    const now = new Date("2026-11-08T12:00:00Z");
    const { expiresAt } = await issueRealtimeToken(db, owner.id, board.id, privateKey, now);
    expect(expiresAt.toISOString()).toBe("2026-11-08T12:05:00.000Z");
  });
});
