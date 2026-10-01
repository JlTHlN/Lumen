import { desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { cacheEntries, jobRuns } from "@/db/schema";
import { getSettings } from "./settings";
import { buildUpcomingEpisodes, getUpcomingReleases, invalidateUpcoming, pushNotification, today } from "./library";
import { sendTelegram } from "./notify";

function pad(value?: number) {
  return String(value ?? 0).padStart(2, "0");
}

function href(type: string, provider: string, externalId: string, query = "") {
  const base = type === "tv" ? "tv" : type === "game" ? "games" : "movies";
  return `/${base}/${provider}-${externalId}${query}`;
}

/** Creates notifications for today's episodes/releases. Returns the count created. */
export async function checkNewReleases(): Promise<number> {
  const settings = await getSettings();
  const events = settings.notifications.events;
  const telegramReady = Boolean(settings.notifications.telegram.botToken && settings.notifications.telegram.chatId);
  const now = today();
  const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  let created = 0;

  const deliver = async (title: string, body: string, options: Parameters<typeof pushNotification>[2]) => {
    const fresh = await pushNotification(title, body, options);
    if (fresh) {
      created += 1;
      if (telegramReady && settings.notifications.digest === "instant") {
        await sendTelegram(`🔔 <b>${title}</b>\n${body}`).catch(() => undefined);
      }
    }
  };

  if (events.newEpisode || events.upcomingEpisode) {
    await invalidateUpcoming();
    const episodes = await buildUpcomingEpisodes(3, 60);
    for (const entry of episodes) {
      if (entry.kind !== "episode" || !entry.airDate) continue;
      const code = `S${pad(entry.season)}E${pad(entry.episode)}`;
      const link = href("tv", entry.media.provider, entry.media.externalId, `?season=${entry.season}&episode=${entry.episode}`);
      if (events.newEpisode && entry.airDate === now) {
        await deliver(`New episode · ${entry.media.title}`, `${code} is now available.`, { mediaType: "tv", mediaId: entry.media.id, href: link });
      } else if (events.upcomingEpisode && entry.airDate === soon) {
        await deliver(`Tomorrow · ${entry.media.title}`, `${code} airs ${entry.airDate}.`, { mediaType: "tv", mediaId: entry.media.id, href: link });
      }
    }
  }

  for (const kind of ["movie", "game"] as const) {
    const enabled = kind === "movie" ? events.movieRelease : events.gameRelease;
    if (!enabled) continue;
    for (const item of await getUpcomingReleases(kind)) {
      if (item.media.releaseDate !== now) continue;
      await deliver(
        `${kind === "movie" ? "Movie" : "Game"} out today · ${item.media.title}`,
        `Released ${item.media.releaseDate}.`,
        { mediaType: kind, mediaId: item.media.id, href: href(kind, item.media.provider, item.media.externalId) },
      );
    }
  }
  return created;
}

export async function runScheduledJobs(reason = "schedule") {
  try {
    await db.delete(cacheEntries).where(lt(cacheEntries.expiresAt, new Date()));
    const created = await checkNewReleases();
    await db.insert(jobRuns).values({ job: "refresh", status: "ok", detail: `${reason}: ${created} notifications` });
  } catch {
    await db.insert(jobRuns).values({ job: "refresh", status: "error", detail: reason }).catch(() => undefined);
  }
}

const globalForJobs = globalThis as typeof globalThis & { __jobsStarted?: boolean };

/** Lightweight in-process scheduler; checks hourly, runs per configured interval. */
export function startScheduler() {
  if (globalForJobs.__jobsStarted) return;
  globalForJobs.__jobsStarted = true;
  const tick = async () => {
    try {
      const settings = await getSettings();
      if (!settings.jobs.enabled) return;
      const last = await db.select().from(jobRuns).where(eq(jobRuns.job, "refresh")).orderBy(desc(jobRuns.createdAt)).limit(1);
      const due = !last.length || Date.now() - last[0].createdAt.getTime() > Math.max(1, settings.jobs.refreshHours) * 3600 * 1000;
      if (due) await runScheduledJobs();
    } catch {
      /* database may not be ready yet; next tick retries */
    }
  };
  const first = setTimeout(tick, 20_000);
  const interval = setInterval(tick, 60 * 60 * 1000);
  first.unref?.();
  interval.unref?.();
}
