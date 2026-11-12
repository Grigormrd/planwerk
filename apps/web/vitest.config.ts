import { defineConfig } from "vitest/config";

// Unit and integration tests live next to the code; e2e/ belongs to Playwright.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The first test in a file starts PGlite and runs the migrations, which
    // can take longer than the default 10 s on shared CI runners.
    hookTimeout: 30_000,
  },
});
