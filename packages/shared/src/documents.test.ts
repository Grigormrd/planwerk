import { describe, expect, it } from "vitest";
import { boardDocumentName, parseBoardDocumentName } from "./documents";

const id = "3f1c2b7e-8a4d-4c9e-9b1a-2d5e6f7a8b9c";

describe("board document names", () => {
  it("round-trips a board id", () => {
    expect(parseBoardDocumentName(boardDocumentName(id))).toBe(id);
  });

  it("rejects names with a different prefix", () => {
    expect(parseBoardDocumentName(`workspace:${id}`)).toBeNull();
  });

  it("rejects malformed ids", () => {
    expect(parseBoardDocumentName("board:not-a-uuid")).toBeNull();
    expect(parseBoardDocumentName("board:")).toBeNull();
  });

  it("refuses to build a name from an invalid id", () => {
    expect(() => boardDocumentName("nope")).toThrow();
  });
});
