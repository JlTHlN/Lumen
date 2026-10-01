import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import { bootstrapSchema } from "./schema.sql";

export interface StartupResult {
  database: boolean;
  schema: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True once the server accepts queries. */
export async function waitForDatabase(timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown error";
      // Postgres is often still initialising on first boot of a new volume.
      if (attempt % 5 === 0) {
        console.log(`[startup] database not ready (attempt ${attempt}): ${lastError}`);
      }
      await sleep(1500);
    }
  }
  console.error(`[startup] gave up waiting for the database: ${lastError}`);
  return false;
}

export interface SchemaStatus {
  ready: boolean;
  error?: string;
}

/** Cached so the dashboard can report schema state without re-running DDL. */
const globalForSchema = globalThis as typeof globalThis & {
  __schemaStatus?: SchemaStatus;
  __schemaPromise?: Promise<SchemaStatus>;
};

export function schemaStatus(): SchemaStatus {
  return globalForSchema.__schemaStatus ?? { ready: false, error: "Startup has not completed yet." };
}

/**
 * Creates the schema if it is missing, then caches the result.
 *
 * Every deployment — brand new or years old — runs this on boot, so upgrading
 * never requires a manual migration step.
 */
export async function ensureSchema(): Promise<SchemaStatus> {
  if (globalForSchema.__schemaStatus?.ready) return globalForSchema.__schemaStatus;
  if (globalForSchema.__schemaPromise) return globalForSchema.__schemaPromise;

  globalForSchema.__schemaPromise = (async () => {
    const result = await bootstrapSchema();
    const status: SchemaStatus = result.ok
      ? { ready: true }
      : { ready: false, error: result.error };
    globalForSchema.__schemaStatus = status;
    globalForSchema.__schemaPromise = undefined;
    if (!result.ok) {
      console.error("[startup] schema bootstrap failed:", result.error);
    }
    return status;
  })();

  return globalForSchema.__schemaPromise;
}

/**
 * Full startup sequence: wait for Postgres, then create the schema.
 * Never throws — failures are reported through the health endpoint so the UI
 * can show something useful instead of a broken dashboard.
 */
export async function runStartup(): Promise<StartupResult> {
  const databaseUp = await waitForDatabase();
  if (!databaseUp) {
    return { database: false, schema: false, error: "Could not reach the database." };
  }
  const schema = await ensureSchema();
  return { database: true, schema: schema.ready, error: schema.error };
}

/** Used by the health endpoint for a live check. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export { pool };
