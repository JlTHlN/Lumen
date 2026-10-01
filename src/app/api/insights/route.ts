import { fail, ok } from "@/lib/api";
import { getAchievements, getFunFact, getHeatmap, getRecap, getStreak, MOODS, pickForMe, type MoodId } from "@/lib/insights";
import { asMediaType } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "achievements";

  try {
    if (view === "achievements") {
      const [achievements, streak] = await Promise.all([getAchievements(), getStreak()]);
      return ok({ ...achievements, streak, moods: MOODS.map(({ id, label }) => ({ id, label })) });
    }
    if (view === "recap") {
      const yearParam = Number(url.searchParams.get("year") ?? "");
      const recap = await getRecap(Number.isFinite(yearParam) && yearParam > 0 ? yearParam : undefined);
      const [achievements, streak] = await Promise.all([getAchievements(), getStreak()]);
      return ok({ recap, achievements, streak });
    }
    if (view === "heatmap") {
      const weeks = Math.min(52, Math.max(8, Number(url.searchParams.get("weeks") ?? 26) || 26));
      const [heatmap, streak, fact] = await Promise.all([getHeatmap(weeks), getStreak(), getFunFact()]);
      return ok({ heatmap, streak, fact });
    }
    if (view === "pick") {
      const mood = (url.searchParams.get("mood") ?? "any") as MoodId;
      const typeParam = url.searchParams.get("type");
      const pick = await pickForMe(mood, typeParam ? asMediaType(typeParam) : undefined);
      return ok({
        pick,
        moods: MOODS.map(({ id, label }) => ({ id, label })),
        message: pick ? null : "Add something to your watchlist first, then I can pick for you.",
      });
    }
    if (view === "fact") {
      return ok({ fact: await getFunFact() });
    }
    return fail("Unknown view");
  } catch {
    return fail("We couldn't build your insights right now.", 503);
  }
}
