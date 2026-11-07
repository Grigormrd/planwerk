import { describe, expect, it } from "vitest";
import { BoardName, WorkspaceName } from "./names";

describe("display names", () => {
  it("trims surrounding whitespace", () => {
    expect(WorkspaceName.parse("  Flat 3B  ")).toBe("Flat 3B");
  });

  it("rejects empty names with a readable message", () => {
    const result = BoardName.safeParse("   ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Board name is required.");
  });

  it("rejects names longer than 80 characters", () => {
    expect(WorkspaceName.safeParse("x".repeat(81)).success).toBe(false);
  });
});
