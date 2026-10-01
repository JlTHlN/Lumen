import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";

export interface AppSettings {
  appName: string;
  profile: {
    username: string;
    displayName: string;
    bio: string;
    avatar: string;
    timezone: string;
    joinedAt: string;
  };
  providers: {
    movieTv: "tmdb";
    game: "igdb" | "rawg";
    tmdb: { apiKey: string };
    igdb: { clientId: string; clientSecret: string; token: string; tokenExpiresAt: string };
    rawg: { apiKey: string };
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
    telegram: { botToken: string; chatId: string };
    events: {
      newEpisode: boolean;
      upcomingEpisode: boolean;
      gameRelease: boolean;
      movieRelease: boolean;
      reminder: boolean;
    };
    digest: "instant" | "daily" | "weekly";
    bot: { enabled: boolean };
  };
  appearance: { theme: "dark" | "system"; accent: "purple" };
  jobs: { refreshHours: number; enabled: boolean };
  onboarding: { completed: boolean; providersSkipped: boolean };
}

type SecretShape = {
  providers: {
    tmdb: { apiKey: string };
    igdb: { clientId: string; clientSecret: string; token: string; tokenExpiresAt: string };
    rawg: { apiKey: string };
  };
  notifications: { telegram: { botToken: string; chatId: string } };
};

export const DEFAULT_SETTINGS: AppSettings = {
  appName: "Lumen",
  profile: {
    username: "you",
    displayName: "Media Lover",
    bio: "Tracking everything I watch and play.",
    avatar: "🎬",
    timezone: "UTC",
    joinedAt: new Date().toISOString(),
  },
  providers: {
    movieTv: "tmdb",
    game: "igdb",
    tmdb: { apiKey: "" },
    igdb: { clientId: "", clientSecret: "", token: "", tokenExpiresAt: "" },
    rawg: { apiKey: "" },
  },
  cache: {
    movieDays: 30,
    showDays: 14,
    episodeHours: 24,
    popularHours: 6,
    upcomingHours: 6,
    imageCaching: false,
  },
  notifications: {
    telegram: { botToken: "", chatId: "" },
    events: {
      newEpisode: true,
      upcomingEpisode: true,
      gameRelease: false,
      movieRelease: false,
      reminder: false,
    },
    digest: "instant",
    bot: { enabled: true },
  },
  appearance: { theme: "dark", accent: "purple" },
  jobs: { refreshHours: 6, enabled: true },
  onboarding: { completed: false, providersSkipped: false },
};

const SECRET_PATHS = [
  "providers.tmdb.apiKey",
  "providers.igdb.clientId",
  "providers.igdb.clientSecret",
  "providers.igdb.token",
  "providers.igdb.tokenExpiresAt",
  "providers.rawg.apiKey",
  "notifications.telegram.botToken",
  "notifications.telegram.chatId",
];

function pickSecrets(source: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of SECRET_PATHS) {
    out[path] = String(path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, source) ?? "");
  }
  return out;
}

function applySecrets(target: Record<string, unknown>, secrets: Record<string, string>) {
  for (const [path, raw] of Object.entries(secrets)) {
    const value = decryptSecret(raw);
    const parts = path.split(".");
    let cursor: Record<string, unknown> = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base) || Array.isArray(patch)) return patch as T;
  if (typeof base === "object" && typeof patch === "object" && base !== null) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (value === undefined) continue;
      const current = (base as Record<string, unknown>)[key];
      if (
        current &&
        typeof current === "object" &&
        !Array.isArray(current) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        out[key] = deepMerge(current, value);
      } else {
        out[key] = value;
      }
    }
    return out as T;
  }
  return patch as T;
}

function blankSecrets(settings: AppSettings): AppSettings {
  const clone: AppSettings = JSON.parse(JSON.stringify(settings));
  clone.providers.tmdb.apiKey = "";
  clone.providers.igdb.clientId = "";
  clone.providers.igdb.clientSecret = "";
  clone.providers.igdb.token = "";
  clone.providers.igdb.tokenExpiresAt = "";
  clone.providers.rawg.apiKey = "";
  clone.notifications.telegram.botToken = "";
  clone.notifications.telegram.chatId = "";
  return clone;
}

async function readRows(): Promise<Record<string, unknown>> {
  try {
    const rows = await db.select().from(appSettings);
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch {
    return {};
  }
}

const globalForSettings = globalThis as typeof globalThis & {
  __settingsCache?: { value: AppSettings; at: number } | null;
};
const SETTINGS_TTL_MS = 15_000;

export function invalidateSettings() {
  globalForSettings.__settingsCache = null;
}

/** Full settings with secrets decrypted (server-side only). Memoised briefly. */
export async function getSettings(): Promise<AppSettings> {
  const cached = globalForSettings.__settingsCache;
  if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) return cached.value;
  const value = await loadSettings();
  globalForSettings.__settingsCache = { value, at: Date.now() };
  return value;
}

async function loadSettings(): Promise<AppSettings> {
  const rows = await readRows();
  const base = deepMerge(DEFAULT_SETTINGS, rows.settings ?? {}) as AppSettings;
  const secrets = (rows.secrets as Record<string, string> | undefined) ?? {};
  const target = blankSecrets(base) as unknown as Record<string, unknown>;
  applySecrets(target, secrets);
  return target as unknown as AppSettings;
}

async function writeRow(key: string, value: unknown) {
  invalidateSettings();
  await db
    .insert(appSettings)
    .values({ key, value: value as never, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: value as never, updatedAt: new Date() } });
}

export async function saveSettings(patch: unknown): Promise<AppSettings> {
  const patchRecord = (patch ?? {}) as Record<string, unknown>;
  const incomingSecrets = pickSecrets(patchRecord);
  const sanitizedPatch = blankSecrets(deepMerge(blankSecrets(DEFAULT_SETTINGS), patchRecord));
  const current = await getSettings();
  const nextPublic = deepMerge(blankSecrets(current), sanitizedPatch);
  const existingSecretsRow = ((await readRows()).secrets as Record<string, string> | undefined) ?? {};
  const mergedSecrets: Record<string, string> = { ...existingSecretsRow };
  for (const [path, value] of Object.entries(incomingSecrets)) {
    if (value === "") continue; // empty means "unchanged" so masked values never wipe keys
    mergedSecrets[path] = encryptSecret(value);
  }
  await writeRow("settings", nextPublic);
  await writeRow("secrets", mergedSecrets);
  invalidateSettings();
  return getSettings();
}

export async function setSettingValue(key: string, value: unknown) {
  await writeRow(key, value);
}

export async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const rows = await readRows();
  return (rows[key] as T | undefined) ?? fallback;
}

/** Client-safe view: secrets are never returned, only masked hints. */
export function publicSettings(settings: AppSettings) {
  return {
    appName: settings.appName,
    profile: settings.profile,
    providers: {
      movieTv: settings.providers.movieTv,
      game: settings.providers.game,
      tmdb: { configured: Boolean(settings.providers.tmdb.apiKey), masked: maskSecret(settings.providers.tmdb.apiKey) },
      igdb: {
        configured: Boolean(settings.providers.igdb.clientId && settings.providers.igdb.clientSecret),
        masked: maskSecret(settings.providers.igdb.clientId),
      },
      rawg: { configured: Boolean(settings.providers.rawg.apiKey), masked: maskSecret(settings.providers.rawg.apiKey) },
    },
    cache: settings.cache,
    notifications: {
      telegram: {
        configured: Boolean(
          settings.notifications.telegram.botToken && settings.notifications.telegram.chatId,
        ),
        maskedToken: maskSecret(settings.notifications.telegram.botToken),
        chatIdMasked: maskSecret(settings.notifications.telegram.chatId),
      },
      events: settings.notifications.events,
      digest: settings.notifications.digest,
      bot: settings.notifications.bot,
    },
    appearance: settings.appearance,
    jobs: settings.jobs,
    onboarding: settings.onboarding,
  };
}

export type PublicSettings = ReturnType<typeof publicSettings>;
export type { SecretShape };
