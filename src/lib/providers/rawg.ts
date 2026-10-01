import type { DiscoveryKind, MediaType, NormalizedMedia } from "@/lib/types";
import { fetchJson, parseYear, ProviderError, RateLimiter, type MediaProvider } from "./base";
import { getSettings } from "@/lib/settings";

const BASE = "https://api.rawg.io/api";
const limiter = new RateLimiter(120);

interface RawgGame {
  id: number;
  name?: string;
  slug?: string;
  released?: string | null;
  background_image?: string | null;
  rating?: number;
  ratings_count?: number;
  added?: number;
  metacritic?: number | null;
  description_raw?: string;
  genres?: Array<{ name?: string }>;
  platforms?: Array<{ platform?: { name?: string } }>;
  parent_platforms?: Array<{ platform?: { name?: string } }>;
  developers?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  website?: string;
  stores?: Array<{ url?: string; store?: { name?: string } }>;
  short_screenshots?: Array<{ image?: string }>;
  esrb_rating?: { name?: string };
  playtime?: number;
}

function normalize(game: RawgGame): NormalizedMedia {
  return {
    provider: "rawg",
    externalId: String(game.id),
    type: "game",
    title: game.name ?? "Untitled",
    originalTitle: game.name ?? null,
    year: parseYear(game.released ?? null),
    releaseDate: game.released ?? null,
    overview: game.description_raw ?? null,
    posterUrl: game.background_image ?? null,
    backdropUrl: game.background_image ?? null,
    trailerUrl: null,
    genres: (game.genres ?? []).map((genre) => genre.name ?? "").filter(Boolean),
    externalRating: game.rating ? Math.round(game.rating * 2 * 10) / 10 : null,
    runtime: null,
    popularity: game.added ?? 0,
    metadata: {
      developers: (game.developers ?? []).map((dev) => dev.name ?? "").filter(Boolean),
      publishers: (game.publishers ?? []).map((pub) => pub.name ?? "").filter(Boolean),
      platforms: (game.platforms ?? [])
        .map((entry) => entry.platform?.name ?? "")
        .filter(Boolean),
      screenshots: (game.short_screenshots ?? []).slice(1, 6).map((shot) => shot.image).filter(Boolean),
      website: game.website ?? null,
      metacritic: game.metacritic ?? null,
      averagePlaytime: game.playtime ?? null,
      stores: (game.stores ?? [])
        .filter((store) => store.url)
        .map((store) => ({ name: store.store?.name ?? "Store", url: store.url })),
      esrb: game.esrb_rating?.name ?? null,
      source: "RAWG",
    },
  };
}

export class RawgProvider implements MediaProvider {
  id = "rawg";
  label = "RAWG";
  supports: MediaType[] = ["game"];

  async isConfigured() {
    const settings = await getSettings();
    return Boolean(settings.providers.rawg.apiKey?.trim());
  }

  private async key() {
    const settings = await getSettings();
    const key = settings.providers.rawg.apiKey?.trim();
    if (!key) throw new ProviderError("RAWG is not configured", "not_configured");
    return key;
  }

  private async request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const key = await this.key();
    const url = new URL(BASE + path);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    url.searchParams.set("key", key);
    return limiter.run(() => fetchJson<T>(url.toString()));
  }

  async search(query: string, type: MediaType): Promise<NormalizedMedia[]> {
    if (type !== "game") return [];
    const data = await this.request<{ results?: RawgGame[] }>("/games", {
      search: query,
      page_size: 24,
    });
    return (data.results ?? []).map(normalize);
  }

  async getDetails(externalId: string, type: MediaType): Promise<NormalizedMedia | null> {
    if (type !== "game") return null;
    const game = await this.request<RawgGame>(`/games/${externalId}`);
    return normalize(game);
  }

  async getDiscovery(kind: DiscoveryKind, type: MediaType): Promise<NormalizedMedia[]> {
    if (type !== "game") return [];
    const params: Record<string, string | number> = { page_size: 20 };
    if (kind === "upcoming") {
      const start = new Date();
      const end = new Date(Date.now() + 400 * 24 * 3600 * 1000);
      params.dates = `${start.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}`;
      params.ordering = "released";
    } else if (kind === "trending") {
      params.ordering = "-added";
      params.dates = `${new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().slice(0, 10)},${new Date()
        .toISOString()
        .slice(0, 10)}`;
    } else {
      params.ordering = "-metacritic";
    }
    const data = await this.request<{ results?: RawgGame[] }>("/games", params);
    return (data.results ?? []).map(normalize);
  }

  async testConnection() {
    try {
      await this.request("/games", { page_size: 1 });
      return { ok: true, status: "connected" as const, message: "Connected successfully" };
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.status === "not_configured") {
          return { ok: false, status: "not_configured" as const, message: "Add your RAWG API key first" };
        }
        if (error.status === "auth_failed") {
          return {
            ok: false,
            status: "auth_failed" as const,
            message: "Authentication failed — check that the RAWG key is correct",
          };
        }
        return { ok: false, status: "unavailable" as const, message: "RAWG is unreachable right now" };
      }
      return { ok: false, status: "unavailable" as const, message: "RAWG is unreachable right now" };
    }
  }
}
