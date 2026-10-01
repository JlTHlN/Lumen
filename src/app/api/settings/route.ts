import { fail, ok } from "@/lib/api";
import { getSettings, publicSettings, saveSettings } from "@/lib/settings";
import { cacheStats, clearCache, humanBytes } from "@/lib/cache";
import { igdbProvider, rawgProvider, tmdbProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();
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
    if (body.action === "clear_cache") {
      const scope = (body.patch?.scope as string) ?? "all";
      await clearCache(scope === "images" ? "discovery" : (scope as "all" | "metadata" | "discovery"));
      const cache = await cacheStats();
      return ok({ cleared: true, cache: { ...cache, cacheHuman: humanBytes(cache.bytes) } });
    }

    const settings = await saveSettings(body.patch ?? {});
    return ok({ settings: publicSettings(settings) });
  } catch {
    return fail("We couldn't save that setting.", 500);
  }
}
