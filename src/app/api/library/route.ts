import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaItems, watchEvents } from "@/db/schema";
import { asMediaType, fail, ok, withDb } from "@/lib/api";
import {
  applyStatus,
  countWatches,
  episodeProgress,
  getEntry,
  getLibrary,
  invalidateUpcoming,
  markUpTo,
  nextUnwatched,
  recordActivity,
  removeEntry,
  saveEntry,
  setEpisodeWatched,
  setSeasonWatched,
  setShowWatched,
  today,
  toLibraryEntry,
  toMediaRecord,
  totalEpisodes,
} from "@/lib/library";
import { statusLabel, statusesFor, type MediaType } from "@/lib/types";

export const dynamic = "force-dynamic";

async function mediaById(mediaId: number) {
  if (!Number.isFinite(mediaId)) return null;
  const rows = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1);
  return rows.length ? toMediaRecord(rows[0]) : null;
}

async function stateFor(mediaId: number) {
  const media = await mediaById(mediaId);
  if (!media) return null;
  const entry = toLibraryEntry(await getEntry(mediaId));
  if (media.type !== "tv") return { media, entry };
  const watched = await episodeProgress(mediaId);
  return {
    media,
    entry,
    watchedEpisodes: watched.length,
    totalEpisodes: totalEpisodes(media),
    nextEpisode: nextUnwatched(media, watched),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");
  const statusParam = url.searchParams.get("status");
  try {
    const items = await withDb(() =>
      getLibrary({
      type: typeParam ? asMediaType(typeParam) : undefined,
      status: statusParam ? statusParam.split(",").filter(Boolean) : undefined,
      favoritesOnly: url.searchParams.get("favorites") === "1",
      search: url.searchParams.get("q") ?? undefined,
        limit: Math.min(500, Number(url.searchParams.get("limit") ?? 300) || 300),
      }),
    );
    return ok({ items });
  } catch {
    return fail("We couldn't load your library right now.", 503, { items: [] });
  }
}

interface Body {
  action: string;
  mediaId: number;
  status?: string;
  rating?: number | null;
  liked?: boolean | null;
  favorite?: boolean;
  notes?: string | null;
  platform?: string | null;
  playtimeHours?: number | null;
  startedOn?: string | null;
  completedOn?: string | null;
  watchedOn?: string | null;
  rewatch?: boolean;
  season?: number;
  episode?: number;
  watched?: boolean;
}

const OPTIONAL_FIELDS = ["rating", "liked", "favorite", "notes", "platform", "playtimeHours", "startedOn", "completedOn"] as const;

function cleanRating(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(Math.min(10, Math.max(1, parsed)) * 10) / 10;
}

function pickOptional(body: Body) {
  const patch: Record<string, unknown> = {};
  for (const field of OPTIONAL_FIELDS) {
    if (body[field] !== undefined) patch[field] = field === "rating" ? cleanRating(body.rating) : body[field];
  }
  if (typeof patch.notes === "string") patch.notes = (patch.notes as string).slice(0, 4000);
  return patch;
}


export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("Invalid request");
  }
  const media = await mediaById(Number(body.mediaId));
  if (!media) return fail("That title is no longer in your local cache.", 404);
  const type = media.type as MediaType;
  const defaultStatus = type === "game" ? "backlog" : "want_to_watch";

  try {
    switch (body.action) {
      case "add":
      case "set_status":
      case "patch": {
        const existing = await getEntry(media.id);
        const status = body.status ?? existing?.status ?? defaultStatus;
        if (!statusesFor(type).includes(status)) return fail("That status isn't available for this type.");
        await applyStatus(media, status, pickOptional(body) as never);
        break;
      }
      case "mark_watched": {
        const existing = await getEntry(media.id);
        const watchedOn = body.watchedOn || today();
        const at = new Date(`${watchedOn}T12:00:00Z`);
        const occurredAt = Number.isNaN(at.getTime()) ? new Date() : at;
        if (type === "tv") {
          await saveEntry(media.id, { status: existing?.status ?? "watching", ...pickOptional(body) });
          await setShowWatched(media);
        } else {
          await db.insert(watchEvents).values({ mediaId: media.id, occurredAt, note: body.rewatch ? "rewatch" : null });
          await saveEntry(media.id, {
            status: type === "game" ? "completed" : "watched",
            ...pickOptional(body),
            timesWatched: await countWatches(media.id),
            lastWatchedAt: occurredAt,
            startedOn: body.startedOn ?? existing?.startedOn ?? watchedOn,
            completedOn: type === "game" ? body.completedOn ?? watchedOn : existing?.completedOn ?? null,
          });
        }
        await recordActivity(
          media,
          type === "game" ? "completed" : "watched",
          `${body.rewatch ? "Rewatched" : type === "game" ? "Completed" : "Watched"} on ${watchedOn}`,
        );
        break;
      }
      case "episode": {
        const season = Number(body.season ?? 1);
        const episode = Number(body.episode ?? 1);
        await setEpisodeWatched(media, season, episode, body.watched ?? true);
        if (body.watched ?? true) {
          await recordActivity(media, "episode", `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")} watched`);
        }
        break;
      }
      case "episode_upto": {
        const season = Number(body.season ?? 1);
        const episode = Number(body.episode ?? 1);
        await markUpTo(media, season, episode);
        await recordActivity(media, "episode", `Caught up to S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`);
        break;
      }
      case "season": {
        const season = Number(body.season ?? 1);
        await setSeasonWatched(media, season, body.watched ?? true);
        await recordActivity(media, "season", `Season ${season} ${body.watched === false ? "marked unwatched" : "watched"}`);
        break;
      }
      case "show": {
        await setShowWatched(media);
        await recordActivity(media, "completed", "All aired episodes watched");
        break;
      }
      case "favorite": {
        const existing = await getEntry(media.id);
        await saveEntry(media.id, {
          status: existing?.status ?? defaultStatus,
          favorite: body.favorite ?? !existing?.favorite,
        });
        break;
      }
      case "remove": {
        await removeEntry(media.id);
        if (type === "tv") await invalidateUpcoming();
        return ok({ removed: true, media, entry: null });
      }
      default:
        return fail("Unknown action");
    }
    return ok(await stateFor(media.id));
  } catch {
    return fail("We couldn't save that change.", 500);
  }
}
