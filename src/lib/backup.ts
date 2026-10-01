import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { episodeRecords, libraryItems, listItems, lists, mediaItems, watchEvents } from "@/db/schema";
import { getSettings } from "./settings";
import { getMediaDetails, upsertMedia } from "./providers";
import { toMediaRecord } from "./library";
import type { MediaType } from "./types";
import { statusLabel } from "./types";

export const EXPORT_VERSION = 1;

interface ExportEntry {
  provider: string;
  provider_id: string;
  snapshot: {
    title: string;
    type: MediaType;
    year: number | null;
    release_date: string | null;
    overview: string | null;
    poster_url: string | null;
    genres: string[];
    runtime: number | null;
    seasons?: number;
  };
  status: string;
  rating: number | null;
  liked: boolean | null;
  favorite: boolean;
  notes: string | null;
  platform: string | null;
  playtime_hours: number | null;
  started_on: string | null;
  completed_on: string | null;
  times_watched: number;
  watch_history: Array<{ season: number | null; episode: number | null; occurred_at: string }>;
  episodes: Array<{ season: number; episode: number; rating: number | null; liked: boolean | null; watched_at: string | null }>;
}

export interface BackupFile {
  export_version: number;
  application: string;
  exported_at: string;
  user: Record<string, unknown>;
  preferences: Record<string, unknown>;
  movies: ExportEntry[];
  shows: ExportEntry[];
  games: ExportEntry[];
  lists: Array<{
    name: string;
    description: string | null;
    media_type: string;
    items: Array<{ provider: string; provider_id: string; type: string; title: string }>;
  }>;
}

export async function buildExport(): Promise<BackupFile> {
  const settings = await getSettings();
  const rows = await db
    .select({ media: mediaItems, entry: libraryItems })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id));

  const episodes = await db.select().from(episodeRecords);
  const events = await db.select().from(watchEvents);
  const listRows = await db.select().from(lists).orderBy(lists.sortOrder, lists.id);
  const listItemRows = listRows.length
    ? await db
        .select({ listId: listItems.listId, media: mediaItems })
        .from(listItems)
        .innerJoin(mediaItems, eq(listItems.mediaId, mediaItems.id))
    : [];

  const episodesByMedia = new Map<number, typeof episodes>();
  for (const episode of episodes) {
    const list = episodesByMedia.get(episode.mediaId) ?? [];
    list.push(episode);
    episodesByMedia.set(episode.mediaId, list);
  }
  const eventsByMedia = new Map<number, typeof events>();
  for (const event of events) {
    const list = eventsByMedia.get(event.mediaId) ?? [];
    list.push(event);
    eventsByMedia.set(event.mediaId, list);
  }

  const entries: ExportEntry[] = rows.map(({ media, entry }) => ({
    provider: media.provider,
    provider_id: media.externalId,
    snapshot: {
      title: media.title,
      type: media.type as MediaType,
      year: media.year,
      release_date: media.releaseDate,
      overview: media.overview,
      poster_url: media.posterUrl,
      genres: media.genres ?? [],
      runtime: media.runtime,
      seasons: media.type === "tv" ? (media.seasons ?? []).length : undefined,
    },
    status: entry.status,
    rating: entry.rating,
    liked: entry.liked,
    favorite: entry.favorite,
    notes: entry.notes,
    platform: entry.platform,
    playtime_hours: entry.playtimeHours,
    started_on: entry.startedOn,
    completed_on: entry.completedOn,
    times_watched: entry.timesWatched,
    watch_history: (eventsByMedia.get(media.id) ?? []).map((event) => ({
      season: event.season,
      episode: event.episode,
      occurred_at: event.occurredAt.toISOString(),
    })),
    episodes: (episodesByMedia.get(media.id) ?? [])
      .filter((episode) => episode.watched || episode.rating != null || episode.liked != null)
      .map((episode) => ({
        season: episode.season,
        episode: episode.episode,
        rating: episode.rating,
        liked: episode.liked,
        watched_at: episode.watchedAt ? episode.watchedAt.toISOString() : null,
      })),
  }));

  return {
    export_version: EXPORT_VERSION,
    application: settings.appName,
    exported_at: new Date().toISOString(),
    user: {
      username: settings.profile.username,
      display_name: settings.profile.displayName,
      bio: settings.profile.bio,
      avatar: settings.profile.avatar,
      timezone: settings.profile.timezone,
      joined_at: settings.profile.joinedAt,
    },
    preferences: {
      appearance: settings.appearance,
      notifications: settings.notifications.events,
    },
    movies: entries.filter((entry) => entry.snapshot.type === "movie"),
    shows: entries.filter((entry) => entry.snapshot.type === "tv"),
    games: entries.filter((entry) => entry.snapshot.type === "game"),
    lists: listRows.map((list) => ({
      name: list.name,
      description: list.description,
      media_type: list.mediaType,
      items: listItemRows
        .filter((item) => item.listId === list.id)
        .map((item) => ({
          provider: item.media.provider,
          provider_id: item.media.externalId,
          type: item.media.type,
          title: item.media.title,
        })),
    })),
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function exportAsText(backup: BackupFile): string {
  const lines: string[] = [];
  lines.push(`${backup.application.toUpperCase()} BACKUP`);
  lines.push(`Exported: ${formatDate(backup.exported_at)}`);
  lines.push(`Format version: ${backup.export_version}`);
  lines.push("");
  lines.push("USER");
  lines.push(`Username: ${backup.user.username}`);
  lines.push(`Display name: ${backup.user.display_name}`);
  lines.push("");
  for (const [label, group] of [
    ["MOVIES", backup.movies],
    ["TV SHOWS", backup.shows],
    ["GAMES", backup.games],
  ] as Array<[string, ExportEntry[]]>) {
    lines.push(`${label}`);
    lines.push("".padEnd(40, "-"));
    if (!group.length) lines.push("(none)");
    for (const entry of group) {
      lines.push("");
      lines.push(entry.snapshot.title);
      lines.push(`Status: ${statusLabel(entry.status)}`);
      if (entry.snapshot.year) lines.push(`Year: ${entry.snapshot.year}`);
      if (entry.rating != null) lines.push(`Rating: ${entry.rating}`);
      lines.push(`Liked: ${entry.liked === true ? "Yes" : entry.liked === false ? "No" : "—"}`);
      lines.push(`Favorite: ${entry.favorite ? "Yes" : "No"}`);
      if (entry.platform) lines.push(`Platform: ${entry.platform}`);
      if (entry.playtime_hours != null) lines.push(`Playtime: ${entry.playtime_hours}h`);
      if (entry.started_on) lines.push(`Started: ${formatDate(entry.started_on)}`);
      if (entry.completed_on) lines.push(`Completed: ${formatDate(entry.completed_on)}`);
      if (entry.snapshot.type === "tv") {
        const watched = entry.episodes.filter((episode) => episode.watched_at);
        if (watched.length) lines.push(`Episodes watched: ${watched.length}`);
        for (const episode of watched) {
          lines.push(`  S${String(episode.season).padStart(2, "0")}E${String(episode.episode).padStart(2, "0")} — ${formatDate(episode.watched_at)}`);
        }
      } else if (entry.watch_history.length) {
        lines.push(`Watched: ${formatDate(entry.watch_history[entry.watch_history.length - 1].occurred_at)}`);
      }
      if (entry.notes) lines.push(`Notes: ${entry.notes}`);
    }
    lines.push("");
  }
  if (backup.lists.length) {
    lines.push("LISTS");
    lines.push("".padEnd(40, "-"));
    for (const list of backup.lists) {
      lines.push("");
      lines.push(list.name);
      if (list.description) lines.push(list.description);
      for (const item of list.items) lines.push(`  - ${item.title} (${item.type})`);
    }
  }
  return lines.join("\n");
}

async function resolveMediaId(
  provider: string,
  externalId: string,
  snapshot: ExportEntry["snapshot"],
  refetch: boolean,
): Promise<number | null> {
  const existing = await db
    .select({ id: mediaItems.id })
    .from(mediaItems)
    .where(
      and(eq(mediaItems.provider, provider), eq(mediaItems.type, snapshot.type), eq(mediaItems.externalId, externalId)),
    )
    .limit(1);
  if (existing.length) return existing[0].id;
  if (refetch) {
    try {
      const result = await getMediaDetails(snapshot.type, provider, externalId, true);
      return result.mediaId;
    } catch {
      /* fall through to snapshot restore */
    }
  }
  const inserted = await db
    .insert(mediaItems)
    .values({
      type: snapshot.type,
      provider,
      externalId,
      title: snapshot.title,
      year: snapshot.year,
      releaseDate: snapshot.release_date,
      overview: snapshot.overview,
      posterUrl: snapshot.poster_url,
      genres: snapshot.genres ?? [],
      runtime: snapshot.runtime,
    })
    .onConflictDoNothing()
    .returning({ id: mediaItems.id });
  if (inserted.length) return inserted[0].id;
  const again = await db
    .select({ id: mediaItems.id })
    .from(mediaItems)
    .where(
      and(eq(mediaItems.provider, provider), eq(mediaItems.type, snapshot.type), eq(mediaItems.externalId, externalId)),
    )
    .limit(1);
  return again[0]?.id ?? null;
}

export interface ImportSummary {
  movies: number;
  shows: number;
  games: number;
  episodes: number;
  lists: number;
}

export async function summarizeImport(payload: unknown): Promise<ImportSummary> {
  const data = payload as Partial<BackupFile>;
  const count = (entries?: ExportEntry[]) => (entries ?? []).length;
  return {
    movies: count(data.movies),
    shows: count(data.shows),
    games: count(data.games),
    episodes: [...(data.shows ?? []), ...(data.movies ?? [])].reduce(
      (sum, entry) => sum + (entry.episodes?.length ?? 0),
      0,
    ),
    lists: data.lists?.length ?? 0,
  };
}

export async function importBackup(
  payload: unknown,
  options: { mode: "merge" | "replace"; refetch: boolean },
): Promise<ImportSummary> {
  const data = payload as Partial<BackupFile>;
  const groups: ExportEntry[][] = [data.movies ?? [], data.shows ?? [], data.games ?? []];

  if (options.mode === "replace") {
    await db.delete(episodeRecords);
    await db.delete(watchEvents);
    await db.delete(libraryItems);
    await db.delete(lists);
  }

  let episodeCount = 0;
  const importedIds: number[] = [];

  for (const group of groups) {
    for (const entry of group) {
      const mediaId = await resolveMediaId(entry.provider, entry.provider_id, entry.snapshot, options.refetch);
      if (!mediaId) continue;
      importedIds.push(mediaId);
      await db
        .insert(libraryItems)
        .values({
          mediaId,
          status: entry.status,
          rating: entry.rating,
          liked: entry.liked,
          favorite: entry.favorite,
          notes: entry.notes,
          platform: entry.platform,
          playtimeHours: entry.playtime_hours,
          startedOn: entry.started_on,
          completedOn: entry.completed_on,
          timesWatched: entry.times_watched,
        })
        .onConflictDoUpdate({
          target: libraryItems.mediaId,
          set: {
            status: entry.status,
            rating: entry.rating,
            liked: entry.liked,
            favorite: entry.favorite,
            notes: entry.notes,
            platform: entry.platform,
            playtimeHours: entry.playtime_hours,
            startedOn: entry.started_on,
            completedOn: entry.completed_on,
            timesWatched: entry.times_watched,
            updatedAt: new Date(),
          },
        });

      for (const episode of entry.episodes ?? []) {
        await db
          .insert(episodeRecords)
          .values({
            mediaId,
            season: episode.season,
            episode: episode.episode,
            watched: true,
            rating: episode.rating,
            liked: episode.liked,
            watchedAt: episode.watched_at ? new Date(episode.watched_at) : new Date(),
          })
          .onConflictDoUpdate({
            target: [episodeRecords.mediaId, episodeRecords.season, episodeRecords.episode],
            set: {
              rating: episode.rating,
              liked: episode.liked,
              watchedAt: episode.watched_at ? new Date(episode.watched_at) : new Date(),
            },
          });
        episodeCount += 1;
      }

      for (const event of entry.watch_history ?? []) {
        await db.insert(watchEvents).values({
          mediaId,
          season: event.season,
          episode: event.episode,
          occurredAt: new Date(event.occurred_at),
        });
      }
    }
  }

  let listCount = 0;
  for (const list of data.lists ?? []) {
    const existing = await db.select().from(lists).where(eq(lists.name, list.name)).limit(1);
    let listId = existing[0]?.id;
    if (!listId) {
      const inserted = await db
        .insert(lists)
        .values({ name: list.name, description: list.description ?? null, mediaType: list.media_type ?? "all" })
        .returning({ id: lists.id });
      listId = inserted[0].id;
    }
    for (const item of list.items ?? []) {
      const mediaId = await resolveMediaId(
        item.provider,
        item.provider_id,
        {
          title: item.title,
          type: (item.type as MediaType) ?? "movie",
          year: null,
          release_date: null,
          overview: null,
          poster_url: null,
          genres: [],
          runtime: null,
        },
        options.refetch,
      );
      if (!mediaId) continue;
      await db
        .insert(listItems)
        .values({ listId, mediaId })
        .onConflictDoNothing();
    }
    listCount += 1;
  }

  return {
    movies: (data.movies ?? []).length,
    shows: (data.shows ?? []).length,
    games: (data.games ?? []).length,
    episodes: episodeCount,
    lists: listCount,
  };
}

export async function librarySnapshot() {
  const rows = await db
    .select({ media: mediaItems, entry: libraryItems })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id));
  return rows.map((row) => ({ media: toMediaRecord(row.media), entry: row.entry }));
}

export async function deleteAllUserData() {
  await db.delete(episodeRecords);
  await db.delete(watchEvents);
  await db.delete(libraryItems);
  await db.delete(lists);
}

export async function mediaByIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(mediaItems).where(inArray(mediaItems.id, ids));
}

export { upsertMedia };
