import { describe, expect, it } from "vitest";
import { parseBoardId } from "./boards";

describe("parseBoardId", () => {
  it("accepts a UUID", () => {
    const id = "3f1c2b7e-8a4d-4c9e-9b1a-2d5e6f7a8b9c";
    expect(parseBoardId(id)).toBe(id);
  });

  it.each(["", "not-a-uuid", "board:3f1c2b7e-8a4d-4c9e-9b1a-2d5e6f7a8b9c", "../secrets"])(
    "rejects %j",
    (value) => {
      expect(parseBoardId(value)).toBeNull();
    },
  );
});
