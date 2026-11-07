import { z } from "zod";

export const workspaceRoles = ["owner", "member", "viewer"] as const;

export const WorkspaceRole = z.enum(workspaceRoles);
export type WorkspaceRole = z.infer<typeof WorkspaceRole>;

/** Members and owners may change board content; viewers are read-only. */
export function canEditBoard(role: WorkspaceRole): boolean {
  return role === "owner" || role === "member";
}

/** Only owners may invite, remove or re-assign members. */
export function canManageMembers(role: WorkspaceRole): boolean {
  return role === "owner";
}
