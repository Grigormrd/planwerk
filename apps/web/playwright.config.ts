import { defineConfig, devices } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * End-to-end tests run the whole stack locally:
 * - Postgres in Docker (in CI: a service container on the same port),
 * - the realtime Worker in workerd with a key pair generated for this run,
 * - a production build of the web app in its own folder (.next-e2e).
 */

const DB_PORT = 54329;
const WEB_PORT = 3100;
const REALTIME_PORT = 8788;
const isCI = !!process.env.CI;

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `postgres://postgres:postgres@localhost:${DB_PORT}/postgres`;

// Never run end-to-end tests against a real database.
if (!["localhost", "127.0.0.1"].includes(new URL(DATABASE_URL).hostname)) {
  throw new Error(`E2E tests must use a local database, got ${new URL(DATABASE_URL).hostname}`);
}

// The config is evaluated by the runner and again by each worker. Generate
// the keys once and hand them to the workers through the environment.
if (!process.env.E2E_REALTIME_PRIVATE_KEY) {
  // P-256 is the curve ES256 uses; Node exports both halves as JWK.
  const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.E2E_REALTIME_PRIVATE_KEY = JSON.stringify(pair.privateKey.export({ format: "jwk" }));
  const publicKey = JSON.stringify(pair.publicKey.export({ format: "jwk" }));
  mkdirSync("e2e/.generated", { recursive: true });
  writeFileSync("e2e/.generated/realtime.env", `REALTIME_TOKEN_PUBLIC_KEY='${publicKey}'\n`);
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: isCI ? 1 : 2,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // In CI the service container already listens on this port.
      command: `docker run --rm -e POSTGRES_PASSWORD=postgres -p ${DB_PORT}:5432 postgres:17-alpine`,
      port: DB_PORT,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `pnpm exec wrangler dev --port ${REALTIME_PORT} --env-file ../web/e2e/.generated/realtime.env --persist-to .wrangler/e2e-state`,
      cwd: "../realtime",
      url: `http://127.0.0.1:${REALTIME_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "node e2e/wait-for-db.mjs && node scripts/migrate.mjs && next build && next start",
      url: `http://localhost:${WEB_PORT}/sign-in`,
      reuseExistingServer: !isCI,
      timeout: 300_000,
      env: {
        PORT: String(WEB_PORT),
        NEXT_DIST_DIR: ".next-e2e",
        DATABASE_URL,
        DATABASE_URL_UNPOOLED: DATABASE_URL,
        BETTER_AUTH_URL: `http://localhost:${WEB_PORT}`,
        BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
        REALTIME_TOKEN_PRIVATE_KEY: process.env.E2E_REALTIME_PRIVATE_KEY!,
        // 127.0.0.1 avoids the IPv6 detour browsers take for "localhost".
        NEXT_PUBLIC_REALTIME_HOST: `127.0.0.1:${REALTIME_PORT}`,
        GITHUB_CLIENT_ID: "",
        GITHUB_CLIENT_SECRET: "",
      },
    },
  ],
});
