import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, { status: 200, ...init });
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
