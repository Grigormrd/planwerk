// Docker publishes the port before Postgres accepts connections. Wait until
// a query succeeds (up to 60 s) so migrations do not fail on startup.
import pg from "pg";

const url = process.env.DATABASE_URL;
const deadline = Date.now() + 60_000;

for (;;) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    console.log("[e2e] Database is ready.");
    break;
  } catch (error) {
    await client.end().catch(() => {});
    if (Date.now() > deadline) {
      console.error("[e2e] Database did not become ready:", error.message);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
