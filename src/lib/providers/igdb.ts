import type { DiscoveryKind, MediaType, NormalizedMedia } from "@/lib/types";
import { fetchJson, parseYear, ProviderError, RateLimiter, type MediaProvider } from "./base";
import { getSettings, invalidateSettings } from "@/lib/settings";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptSecret } from "@/lib/crypto";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_URL = "https://api.igdb.com/v4/games";
/** IGDB documents a 4 requests/second limit. */
const limiter = new RateLimiter(280);

interface IgdbGame {
  id: number;
  name?: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  rating?: number;
  aggregated_rating?: number;
  total_rating?: number;
  url?: string;
  cover?: { image_id?: string };
  artworks?: Array<{ image_id?: string }>;
  screenshots?: Array<{ image_id?: string }>;
  genres?: Array<{ name?: string }>;
  platforms?: Array<{ name?: string; abbreviation?: string }>;
  involved_companies?: Array<{ company?: { name?: string }; developer?: boolean; publisher?: boolean }>;
  websites?: Array<{ url?: string; category?: number }>;
  videos?: Array<{ video_id?: string; name?: string }>;
  hypes?: number;
}

function igdbImage(imageId?: string, size = "cover_big"): string | null {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : null;
}

function normalize(game: IgdbGame): NormalizedMedia {
  const developers = (game.involved_companies ?? [])
    .filter((company) => company.developer)
    .map((company) => company.company?.name ?? "")
    .filter(Boolean);
  const publishers = (game.involved_companies ?? [])
    .filter((company) => company.publisher)
    .map((company) => company.company?.name ?? "")
    .filter(Boolean);
  const date = game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null;
  const rating = game.total_rating ?? game.rating ?? game.aggregated_rating ?? null;
  const website = (game.websites ?? []).find((site) => site.category === 1)?.url ?? game.url ?? null;
  return {
    provider: "igdb",
    externalId: String(game.id),
    type: "game",
    title: game.name ?? "Untitled",
    originalTitle: game.name ?? null,
    year: parseYear(date),
    releaseDate: date,
    overview: game.summary ?? game.storyline ?? null,
    posterUrl: igdbImage(game.cover?.image_id),
    backdropUrl: igdbImage(game.artworks?.[0]?.image_id ?? undefined, "1080p"),
    trailerUrl: game.videos?.[0]?.video_id
      ? `https://www.youtube.com/watch?v=${game.videos[0].video_id}`
      : null,
    genres: (game.genres ?? []).map((genre) => genre.name ?? "").filter(Boolean),
    externalRating: rating ? Math.round(rating * 10) / 10 : null,
    runtime: null,
    popularity: game.hypes ?? 0,
    metadata: {
      developers,
      publishers,
      platforms: (game.platforms ?? []).map((platform) => platform.abbreviation ?? platform.name ?? "").filter(Boolean),
      screenshots: (game.screenshots ?? []).slice(0, 6).map((shot) => igdbImage(shot.image_id, "screenshot_huge")),
      website,
      storyline: game.storyline ?? null,
      source: "IGDB",
    },
  };
}

const FIELDS =
  "fields name,summary,storyline,first_release_date,rating,aggregated_rating,total_rating,hypes,url,cover.image_id,artworks.image_id,screenshots.image_id,genres.name,platforms.name,platforms.abbreviation,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,websites.url,websites.category,videos.video_id";

export class IgdbProvider implements MediaProvider {
  id = "igdb";
  label = "IGDB";
  supports: MediaType[] = ["game"];

  async isConfigured() {
    const settings = await getSettings();
    return Boolean(settings.providers.igdb.clientId && settings.providers.igdb.clientSecret);
  }

  private async clientId() {
    const settings = await getSettings();
    const id = settings.providers.igdb.clientId?.trim();
    if (!id) throw new ProviderError("IGDB is not configured", "not_configured");
    return id;
  }

  /** Obtain (and cache) an app access token; never ask the user for one. */
  private async accessToken(force = false): Promise<string> {
    const settings = await getSettings();
    const { clientId, clientSecret, token, tokenExpiresAt } = settings.providers.igdb;
    if (!clientId || !clientSecret) throw new ProviderError("IGDB is not configured", "not_configured");
    if (!force && token && tokenExpiresAt && new Date(tokenExpiresAt).getTime() > Date.now() + 60_000) {
      return token;
    }
    const url = `${TOKEN_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(
      clientSecret,
    )}&grant_type=client_credentials`;
    const response = await fetchJson<{ access_token: string; expires_in: number }>(url, { method: "POST" });
    const expiresAt = new Date(Date.now() + (response.expires_in ?? 3600) * 1000).toISOString();
    // Persist the token in the encrypted secrets row.
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "secrets")).limit(1);
    const secrets = (rows[0]?.value as Record<string, string> | undefined) ?? {};
    const next = {
      ...secrets,
      "providers.igdb.token": encryptSecret(response.access_token),
      "providers.igdb.tokenExpiresAt": encryptSecret(expiresAt),
    };
    await db
      .insert(appSettings)
      .values({ key: "secrets", value: next as never, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: next as never, updatedAt: new Date() } });
    invalidateSettings();
    return response.access_token;
  }

  private async query(body: string): Promise<IgdbGame[]> {
    const clientId = await this.clientId();
    const token = await this.accessToken();
    const request = () =>
      fetchJson<IgdbGame[]>(IGDB_URL, {
        method: "POST",
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body,
      });
    try {
      return await limiter.run(request);
    } catch (error) {
      if (error instanceof ProviderError && error.status === "auth_failed") {
        // token may have been revoked — refresh once and retry
        const fresh = await this.accessToken(true);
        return limiter.run(() =>
          fetchJson<IgdbGame[]>(IGDB_URL, {
            method: "POST",
            headers: { "Client-ID": clientId, Authorization: `Bearer ${fresh}`, Accept: "application/json" },
            body,
          }),
        );
      }
      throw error;
    }
  }

  async search(query: string, type: MediaType): Promise<NormalizedMedia[]> {
    if (type !== "game") return [];
    const games = await this.query(`${FIELDS}; search "${query.replace(/"/g, "")}"; limit 24;`);
    return games.map(normalize);
  }

  async getDetails(externalId: string, type: MediaType): Promise<NormalizedMedia | null> {
    if (type !== "game") return null;
    const games = await this.query(`${FIELDS}; where id = ${Number(externalId)}; limit 1;`);
    if (!games.length) return null;
    return normalize(games[0]);
  }

  async getDiscovery(kind: DiscoveryKind, type: MediaType): Promise<NormalizedMedia[]> {
    if (type !== "game") return [];
    const now = Math.floor(Date.now() / 1000);
    const limit = "limit 20;";
    const body =
      kind === "upcoming"
        ? `${FIELDS}; where cover != null & first_release_date > ${now}; sort first_release_date asc; ${limit}`
        : kind === "trending"
          ? `${FIELDS}; where cover != null & hypes != null; sort hypes desc; ${limit}`
          : `${FIELDS}; where cover != null & total_rating != null; sort total_rating desc; ${limit}`;
    const games = await this.query(body);
    return games.map(normalize);
  }

  async testConnection() {
    try {
      const games = await this.query("fields name; limit 1;");
      if (!games.length) {
        return { ok: true, status: "connected" as const, message: "Connected successfully" };
      }
      return { ok: true, status: "connected" as const, message: "Connected successfully" };
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.status === "not_configured") {
          return {
            ok: false,
            status: "not_configured" as const,
            message: "Add your IGDB Client ID and Client Secret first",
          };
        }
        if (error.status === "auth_failed") {
          return {
            ok: false,
            status: "auth_failed" as const,
            message: "Authentication failed — verify your Twitch Client ID and Secret",
          };
        }
        return { ok: false, status: "unavailable" as const, message: "IGDB is unreachable right now" };
      }
      return { ok: false, status: "unavailable" as const, message: "IGDB is unreachable right now" };
    }
  }
}
