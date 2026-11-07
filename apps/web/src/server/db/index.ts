import { Pool } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: Neon in the app, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Database | undefined;

/**
 * Created lazily so that `next build` works without DATABASE_URL.
 * Uses Neon's WebSocket pool, which supports interactive transactions.
 */
export function getDb(): Database {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Run `vercel env pull` in apps/web.");
    }
    db = drizzle({ client: new Pool({ connectionString }), schema });
  }
  return db;
}

export { schema };
