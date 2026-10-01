import { asMediaType, fail, okCached } from "@/lib/api";
import { getStats } from "@/lib/library";
import { getRecommended } from "@/lib/library";
import { getLibraryForMediaIds } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = asMediaType(url.searchParams.get("type"));
  try {
    const stats = await getStats(type);
    const recommended = await getRecommended(type);
    const entries = await getLibraryForMediaIds(recommended.candidates.map((item) => item.id));
    return okCached({
      stats,
      topGenres: recommended.topGenres,
      recommended: recommended.candidates.map((item) => ({ media: item, entry: entries.get(item.id) ?? null })),
    }, 15);
  } catch {
    return fail("We couldn't calculate your statistics right now.", 503);
  }
}
