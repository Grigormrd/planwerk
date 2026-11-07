import { canEditBoard, canManageMembers, type WorkspaceRole } from "@planwerk/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar, Card, inputClass, RoleBadge, SectionTitle, Skeleton } from "@/components/ui";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { requireUser } from "@/server/session";
import * as workspaces from "@/server/workspaces";
import {
  changeRoleAction,
  createBoardAction,
  removeMemberAction,
  revokeInviteAction,
} from "../../actions";
import { InviteForm } from "./invite-form";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

async function Boards({ workspaceId, role }: { workspaceId: string; role: WorkspaceRole }) {
  const user = await requireUser();
  const boards = await workspaces.listBoards(getDb(), user.id, workspaceId);
  return (
    <Card>
      <SectionTitle>Boards</SectionTitle>
      {boards.length === 0 ? (
        <p className="mb-4 text-sm text-foreground/60">No boards yet.</p>
      ) : (
        <ul className="mb-4 grid gap-2 sm:grid-cols-2">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/app/b/${b.id}`}
                className="block rounded-lg border border-foreground/10 p-4 font-medium transition hover:border-foreground/30"
              >
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canEditBoard(role) && (
        <ActionForm action={createBoardAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <label htmlFor="board-name" className="sr-only">
            Board name
          </label>
          <input
            id="board-name"
            name="name"
            required
            maxLength={80}
            placeholder="New board, e.g. Groceries"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <SubmitButton variant="secondary" pendingLabel="Adding…">
            Add board
          </SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}

async function Members({ workspaceId, role }: { workspaceId: string; role: WorkspaceRole }) {
  const user = await requireUser();
  const db = getDb();
  const [members, invitations] = await Promise.all([
    workspaces.listMembers(db, user.id, workspaceId),
    workspaces.listInvitations(db, user.id, workspaceId),
  ]);
  const isOwner = canManageMembers(role);

  return (
    <Card>
      <SectionTitle>Members</SectionTitle>
      <ul className="flex flex-col divide-y divide-foreground/10">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
            <Avatar name={m.name} image={m.image} />
            <span className="flex min-w-32 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {m.name}
                {m.userId === user.id && <span className="text-foreground/50"> (you)</span>}
              </span>
              {m.isGuest && <span className="text-xs text-foreground/50">Guest</span>}
            </span>
            {isOwner ? (
              <ActionForm action={changeRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="userId" value={m.userId} />
                <label htmlFor={`role-${m.userId}`} className="sr-only">
                  Role of {m.name}
                </label>
                <select
                  id={`role-${m.userId}`}
                  name="role"
                  defaultValue={m.role}
                  className={`${inputClass} w-auto py-1`}
                >
                  <option value="owner">Owner</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <SubmitButton variant="ghost">Save</SubmitButton>
              </ActionForm>
            ) : (
              <RoleBadge role={m.role} />
            )}
            {(isOwner || m.userId === user.id) && (
              <ActionForm action={removeMemberAction}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="userId" value={m.userId} />
                <SubmitButton variant="ghost">
                  {m.userId === user.id ? "Leave" : "Remove"}
                </SubmitButton>
              </ActionForm>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="mt-5 flex flex-col gap-4 border-t border-foreground/10 pt-5">
          <InviteForm workspaceId={workspaceId} />
          {invitations.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 text-foreground/70">
                  <RoleBadge role={inv.role} />
                  <span className="flex-1">
                    Invite link, valid until {dateFormat.format(inv.expiresAt)}
                  </span>
                  <ActionForm action={revokeInviteAction}>
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <SubmitButton variant="ghost">Revoke</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

async function WorkspaceContent({ params }: PageProps<"/app/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const user = await requireUser(`/app/w/${workspaceId}`);

  const ws = await workspaces.getWorkspace(getDb(), user.id, workspaceId).catch((error) => {
    // Unknown ids and malformed UUIDs both look like a missing workspace.
    if (error instanceof DomainError || /uuid/i.test(String(error))) notFound();
    throw error;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app" className="text-sm text-foreground/50 hover:text-foreground">
          Workspaces
        </Link>
        <span className="text-foreground/30">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
        <RoleBadge role={ws.role} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Suspense fallback={<Skeleton />}>
          <Boards workspaceId={ws.id} role={ws.role} />
        </Suspense>
        <Suspense fallback={<Skeleton />}>
          <Members workspaceId={ws.id} role={ws.role} />
        </Suspense>
      </div>
    </div>
  );
}

export default function WorkspacePage(props: PageProps<"/app/w/[workspaceId]">) {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <WorkspaceContent {...props} />
    </Suspense>
  );
}
