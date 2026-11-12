import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./db";
import { DomainError } from "./errors";
import { createTestDb, createUser } from "./test-db";
import {
  acceptInvitation,
  changeMemberRole,
  createBoard,
  createInvitation,
  createWorkspace,
  getBoard,
  getWorkspace,
  listBoards,
  listInvitations,
  listMembers,
  listWorkspaces,
  openDemoBoard,
  previewInvitation,
  removeMember,
  renameWorkspace,
  revokeInvitation,
  transferMemberships,
} from "./workspaces";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

async function expectDomainError(promise: Promise<unknown>, code: DomainError["code"]) {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => error instanceof DomainError && error.code === code,
  );
}

/** Owner with a workspace plus a member who joined through an invite link. */
async function workspaceWithMember(memberRole: "member" | "viewer" = "member") {
  const owner = await createUser(db, "Olga");
  const member = await createUser(db, "Max");
  const ws = await createWorkspace(db, owner.id, "Flat 3B");
  const { token } = await createInvitation(db, owner.id, ws.id, memberRole);
  await acceptInvitation(db, member.id, token);
  return { owner, member, ws };
}

describe("workspaces", () => {
  it("makes the creator the owner", async () => {
    const owner = await createUser(db);
    const ws = await createWorkspace(db, owner.id, "  Flat 3B ");

    expect(ws.name).toBe("Flat 3B");
    expect(await listWorkspaces(db, owner.id)).toEqual([
      { id: ws.id, name: "Flat 3B", role: "owner", memberCount: 1 },
    ]);
  });

  it("validates names", async () => {
    const owner = await createUser(db);
    await expectDomainError(createWorkspace(db, owner.id, "   "), "invalid");
  });

  it("hides workspaces from non-members", async () => {
    const { ws } = await workspaceWithMember();
    const stranger = await createUser(db, "Stranger");

    await expectDomainError(getWorkspace(db, stranger.id, ws.id), "not_found");
    await expectDomainError(listBoards(db, stranger.id, ws.id), "not_found");
    expect(await listWorkspaces(db, stranger.id)).toEqual([]);
  });

  it("lets only owners rename", async () => {
    const { owner, member, ws } = await workspaceWithMember();
    await expectDomainError(renameWorkspace(db, member.id, ws.id, "Mine now"), "forbidden");
    await renameWorkspace(db, owner.id, ws.id, "Flat 3C");
    expect((await getWorkspace(db, member.id, ws.id)).name).toBe("Flat 3C");
  });
});

describe("phase 1 goal: two accounts share a workspace", () => {
  it("shows the same boards to both members", async () => {
    const { owner, member, ws } = await workspaceWithMember();
    const created = await createBoard(db, owner.id, ws.id, "Groceries");

    const ownerBoards = await listBoards(db, owner.id, ws.id);
    const memberBoards = await listBoards(db, member.id, ws.id);

    expect(memberBoards).toEqual(ownerBoards);
    expect(memberBoards.map((b) => b.id)).toEqual([created.id]);
    expect((await getBoard(db, member.id, created.id)).role).toBe("member");
  });
});

describe("invitations", () => {
  it("previews the workspace and role behind a link", async () => {
    const owner = await createUser(db);
    const ws = await createWorkspace(db, owner.id, "Flat 3B");
    const { token } = await createInvitation(db, owner.id, ws.id, "viewer");

    expect(await previewInvitation(db, token)).toEqual({
      workspaceId: ws.id,
      workspaceName: "Flat 3B",
      role: "viewer",
    });
  });

  it("can be used by several people until it expires", async () => {
    const owner = await createUser(db);
    const ws = await createWorkspace(db, owner.id, "Team");
    const now = new Date("2026-11-07T12:00:00Z");
    const { token } = await createInvitation(db, owner.id, ws.id, "member", now);

    for (const name of ["A", "B"]) {
      const user = await createUser(db, name);
      await acceptInvitation(db, user.id, token, now);
    }
    expect(await listMembers(db, owner.id, ws.id)).toHaveLength(3);

    const eightDaysLater = new Date("2026-11-15T12:00:00Z");
    const late = await createUser(db, "Late");
    await expectDomainError(acceptInvitation(db, late.id, token, eightDaysLater), "not_found");
  });

  it("stops working once revoked", async () => {
    const owner = await createUser(db);
    const ws = await createWorkspace(db, owner.id, "Team");
    const { token } = await createInvitation(db, owner.id, ws.id, "member");
    const [listed] = await listInvitations(db, owner.id, ws.id);

    await revokeInvitation(db, owner.id, ws.id, listed!.id);

    const user = await createUser(db);
    await expectDomainError(acceptInvitation(db, user.id, token), "not_found");
    expect(await listInvitations(db, owner.id, ws.id)).toEqual([]);
  });

  it("never downgrades an existing member", async () => {
    const { owner, member, ws } = await workspaceWithMember("member");
    const { token } = await createInvitation(db, owner.id, ws.id, "viewer");

    await acceptInvitation(db, member.id, token);
    await acceptInvitation(db, owner.id, token);

    const roles = Object.fromEntries(
      (await listMembers(db, owner.id, ws.id)).map((m) => [m.name, m.role]),
    );
    expect(roles).toEqual({ Olga: "owner", Max: "member" });
  });

  it("cannot be created by non-owners or for the owner role", async () => {
    const { owner, member, ws } = await workspaceWithMember();
    await expectDomainError(createInvitation(db, member.id, ws.id, "viewer"), "forbidden");
    await expectDomainError(createInvitation(db, owner.id, ws.id, "owner"), "invalid");
  });

  it("rejects unknown tokens", async () => {
    const user = await createUser(db);
    await expectDomainError(acceptInvitation(db, user.id, "made-up"), "not_found");
  });
});

describe("roles", () => {
  it("prevents viewers from creating boards", async () => {
    const { member: viewer, ws } = await workspaceWithMember("viewer");
    await expectDomainError(createBoard(db, viewer.id, ws.id, "Nope"), "forbidden");
  });

  it("lets owners promote and demote members", async () => {
    const { owner, member, ws } = await workspaceWithMember("viewer");

    await changeMemberRole(db, owner.id, ws.id, member.id, "member");
    await createBoard(db, member.id, ws.id, "Now allowed");

    await expectDomainError(
      changeMemberRole(db, member.id, ws.id, owner.id, "viewer"),
      "forbidden",
    );
  });

  it("always keeps at least one owner", async () => {
    const { owner, member, ws } = await workspaceWithMember();

    await expectDomainError(changeMemberRole(db, owner.id, ws.id, owner.id, "member"), "conflict");
    await expectDomainError(removeMember(db, owner.id, ws.id, owner.id), "conflict");

    await changeMemberRole(db, owner.id, ws.id, member.id, "owner");
    await removeMember(db, owner.id, ws.id, owner.id);
    expect((await listMembers(db, member.id, ws.id)).map((m) => m.name)).toEqual(["Max"]);
  });

  it("lets members leave but not remove others", async () => {
    const { owner, member, ws } = await workspaceWithMember();
    const other = await createUser(db, "Other");
    const { token } = await createInvitation(db, owner.id, ws.id, "member");
    await acceptInvitation(db, other.id, token);

    await expectDomainError(removeMember(db, member.id, ws.id, other.id), "forbidden");
    await removeMember(db, member.id, ws.id, member.id);
    await expectDomainError(getWorkspace(db, member.id, ws.id), "not_found");
  });
});

describe("guest accounts", () => {
  it("move their workspaces to the real account, keeping the stronger role", async () => {
    const guest = await createUser(db, "Guest", true);
    const real = await createUser(db, "Real");
    const guestWorkspace = await createWorkspace(db, guest.id, "Made as guest");

    const shared = await createWorkspace(db, real.id, "Shared");
    const { token } = await createInvitation(db, real.id, shared.id, "viewer");
    await acceptInvitation(db, guest.id, token);

    await transferMemberships(db, guest.id, real.id);

    expect(await listWorkspaces(db, real.id)).toEqual([
      { id: guestWorkspace.id, name: "Made as guest", role: "owner", memberCount: 1 },
      { id: shared.id, name: "Shared", role: "owner", memberCount: 1 },
    ]);
    expect(await listWorkspaces(db, guest.id)).toEqual([]);
  });
});

describe("demo board", () => {
  it("is created once per user, in a workspace they own", async () => {
    const guest = await createUser(db, "Guest", true);

    const first = await openDemoBoard(db, guest.id);
    const again = await openDemoBoard(db, guest.id);

    expect(again).toEqual(first);
    expect(await listWorkspaces(db, guest.id)).toEqual([
      { id: first.workspaceId, name: "Demo team", role: "owner", memberCount: 1 },
    ]);
    expect(await getBoard(db, guest.id, first.id)).toMatchObject({
      name: "Product launch",
      template: "demo",
      role: "owner",
    });
  });

  it("is not someone else's demo the user was invited to", async () => {
    const owner = await createUser(db, "Olga");
    const visitor = await createUser(db, "Vic");
    const theirs = await openDemoBoard(db, owner.id);
    const { token } = await createInvitation(db, owner.id, theirs.workspaceId, "member");
    await acceptInvitation(db, visitor.id, token);

    const mine = await openDemoBoard(db, visitor.id);
    expect(mine.id).not.toBe(theirs.id);
  });

  it("is separate from ordinary boards", async () => {
    const owner = await createUser(db);
    const ws = await createWorkspace(db, owner.id, "Team");
    const plain = await createBoard(db, owner.id, ws.id, "Plans");

    expect((await getBoard(db, owner.id, plain.id)).template).toBeNull();
    expect((await openDemoBoard(db, owner.id)).id).not.toBe(plain.id);
  });
});
