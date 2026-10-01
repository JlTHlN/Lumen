import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent schema bootstrap.
 *
 * Generated from `src/db/schema.ts` via drizzle-kit, then made safe to run on
 * every boot: tables and indexes use IF NOT EXISTS, and foreign keys are guarded
 * (Postgres has no `ADD CONSTRAINT IF NOT EXISTS`).
 *
 * This is what lets a fresh Docker deployment create its own tables with no
 * manual migration step.
 */
export const BOOTSTRAP_STATEMENTS: string[] = [
  "CREATE TABLE IF NOT EXISTS \"activity_log\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"media_id\" integer,\n\t\"media_type\" text NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"action\" text NOT NULL,\n\t\"detail\" text,\n\t\"poster_url\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"app_settings\" (\n\t\"key\" text PRIMARY KEY NOT NULL,\n\t\"value\" jsonb NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"cache_entries\" (\n\t\"key\" text PRIMARY KEY NOT NULL,\n\t\"payload\" jsonb NOT NULL,\n\t\"bytes\" integer DEFAULT 0 NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"episode_records\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"media_id\" integer NOT NULL,\n\t\"season\" integer NOT NULL,\n\t\"episode\" integer NOT NULL,\n\t\"watched\" boolean DEFAULT true NOT NULL,\n\t\"rating\" double precision,\n\t\"liked\" boolean,\n\t\"watched_at\" timestamp with time zone,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"job_runs\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"job\" text NOT NULL,\n\t\"status\" text NOT NULL,\n\t\"detail\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"library_items\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"media_id\" integer NOT NULL,\n\t\"status\" text NOT NULL,\n\t\"rating\" double precision,\n\t\"liked\" boolean,\n\t\"favorite\" boolean DEFAULT false NOT NULL,\n\t\"notes\" text,\n\t\"platform\" text,\n\t\"playtime_hours\" double precision,\n\t\"started_on\" text,\n\t\"completed_on\" text,\n\t\"times_watched\" integer DEFAULT 0 NOT NULL,\n\t\"last_watched_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"list_items\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"list_id\" integer NOT NULL,\n\t\"media_id\" integer NOT NULL,\n\t\"sort_order\" integer DEFAULT 0 NOT NULL,\n\t\"added_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"lists\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"description\" text,\n\t\"media_type\" text DEFAULT 'all' NOT NULL,\n\t\"visibility\" text DEFAULT 'private' NOT NULL,\n\t\"sort_order\" integer DEFAULT 0 NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"media_items\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"type\" text NOT NULL,\n\t\"provider\" text NOT NULL,\n\t\"external_id\" text NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"original_title\" text,\n\t\"year\" integer,\n\t\"release_date\" text,\n\t\"overview\" text,\n\t\"poster_url\" text,\n\t\"backdrop_url\" text,\n\t\"trailer_url\" text,\n\t\"genres\" jsonb DEFAULT '[]'::jsonb NOT NULL,\n\t\"external_rating\" double precision,\n\t\"runtime\" integer,\n\t\"popularity\" double precision DEFAULT 0 NOT NULL,\n\t\"metadata\" jsonb DEFAULT '{}'::jsonb NOT NULL,\n\t\"seasons\" jsonb DEFAULT '[]'::jsonb NOT NULL,\n\t\"cached_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"details_fetched_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"notifications\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"body\" text,\n\t\"media_type\" text,\n\t\"media_id\" integer,\n\t\"href\" text,\n\t\"read\" boolean DEFAULT false NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS \"watch_events\" (\n\t\"id\" serial PRIMARY KEY NOT NULL,\n\t\"media_id\" integer NOT NULL,\n\t\"season\" integer,\n\t\"episode\" integer,\n\t\"occurred_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"note\" text\n);",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_log_media_id_media_items_id_fk') THEN\n    ALTER TABLE \"activity_log\" ADD CONSTRAINT \"activity_log_media_id_media_items_id_fk\" FOREIGN KEY (\"media_id\") REFERENCES \"public\".\"media_items\"(\"id\") ON DELETE cascade ON UPDATE no action;\n  END IF;\nEND $$;",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'episode_records_media_id_media_items_id_fk') THEN\n    ALTER TABLE \"episode_records\" ADD CONSTRAINT \"episode_records_media_id_media_items_id_fk\" FOREIGN KEY (\"media_id\") REFERENCES \"public\".\"media_items\"(\"id\") ON DELETE cascade ON UPDATE no action;\n  END IF;\nEND $$;",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'library_items_media_id_media_items_id_fk') THEN\n    ALTER TABLE \"library_items\" ADD CONSTRAINT \"library_items_media_id_media_items_id_fk\" FOREIGN KEY (\"media_id\") REFERENCES \"public\".\"media_items\"(\"id\") ON DELETE cascade ON UPDATE no action;\n  END IF;\nEND $$;",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'list_items_list_id_lists_id_fk') THEN\n    ALTER TABLE \"list_items\" ADD CONSTRAINT \"list_items_list_id_lists_id_fk\" FOREIGN KEY (\"list_id\") REFERENCES \"public\".\"lists\"(\"id\") ON DELETE cascade ON UPDATE no action;\n  END IF;\nEND $$;",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'list_items_media_id_media_items_id_fk') THEN\n    ALTER TABLE \"list_items\" ADD CONSTRAINT \"list_items_media_id_media_items_id_fk\" FOREIGN KEY (\"media_id\") REFERENCES \"public\".\"media_items\"(\"id\") ON DELETE cascade ON UPDATE no action;\n  END IF;\nEND $$;",
  "DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'watch_events_media_id_media_items_id_fk') THEN\n    ALTER TABLE \"watch_events\" ADD CONSTRAINT \"watch_events_media_id_media_items_id_fk\" FOREIGN KEY (\"media_id\") REFERENCES \"public\".\"media_items\"(\"id\") ON DELETE cascade ON UPDATE no action;\n  END IF;\nEND $$;",
  "CREATE INDEX IF NOT EXISTS \"activity_created_idx\" ON \"activity_log\" USING btree (\"created_at\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"episode_records_unique_idx\" ON \"episode_records\" USING btree (\"media_id\",\"season\",\"episode\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"library_items_media_idx\" ON \"library_items\" USING btree (\"media_id\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"list_items_unique_idx\" ON \"list_items\" USING btree (\"list_id\",\"media_id\");",
  "CREATE INDEX IF NOT EXISTS \"list_items_media_idx\" ON \"list_items\" USING btree (\"media_id\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"media_items_identity_idx\" ON \"media_items\" USING btree (\"provider\",\"type\",\"external_id\");",
  "CREATE INDEX IF NOT EXISTS \"media_items_type_idx\" ON \"media_items\" USING btree (\"type\");",
  "CREATE INDEX IF NOT EXISTS \"media_items_title_idx\" ON \"media_items\" USING btree (\"title\");",
  "CREATE INDEX IF NOT EXISTS \"watch_events_media_idx\" ON \"watch_events\" USING btree (\"media_id\");",
  "CREATE INDEX IF NOT EXISTS \"watch_events_occurred_idx\" ON \"watch_events\" USING btree (\"occurred_at\");",
];

export interface BootstrapResult {
  ok: boolean;
  error?: string;
  applied: number;
}

/** Runs every statement. Safe to call repeatedly. */
export async function bootstrapSchema(): Promise<BootstrapResult> {
  let applied = 0;
  try {
    for (const statement of BOOTSTRAP_STATEMENTS) {
      await db.execute(sql.raw(statement));
      applied += 1;
    }
    return { ok: true, applied };
  } catch (error) {
    return {
      ok: false,
      applied,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
