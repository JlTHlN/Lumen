import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { episodeRecords, libraryItems, lists, mediaItems, watchEvents } from "@/db/schema";
import { ACTIVE_STATUSES, type MediaType } from "./types";

/* ------------------------------------------------------------------ */
/* Shared data gathering                                               */
/* ------------------------------------------------------------------ */

interface Row {
  mediaId: number;
  type: MediaType;
  title: string;
  genres: string[];
  year: number | null;
  runtime: number | null;
  status: string;
  rating: number | null;
  favorite: boolean;
  liked: boolean | null;
  platform: string | null;
  timesWatched: number;
  lastWatchedAt: Date | null;
  startedOn: string | null;
  completedOn: string | null;
  releaseDate: string | null;
}

async function loadRows(): Promise<Row[]> {
  const rows = await db
    .select({
      mediaId: libraryItems.mediaId,
      type: mediaItems.type,
      title: mediaItems.title,
      genres: mediaItems.genres,
      year: mediaItems.year,
      runtime: mediaItems.runtime,
      releaseDate: mediaItems.releaseDate,
      status: libraryItems.status,
      rating: libraryItems.rating,
      favorite: libraryItems.favorite,
      liked: libraryItems.liked,
      platform: libraryItems.platform,
      timesWatched: libraryItems.timesWatched,
      lastWatchedAt: libraryItems.lastWatchedAt,
      startedOn: libraryItems.startedOn,
      completedOn: libraryItems.completedOn,
    })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id));
  return rows.map((row) => ({ ...row, type: row.type as MediaType, genres: row.genres ?? [] }));
}

/** Every day something was watched, with how many. Powers streaks + heatmap. */
async function loadDailyCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const add = (day: string, n = 1) => counts.set(day, (counts.get(day) ?? 0) + n);

  const [events, episodes] = await Promise.all([
    db.select({ day: sql<string>`to_char(${watchEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(watchEvents)
      .groupBy(sql`to_char(${watchEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`),
    db.select({ day: sql<string>`to_char(${episodeRecords.watchedAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(episodeRecords)
      .where(eq(episodeRecords.watched, true))
      .groupBy(sql`to_char(${episodeRecords.watchedAt} at time zone 'UTC', 'YYYY-MM-DD')`),
  ]);
  for (const row of [...events, ...episodes]) if (row.day) add(row.day, Number(row.n));
  return counts;
}

async function loadHours(): Promise<number[]> {
  const rows = await db
    .select({ hour: sql<number>`extract(hour from ${watchEvents.occurredAt} at time zone 'UTC')::int` })
    .from(watchEvents);
  const ep = await db
    .select({ hour: sql<number>`extract(hour from ${episodeRecords.watchedAt} at time zone 'UTC')::int` })
    .from(episodeRecords)
    .where(eq(episodeRecords.watched, true));
  return [...rows, ...ep].map((row) => Number(row.hour));
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

export interface StreakInfo {
  current: number;
  longest: number;
  totalDays: number;
  bestDay: { date: string; count: number } | null;
}

export async function getStreak(): Promise<StreakInfo> {
  const counts = await loadDailyCounts();
  const days = [...counts.keys()].sort();
  if (!days.length) return { current: 0, longest: 0, totalDays: 0, bestDay: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${days[i]}T00:00:00Z`).getTime();
    if (cur - prev === 86400000) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 1;
  }

  const today = dayKey(startOfDay());
  const yesterday = dayKey(startOfDay(-1));
  let current = 0;
  if (counts.has(today) || counts.has(yesterday)) {
    let cursor = counts.has(today) ? 0 : -1;
    while (counts.has(dayKey(startOfDay(cursor)))) {
      current += 1;
      cursor -= 1;
    }
  }

  const bestDay = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    current,
    longest,
    totalDays: days.length,
    bestDay: bestDay ? { date: bestDay[0], count: bestDay[1] } : null,
  };
}

/** 26 weeks × 7 days of activity, oldest first. */
export async function getHeatmap(weeks = 26) {
  const counts = await loadDailyCounts();
  const days: Array<{ date: string; count: number }> = [];
  const total = weeks * 7;
  const today = startOfDay();
  // Align so the grid ends on the current week's Saturday.
  const endOffset = 6 - today.getUTCDay();
  for (let i = total - 1 + endOffset; i >= endOffset; i -= 1) {
    const d = startOfDay(-i);
    const key = dayKey(d);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }
  const max = days.reduce((m, d) => Math.max(m, d.count), 0);
  return { days, max, weeks };
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  total: number;
  unlocked: boolean;
  rarity: "common" | "rare" | "epic";
}

export async function getAchievements(): Promise<{ all: Achievement[]; unlocked: number; score: number }> {
  const [rows, daily, hours] = await Promise.all([loadRows(), loadDailyCounts(), loadHours()]);
  const [listCount, episodeTotal, bestShow, rewatchEvents] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(lists),
    db.select({ n: sql<number>`count(*)::int` }).from(episodeRecords).where(eq(episodeRecords.watched, true)),
    db
      .select({ mediaId: episodeRecords.mediaId, n: sql<number>`count(*)::int` })
      .from(episodeRecords)
      .where(eq(episodeRecords.watched, true))
      .groupBy(episodeRecords.mediaId)
      .orderBy(sql`count(*) desc`)
      .limit(1),
    db.select({ mediaId: watchEvents.mediaId, n: sql<number>`count(*)::int` })
      .from(watchEvents)
      .groupBy(watchEvents.mediaId)
      .having(sql`count(*) > 1`)
      .limit(1),
  ]);

  const movies = rows.filter((r) => r.type === "movie");
  const shows = rows.filter((r) => r.type === "tv");
  const games = rows.filter((r) => r.type === "game");
  const moviesWatched = movies.filter((r) => r.status === "watched").length;
  const showsCompleted = shows.filter((r) => r.status === "completed").length;
  const gamesCompleted = games.filter((r) => r.status === "completed").length;
  const episodes = Number(episodeTotal[0]?.n ?? 0);
  const rated = rows.filter((r) => r.rating != null).length;
  const favorites = rows.filter((r) => r.favorite).length;
  const genres = new Set(rows.flatMap((r) => r.genres));
  const decades = new Set(rows.map((r) => r.year).filter((y): y is number => !!y).map((y) => Math.floor(y / 10)));
  const platforms = new Set(games.map((r) => r.platform).filter(Boolean) as string[]);
  const hoursAll = hours;
  const nightOwl = hoursAll.some((h) => h >= 23 || h < 4);
  const earlyBird = hoursAll.some((h) => h >= 5 && h < 8);
  const movieMinutes = movies.filter((r) => r.status === "watched").reduce((sum, r) => sum + (r.runtime ?? 100), 0);
  const avgEpisodeRuntime = shows.length
    ? shows.reduce((sum, r) => sum + (r.runtime ?? 45), 0) / shows.length
    : 45;
  const totalHours = Math.round((movieMinutes + episodes * avgEpisodeRuntime) / 60);
  const animation = rows.filter((r) => r.genres.some((g) => /animation|anime/i.test(g))).length;
  const bestDayCount = [...daily.values()].sort((a, b) => b - a)[0] ?? 0;
  const streak = await getStreak();
  const listsN = Number(listCount[0]?.n ?? 0);
  const perfect = rows.some((r) => (r.rating ?? 0) >= 10);
  const brutal = rows.some((r) => (r.rating ?? 0) <= 2 && r.rating != null);

  const defs: Array<[string, string, string, string, number, number, Achievement["rarity"]]> = [
    ["first_track", "First Steps", "Add your very first title", "sparkle", rows.length, 1, "common"],
    ["movie_night", "Movie Night", "Watch 10 movies", "film", moviesWatched, 10, "common"],
    ["cinephile", "Cinephile", "Watch 50 movies", "film", moviesWatched, 50, "rare"],
    ["binge", "Binge Watcher", "Watch 100 episodes", "tv", episodes, 100, "common"],
    ["seasoned", "Seasoned", "Watch 500 episodes", "tv", episodes, 500, "epic"],
    ["completionist", "Completionist", "Finish 5 shows", "check", showsCompleted, 5, "common"],
    ["game_on", "Game On", "Complete 5 games", "gamepad", gamesCompleted, 5, "common"],
    ["backlog_hero", "Backlog Hero", "Complete 15 games", "gamepad", gamesCompleted, 15, "rare"],
    ["critic", "Critic", "Rate 25 titles", "star", rated, 25, "common"],
    ["perfection", "Perfectionist", "Give something a 10", "star", perfect ? 1 : 0, 1, "rare"],
    ["brutal", "Brutally Honest", "Rate something 2 or lower", "star", brutal ? 1 : 0, 1, "rare"],
    ["collector", "Heart Collector", "Favourite 10 titles", "heart", favorites, 10, "common"],
    ["curator", "Curator", "Create 3 lists", "list", listsN, 3, "common"],
    ["marathon", "Marathon", "Track 100 hours of entertainment", "clock", totalHours, 100, "rare"],
    ["night_owl", "Night Owl", "Track something after 11pm", "moon", nightOwl ? 1 : 0, 1, "rare"],
    ["early_bird", "Early Bird", "Track something before 8am", "sun", earlyBird ? 1 : 0, 1, "rare"],
    ["decade_diver", "Decade Diver", "Track titles from 5 different decades", "layers", decades.size, 5, "rare"],
    ["genre_hopper", "Genre Hopper", "Track 12 different genres", "grid", genres.size, 12, "common"],
    ["rewatch_club", "Rewatch Club", "Watch the same movie twice", "refresh", rewatchEvents.length ? 1 : 0, 1, "rare"],
    ["week_warrior", "Week Warrior", "Track something 7 days in a row", "flame", streak.longest, 7, "epic"],
    ["animation_fan", "Animation Fan", "Track 5 animated titles", "sparkle", animation, 5, "common"],
    ["platform_hopper", "Platform Hopper", "Complete games on 3 platforms", "gamepad", platforms.size, 3, "rare"],
    ["deep_dive", "Deep Dive", "Watch 40 episodes of one show", "tv", Number(bestShow[0]?.n ?? 0), 40, "rare"],
    ["sunday_scaries", "One Sitting", "Watch 10 episodes in a single day", "flame", bestDayCount, 10, "epic"],
  ];

  const all = defs.map(([id, title, description, icon, progress, total, rarity]) => ({
    id,
    title,
    description,
    icon,
    progress: Math.min(progress, total),
    total,
    unlocked: progress >= total,
    rarity,
  }));

  const unlocked = all.filter((a) => a.unlocked).length;
  const weights = { common: 1, rare: 3, epic: 5 } as const;
  const score = all.filter((a) => a.unlocked).reduce((s, a) => s + weights[a.rarity], 0);
  return { all, unlocked, score };
}

/* ------------------------------------------------------------------ */
/* Year-in-review recap                                                */
/* ------------------------------------------------------------------ */

export interface Recap {
  year: number;
  years: number[];
  movies: number;
  shows: number;
  games: number;
  episodes: number;
  hours: number;
  topGenres: Array<{ genre: string; count: number }>;
  busiestMonth: { month: number; count: number } | null;
  monthBars: Array<{ month: number; count: number }>;
  topRated: { type: MediaType; title: string; rating: number; mediaId: number } | null;
  favourites: number;
  firstOfTheYear: { title: string; date: string } | null;
  longestMovie: { title: string; runtime: number } | null;
  mostEpisodes: { title: string; count: number } | null;
  platforms: Array<{ platform: string; count: number }>;
  decades: Array<{ decade: string; count: number }>;
  headline: string;
}

export async function getRecap(year?: number): Promise<Recap> {
  const rows = await loadRows();
  const thisYear = new Date().getUTCFullYear();
  const target = year ?? thisYear;

  const dateOf = (r: Row): string | null =>
    r.lastWatchedAt
      ? r.lastWatchedAt.toISOString().slice(0, 10)
      : r.completedOn ?? r.startedOn ?? null;

  const inYear = rows.filter((r) => (dateOf(r) ?? "").startsWith(String(target)));
  const yearEpisodes = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(episodeRecords)
    .where(and(eq(episodeRecords.watched, true), sql`extract(year from ${episodeRecords.watchedAt}) = ${target}`));
  const episodes = Number(yearEpisodes[0]?.n ?? 0);

  const movies = inYear.filter((r) => r.type === "movie");
  const shows = inYear.filter((r) => r.type === "tv");
  const games = inYear.filter((r) => r.type === "game");

  const genreCount = new Map<string, number>();
  for (const r of inYear) for (const g of r.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([genre, count]) => ({ genre, count }));

  const monthCount = new Array(12).fill(0) as number[];
  for (const r of inYear) {
    const d = dateOf(r);
    if (d) monthCount[Number(d.slice(5, 7)) - 1] += 1;
  }
  const monthRows = await db
    .select({
      month: sql<number>`extract(month from ${episodeRecords.watchedAt})::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(episodeRecords)
    .where(and(eq(episodeRecords.watched, true), sql`extract(year from ${episodeRecords.watchedAt}) = ${target}`))
    .groupBy(sql`extract(month from ${episodeRecords.watchedAt})`);
  for (const row of monthRows) {
    const index = Number(row.month) - 1;
    if (index >= 0 && index < 12) monthCount[index] += Number(row.n);
  }
  const busiestIndex = monthCount.indexOf(Math.max(...monthCount));
  const busiestMonth = monthCount[busiestIndex] > 0 ? { month: busiestIndex + 1, count: monthCount[busiestIndex] } : null;

  const avgRuntime = shows.length ? shows.reduce((s, r) => s + (r.runtime ?? 45), 0) / shows.length : 45;
  const hours = Math.round((movies.reduce((s, r) => s + (r.runtime ?? 100), 0) + episodes * avgRuntime) / 60);

  const rated = inYear.filter((r) => r.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const sortedByDate = [...inYear].sort((a, b) => (dateOf(a) ?? "").localeCompare(dateOf(b) ?? ""));
  const longest = [...movies].sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0))[0];
  const perShow = await db
    .select({ mediaId: episodeRecords.mediaId, n: sql<number>`count(*)::int` })
    .from(episodeRecords)
    .where(and(eq(episodeRecords.watched, true), sql`extract(year from ${episodeRecords.watchedAt}) = ${target}`))
    .groupBy(episodeRecords.mediaId)
    .orderBy(sql`count(*) desc`)
    .limit(1);
  const mostEpisodesRow = perShow[0]
    ? rows.find((r) => r.mediaId === Number(perShow[0].mediaId))
    : null;
  const platformCount = new Map<string, number>();
  for (const g of games.filter((r) => r.status === "completed")) {
    const p = g.platform ?? "Unspecified";
    platformCount.set(p, (platformCount.get(p) ?? 0) + 1);
  }
  const decadeCount = new Map<string, number>();
  for (const r of inYear) {
    const y = r.year ?? (r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null);
    if (!y) continue;
    const d = `${Math.floor(y / 10) * 10}s`;
    decadeCount.set(d, (decadeCount.get(d) ?? 0) + 1);
  }

  const total = inYear.length;
  const headline =
    total === 0
      ? `Nothing tracked in ${target} yet — every great year starts with one title.`
      : topGenres[0]
        ? `${target} was your ${topGenres[0].genre} year.`
        : `${total} titles made your ${target}.`;

  return {
    year: target,
    years: [...new Set(rows.map((r) => (dateOf(r) ?? "").slice(0, 4)).filter(Boolean))].map(Number).sort((a, b) => b - a),
    movies: movies.length,
    shows: shows.length,
    games: games.length,
    episodes,
    hours,
    topGenres,
    busiestMonth,
    monthBars: monthCount.map((count, index) => ({ month: index + 1, count })),
    topRated: rated[0]
      ? { type: rated[0].type, title: rated[0].title, rating: rated[0].rating as number, mediaId: rated[0].mediaId }
      : null,
    favourites: inYear.filter((r) => r.favorite).length,
    firstOfTheYear: sortedByDate[0] ? { title: sortedByDate[0].title, date: dateOf(sortedByDate[0]) ?? "" } : null,
    longestMovie: longest?.runtime ? { title: longest.title, runtime: longest.runtime } : null,
    mostEpisodes: mostEpisodesRow ? { title: mostEpisodesRow.title, count: Number(perShow[0]?.n ?? 0) } : null,
    platforms: [...platformCount.entries()].sort((a, b) => b[1] - a[1]).map(([platform, count]) => ({ platform, count })),
    decades: [...decadeCount.entries()].sort((a, b) => b[1] - a[1]).map(([decade, count]) => ({ decade, count })),
    headline,
  };
}

/* ------------------------------------------------------------------ */
/* "Pick something for me"                                             */
/* ------------------------------------------------------------------ */

export const MOODS = [
  { id: "any", label: "Anything", test: () => true },
  { id: "short", label: "Something short", test: (r: Row) => (r.runtime ?? 999) <= 105 && r.type !== "tv" },
  { id: "epic", label: "Something epic", test: (r: Row) => (r.runtime ?? 0) >= 140 || r.genres.some((g) => /adventure|fantasy|sci-fi/i.test(g)) },
  { id: "light", label: "Something light", test: (r: Row) => r.genres.some((g) => /comedy|family|animation|romance/i.test(g)) },
  { id: "dark", label: "Something dark", test: (r: Row) => r.genres.some((g) => /horror|thriller|crime|mystery/i.test(g)) },
  { id: "classic", label: "A classic", test: (r: Row) => (r.year ?? 9999) < 2000 },
  { id: "fresh", label: "Something new", test: (r: Row) => (r.year ?? 0) >= new Date().getUTCFullYear() - 2 },
  { id: "anime", label: "Anime / animation", test: (r: Row) => r.genres.some((g) => /animation|anime/i.test(g)) },
  { id: "underrated", label: "Underrated by me", test: (r: Row) => r.rating == null },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

export interface Pick {
  mediaId: number;
  type: MediaType;
  title: string;
  year: number | null;
  genres: string[];
  runtime: number | null;
  posterUrl: string | null;
  provider: string;
  externalId: string;
  reason: string;
}

export async function pickForMe(moodId: MoodId = "any", type?: MediaType): Promise<Pick | null> {
  const rows = await db
    .select({
      mediaId: libraryItems.mediaId,
      type: mediaItems.type,
      title: mediaItems.title,
      year: mediaItems.year,
      genres: mediaItems.genres,
      runtime: mediaItems.runtime,
      posterUrl: mediaItems.posterUrl,
      provider: mediaItems.provider,
      externalId: mediaItems.externalId,
      status: libraryItems.status,
      rating: libraryItems.rating,
    })
    .from(libraryItems)
    .innerJoin(mediaItems, eq(libraryItems.mediaId, mediaItems.id));

  const waiting = ["want_to_watch", "want_to_play", "backlog"];
  const mood = MOODS.find((m) => m.id === moodId) ?? MOODS[0];

  let pool = rows.filter(
    (r) =>
      (!type || r.type === type) &&
      (waiting.includes(r.status) || ACTIVE_STATUSES[r.type as MediaType].includes(r.status)) &&
      mood.test({ genres: r.genres ?? [], runtime: r.runtime, year: r.year, type: r.type as MediaType } as Row),
  );

  // Nothing waiting in that mood? Offer something already tracked but unwatched, then anything.
  if (!pool.length) {
    pool = rows.filter((r) => (!type || r.type === type) && waiting.includes(r.status));
  }
  if (!pool.length) {
    pool = rows.filter((r) => !type || r.type === type);
  }
  if (!pool.length) return null;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const reason =
    mood.id === "any"
      ? "Straight from your watchlist"
      : chosen.rating == null
        ? `${mood.label} · you haven't rated it yet`
        : `${mood.label} · you gave it ${chosen.rating.toFixed(1)}`;

  return {
    mediaId: chosen.mediaId,
    type: chosen.type as MediaType,
    title: chosen.title,
    year: chosen.year,
    genres: chosen.genres ?? [],
    runtime: chosen.runtime,
    posterUrl: chosen.posterUrl,
    provider: chosen.provider,
    externalId: chosen.externalId,
    reason,
  };
}

/** Fun one-liners for the home page, derived from real data. */
export async function getFunFact(): Promise<string | null> {
  const rows = await loadRows();
  if (!rows.length) return null;
  const facts: string[] = [];
  const rated = rows.filter((r) => r.rating != null);
  if (rated.length >= 3) {
    const avg = rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length;
    facts.push(`You're a ${avg >= 8 ? "generous" : avg >= 6.5 ? "fair" : "tough"} rater — your average is ${avg.toFixed(1)}/10.`);
  }
  const games = rows.filter((r) => r.type === "game" && ["backlog", "want_to_play"].includes(r.status));
  if (games.length >= 3) facts.push(`Your backlog is ${games.length} games deep. No judgement.`);
  const favorites = rows.filter((r) => r.favorite);
  if (favorites.length) facts.push(`"${favorites[Math.floor(Math.random() * favorites.length)].title}" is one of your favourites.`);
  const decades = new Map<string, number>();
  for (const r of rows) {
    if (!r.year) continue;
    const d = `${Math.floor(r.year / 10) * 10}s`;
    decades.set(d, (decades.get(d) ?? 0) + 1);
  }
  const topDecade = [...decades.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topDecade) facts.push(`You clearly love the ${topDecade[0]} — ${topDecade[1]} titles from it.`);
  const longest = [...rows].sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0))[0];
  if (longest?.runtime && longest.runtime >= 150) facts.push(`"${longest.title}" is your longest watch at ${longest.runtime} minutes.`);
  return facts[Math.floor(Math.random() * facts.length)] ?? null;
}
