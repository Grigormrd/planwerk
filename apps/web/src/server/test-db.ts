import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Database } from "./db";
import * as schema from "./db/schema";

let template: Promise<PGlite> | undefined;

/** Migrates one database per test file; every test gets a cheap clone of it. */
function migratedTemplate(): Promise<PGlite> {
  template ??= (async () => {
    const client = new PGlite();
    await migrate(drizzle({ client }), {
      migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    });
    return client;
  })();
  return template;
}

/**
 * A real Postgres (PGlite, in-process) with the production migrations applied.
 * Each call returns a fresh, isolated database.
 */
export async function createTestDb(): Promise<Database> {
  const client = (await (await migratedTemplate()).clone()) as PGlite;
  return drizzle({ client, schema }) as unknown as Database;
}

let counter = 0;

export async function createUser(db: Database, name = "User", isAnonymous = false) {
  counter += 1;
  const [created] = await db
    .insert(schema.user)
    .values({
      id: `user_${counter}_${Date.now()}`,
      name,
      email: `user${counter}.${Date.now()}@example.test`,
      isAnonymous,
    })
    .returning();
  if (!created) throw new Error("Insert returned no row");
  return created;
}
