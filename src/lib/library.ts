import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  cacheEntries,
  episodeRecords,
  libraryItems,
  listItems,
  lists,
  mediaItems,
  notifications,
  watchEvents,
} from "@/db/schema";
import { readCache, writeCache } from "./cache";
import { getSeasonEpisodes, isOngoingMeta } from "./providers";
import { ACTIVE_STATUSES, type MediaType } from "./types";
import type { LibraryEntry, LibraryMedia, MediaRecord } from "./types";

type MediaRow = typeof mediaItems.$inferSelect;
type EntryRow = typeof libraryItems.$inferSelect;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toMediaRecord(row: MediaRow): MediaRecord {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.externalId,
    type: row.type as MediaType,
    title: row.title,
    originalTitle: row.originalTitle,
    year: row.year,
    releaseDate: row.releaseDate,
    overview: row.overview,
    posterUrl: row.posterUrl,
    backdropUrl: row.backdropUrl,
    trailerUrl: row.trailerUrl,
    genres: row.genres ?? [],
    externalRating: row.externalRating,
    runtime: row.runtime,
    popularity: row.popularity,
    metadata: row.metadata ?? {},
    seasons: row.seasons ?? [],
  };
}

export function toLibraryEntry(row: EntryRow | undefined | null): LibraryEntry | null {
  if (!row) return null;
  return {
    id: row.id,
    mediaId: row.mediaId,
    status: row.status,
    rating: row.rating,
    liked: row.liked,
    favorite: row.favorite,
    notes: row.notes,
    platform: row.platform,
    playtimeHours: row.playtimeHours,
    startedOn: row.startedOn,
    completedOn: row.completedOn,
    timesWatched: row.timesWatched,
    lastWatchedAt: row.lastWatchedAt ? row.lastWatchedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function isOngoing(media: Pick<MediaRecord, "metadata">): boolean {
  return isOngoingMeta(media.metadata);
}

export async function getEntry(mediaId: number) {
  const rows = await db.select().from(libraryItems).where(eq(libraryItems.mediaId, mediaId)).limit(1);
  return rows[0];
}

export async function recordActivity(media: MediaRecord, action: string, detail?: string) {
  await db.insert(activityLog).values({
    mediaId: media.id,
    mediaType: media.type,
    title: media.title,
    action,
    detail: detail ?? null,
    posterUrl: media.posterUrl,
  });
}

export async function saveEntry(mediaId: number, patch: Partial<typeof libraryItems.$inferInsert>) {
  const [row] = await db
    .insert(libraryItems)
    .values({ mediaId, status: "want_to_watch", ...patch })
    .onConflictDoUpdate({
      target: libraryItems.mediaId,
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function countWatches(mediaId: number) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(watchEvents)
    .where(eq(watchEvents.mediaId, mediaId));
  return Number(row?.value ?? 0);
}

export function defaultStatus(type: MediaType) {
  return type === "game" ? "backlog" : "want_to_watch";
}

/** Shared status logic used by the web app and the Telegram bot. */
export async function applyStatus(
  media: MediaRecord,
  status: string,
  extra: Partial<typeof libraryItems.$inferInsert> = {},
) {
  const existing = await getEntry(media.id);
  const patch: Partial<typeof libraryItems.$inferInsert> = { status, ...extra };
  if (media.type === "game" && status === "playing" && !existing?.startedOn && !patch.startedOn) patch.startedOn = today();
  if (media.type === "game" && status === "completed" && !existing?.completedOn && !patch.completedOn) patch.completedOn = today();
  if (media.type === "movie" && status === "watched" && !(existing?.timesWatched ?? 0)) {
    await db.insert(watchEvents).values({ mediaId: media.id });
    patch.timesWatched = await countWatches(media.id);
    patch.lastWatchedAt = new Date();
  }
  const row = await saveEntry(media.id, patch);
  if (!existing || existing.status !== status) {
    const { statusLabel } = await import("./types");
    await recordActivity(media, "status", statusLabel(status));
  }
  if (media.type === "tv") await invalidateUpcoming();
  return row;
}

/** Log a (re)watch / completion event for a movie or game. */
export async function logWatch(media: MediaRecord, options: { rewatch?: boolean; date?: string } = {}) {
  const existing = await getEntry(media.id);
  const watchedOn = options.date || today();
  const at = new Date(`${watchedOn}T12:00:00Z`);
  const occurredAt = Number.isNaN(at.getTime()) ? new Date() : at;
  await db.insert(watchEvents).values({ mediaId: media.id, occurredAt, note: options.rewatch ? "rewatch" : null });
  const row = await saveEntry(media.id, {
    status: media.type === "game" ? "completed" : "watched",
    timesWatched: await countWatches(media.id),
    lastWatchedAt: occurredAt,
    startedOn: existing?.startedOn ?? watchedOn,
    completedOn: media.type === "game" ? watchedOn : existing?.completedOn ?? null,
  });
  await recordActivity(media, media.type === "game" ? "completed" : "watched", `${options.rewatch ? "Rewatched" : media.type === "game" ? "Completed" : "Watched"} on ${watchedOn}`);
  return row;
}

export async function removeEntry(mediaId: number) {
  await Promise.all([
    db.delete(libraryItems).where(eq(libraryItems.mediaId, mediaId)),
    db.delete(episodeRecords).where(eq(episodeRecords.mediaId, mediaId)),
    db.delete(watchEvents).where(eq(watchEvents.mediaId, mediaId)),
  ]);
}

export async function episodeProgress(mediaId: number) {
  return db
    .select({ season: episodeRecords.season, episode: episodeRecords.episode })
    .from(episodeRecords)
    .where(and(eq(episodeRecords.mediaId, mediaId), eq(episodeRecords.watched, true)));
}

export function totalEpisodes(media: MediaRecord) {
  return (media.seasons ?? []).reduce((sum, season) => sum + (season.episodeCount || 0), 0);
}

function sortedSeasons(media: MediaRecord) {
  return [...(media.seasons ?? [])].sort((a, b) => a.seasonNumber - b.seasonNumber);
}

/** Next episode after the furthest one watched; falls back to the earliest gap. */
export function nextUnwatched(
  media: MediaRecord,
  watched: Array<{ season: number; episode: number }>,
): { season: number; episode: number } | null {
  const seen = new Set(watched.map((row) => `${row.season}-${row.episode}`));
  const furthest = watched.reduce(
    (max, row) => Math.max(max, row.season * 10000 + row.episode),
    0,
  );
  let firstGap: { season: number; episode: number } | null = null;
  for (const season of sortedSeasons(media)) {
    for (let index = 1; index <= (season.episodeCount || 0); index += 1) {
      if (seen.has(`${season.seasonNumber}-${index}`)) continue;
      const candidate = { season: season.seasonNumber, episode: index };
      if (season.seasonNumber * 10000 + index > furthest) return candidate;
      firstGap ??= candidate;
    }
  }
  return firstGap;
}

export async function refreshTvStatus(media: MediaRecord) {
  const [watched, entry] = await Promise.all([episodeProgress(media.id), getEntry(media.id)]);
  if (!entry || entry.status === "dropped") return; // manual "dropped" is never overridden
  const total = totalEpisodes(media);
  const allWatched = total > 0 && watched.length >= total;
  const patch: Partial<typeof libraryItems.$inferInsert> = {};
  if (allWatched && !isOngoing(media)) {
    if (entry.status !== "completed") {
      patch.status = "completed";
      patch.completedOn = entry.completedOn ?? today();
    }
  } else if (watched.length > 0 && ["want_to_watch", "completed", "on_hold"].includes(entry.status)) {
    patch.status = "watching";
  }
  if (Object.keys(patch).length) {
    await db.update(libraryItems).set({ ...patch, updatedAt: new Date() }).where(eq(libraryItems.id, entry.id));
  }
}

/** Batch mark/unmark episodes, then recompute status once. */
export async function setEpisodesWatched(
  media: MediaRecord,
  episodes: Array<{ season: number; episode: number }>,
  watched: boolean,
) {
  if (!episodes.length) return;
  const now = new Date();
  if (watched) {
    const before = new Set((await episodeProgress(media.id)).map((row) => `${row.season}-${row.episode}`));
    await db
      .insert(episodeRecords)
      .values(episodes.map((ep) => ({ mediaId: media.id, season: ep.season, episode: ep.episode, watched: true, watchedAt: now })))
      .onConflictDoUpdate({
        target: [episodeRecords.mediaId, episodeRecords.season, episodeRecords.episode],
        set: { watched: true, watchedAt: sql`coalesce(${episodeRecords.watchedAt}, now())`, updatedAt: now },
      });
    const fresh = episodes.filter((ep) => !before.has(`${ep.season}-${ep.episode}`));
    if (fresh.length) {
      await db.insert(watchEvents).values(fresh.map((ep) => ({ mediaId: media.id, season: ep.season, episode: ep.episode, occurredAt: now })));
    }
    await saveEntry(media.id, { lastWatchedAt: now });
  } else {
    const bySeason = new Map<number, number[]>();
    for (const ep of episodes) bySeason.set(ep.season, [...(bySeason.get(ep.season) ?? []), ep.episode]);
    for (const [season, numbers] of bySeason) {
      const where = and(
        eq(episodeRecords.mediaId, media.id),
        eq(episodeRecords.season, season),
        inArray(episodeRecords.episode, numbers),
      );
      await db.update(episodeRecords).set({ watched: false, watchedAt: null, updatedAt: now }).where(where);
      await db
        .delete(watchEvents)
        .where(and(eq(watchEvents.mediaId, media.id), eq(watchEvents.season, season), inArray(watchEvents.episode, numbers)));
    }
    await saveEntry(media.id, {});
  }
  await refreshTvStatus(media);
  await invalidateUpcoming();
}

export async function setEpisodeWatched(media: MediaRecord, season: number, episode: number, watched: boolean) {
  await setEpisodesWatched(media, [{ season, episode }], watched);
}

function airedFilter(airDate: string | null | undefined) {
  return !airDate || airDate <= today();
}

export async function setSeasonWatched(media: MediaRecord, season: number, watched: boolean) {
  const { episodes } = await getSeasonEpisodes(media.provider, media.externalId, season, media.id, {
    ongoing: isOngoing(media),
  });
  const list = episodes.filter((ep) => !watched || airedFilter(ep.airDate));
  await setEpisodesWatched(media, list.map((ep) => ({ season: ep.season, episode: ep.episode })), watched);
}

/** Mark every aired episode of the show watched. */
export async function setShowWatched(media: MediaRecord) {
  const ongoing = isOngoing(media);
  const all: Array<{ season: number; episode: number }> = [];
  for (const season of sortedSeasons(media)) {
    if (season.airDate && season.airDate > today()) continue;
    const { episodes } = await getSeasonEpisodes(media.provider, media.externalId, season.seasonNumber, media.id, { ongoing });
    for (const ep of episodes) if (airedFilter(ep.airDate)) all.push({ season: ep.season, episode: ep.episode });
  }
  await setEpisodesWatched(media, all, true);
}

/** Mark everything up to and including an episode (TV Time style "watched up to here"). */
export async function markUpTo(media: MediaRecord, season: number, episode: number) {
  const list: Array<{ season: number; episode: number }> = [];
  for (const entry of sortedSeasons(media)) {
    if (entry.seasonNumber > season) break;
    const limit = entry.seasonNumber === season ? episode : entry.episodeCount;
    for (let index = 1; index <= limit; index += 1) list.push({ season: entry.seasonNumber, episode: index });
  }
  await setEpisodesWatched(media, list, true);
}

export interface LibraryQuery {
  type?: MediaType;
  status?: string[];
  favoritesOnly?: boolean;
  search?: string;
  limit?: number;
}

/** Library with TV progress computed in a single extra query (no N+1). */
export async function getLibrary(query: LibraryQuery = {}): Promise<LibraryMedia[]> {
  const conditions = [];
  if (query.type) conditions.push(eq(mediaItems.type, query.type));
  if (query.status?.length) conditions.push(inArray(libraryItems.status, query.status));
  if (query.favoritesOnly) conditions.push(eq(libraryItems.favorite, true));
  if (query.search) conditions.push(sql`${mediaItems.title} ilike ${`%${query.search}%`}`);

  const rows = await db
    .select({ media: mediaItems, entry: libraryItems })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(libraryItems.updatedAt))
    .limit(query.limit ?? 300);

  const tvIds = rows.filter((row) => row.media.type === "tv").map((row) => row.media.id);
  const progress = new Map<number, Array<{ season: number; episode: number }>>();
  if (tvIds.length) {
    const eps = await db
      .select({ mediaId: episodeRecords.mediaId, season: episodeRecords.season, episode: episodeRecords.episode })
      .from(episodeRecords)
      .where(and(inArray(episodeRecords.mediaId, tvIds), eq(episodeRecords.watched, true)));
    for (const ep of eps) progress.set(ep.mediaId, [...(progress.get(ep.mediaId) ?? []), ep]);
  }

  return rows.map((row) => {
    const media = toMediaRecord(row.media);
    const entry = toLibraryEntry(row.entry);
    if (row.media.type !== "tv") return { media, entry };
    const watched = progress.get(media.id) ?? [];
    const next = nextUnwatched(media, watched);
    return {
      media,
      entry,
      watchedEpisodes: watched.length,
      totalEpisodes: totalEpisodes(media),
      nextEpisode: next ? { ...next, name: null, airDate: null } : null,
    };
  });
}

export async function getLibraryForMediaIds(ids: number[]) {
  const map = new Map<number, LibraryEntry>();
  if (!ids.length) return map;
  const rows = await db.select().from(libraryItems).where(inArray(libraryItems.mediaId, ids));
  for (const row of rows) map.set(row.mediaId, toLibraryEntry(row)!);
  return map;
}

export async function getContinueWatching(): Promise<LibraryMedia[]> {
  const active = await getLibrary({ type: "tv", status: ACTIVE_STATUSES.tv });
  return active.sort((a, b) => {
    const aTime = a.entry?.lastWatchedAt ? new Date(a.entry.lastWatchedAt).getTime() : 0;
    const bTime = b.entry?.lastWatchedAt ? new Date(b.entry.lastWatchedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export interface UpNextEntry extends LibraryMedia {
  next: {
    season: number;
    episode: number;
    name: string | null;
    airDate: string | null;
    overview: string | null;
    stillUrl: string | null;
    runtime: number | null;
    aired: boolean;
  } | null;
  caughtUp: boolean;
  ongoing: boolean;
  started: boolean;
}

/** Episode-by-episode watchlist: the next episode of every show you follow. */
export async function getUpNext(): Promise<UpNextEntry[]> {
  const shows = await getLibrary({ type: "tv", status: ["watching", "watching_again", "want_to_watch", "on_hold"] });
  const entries = await Promise.all(
    shows.map(async (item): Promise<UpNextEntry> => {
      const ongoing = isOngoing(item.media);
      const started = (item.watchedEpisodes ?? 0) > 0;
      const nextRef = item.nextEpisode;
      if (!nextRef) return { ...item, next: null, caughtUp: true, ongoing, started };
      const { episodes } = await getSeasonEpisodes(item.media.provider, item.media.externalId, nextRef.season, item.media.id, { ongoing });
      const ep = episodes.find((candidate) => candidate.episode === nextRef.episode);
      const airDate = ep?.airDate ?? null;
      const aired = airedFilter(airDate);
      return {
        ...item,
        next: {
          season: nextRef.season,
          episode: nextRef.episode,
          name: ep?.name ?? null,
          airDate,
          overview: ep?.overview ?? null,
          stillUrl: ep?.stillUrl ?? null,
          runtime: ep?.runtime ?? item.media.runtime ?? null,
          aired,
        },
        caughtUp: !aired,
        ongoing,
        started,
      };
    }),
  );
  const rank = (entry: UpNextEntry) =>
    entry.next?.aired && entry.started && entry.entry?.status !== "on_hold" ? 0 : entry.next?.aired && !entry.started ? 1 : 2;
  return entries.sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff) return diff;
    const aTime = a.entry?.lastWatchedAt ? new Date(a.entry.lastWatchedAt).getTime() : 0;
    const bTime = b.entry?.lastWatchedAt ? new Date(b.entry.lastWatchedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export interface UpcomingEntry {
  media: MediaRecord;
  kind: "episode" | "release" | "season";
  season?: number;
  episode?: number;
  name?: string | null;
  airDate: string | null;
  watched?: boolean;
}

const UPCOMING_KEY = "library:upcoming:v2";

export async function invalidateUpcoming() {
  await db.delete(cacheEntries).where(eq(cacheEntries.key, UPCOMING_KEY));
}

/** Upcoming episodes for every followed show that is ongoing or has an announced season. */
export async function buildUpcomingEpisodes(perShow = 3, total = 24): Promise<UpcomingEntry[]> {
  const rows = await db
    .select({ media: mediaItems })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id))
    .where(and(eq(mediaItems.type, "tv"), ne(libraryItems.status, "dropped")));
  const now = today();

  const perShowResults = await Promise.all(
    rows.map(async ({ media: row }) => {
      const media = toMediaRecord(row);
      const seasons = sortedSeasons(media);
      const hasFutureSeason = seasons.some((season) => !season.airDate || season.airDate >= now);
      const ongoing = isOngoing(media);
      if (!ongoing && !hasFutureSeason) return [] as UpcomingEntry[];

      const toCheck = seasons
        .filter((season, index) => index >= seasons.length - 2 || !season.airDate || season.airDate >= now)
        .slice(-3);
      const out: UpcomingEntry[] = [];
      for (const season of toCheck) {
        const { episodes } = await getSeasonEpisodes(media.provider, media.externalId, season.seasonNumber, media.id, { ongoing: true });
        for (const ep of episodes) {
          if (ep.airDate && ep.airDate >= now) {
            out.push({ media, kind: "episode", season: ep.season, episode: ep.episode, name: ep.name, airDate: ep.airDate });
          }
        }
        if (!episodes.length && (!season.airDate || season.airDate >= now)) {
          out.push({ media, kind: "season", season: season.seasonNumber, airDate: season.airDate ?? null, name: season.name });
        }
      }
      const nextMeta = media.metadata?.nextEpisodeToAir as
        | { season: number; episode: number; name: string | null; airDate: string | null }
        | undefined
        | null;
      if (!out.length && nextMeta) {
        out.push({ media, kind: "episode", season: nextMeta.season, episode: nextMeta.episode, name: nextMeta.name, airDate: nextMeta.airDate });
      }
      if (!out.length && ongoing) {
        out.push({ media, kind: "season", season: (seasons.at(-1)?.seasonNumber ?? 0) + 1, airDate: null, name: "New season announced" });
      }
      return out
        .sort((a, b) => (a.airDate ?? "9999").localeCompare(b.airDate ?? "9999"))
        .slice(0, perShow);
    }),
  );

  return perShowResults
    .flat()
    .sort((a, b) => (a.airDate ?? "9999").localeCompare(b.airDate ?? "9999"))
    .slice(0, total);
}

export async function getUpcoming(): Promise<UpcomingEntry[]> {
  const cached = await readCache<UpcomingEntry[]>(UPCOMING_KEY);
  if (cached) return cached;
  const built = await buildUpcomingEpisodes();
  await writeCache(UPCOMING_KEY, built, 30 * 60);
  return built;
}

export async function getUpcomingReleases(type: MediaType): Promise<LibraryMedia[]> {
  const rows = await db
    .select({ media: mediaItems, entry: libraryItems })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id))
    .where(and(eq(mediaItems.type, type), gte(mediaItems.releaseDate, today())))
    .orderBy(mediaItems.releaseDate)
    .limit(12);
  return rows.map((row) => ({ media: toMediaRecord(row.media), entry: toLibraryEntry(row.entry) }));
}

export async function getRecentActivity(limit = 12) {
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

function monthStart(): Date {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function getStats(type: MediaType) {
  const rows = await db
    .select({ media: mediaItems, entry: libraryItems })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id))
    .where(eq(mediaItems.type, type));

  const ratings = rows.map((row) => row.entry.rating).filter((value): value is number => value != null);
  const genreCount = new Map<string, number>();
  for (const row of rows) {
    if (row.entry.status === "want_to_watch" || row.entry.status === "want_to_play") continue;
    for (const genre of row.media.genres ?? []) genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
  }
  const favouriteGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const distribution = new Array(10).fill(0) as number[];
  for (const value of ratings) {
    const bucket = Math.min(9, Math.max(0, Math.round(value) - 1));
    distribution[bucket] += 1;
  }
  const base = {
    tracked: rows.length,
    averageRating: avg ? Math.round(avg * 10) / 10 : null,
    favouriteGenre,
    ratings: ratings.length,
    distribution,
  };
  const start = monthStart().getTime();

  if (type === "movie") {
    const watched = rows.filter((row) => row.entry.status === "watched" || row.entry.timesWatched > 0);
    const ids = watched.map((row) => row.media.id);
    const events = ids.length
      ? await db
          .select({ mediaId: watchEvents.mediaId, occurredAt: watchEvents.occurredAt })
          .from(watchEvents)
          .where(inArray(watchEvents.mediaId, ids))
      : [];
    const runtime = new Map(watched.map((row) => [row.media.id, row.media.runtime ?? 100]));
    const withEvents = new Set(events.map((event) => event.mediaId));
    const minutes =
      events.reduce((sum, event) => sum + (runtime.get(event.mediaId) ?? 100), 0) +
      watched.filter((row) => !withEvents.has(row.media.id)).reduce((sum, row) => sum + (row.media.runtime ?? 100), 0);
    const yearCount = new Map<number, number>();
    for (const event of events) {
      const year = event.occurredAt.getUTCFullYear();
      yearCount.set(year, (yearCount.get(year) ?? 0) + 1);
    }
    const rated = watched.filter((row) => row.entry.rating != null).sort((a, b) => (b.entry.rating ?? 0) - (a.entry.rating ?? 0));
    const longest = [...watched].sort((a, b) => (b.media.runtime ?? 0) - (a.media.runtime ?? 0))[0];
    return {
      ...base,
      kind: "movie" as const,
      watched: watched.length,
      totalWatches: Math.max(events.length, watched.length),
      hours: Math.round((minutes / 60) * 10) / 10,
      thisMonth: events.filter((event) => event.occurredAt.getTime() >= start).length,
      favouriteYear: [...yearCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      highestRated: rated[0] ? { title: rated[0].media.title, rating: rated[0].entry.rating, id: rated[0].media.id } : null,
      lowestRated: rated.length > 1
        ? { title: rated[rated.length - 1].media.title, rating: rated[rated.length - 1].entry.rating, id: rated[rated.length - 1].media.id }
        : null,
      longest: longest?.media.runtime ? { title: longest.media.title, runtime: longest.media.runtime } : null,
      likedCount: watched.filter((row) => row.entry.liked === true).length,
    };
  }

  if (type === "tv") {
    const ids = rows.map((row) => row.media.id);
    const eps = ids.length
      ? await db
          .select({ mediaId: episodeRecords.mediaId, watchedAt: episodeRecords.watchedAt })
          .from(episodeRecords)
          .where(and(inArray(episodeRecords.mediaId, ids), eq(episodeRecords.watched, true)))
      : [];
    const perShow = new Map<number, number>();
    for (const ep of eps) perShow.set(ep.mediaId, (perShow.get(ep.mediaId) ?? 0) + 1);
    const minutes = rows.reduce((sum, row) => sum + (perShow.get(row.media.id) ?? 0) * (row.media.runtime ?? 45), 0);
    const monthCount = new Map<string, number>();
    for (const ep of eps) {
      if (!ep.watchedAt) continue;
      const key = ep.watchedAt.toISOString().slice(0, 7);
      monthCount.set(key, (monthCount.get(key) ?? 0) + 1);
    }
    const busiest = [...monthCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const most = rows
      .map((row) => ({ title: row.media.title, count: perShow.get(row.media.id) ?? 0, id: row.media.id }))
      .sort((a, b) => b.count - a.count)[0];
    const completed = rows.filter((row) => row.entry.status === "completed");
    const longest = [...completed].sort((a, b) => (perShow.get(b.media.id) ?? 0) - (perShow.get(a.media.id) ?? 0))[0];
    return {
      ...base,
      kind: "tv" as const,
      showsTracked: rows.length,
      showsCompleted: completed.length,
      currentlyWatching: rows.filter((row) => ACTIVE_STATUSES.tv.includes(row.entry.status)).length,
      episodesWatched: eps.length,
      episodesThisMonth: eps.filter((ep) => ep.watchedAt && ep.watchedAt.getTime() >= start).length,
      hours: Math.round((minutes / 60) * 10) / 10,
      busiestMonth: busiest ? `${busiest[0]} (${busiest[1]} eps)` : null,
      mostEpisodes: most?.count ? most : null,
      longestShow: longest ? { title: longest.media.title, episodes: perShow.get(longest.media.id) ?? 0 } : null,
      likedCount: rows.filter((row) => row.entry.liked === true).length,
    };
  }

  const completed = rows.filter((row) => row.entry.status === "completed");
  const platformCount = new Map<string, number>();
  for (const row of completed) {
    const platform = row.entry.platform ?? "Unspecified";
    platformCount.set(platform, (platformCount.get(platform) ?? 0) + 1);
  }
  const rated = rows.filter((row) => row.entry.rating != null).sort((a, b) => (b.entry.rating ?? 0) - (a.entry.rating ?? 0));
  const byRelease = completed.filter((row) => row.media.releaseDate).sort((a, b) => (a.media.releaseDate! < b.media.releaseDate! ? -1 : 1));
  return {
    ...base,
    kind: "game" as const,
    gamesCompleted: completed.length,
    playing: rows.filter((row) => row.entry.status === "playing").length,
    backlog: rows.filter((row) => ["backlog", "want_to_play"].includes(row.entry.status)).length,
    playtimeHours: Math.round(rows.reduce((sum, row) => sum + (row.entry.playtimeHours ?? 0), 0) * 10) / 10,
    completedThisYear: completed.filter((row) => (row.entry.completedOn ?? "").startsWith(String(new Date().getUTCFullYear()))).length,
    favouritePlatform: [...platformCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    highestRated: rated[0] ? { title: rated[0].media.title, rating: rated[0].entry.rating, id: rated[0].media.id } : null,
    oldestCompleted: byRelease[0]?.media.title ?? null,
    newestCompleted: byRelease.at(-1)?.media.title ?? null,
    likedCount: rows.filter((row) => row.entry.liked === true).length,
  };
}

/** Lightweight discovery from the user's top genres (liked / highly rated weigh more). */
export async function getRecommended(type: MediaType) {
  const rows = await db
    .select({ genres: mediaItems.genres, rating: libraryItems.rating, liked: libraryItems.liked, mediaId: libraryItems.mediaId })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id))
    .where(eq(mediaItems.type, type))
    .limit(300);
  const genreScore = new Map<string, number>();
  for (const row of rows) {
    const weight = (row.rating ?? 0) >= 8 ? 3 : row.liked ? 2 : 1;
    for (const genre of row.genres ?? []) genreScore.set(genre, (genreScore.get(genre) ?? 0) + weight);
  }
  const topGenres = [...genreScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([genre]) => genre);
  if (!topGenres.length) return { topGenres, candidates: [] as MediaRecord[] };
  const tracked = new Set(rows.map((row) => row.mediaId));
  const pool = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.type, type),
        sql`${mediaItems.genres} ?| array[${sql.join(topGenres.map((genre) => sql`${genre}`), sql`, `)}]`,
      ),
    )
    .orderBy(desc(mediaItems.popularity))
    .limit(60);
  const candidates = pool.filter((row) => !tracked.has(row.id)).slice(0, 18).map(toMediaRecord);
  return { topGenres, candidates };
}

export async function getLists() {
  const [rows, counts] = await Promise.all([
    db.select().from(lists).orderBy(lists.sortOrder, lists.id),
    db
      .select({ listId: listItems.listId, count: sql<number>`count(*)::int` })
      .from(listItems)
      .groupBy(listItems.listId),
  ]);
  const countMap = new Map(counts.map((row) => [row.listId, Number(row.count)]));
  return rows.map((row) => ({ ...row, itemCount: countMap.get(row.id) ?? 0 }));
}

/** Creates a notification unless an identical one exists already (anti-spam). */
export async function pushNotification(
  title: string,
  body: string | null,
  options: { mediaType?: MediaType; mediaId?: number; href?: string } = {},
): Promise<boolean> {
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.title, title), body ? eq(notifications.body, body) : sql`${notifications.body} is null`))
    .limit(1);
  if (existing.length) return false;
  await db.insert(notifications).values({
    title,
    body,
    mediaType: options.mediaType ?? null,
    mediaId: options.mediaId ?? null,
    href: options.href ?? null,
  });
  return true;
}
