export type MediaType = "movie" | "tv" | "game";

export const MEDIA_TYPES: MediaType[] = ["movie", "tv", "game"];

export const MEDIA_LABEL: Record<MediaType, string> = {
  movie: "Movies",
  tv: "TV Shows",
  game: "Games",
};

export const MEDIA_SINGULAR: Record<MediaType, string> = {
  movie: "Movie",
  tv: "Show",
  game: "Game",
};

export const MOVIE_STATUSES = [
  "want_to_watch",
  "watching",
  "watched",
  "on_hold",
  "dropped",
] as const;

export const TV_STATUSES = [
  "want_to_watch",
  "watching",
  "watching_again",
  "on_hold",
  "completed",
  "dropped",
] as const;

export const GAME_STATUSES = [
  "backlog",
  "want_to_play",
  "playing",
  "on_hold",
  "completed",
  "dropped",
] as const;

export type StatusValue =
  | (typeof MOVIE_STATUSES)[number]
  | (typeof TV_STATUSES)[number]
  | (typeof GAME_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  want_to_watch: "Want to Watch",
  want_to_play: "Want to Play",
  watching: "Currently Watching",
  watching_again: "Watching Again",
  watched: "Watched",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
  backlog: "Backlog",
  playing: "Currently Playing",
};

export const STATUS_ORDER: Record<MediaType, readonly string[]> = {
  movie: MOVIE_STATUSES,
  tv: TV_STATUSES,
  game: GAME_STATUSES,
};

export function statusesFor(type: MediaType): readonly string[] {
  return STATUS_ORDER[type];
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "Not tracked";
  return STATUS_LABEL[status] ?? status;
}

/** Statuses considered "in progress" for continue-watching rails. */
export const ACTIVE_STATUSES: Record<MediaType, string[]> = {
  movie: ["watching"],
  tv: ["watching", "watching_again"],
  game: ["playing"],
};

export interface NormalizedMedia {
  provider: string;
  externalId: string;
  type: MediaType;
  title: string;
  originalTitle?: string | null;
  year?: number | null;
  releaseDate?: string | null;
  overview?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null;
  genres?: string[];
  externalRating?: number | null;
  runtime?: number | null;
  popularity?: number | null;
  metadata?: Record<string, unknown>;
  seasons?: Array<{
    seasonNumber: number;
    name: string;
    episodeCount: number;
    airDate?: string | null;
    overview?: string | null;
    posterUrl?: string | null;
  }>;
}

export interface NormalizedEpisode {
  season: number;
  episode: number;
  name: string | null;
  airDate: string | null;
  overview: string | null;
  stillUrl: string | null;
  runtime: number | null;
  rating: number | null;
  guestCast?: string[];
  network?: string | null;
}

export interface MediaRecord extends NormalizedMedia {
  id: number;
}

export interface LibraryEntry {
  id: number;
  mediaId: number;
  status: string;
  rating: number | null;
  liked: boolean | null;
  favorite: boolean;
  notes: string | null;
  platform: string | null;
  playtimeHours: number | null;
  startedOn: string | null;
  completedOn: string | null;
  timesWatched: number;
  lastWatchedAt: string | null;
  updatedAt: string;
}

export interface LibraryMedia {
  media: MediaRecord;
  entry: LibraryEntry | null;
  watchedEpisodes?: number;
  totalEpisodes?: number;
  nextEpisode?: { season: number; episode: number; name: string | null; airDate: string | null } | null;
}

export type DiscoveryKind = "popular" | "trending" | "upcoming" | "recommended";

export const DISCOVERY_LABEL: Record<DiscoveryKind, string> = {
  popular: "Popular",
  trending: "Trending",
  upcoming: "Upcoming",
  recommended: "Because you watch",
};
