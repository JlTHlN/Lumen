import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { cacheEntries } from "@/db/schema";

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const rows = await db
      .select()
      .from(cacheEntries)
      .where(sql`${cacheEntries.key} = ${key} and ${cacheEntries.expiresAt} > now()`)
      .limit(1);
    if (!rows.length) return null;
    return rows[0].payload as T;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, payload: unknown, ttlSeconds: number) {
  try {
    const serialized = JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await db
      .insert(cacheEntries)
      .values({ key, payload: payload as never, bytes: serialized.length, expiresAt })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: { payload: payload as never, bytes: serialized.length, expiresAt, createdAt: new Date() },
      });
  } catch {
    /* cache writes are best-effort */
  }
}

export async function cacheStats() {
  try {
    const rows = await db
      .select({
        entries: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${cacheEntries.bytes}), 0)::bigint`,
      })
      .from(cacheEntries);
    const mediaRows = await db.execute<{ bytes: string }>(
      sql`select coalesce(sum(pg_total_relation_size('media_items')), 0)::text as bytes`,
    );
    const metaBytes = Number(mediaRows.rows?.[0]?.bytes ?? 0);
    return {
      entries: Number(rows[0]?.entries ?? 0),
      bytes: Number(rows[0]?.bytes ?? 0),
      metadataBytes: metaBytes,
    };
  } catch {
    return { entries: 0, bytes: 0, metadataBytes: 0 };
  }
}

export async function clearCache(scope: "all" | "metadata" | "discovery") {
  try {
    if (scope === "all") {
      await db.delete(cacheEntries);
      await db.execute(sql`update media_items set seasons = '[]'::jsonb where type = 'tv'`);
    } else if (scope === "discovery") {
      await db.delete(cacheEntries).where(sql`${cacheEntries.key} like 'discover:%'`);
    } else {
      await db.delete(cacheEntries);
    }
    await db.delete(cacheEntries).where(lt(cacheEntries.expiresAt, new Date()));
    return true;
  } catch {
    return false;
  }
}

export function humanBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${Math.round(bytes || 0)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}
