import { describe, expect, it } from "vitest";
import { PRESENCE_COLORS, presenceColor } from "./presence";

describe("presenceColor", () => {
  it("is stable for the same user", () => {
    expect(presenceColor("user_123")).toBe(presenceColor("user_123"));
  });

  it("always returns a colour from the palette", () => {
    for (const id of ["", "a", "user_1", "x".repeat(200), "ünïcødé"]) {
      expect(PRESENCE_COLORS).toContain(presenceColor(id));
    }
  });

  it("spreads users across the palette", () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => presenceColor(`user_${i}`)));
    expect(used.size).toBe(PRESENCE_COLORS.length);
  });
});
