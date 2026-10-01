import { asMediaType, fail, ok } from "@/lib/api";
import { searchMedia } from "@/lib/providers";
import { getLibraryForMediaIds } from "@/lib/library";
import type { NormalizedMedia } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const type = asMediaType(url.searchParams.get("type"));
  if (query.length < 2) return ok({ items: [], offline: false, error: null });

  try {
    const result = await searchMedia(query, type);
    const entries = await getLibraryForMediaIds(result.items.map((item) => item.id));
    return ok({
      ...result,
      items: result.items.map((item: NormalizedMedia & { id: number }) => ({
        media: item,
        entry: entries.get(item.id) ?? null,
      })),
    });
  } catch {
    return fail("Search is unavailable right now. Try again in a moment.", 503, { items: [] });
  }
}
