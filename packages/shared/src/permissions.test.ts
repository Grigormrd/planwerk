import { describe, expect, it } from "vitest";
import { canEditBoard, canManageMembers, workspaceRoles } from "./permissions";

describe("permissions", () => {
  it.each([
    ["owner", true, true],
    ["member", true, false],
    ["viewer", false, false],
  ] as const)("%s → edit: %s, manage members: %s", (role, edit, manage) => {
    expect(canEditBoard(role)).toBe(edit);
    expect(canManageMembers(role)).toBe(manage);
  });

  it("covers every role", () => {
    expect(workspaceRoles).toEqual(["owner", "member", "viewer"]);
  });
});
