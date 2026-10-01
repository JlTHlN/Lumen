import { fail, ok, withDb } from "@/lib/api";
import { getSettings, publicSettings, saveSettings } from "@/lib/settings";
import { cacheStats, clearCache, humanBytes } from "@/lib/cache";
import { igdbProvider, rawgProvider, tmdbProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Explains why a save failed instead of an opaque error. */
async function describeSaveProblem(error: unknown): Promise<string> {
  try {
    const { schemaStatus, pingDatabase } = await import("@/db/startup");
    if (!(await pingDatabase())) {
      return "Can't reach the database, so nothing was saved. Check the db service and reload.";
    }
    const status = schemaStatus();
    if (!status.ready) {
      return `Settings can't be saved because the database tables are missing. ${status.error ?? ""} Restart the app container to run setup.`.trim();
    }
  } catch {
    /* fall through */
  }
  void error;
  return "We couldn't save that setting. Your library is unaffected — try again.";
}

export async function GET() {
  try {
    const settings = await withDb(getSettings);
    const cache = await cacheStats();
    const [tmdb, igdb, rawg] = await Promise.all([
      tmdbProvider.isConfigured(),
      igdbProvider.isConfigured(),
      rawgProvider.isConfigured(),
    ]);
    return ok({
      settings: publicSettings(settings),
      system: {
        cacheEntries: cache.entries,
        cacheBytes: cache.bytes,
        cacheHuman: humanBytes(cache.bytes),
        metadataBytes: humanBytes(cache.metadataBytes),
        providers: { tmdb, igdb, rawg },
        version: "1.0.0",
      },
    });
  } catch {
    return fail("We couldn't load your settings.", 503);
  }
}

interface Body {
  scope: string;
  patch: Record<string, unknown>;
  action?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("Invalid request");
  }

  try {
    await withDb(async () => getSettings());
    if (body.action === "clear_cache") {
      const scope = (body.patch?.scope as string) ?? "all";
      await clearCache(scope === "images" ? "discovery" : (scope as "all" | "metadata" | "discovery"));
      const cache = await cacheStats();
      return ok({ cleared: true, cache: { ...cache, cacheHuman: humanBytes(cache.bytes) } });
    }

    const saved = await withDb(() => saveSettings(body.patch ?? {}));
    return ok({ settings: publicSettings(saved) });
  } catch (error) {
    return fail(await describeSaveProblem(error), 503);
  }
}
