import {
  BoardName,
  canEditBoard,
  canManageMembers,
  WorkspaceName,
  WorkspaceRole,
  type WorkspaceRole as Role,
} from "@planwerk/shared";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "./db";
import { board, invitation, membership, user, workspace } from "./db/schema";
import { conflict, forbidden, invalid, notFound } from "./errors";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalid(result.error.issues[0]?.message ?? "Invalid input.");
  return result.data;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Returns the caller's role in a workspace. Non-members get "not found"
 * rather than "forbidden", so workspace ids cannot be probed.
 */
export async function requireRole(
  db: Database,
  userId: string,
  workspaceId: string,
): Promise<Role> {
  const [row] = await db
    .select({ role: membership.role })
    .from(membership)
    .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, userId)));
  if (!row) throw notFound("Workspace");
  return row.role;
}

async function countOwners(db: Database, workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ owners: count() })
    .from(membership)
    .where(and(eq(membership.workspaceId, workspaceId), eq(membership.role, "owner")));
  return row?.owners ?? 0;
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export async function createWorkspace(db: Database, userId: string, name: string) {
  const validName = parse(WorkspaceName, name);
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(workspace).values({ name: validName }).returning();
    if (!created) throw new Error("Insert returned no row");
    await tx.insert(membership).values({ workspaceId: created.id, userId, role: "owner" });
    return created;
  });
}

export async function listWorkspaces(db: Database, userId: string) {
  return db
    .select({
      id: workspace.id,
      name: workspace.name,
      role: membership.role,
      memberCount: sql<number>`(select count(*)::int from ${membership} m where m.workspace_id = ${workspace.id})`,
    })
    .from(membership)
    .innerJoin(workspace, eq(workspace.id, membership.workspaceId))
    .where(eq(membership.userId, userId))
    .orderBy(asc(workspace.name));
}

export async function getWorkspace(db: Database, userId: string, workspaceId: string) {
  const role = await requireRole(db, userId, workspaceId);
  const [row] = await db.select().from(workspace).where(eq(workspace.id, workspaceId));
  if (!row) throw notFound("Workspace");
  return { ...row, role };
}

export async function renameWorkspace(
  db: Database,
  userId: string,
  workspaceId: string,
  name: string,
) {
  const role = await requireRole(db, userId, workspaceId);
  if (!canManageMembers(role)) throw forbidden("Only owners can rename a workspace.");
  const validName = parse(WorkspaceName, name);
  await db.update(workspace).set({ name: validName }).where(eq(workspace.id, workspaceId));
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(db: Database, userId: string, workspaceId: string) {
  await requireRole(db, userId, workspaceId);
  return db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      isGuest: user.isAnonymous,
      role: membership.role,
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.workspaceId, workspaceId))
    .orderBy(asc(membership.createdAt));
}

export async function changeMemberRole(
  db: Database,
  actorId: string,
  workspaceId: string,
  targetUserId: string,
  newRole: string,
) {
  const role = parse(WorkspaceRole, newRole);
  const actorRole = await requireRole(db, actorId, workspaceId);
  if (!canManageMembers(actorRole)) throw forbidden("Only owners can change roles.");

  await db.transaction(async (tx) => {
    const current = await requireRole(tx, targetUserId, workspaceId).catch(() => {
      throw notFound("Member");
    });
    if (current === "owner" && role !== "owner" && (await countOwners(tx, workspaceId)) <= 1) {
      throw conflict("A workspace needs at least one owner.");
    }
    await tx
      .update(membership)
      .set({ role })
      .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, targetUserId)));
  });
}

/** Owners can remove anyone; everyone can remove themselves (leave). */
export async function removeMember(
  db: Database,
  actorId: string,
  workspaceId: string,
  targetUserId: string,
) {
  const actorRole = await requireRole(db, actorId, workspaceId);
  if (actorId !== targetUserId && !canManageMembers(actorRole)) {
    throw forbidden("Only owners can remove members.");
  }

  await db.transaction(async (tx) => {
    const targetRole = await requireRole(tx, targetUserId, workspaceId).catch(() => {
      throw notFound("Member");
    });
    if (targetRole === "owner" && (await countOwners(tx, workspaceId)) <= 1) {
      throw conflict("Hand over ownership before the last owner leaves.");
    }
    await tx
      .delete(membership)
      .where(and(eq(membership.workspaceId, workspaceId), eq(membership.userId, targetUserId)));
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

const InvitableRole = WorkspaceRole.exclude(["owner"]);

/** Creates a shareable invite link token. Only its hash is stored. */
export async function createInvitation(
  db: Database,
  actorId: string,
  workspaceId: string,
  role: string,
  now = new Date(),
) {
  const invitedRole = parse(InvitableRole, role);
  const actorRole = await requireRole(db, actorId, workspaceId);
  if (!canManageMembers(actorRole)) throw forbidden("Only owners can invite people.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  await db.insert(invitation).values({
    workspaceId,
    tokenHash: hashToken(token),
    role: invitedRole,
    createdBy: actorId,
    expiresAt,
  });
  return { token, role: invitedRole, expiresAt };
}

export async function listInvitations(
  db: Database,
  actorId: string,
  workspaceId: string,
  now = new Date(),
) {
  const actorRole = await requireRole(db, actorId, workspaceId);
  if (!canManageMembers(actorRole)) return [];
  return db
    .select({ id: invitation.id, role: invitation.role, expiresAt: invitation.expiresAt })
    .from(invitation)
    .where(
      and(
        eq(invitation.workspaceId, workspaceId),
        isNull(invitation.revokedAt),
        gt(invitation.expiresAt, now),
      ),
    )
    .orderBy(asc(invitation.createdAt));
}

export async function revokeInvitation(
  db: Database,
  actorId: string,
  workspaceId: string,
  invitationId: string,
  now = new Date(),
) {
  const actorRole = await requireRole(db, actorId, workspaceId);
  if (!canManageMembers(actorRole)) throw forbidden("Only owners can revoke invites.");
  await db
    .update(invitation)
    .set({ revokedAt: now })
    .where(and(eq(invitation.id, invitationId), eq(invitation.workspaceId, workspaceId)));
}

async function findUsableInvitation(db: Database, token: string, now: Date) {
  const [row] = await db
    .select({
      workspaceId: invitation.workspaceId,
      workspaceName: workspace.name,
      role: invitation.role,
    })
    .from(invitation)
    .innerJoin(workspace, eq(workspace.id, invitation.workspaceId))
    .where(
      and(
        eq(invitation.tokenHash, hashToken(token)),
        isNull(invitation.revokedAt),
        gt(invitation.expiresAt, now),
      ),
    );
  if (!row) throw notFound("Invite link (it may have expired)");
  return row;
}

/** Public preview for the invite page: which workspace, which role. */
export async function previewInvitation(db: Database, token: string, now = new Date()) {
  return findUsableInvitation(db, token, now);
}

/**
 * Joins the workspace behind an invite link. Existing members keep their
 * current role, so an old "viewer" link can never downgrade anyone.
 */
export async function acceptInvitation(
  db: Database,
  userId: string,
  token: string,
  now = new Date(),
) {
  const found = await findUsableInvitation(db, token, now);
  await db
    .insert(membership)
    .values({ workspaceId: found.workspaceId, userId, role: found.role })
    .onConflictDoNothing();
  return { workspaceId: found.workspaceId };
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export async function listBoards(db: Database, userId: string, workspaceId: string) {
  await requireRole(db, userId, workspaceId);
  return db
    .select({ id: board.id, name: board.name, createdAt: board.createdAt })
    .from(board)
    .where(eq(board.workspaceId, workspaceId))
    .orderBy(asc(board.createdAt));
}

export async function createBoard(db: Database, userId: string, workspaceId: string, name: string) {
  const validName = parse(BoardName, name);
  const role = await requireRole(db, userId, workspaceId);
  if (!canEditBoard(role)) throw forbidden("Viewers can't create boards.");
  const [created] = await db
    .insert(board)
    .values({ workspaceId, name: validName, createdBy: userId })
    .returning();
  if (!created) throw new Error("Insert returned no row");
  return created;
}

export async function getBoard(db: Database, userId: string, boardId: string) {
  const [row] = await db
    .select({
      id: board.id,
      name: board.name,
      workspaceId: board.workspaceId,
      workspaceName: workspace.name,
      role: membership.role,
    })
    .from(board)
    .innerJoin(workspace, eq(workspace.id, board.workspaceId))
    .innerJoin(
      membership,
      and(eq(membership.workspaceId, board.workspaceId), eq(membership.userId, userId)),
    )
    .where(eq(board.id, boardId));
  if (!row) throw notFound("Board");
  return row;
}

// ---------------------------------------------------------------------------
// Guest accounts
// ---------------------------------------------------------------------------

/**
 * When a guest signs in with a real account, their workspaces move over.
 * If both accounts are in the same workspace, the stronger role wins.
 */
export async function transferMemberships(db: Database, fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) return;
  const strength: Record<Role, number> = { viewer: 0, member: 1, owner: 2 };
  await db.transaction(async (tx) => {
    const guestMemberships = await tx
      .select()
      .from(membership)
      .where(eq(membership.userId, fromUserId));

    for (const guest of guestMemberships) {
      const [existing] = await tx
        .select({ role: membership.role })
        .from(membership)
        .where(and(eq(membership.workspaceId, guest.workspaceId), eq(membership.userId, toUserId)));

      if (!existing) {
        await tx.insert(membership).values({ ...guest, userId: toUserId });
      } else if (strength[guest.role] > strength[existing.role]) {
        await tx
          .update(membership)
          .set({ role: guest.role })
          .where(
            and(eq(membership.workspaceId, guest.workspaceId), eq(membership.userId, toUserId)),
          );
      }
    }

    await tx.delete(membership).where(eq(membership.userId, fromUserId));
  });
}
