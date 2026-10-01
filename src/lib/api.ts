import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, { status: 200, ...init });
}

/**
 * Runs a database-backed handler, self-healing if the schema is missing.
 *
 * A fresh container can receive requests before (or instead of) the startup
 * bootstrap, so a failed query is retried once after creating the schema. This
 * turns "we couldn't load your dashboard" into a working request.
 */
export async function withDb<T>(handler: () => Promise<T>): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    try {
      const { ensureSchema, schemaStatus } = await import("@/db/startup");
      if (schemaStatus().ready) throw error;
      const result = await ensureSchema();
      if (!result.ready) throw error;
      return await handler();
    } catch {
      throw error;
    }
  }
}

/** Cache a public response in the browser/CDN for `seconds`, with longer SWR. */
export function okCached<T>(data: T, seconds = 30) {
  return NextResponse.json(data as object, {
    status: 200,
    headers: { "Cache-Control": `private, max-age=${seconds}, stale-while-revalidate=${Math.max(60, seconds * 10)}` },
  });
}


export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Never leak raw provider/stack errors to the client. */
export function safeMessage(error: unknown, fallback = "Something went wrong. Your library is still safe.") {
  if (error instanceof Error && error.name === "ProviderError") return fallback;
  return fallback;
}

export function asMediaType(value: string | null): "movie" | "tv" | "game" {
  return value === "tv" || value === "game" ? value : "movie";
}
