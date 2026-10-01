import type { LibraryEntry, MediaRecord, MediaType, NormalizedEpisode } from "./types";

export interface ItemView {
  media: MediaRecord;
  entry: LibraryEntry | null;
  watchedEpisodes?: number;
  totalEpisodes?: number;
  nextEpisode?: { season: number; episode: number; name?: string | null; airDate?: string | null } | null;
}

export interface UpNextView extends ItemView {
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

export interface UpNextData {
  upNext: UpNextView[];
  upcoming: UpcomingView[];
}

export interface UpcomingView {
  media: MediaRecord;
  kind: "episode" | "release" | "season";
  season?: number;
  episode?: number;
  name?: string | null;
  airDate: string | null;
}

export interface ActivityView {
  id: number;
  mediaType: string;
  title: string;
  action: string;
  detail: string | null;
  posterUrl: string | null;
  createdAt: string;
}

export interface DiscoveryView {
  items: ItemView[];
  topGenres: string[];
  offline: boolean;
  error: string | null;
}

export interface HomeData {
  settings: {
    appName: string;
    profile: { displayName: string; avatar: string; username: string; timezone: string; joinedAt: string; bio: string };
    providers: { tmdb: { configured: boolean }; igdb: { configured: boolean }; rawg: { configured: boolean }; game: string };
    onboarding: { completed: boolean };
  };
  upNext: UpNextView[];
  continueWatching: UpNextView[];
  favorites: ItemView[];
  moviesPlaying: ItemView[];
  gamesPlaying: ItemView[];
  recentlyWatched: ItemView[];
  recentlyCompletedShows: ItemView[];
  recentlyPlayed: ItemView[];
  upcomingEpisodes: UpcomingView[];
  upcomingMovies: ItemView[];
  upcomingGames: ItemView[];
  activity: ActivityView[];
  popular: Record<MediaType, ItemView[]>;
  providerError: string | null;
  offline: boolean;
  stats: Record<MediaType, Record<string, unknown>>;
  unread: number;
  counts: Record<MediaType, number>;
  listsCount: number;
  ratedCount: number;
  watchedCount: number;
}

export interface EpisodeView extends NormalizedEpisode {
  watched: boolean;
  myRating: number | null;
  liked: boolean | null;
  watchedAt: string | null;
  aired: boolean;
}

export interface DetailData {
  media: MediaRecord;
  entry: LibraryEntry | null;
  episodes: EpisodeView[];
  season: number | null;
  episodeError: string | null;
  ongoing: boolean;
  watchedEpisodes: number;
  totalEpisodes: number;
  nextEpisode: { season: number; episode: number } | null;
  offline: boolean;
  fromCache: boolean;
}

export interface LibraryData {
  items: ItemView[];
}

export interface ListsData {
  lists: Array<{
    id: number;
    name: string;
    description: string | null;
    mediaType: string;
    itemCount: number;
  }>;
}

export interface ListDetailData {
  list: { id: number; name: string; description: string | null; mediaType: string };
  items: ItemView[];
}

export interface StatsData {
  stats: Record<string, unknown> & { kind: MediaType };
  topGenres: string[];
  recommended: ItemView[];
}

export interface SettingsData {
  settings: {
    appName: string;
    profile: HomeData["settings"]["profile"];
    providers: HomeData["settings"]["providers"] & {
      igdb: { configured: boolean; masked: string | null };
      rawg: { configured: boolean; masked: string | null };
      tmdb: { configured: boolean; masked: string | null };
    };
    cache: {
      movieDays: number;
      showDays: number;
      episodeHours: number;
      popularHours: number;
      upcomingHours: number;
      imageCaching: boolean;
    };
    notifications: {
      telegram: { configured: boolean; maskedToken: string | null; chatIdMasked: string | null };
      events: Record<string, boolean>;
      digest: string;
      bot: { enabled: boolean };
    };
    appearance: { theme: string; accent: string };
    jobs: { refreshHours: number; enabled: boolean };
    onboarding: { completed: boolean; providersSkipped: boolean };
  };
  system: {
    cacheEntries: number;
    cacheBytes: number;
    cacheHuman: string;
    metadataBytes: string;
    providers: { tmdb: boolean; igdb: boolean; rawg: boolean };
    version: string;
  };
}

export interface NotificationsData {
  items: Array<{
    id: number;
    title: string;
    body: string | null;
    read: boolean;
    createdAt: string;
    href: string | null;
  }>;
  unread: number;
}

/* ------------------------------------------------------------------ */
/* Insights: badges, streaks, recap, picks                             */
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

export interface StreakInfo {
  current: number;
  longest: number;
  totalDays: number;
  bestDay: { date: string; count: number } | null;
}

export interface InsightsAchievements {
  all: Achievement[];
  unlocked: number;
  score: number;
  streak: StreakInfo;
  moods: Array<{ id: string; label: string }>;
}

export interface RecapData {
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

export interface RecapView {
  recap: RecapData;
  achievements: Omit<InsightsAchievements, "streak" | "moods">;
  streak: StreakInfo;
}

export interface InsightsPickData {
  pick: {
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
  } | null;
  moods: Array<{ id: string; label: string }>;
  message: string | null;
}

export interface HeatmapData {
  heatmap: { days: Array<{ date: string; count: number }>; max: number };
  streak: StreakInfo;
  fact: string | null;
}
