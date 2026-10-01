import { sql } from "drizzle-orm";
import { db } from "@/db";
import { pingDatabase, schemaStatus } from "@/db/startup";
import { BOOTSTRAP_STATEMENTS } from "@/db/schema.sql";

export const dynamic = "force-dynamic";

export async function GET() {
  const reachable = await pingDatabase();
  const schema = schemaStatus();

  // Self-heal: if the schema was never created (or the DB was swapped), try again.
  if (reachable && !schema.ready) {
    try {
      for (const statement of BOOTSTRAP_STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
      schema.ready = true;
      schema.error = undefined;
    } catch (error) {
      schema.error = error instanceof Error ? error.message : "Schema bootstrap failed";
    }
  }

  const body = {
    status: reachable && schema.ready ? "ok" : "degraded",
    database: reachable ? "connected" : "unavailable",
    schema: schema.ready ? "ready" : "missing",
    version: "1.1.0",
    time: new Date().toISOString(),
    ...(schema.error ? { detail: schema.error } : {}),
  };

  return Response.json(body, { status: reachable && schema.ready ? 200 : 503 });
}
