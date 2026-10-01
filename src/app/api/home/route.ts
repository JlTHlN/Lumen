import { fail, ok } from "@/lib/api";
import { getLibrary, getLists, getRecentActivity, getStats, getUpcoming, getUpNext, getUpcomingReleases } from "@/lib/library";
import { getDiscovery } from "@/lib/providers";
import { getSettings, publicSettings } from "@/lib/settings";
import { unreadCount } from "@/lib/notify";
import type { LibraryEntry, MediaType } from "@/lib/types";
import type { MediaWithId } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, library, upNext, upcoming, activity, movieStats, tvStats, gameStats, popMovies, popShows, popGames, upMovies, upGames, unread, allLists] =
      await Promise.all([
        getSettings(),
        getLibrary({ limit: 500 }),
        getUpNext(),
        getUpcoming(),
        getRecentActivity(10),
        getStats("movie"),
        getStats("tv"),
        getStats("game"),
        getDiscovery("movie", "popular"),
        getDiscovery("tv", "popular"),
        getDiscovery("game", "popular"),
        getUpcomingReleases("movie"),
        getUpcomingReleases("game"),
        unreadCount(),
        getLists(),
      ]);

    const entries = new Map<number, LibraryEntry | null>(library.map((item) => [item.media.id, item.entry]));
    const withEntries = (items: MediaWithId[]) =>
      items.slice(0, 14).map((item) => ({ media: item, entry: entries.get(item.id) ?? null }));
    const pick = (type: MediaType, statuses: string[], limit = 8) =>
      library.filter((item) => item.media.type === type && item.entry && statuses.includes(item.entry.status)).slice(0, limit);

    return ok({
      settings: publicSettings(settings),
      upNext: upNext.slice(0, 12),
      continueWatching: upNext.filter((item) => item.started).slice(0, 12),
      moviesPlaying: pick("movie", ["watching"]),
      gamesPlaying: pick("game", ["playing"]),
      recentlyWatched: pick("movie", ["watched"], 8),
      recentlyCompletedShows: pick("tv", ["completed"], 8),
      recentlyPlayed: pick("game", ["completed"], 8),
      favorites: library.filter((item) => item.entry?.favorite).slice(0, 14),
      upcomingEpisodes: upcoming,
      upcomingMovies: upMovies,
      upcomingGames: upGames,
      activity,
      popular: { movie: withEntries(popMovies.items), tv: withEntries(popShows.items), game: withEntries(popGames.items) },
      providerError: popMovies.error ?? popShows.error ?? popGames.error,
      offline: popMovies.offline || popShows.offline || popGames.offline,
      stats: { movie: movieStats, tv: tvStats, game: gameStats },
      unread,
      counts: { movie: movieStats.tracked, tv: tvStats.tracked, game: gameStats.tracked },
      listsCount: allLists.length,
      ratedCount: movieStats.ratings + tvStats.ratings + gameStats.ratings,
      watchedCount:
        Number((movieStats as Record<string, unknown>).watched ?? 0) +
        Number((tvStats as Record<string, unknown>).episodesWatched ?? 0) +
        Number((gameStats as Record<string, unknown>).gamesCompleted ?? 0),
    });
  } catch {
    return fail("We couldn't load your dashboard right now.", 503);
  }
}
