import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { episodeRecords } from "@/db/schema";
import { asMediaType, fail, ok } from "@/lib/api";
import { getMediaDetails, getSeasonEpisodes } from "@/lib/providers";
import {
  episodeProgress,
  getEntry,
  isOngoing,
  nextUnwatched,
  today,
  toLibraryEntry,
  toMediaRecord,
  totalEpisodes,
} from "@/lib/library";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = asMediaType(url.searchParams.get("type"));
  const provider = url.searchParams.get("provider") ?? "local";
  const externalId = url.searchParams.get("id");
  const seasonParam = Number(url.searchParams.get("season") ?? "");
  const refresh = url.searchParams.get("refresh") === "1";
  if (!externalId) return fail("Missing media id");

  try {
    const details = await getMediaDetails(type, provider, externalId, refresh);
    const media = toMediaRecord(details.row);
    const [entryRow, watched] = await Promise.all([getEntry(media.id), type === "tv" ? episodeProgress(media.id) : Promise.resolve([])]);
    const entry = toLibraryEntry(entryRow);
    const next = type === "tv" ? nextUnwatched(media, watched) : null;
    const ongoing = type === "tv" && isOngoing(media);

    let season: number | null = null;
    let episodes: unknown[] = [];
    let episodeError: string | null = null;
    if (type === "tv" && media.seasons?.length) {
      const seasonNumbers = media.seasons.map((item) => item.seasonNumber);
      season = seasonNumbers.includes(seasonParam)
        ? seasonParam
        : next?.season ?? seasonNumbers[0];
      const [result, records] = await Promise.all([
        getSeasonEpisodes(media.provider, media.externalId, season, media.id, { ongoing }),
        db
          .select()
          .from(episodeRecords)
          .where(and(eq(episodeRecords.mediaId, media.id), eq(episodeRecords.season, season))),
      ]);
      episodeError = result.error;
      const byNumber = new Map(records.map((record) => [record.episode, record]));
      const now = today();
      episodes = result.episodes.map((episode) => {
        const record = byNumber.get(episode.episode);
        return {
          ...episode,
          watched: record?.watched ?? false,
          myRating: record?.rating ?? null,
          liked: record?.liked ?? null,
          watchedAt: record?.watchedAt ?? null,
          aired: !episode.airDate || episode.airDate <= now,
        };
      });
    }

    return ok({
      media,
      entry,
      season,
      episodes,
      episodeError,
      ongoing,
      watchedEpisodes: watched.length,
      totalEpisodes: totalEpisodes(media),
      nextEpisode: next,
      offline: details.offline,
      fromCache: details.fromCache,
    });
  } catch {
    return fail("Unable to load this title right now. Your saved library is still available.", 503);
  }
}
