import { Pool as NeonPool } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: Neon in the app, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Database | undefined;

/**
 * Neon speaks Postgres over WebSockets, which a plain local Postgres (used
 * by the end-to-end tests) does not. Local hosts get the standard driver.
 */
export function isLocalDatabase(connectionString: string): boolean {
  const { hostname } = new URL(connectionString);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Created lazily so that `next build` works without DATABASE_URL.
 * Both drivers support interactive transactions.
 */
export function getDb(): Database {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Run `vercel env pull` in apps/web.");
    }
    db = isLocalDatabase(connectionString)
      ? (drizzlePg({ client: new PgPool({ connectionString }), schema }) as unknown as Database)
      : drizzleNeon({ client: new NeonPool({ connectionString }), schema });
  }
  return db;
}

export { schema };
