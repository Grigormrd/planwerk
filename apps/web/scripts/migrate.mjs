// Applies pending Drizzle migrations before `next build`.
//
// Runs only for production deployments on Vercel and for local builds with a
// database configured. Preview deployments skip it so that an unmerged pull
// request can never change the production schema.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const vercelEnv = process.env.VERCEL_ENV;

if (!url) {
  console.log("[migrate] No DATABASE_URL set, skipping migrations.");
  process.exit(0);
}
if (vercelEnv && vercelEnv !== "production") {
  console.log(`[migrate] Skipping migrations for the ${vercelEnv} environment.`);
  process.exit(0);
}

const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  console.log("[migrate] Database is up to date.");
} finally {
  await pool.end();
}
