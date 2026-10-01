import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { readCache, writeCache } from "@/lib/cache";
import { getSettings } from "@/lib/settings";
import type { DiscoveryKind, MediaType, NormalizedEpisode, NormalizedMedia } from "@/lib/types";
import { LocalProvider } from "./local";
import { IgdbProvider } from "./igdb";
import { RawgProvider } from "./rawg";
import { TmdbProvider } from "./tmdb";
import { ProviderError, type MediaProvider } from "./base";

export const tmdbProvider = new TmdbProvider();
export const igdbProvider = new IgdbProvider();
export const rawgProvider = new RawgProvider();
export const localProvider = new LocalProvider();

export const PROVIDERS: MediaProvider[] = [tmdbProvider, igdbProvider, rawgProvider, localProvider];

export function getProvider(id: string): MediaProvider {
  return PROVIDERS.find((provider) => provider.id === id) ?? localProvider;
}

type MediaRow = typeof mediaItems.$inferSelect;
export type MediaWithId = NormalizedMedia & { id: number };

/** Active provider for a media type; falls back to the built-in offline catalog. */
export async function resolveProvider(type: MediaType): Promise<MediaProvider> {
  const settings = await getSettings();
  if (type === "game") {
    const { igdb, rawg } = settings.providers;
    const igdbReady = Boolean(igdb.clientId && igdb.clientSecret);
    const rawgReady = Boolean(rawg.apiKey);
    if (settings.providers.game === "rawg" && rawgReady) return rawgProvider;
    if (settings.providers.game === "igdb" && igdbReady) return igdbProvider;
    if (rawgReady) return rawgProvider;
    if (igdbReady) return igdbProvider;
    return localProvider;
  }
  return settings.providers.tmdb.apiKey ? tmdbProvider : localProvider;
}

/** Whether a TV show is still airing or has an announced future season. */
export function isOngoingMeta(metadata: Record<string, unknown> | null | undefined): boolean {
  const meta = metadata ?? {};
  if (meta.inProduction === true || meta.nextEpisodeToAir) return true;
  const status = String(meta.status ?? "").toLowerCase();
  return ["returning series", "in production", "planned", "pilot", "airing"].includes(status);
}

function normalizeSeasons(seasons: NormalizedMedia["seasons"]) {
  return (seasons ?? []).map((season) => ({
    seasonNumber: season.seasonNumber,
    name: season.name,
    episodeCount: season.episodeCount,
    airDate: season.airDate ?? null,
    overview: season.overview ?? null,
    posterUrl: season.posterUrl ?? null,
  }));
}

export function rowToNormalized(row: MediaRow): MediaWithId {
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

/** Full-detail upsert: overwrites everything and marks the details as fresh. */
export async function upsertMedia(normalized: NormalizedMedia): Promise<number> {
  const now = new Date();
  const values = {
    type: normalized.type,
    provider: normalized.provider,
    externalId: normalized.externalId,
    title: normalized.title,
    originalTitle: normalized.originalTitle ?? null,
    year: normalized.year ?? null,
    releaseDate: normalized.releaseDate ?? null,
    overview: normalized.overview ?? null,
    posterUrl: normalized.posterUrl ?? null,
    backdropUrl: normalized.backdropUrl ?? null,
    trailerUrl: normalized.trailerUrl ?? null,
    genres: normalized.genres ?? [],
    externalRating: normalized.externalRating ?? null,
    runtime: normalized.runtime ?? null,
    popularity: normalized.popularity ?? 0,
    metadata: normalized.metadata ?? {},
    seasons: normalizeSeasons(normalized.seasons),
    cachedAt: now,
    detailsFetchedAt: now,
    updatedAt: now,
  };
  const [row] = await db
    .insert(mediaItems)
    .values(values)
    .onConflictDoUpdate({
      target: [mediaItems.provider, mediaItems.type, mediaItems.externalId],
      set: { ...values, createdAt: undefined },
    })
    .returning({ id: mediaItems.id });
  return row.id;
}

/**
 * Lightweight batch upsert for search/discovery results in ONE query.
 * Only list-level fields are touched so detail data (cast, seasons, runtime)
 * is never wiped and detail freshness is not faked.
 */
export async function upsertMany(items: NormalizedMedia[]): Promise<MediaWithId[]> {
  const unique = new Map<string, NormalizedMedia>();
  for (const item of items) unique.set(`${item.provider}|${item.type}|${item.externalId}`, item);
  const list = [...unique.values()];
  if (!list.length) return [];
  const rows = await db
    .insert(mediaItems)
    .values(
      list.map((item) => ({
        type: item.type,
        provider: item.provider,
        externalId: item.externalId,
        title: item.title,
        originalTitle: item.originalTitle ?? null,
        year: item.year ?? null,
        releaseDate: item.releaseDate ?? null,
        overview: item.overview ?? null,
        posterUrl: item.posterUrl ?? null,
        backdropUrl: item.backdropUrl ?? null,
        genres: item.genres ?? [],
        externalRating: item.externalRating ?? null,
        popularity: item.popularity ?? 0,
        metadata: item.metadata ?? {},
        seasons: normalizeSeasons(item.seasons),
      })),
    )
    .onConflictDoUpdate({
      target: [mediaItems.provider, mediaItems.type, mediaItems.externalId],
      set: {
        title: sql`excluded.title`,
        year: sql`coalesce(excluded.year, ${mediaItems.year})`,
        releaseDate: sql`coalesce(excluded.release_date, ${mediaItems.releaseDate})`,
        overview: sql`coalesce(excluded.overview, ${mediaItems.overview})`,
        posterUrl: sql`coalesce(excluded.poster_url, ${mediaItems.posterUrl})`,
        backdropUrl: sql`coalesce(excluded.backdrop_url, ${mediaItems.backdropUrl})`,
        externalRating: sql`coalesce(excluded.external_rating, ${mediaItems.externalRating})`,
        popularity: sql`excluded.popularity`,
        genres: sql`case when jsonb_array_length(excluded.genres) > 0 then excluded.genres else ${mediaItems.genres} end`,
        cachedAt: sql`now()`,
      },
    })
    .returning({ id: mediaItems.id, provider: mediaItems.provider, type: mediaItems.type, externalId: mediaItems.externalId });
  const ids = new Map(rows.map((row) => [`${row.provider}|${row.type}|${row.externalId}`, row.id]));
  return items
    .map((item) => ({ ...item, id: ids.get(`${item.provider}|${item.type}|${item.externalId}`) ?? 0 }))
    .filter((item) => item.id > 0);
}

async function findRow(provider: string, type: MediaType, externalId: string): Promise<MediaRow | null> {
  const rows = await db
    .select()
    .from(mediaItems)
    .where(and(eq(mediaItems.provider, provider), eq(mediaItems.type, type), eq(mediaItems.externalId, externalId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface MediaFetchResult {
  mediaId: number;
  row: MediaRow;
  fromCache: boolean;
  offline: boolean;
}

/** Details with local cache. Ongoing shows refresh on the (short) episode TTL. */
export async function getMediaDetails(
  type: MediaType,
  providerId: string,
  externalId: string,
  force = false,
): Promise<MediaFetchResult> {
  const provider = getProvider(providerId);
  const settings = await getSettings();
  const existing = await findRow(provider.id, type, externalId);

  if (existing && existing.detailsFetchedAt && !force) {
    const ttlSeconds =
      type === "tv"
        ? isOngoingMeta(existing.metadata)
          ? Math.max(1, settings.cache.episodeHours) * 3600
          : Math.max(1, settings.cache.showDays) * 86400
        : Math.max(1, settings.cache.movieDays) * 86400;
    const age = (Date.now() - existing.detailsFetchedAt.getTime()) / 1000;
    if (age < ttlSeconds) {
      return { mediaId: existing.id, row: existing, fromCache: true, offline: provider.id === "local" };
    }
  }

  try {
    const details = await provider.getDetails(externalId, type);
    if (!details) throw new ProviderError("Not found", "unavailable");
    const mediaId = await upsertMedia(details);
    const row = (await db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1))[0];
    return { mediaId, row, fromCache: false, offline: provider.id === "local" };
  } catch (error) {
    if (existing) return { mediaId: existing.id, row: existing, fromCache: true, offline: true };
    throw error;
  }
}

export interface DiscoveryResult {
  items: MediaWithId[];
  offline: boolean;
  error: string | null;
}

/** Cached discovery rails. A cache hit costs one DB read and zero writes. */
export async function getDiscovery(type: MediaType, kind: DiscoveryKind, force = false): Promise<DiscoveryResult> {
  const settings = await getSettings();
  const provider = await resolveProvider(type);
  const ttlHours = kind === "upcoming" ? settings.cache.upcomingHours : settings.cache.popularHours;
  const key = `discover:${provider.id}:${type}:${kind}`;

  if (!force) {
    const cached = await readCache<MediaWithId[]>(key);
    if (cached?.length && cached.every((item) => typeof item.id === "number")) {
      return { items: cached, offline: provider.id === "local", error: null };
    }
  }

  try {
    const results = await provider.getDiscovery(kind, type);
    const items = await upsertMany(results.slice(0, 20));
    await writeCache(key, items, Math.max(1, ttlHours) * 3600);
    return { items, offline: provider.id === "local", error: null };
  } catch (error) {
    if (provider.id !== "local") {
      const fallback = await localProvider.getDiscovery(kind, type);
      return {
        items: await upsertMany(fallback.slice(0, 20)),
        offline: true,
        error:
          error instanceof ProviderError && error.status === "not_configured"
            ? "No metadata provider is configured yet — showing the built-in catalog."
            : "Your library is safe, but new titles could not be loaded from the provider right now.",
      };
    }
    return { items: [], offline: true, error: "Nothing to show right now." };
  }
}

export interface SearchOutcome {
  items: MediaWithId[];
  offline: boolean;
  error: string | null;
}

async function localDbMatches(query: string, type: MediaType, provider: string): Promise<MediaWithId[]> {
  const rows = await db
    .select()
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.type, type),
        eq(mediaItems.provider, provider),
        sql`${mediaItems.title} ilike ${`%${query}%`}`,
      ),
    )
    .orderBy(desc(mediaItems.popularity))
    .limit(10);
  return rows.map(rowToNormalized);
}

/** Search: short-lived result cache → provider → local DB fallback. */
export async function searchMedia(query: string, type: MediaType): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], offline: false, error: null };
  const provider = await resolveProvider(type);
  const key = `search:${provider.id}:${type}:${trimmed.toLowerCase()}`;
  const cached = await readCache<MediaWithId[]>(key);
  if (cached) return { items: cached, offline: provider.id === "local", error: null };

  try {
    const results = await provider.search(trimmed, type);
    const items = await upsertMany(results.slice(0, 24));
    await writeCache(key, items, 24 * 3600);
    return { items, offline: provider.id === "local", error: null };
  } catch (error) {
    const fromDb = await localDbMatches(trimmed, type, provider.id);
    const catalog = fromDb.length ? [] : await upsertMany(await localProvider.search(trimmed, type));
    return {
      items: [...fromDb, ...catalog],
      offline: true,
      error:
        error instanceof ProviderError && error.status === "not_configured"
          ? "No metadata provider configured — searching the built-in catalog instead."
          : "You're offline from the metadata provider — showing matches from your local cache.",
    };
  }
}

/** Season episodes with their own cache; ongoing shows use the short episode TTL. */
export async function getSeasonEpisodes(
  providerId: string,
  externalId: string,
  season: number,
  mediaId: number,
  options: { ongoing?: boolean } = {},
): Promise<{ episodes: NormalizedEpisode[]; error: string | null }> {
  const provider = getProvider(providerId);
  const key = `season:${provider.id}:${externalId}:${season}`;
  const cached = await readCache<NormalizedEpisode[]>(key);
  if (cached?.length) return { episodes: cached, error: null };

  const settings = await getSettings();
  const ttl =
    options.ongoing === false
      ? Math.max(1, settings.cache.showDays) * 86400
      : Math.max(1, settings.cache.episodeHours) * 3600;

  if (provider.getSeason) {
    try {
      const episodes = await provider.getSeason(externalId, season);
      if (episodes.length) {
        await writeCache(key, episodes, ttl);
        return { episodes, error: null };
      }
    } catch {
      /* fall through to structural fallback */
    }
  }

  const rows = await db.select({ seasons: mediaItems.seasons }).from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1);
  const seasonMeta = rows[0]?.seasons?.find((entry) => entry.seasonNumber === season);
  if (seasonMeta?.episodeCount) {
    return {
      episodes: Array.from({ length: seasonMeta.episodeCount }, (_, index) => ({
        season,
        episode: index + 1,
        name: null,
        airDate: null,
        overview: null,
        stillUrl: null,
        runtime: null,
        rating: null,
      })),
      error: "Showing cached episode structure — details are unavailable right now.",
    };
  }
  return { episodes: [], error: "Episode information is unavailable right now." };
}

export { ProviderError };
