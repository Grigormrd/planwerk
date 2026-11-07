"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { requireUser } from "@/server/session";
import * as workspaces from "@/server/workspaces";

export type ActionState = { error?: string; inviteUrl?: string } | null;

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

/** Runs a domain operation and turns expected failures into a message for the form. */
async function attempt(operation: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await operation()) ?? null;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export async function createWorkspaceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let workspaceId: string | undefined;
  const result = await attempt(async () => {
    workspaceId = (await workspaces.createWorkspace(getDb(), user.id, field(form, "name"))).id;
  });
  if (workspaceId) redirect(`/app/w/${workspaceId}`);
  return result;
}

export async function createBoardAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const workspaceId = field(form, "workspaceId");
  return attempt(async () => {
    await workspaces.createBoard(getDb(), user.id, workspaceId, field(form, "name"));
    revalidatePath(`/app/w/${workspaceId}`);
  });
}

export async function createInviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const workspaceId = field(form, "workspaceId");
  return attempt(async () => {
    const { token } = await workspaces.createInvitation(
      getDb(),
      user.id,
      workspaceId,
      field(form, "role"),
    );
    revalidatePath(`/app/w/${workspaceId}`);
    return { inviteUrl: `${await origin()}/invite/${token}` };
  });
}

export async function revokeInviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const workspaceId = field(form, "workspaceId");
  return attempt(async () => {
    await workspaces.revokeInvitation(getDb(), user.id, workspaceId, field(form, "invitationId"));
    revalidatePath(`/app/w/${workspaceId}`);
  });
}

export async function changeRoleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const workspaceId = field(form, "workspaceId");
  return attempt(async () => {
    await workspaces.changeMemberRole(
      getDb(),
      user.id,
      workspaceId,
      field(form, "userId"),
      field(form, "role"),
    );
    revalidatePath(`/app/w/${workspaceId}`);
  });
}

export async function removeMemberAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const workspaceId = field(form, "workspaceId");
  const targetUserId = field(form, "userId");
  const result = await attempt(async () => {
    await workspaces.removeMember(getDb(), user.id, workspaceId, targetUserId);
  });
  if (result?.error) return result;
  if (targetUserId === user.id) redirect("/app");
  revalidatePath(`/app/w/${workspaceId}`);
  return null;
}

export async function acceptInviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const token = field(form, "token");
  const user = await requireUser(`/invite/${token}`);
  let workspaceId: string | undefined;
  const result = await attempt(async () => {
    ({ workspaceId } = await workspaces.acceptInvitation(getDb(), user.id, token));
  });
  if (workspaceId) redirect(`/app/w/${workspaceId}`);
  return result;
}
