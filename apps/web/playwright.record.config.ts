import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Records the animated preview in the README (`pnpm record-demo`): same local
 * stack as the end-to-end tests, but only runs `*.record.ts` files.
 */
export default defineConfig({
  ...base,
  testMatch: "**/*.record.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [["list"]],
});
