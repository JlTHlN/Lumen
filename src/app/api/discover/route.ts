import { asMediaType, fail, okCached } from "@/lib/api";
import { getDiscovery } from "@/lib/providers";
import { getLibraryForMediaIds, getRecommended } from "@/lib/library";
import type { DiscoveryKind, MediaType, NormalizedMedia } from "@/lib/types";

export const dynamic = "force-dynamic";

function toPayload(items: Array<NormalizedMedia & { id: number }>, entries: Map<number, unknown>) {
  return items.map((item) => ({ media: item, entry: entries.get(item.id) ?? null }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = asMediaType(url.searchParams.get("type"));
  const kind = (url.searchParams.get("kind") ?? "popular") as DiscoveryKind;
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    if (kind === "recommended") {
      const { topGenres, candidates } = await getRecommended(type);
      if (candidates.length >= 4) {
        const entries = await getLibraryForMediaIds(candidates.map((item) => item.id));
        return okCached({ items: toPayload(candidates, entries), topGenres, offline: false, error: null }, 60);
      }
      const fallback = await getDiscovery(type, "popular", refresh);
      const entries = await getLibraryForMediaIds(fallback.items.map((item) => item.id));
      return okCached({ items: toPayload(fallback.items, entries), topGenres: [], offline: fallback.offline, error: fallback.error }, 60);
    }

    const result = await getDiscovery(type, kind, refresh);
    const entries = await getLibraryForMediaIds(result.items.map((item) => item.id));
    return okCached({ items: toPayload(result.items, entries), topGenres: [], offline: result.offline, error: result.error }, 60);
  } catch {
    return fail("Unable to load this information right now.", 503, { items: [] });
  }
}
