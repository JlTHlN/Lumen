import type { DiscoveryKind, MediaType, NormalizedEpisode, NormalizedMedia } from "@/lib/types";
import { fetchJson, parseYear, ProviderError, RateLimiter, type MediaProvider } from "./base";
import { getSettings } from "@/lib/settings";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const limiter = new RateLimiter(90);

interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  media_type?: string;
}

interface TmdbSeason {
  season_number?: number;
  name?: string;
  episode_count?: number;
  air_date?: string | null;
  overview?: string | null;
  poster_path?: string | null;
}

interface TmdbEpisode {
  episode_number?: number;
  season_number?: number;
  name?: string;
  air_date?: string | null;
  overview?: string | null;
  still_path?: string | null;
  runtime?: number | null;
  vote_average?: number;
  guest_stars?: Array<{ name?: string }>;
}

function poster(path?: string | null, size = "w500") {
  return path ? `${IMG}/${size}${path}` : null;
}

function genreNames(item: TmdbItem): string[] {
  if (item.genres?.length) return item.genres.map((genre) => genre.name);
  const map = TMDB_GENRE_MAP[item.media_type ?? ""] ?? {};
  return (item.genre_ids ?? []).map((id) => map[id]).filter(Boolean);
}

const TMDB_GENRE_MAP: Record<string, Record<number, string>> = {
  movie: {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    53: "Thriller",
    10752: "War",
    37: "Western",
  },
  tv: {
    10759: "Action & Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    10762: "Kids",
    9648: "Mystery",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
  },
};

function normalize(item: TmdbItem, type: MediaType): NormalizedMedia {
  const title = item.title ?? item.name ?? "Untitled";
  const date = item.release_date || item.first_air_date || null;
  return {
    provider: "tmdb",
    externalId: String(item.id),
    type,
    title,
    originalTitle: item.original_title ?? item.original_name ?? title,
    year: parseYear(date),
    releaseDate: date,
    overview: item.overview ?? null,
    posterUrl: poster(item.poster_path),
    backdropUrl: poster(item.backdrop_path, "w1280"),
    trailerUrl: null,
    genres: genreNames(item),
    externalRating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
    runtime: null,
    popularity: item.popularity ?? 0,
  };
}

export class TmdbProvider implements MediaProvider {
  id = "tmdb";
  label = "TMDB";
  supports: MediaType[] = ["movie", "tv"];

  private async key(): Promise<{ apiKey: string; asBearer: boolean }> {
    const settings = await getSettings();
    const apiKey = settings.providers.tmdb.apiKey?.trim();
    if (!apiKey) throw new ProviderError("TMDB is not configured", "not_configured");
    return { apiKey, asBearer: apiKey.split(".").length > 2 || apiKey.startsWith("ey") };
  }

  async isConfigured() {
    const settings = await getSettings();
    return Boolean(settings.providers.tmdb.apiKey?.trim());
  }

  private async request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const { apiKey, asBearer } = await this.key();
    const url = new URL(BASE + path);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const init: RequestInit = { headers: { accept: "application/json" } };
    if (asBearer) (init.headers as Record<string, string>).Authorization = `Bearer ${apiKey}`;
    else url.searchParams.set("api_key", apiKey);
    return limiter.run(() => fetchJson<T>(url.toString(), init));
  }

  async search(query: string, type: MediaType): Promise<NormalizedMedia[]> {
    if (type === "game") return [];
    const data = await this.request<{ results: TmdbItem[] }>(`/search/${type}`, {
      query,
      include_adult: "false",
      page: 1,
    });
    return (data.results ?? []).slice(0, 24).map((item) => normalize(item, type));
  }

  async getDetails(externalId: string, type: MediaType): Promise<NormalizedMedia | null> {
    if (type === "game") return null;
    const append = type === "movie" ? "credits,videos,release_dates" : "credits,videos,content_ratings";
    const data = await this.request<
      TmdbItem & {
        runtime?: number | null;
        episode_run_time?: number[];
        status?: string;
        tagline?: string | null;
        homepage?: string | null;
        original_language?: string;
        production_companies?: Array<{ name?: string }>;
        production_countries?: Array<{ iso_3166_1?: string; name?: string }>;
        spoken_languages?: Array<{ english_name?: string }>;
        number_of_seasons?: number;
        number_of_episodes?: number;
        created_by?: Array<{ name?: string }>;
        networks?: Array<{ name?: string }>;
        credits?: {
          cast?: Array<{ name?: string; character?: string; profile_path?: string | null }>;
          crew?: Array<{ name?: string; job?: string; department?: string }>;
        };
        videos?: { results?: Array<{ key?: string; type?: string; site?: string; name?: string }> };
        seasons?: TmdbSeason[];
        in_production?: boolean;
        next_episode_to_air?: TmdbEpisode | null;
        last_episode_to_air?: TmdbEpisode | null;
      }
    >(`/${type}/${externalId}`, { append_to_response: append });

    const base = normalize(data, type);
    const credits = data.credits ?? {};
    const director = (credits.crew ?? []).find((member) => member.job === "Director")?.name ?? null;
    const trailer = (data.videos?.results ?? []).find(
      (video) => video.site === "YouTube" && (video.type === "Trailer" || video.type === "Teaser"),
    );
    return {
      ...base,
      runtime: type === "movie" ? data.runtime ?? null : data.episode_run_time?.[0] ?? null,
      trailerUrl: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      seasons: (data.seasons ?? [])
        .filter((season) => (season.season_number ?? 0) > 0)
        .map((season) => ({
          seasonNumber: season.season_number ?? 0,
          name: season.name ?? `Season ${season.season_number}`,
          episodeCount: season.episode_count ?? 0,
          airDate: season.air_date ?? null,
          overview: season.overview ?? null,
          posterUrl: poster(season.poster_path, "w300"),
        })),
      metadata: {
        director,
        creator: (data.created_by ?? []).map((person) => person.name).filter(Boolean)[0] ?? null,
        cast: (credits.cast ?? []).slice(0, 12).map((member) => ({
          name: member.name ?? "",
          character: member.character ?? "",
        })),
        crew: (credits.crew ?? []).slice(0, 8).map((member) => ({ name: member.name, job: member.job })),
        studios: (data.production_companies ?? []).map((company) => company.name).filter(Boolean),
        countries: (data.production_countries ?? []).map((country) => country.name).filter(Boolean),
        languages: (data.spoken_languages ?? []).map((lang) => lang.english_name).filter(Boolean),
        network: data.networks?.[0]?.name ?? null,
        status: data.status ?? null,
        tagline: data.tagline ?? null,
        homepage: data.homepage ?? null,
        numberOfSeasons: data.number_of_seasons ?? null,
        numberOfEpisodes: data.number_of_episodes ?? null,
        inProduction: data.in_production ?? false,
        nextEpisodeToAir: data.next_episode_to_air
          ? {
              season: data.next_episode_to_air.season_number ?? 0,
              episode: data.next_episode_to_air.episode_number ?? 0,
              name: data.next_episode_to_air.name ?? null,
              airDate: data.next_episode_to_air.air_date ?? null,
              overview: data.next_episode_to_air.overview ?? null,
            }
          : null,
        lastEpisodeToAir: data.last_episode_to_air
          ? {
              season: data.last_episode_to_air.season_number ?? 0,
              episode: data.last_episode_to_air.episode_number ?? 0,
              airDate: data.last_episode_to_air.air_date ?? null,
            }
          : null,
        source: "TMDB",
      },
    };
  }

  async getDiscovery(kind: DiscoveryKind, type: MediaType): Promise<NormalizedMedia[]> {
    if (type === "game") return [];
    const path =
      type === "movie"
        ? kind === "upcoming"
          ? "/movie/upcoming"
          : kind === "trending"
            ? "/trending/movie/week"
            : "/movie/popular"
        : kind === "upcoming"
          ? "/tv/on_the_air"
          : kind === "trending"
            ? "/trending/tv/week"
            : "/tv/popular";
    const data = await this.request<{ results: TmdbItem[] }>(path, { page: 1 });
    return (data.results ?? [])
      .filter((item) => (item.media_type ? item.media_type === type : true))
      .slice(0, 20)
      .map((item) => normalize({ ...item, media_type: type }, type));
  }

  async getSeason(externalId: string, season: number): Promise<NormalizedEpisode[]> {
    const data = await this.request<{ episodes?: TmdbEpisode[] }>(`/tv/${externalId}/season/${season}`);
    return (data.episodes ?? []).map((episode) => ({
      season: episode.season_number ?? season,
      episode: episode.episode_number ?? 0,
      name: episode.name ?? null,
      airDate: episode.air_date ?? null,
      overview: episode.overview ?? null,
      stillUrl: poster(episode.still_path, "w300"),
      runtime: episode.runtime ?? null,
      rating: episode.vote_average ? Math.round(episode.vote_average * 10) / 10 : null,
      guestCast: (episode.guest_stars ?? []).map((star) => star.name ?? "").filter(Boolean),
    }));
  }

  async testConnection() {
    try {
      await this.request("/configuration");
      return { ok: true, status: "connected" as const, message: "Connected successfully" };
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.status === "not_configured") {
          return { ok: false, status: "not_configured" as const, message: "Add your TMDB API key first" };
        }
        if (error.status === "auth_failed") {
          return {
            ok: false,
            status: "auth_failed" as const,
            message: "Authentication failed — check that the API key is correct",
          };
        }
        return { ok: false, status: "unavailable" as const, message: "TMDB is unreachable right now" };
      }
      return { ok: false, status: "unavailable" as const, message: "TMDB is unreachable right now" };
    }
  }
}
