import { fail, ok } from "@/lib/api";
import { getUpcoming, getUpNext } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [upNext, upcoming] = await Promise.all([getUpNext(), getUpcoming()]);
    return ok({ upNext, upcoming });
  } catch {
    return fail("We couldn't load your watchlist right now.", 503, { upNext: [], upcoming: [] });
  }
}
