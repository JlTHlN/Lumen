import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Normalized, shared metadata. Personal tracking data never lives here.
 */
export const mediaItems = pgTable(
  "media_items",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // movie | tv | game
    provider: text("provider").notNull(), // tmdb | igdb | rawg | local
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    releaseDate: text("release_date"), // YYYY-MM-DD
    overview: text("overview"),
    posterUrl: text("poster_url"),
    backdropUrl: text("backdrop_url"),
    trailerUrl: text("trailer_url"),
    genres: jsonb("genres").$type<string[]>().default([]).notNull(),
    externalRating: doublePrecision("external_rating"),
    runtime: integer("runtime"), // minutes (movie) or avg episode runtime (tv)
    popularity: doublePrecision("popularity").default(0).notNull(),
    /** Provider specific extras: cast, director, platforms, developers ... */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    /** Cached season index for TV shows */
    seasons: jsonb("seasons")
      .$type<
        Array<{
          seasonNumber: number;
          name: string;
          episodeCount: number;
          airDate: string | null;
          overview: string | null;
          posterUrl: string | null;
        }>
      >()
      .default([])
      .notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
    /** Set only when full details (runtime, cast, seasons…) were fetched. */
    detailsFetchedAt: timestamp("details_fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("media_items_identity_idx").on(table.provider, table.type, table.externalId),
    index("media_items_type_idx").on(table.type),
    index("media_items_title_idx").on(table.title),
  ],
);

/**
 * A single-user library entry (personal tracking record).
 */
export const libraryItems = pgTable(
  "library_items",
  {
    id: serial("id").primaryKey(),
    mediaId: integer("media_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    rating: doublePrecision("rating"),
    liked: boolean("liked"),
    favorite: boolean("favorite").default(false).notNull(),
    notes: text("notes"),
    platform: text("platform"),
    playtimeHours: doublePrecision("playtime_hours"),
    startedOn: text("started_on"),
    completedOn: text("completed_on"),
    timesWatched: integer("times_watched").default(0).notNull(),
    lastWatchedAt: timestamp("last_watched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("library_items_media_idx").on(table.mediaId)],
);

export const episodeRecords = pgTable(
  "episode_records",
  {
    id: serial("id").primaryKey(),
    mediaId: integer("media_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    episode: integer("episode").notNull(),
    watched: boolean("watched").default(true).notNull(),
    rating: doublePrecision("rating"),
    liked: boolean("liked"),
    watchedAt: timestamp("watched_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("episode_records_unique_idx").on(table.mediaId, table.season, table.episode)],
);

export const watchEvents = pgTable(
  "watch_events",
  {
    id: serial("id").primaryKey(),
    mediaId: integer("media_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    season: integer("season"),
    episode: integer("episode"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
  },
  (table) => [
    index("watch_events_media_idx").on(table.mediaId),
    index("watch_events_occurred_idx").on(table.occurredAt),
  ],
);

export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  mediaType: text("media_type").default("all").notNull(), // all | movie | tv | game
  visibility: text("visibility").default("private").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const listItems = pgTable(
  "list_items",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("list_items_unique_idx").on(table.listId, table.mediaId),
    index("list_items_media_idx").on(table.mediaId),
  ],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cacheEntries = pgTable("cache_entries", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  bytes: integer("bytes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    mediaId: integer("media_id").references(() => mediaItems.id, { onDelete: "cascade" }),
    mediaType: text("media_type").notNull(),
    title: text("title").notNull(),
    action: text("action").notNull(),
    detail: text("detail"),
    posterUrl: text("poster_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("activity_created_idx").on(table.createdAt)],
);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  mediaType: text("media_type"),
  mediaId: integer("media_id"),
  href: text("href"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobRuns = pgTable("job_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
