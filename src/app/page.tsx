"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost, friendlyDate, useApi } from "@/lib/client";
import { ContinueCard, MediaRow } from "@/components/media-card";
import { useTracking } from "@/components/tracking";
import { UpcomingList } from "@/components/tv-watchlist";
import { Button, Card, EmptyState, ErrorNote, PosterSkeletonRow, SectionHeader, StatCard } from "@/components/ui";
import { LumenMark } from "@/components/brand";
import { IconArrowRight, IconPlay, IconRefresh, IconSearch, IconSparkle, TypeIcon } from "@/components/icons";
import { GettingStarted, PickCard } from "@/components/insights-ui";
import type { HomeData, UpcomingView } from "@/lib/view";
import type { MediaType } from "@/lib/types";

const RAIL_TITLES: Record<MediaType, string> = { tv: "Popular shows", movie: "Popular movies", game: "Popular games" };
const RAIL_LINKS: Record<MediaType, string> = { tv: "/tv?tab=discover", movie: "/movies", game: "/games" };

export default function HomePage() {
  const { version, refresh } = useTracking();
  const { data, loading, error, refresh: reload } = useApi<HomeData>("/api/home", [version]);
  const [refreshing, setRefreshing] = useState(false);
  const first = loading && !data;

  const providersReady =
    data?.settings.providers.tmdb.configured || data?.settings.providers.igdb.configured || data?.settings.providers.rawg.configured;

  async function refreshUpcoming() {
    setRefreshing(true);
    try {
      await apiPost("/api/notifications", { action: "refresh_upcoming" });
      refresh();
    } catch {
      /* list keeps showing cached data */
    } finally {
      setRefreshing(false);
    }
  }

  const upcoming: UpcomingView[] = data
    ? [
        ...data.upcomingEpisodes,
        ...[...data.upcomingGames, ...data.upcomingMovies].map((item) => ({
          media: item.media,
          kind: "release" as const,
          airDate: item.media.releaseDate ?? null,
        })),
      ].sort((a, b) => (a.airDate ?? "9999").localeCompare(b.airDate ?? "9999"))
    : [];

  const totalHours = data
    ? Math.round(
        Number(data.stats.movie.hours ?? 0) + Number(data.stats.tv.hours ?? 0) + Number(data.stats.game.playtimeHours ?? 0),
      )
    : null;

  const greeting =
    new Date().getHours() < 5
      ? "Still up?"
      : new Date().getHours() < 12
        ? "Good morning"
        : new Date().getHours() < 18
          ? "Good afternoon"
          : "Good evening";

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-deep via-surface to-surface p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-glow/15 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-20 size-60 rounded-full bg-purple/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] text-glow uppercase">
              <LumenMark size={18} />
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {greeting}
              {data ? `, ${data.settings.profile.displayName.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {data?.continueWatching.filter((item) => item.next?.aired).length
                ? `${data.continueWatching.filter((item) => item.next?.aired).length} shows have an episode waiting for you.`
                : "What are you watching next?"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/search"
                className="press focusable inline-flex items-center gap-2 rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-bright"
              >
                <IconSearch size={16} /> Search &amp; add
              </Link>
              <Link
                href="/tv"
                className="press focusable inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-2 text-sm font-semibold text-ink hover:border-purple/50"
              >
                <IconPlay size={15} /> Up next
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
            <StatCard label="Movies" value={data?.counts.movie ?? "—"} />
            <StatCard label="Shows" value={data?.counts.tv ?? "—"} />
            <StatCard label="Games" value={data?.counts.game ?? "—"} />
            <StatCard label="Hours" value={totalHours ?? "—"} hint="tracked time" />
          </div>
        </div>
      </section>

      {data && !providersReady && !data.settings.onboarding.completed ? (
        <Card className="flex flex-col gap-3 border-purple/40 bg-purple/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Connect a metadata provider (optional)</p>
            <p className="mt-0.5 text-xs text-muted">
              The built-in catalog works now. Add TMDB / IGDB keys for full artwork, episodes and search.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/settings?tab=providers"
              className="press focusable inline-flex items-center rounded-full bg-purple px-4 py-2 text-xs font-bold text-white"
            >
              Set up providers
            </Link>
            <button
              type="button"
              onClick={async () => {
                await apiPost("/api/settings", { patch: { onboarding: { completed: true, providersSkipped: true } } }).catch(() => undefined);
                reload();
              }}
              className="press focusable rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
            >
              Later
            </button>
          </div>
        </Card>
      ) : null}

      {error && !data ? <ErrorNote message={error} onRetry={reload} /> : null}

      <section>
        <SectionHeader
          title="Continue watching"
          action={
            <Link href="/tv" className="focusable inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
              Up next
            </Link>
          }
        />
        {first ? (
          <PosterSkeletonRow />
        ) : data?.continueWatching.length ? (
          <div className="snap-rail no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {data.continueWatching.map((item) => (
              <ContinueCard key={item.media.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing in progress"
            body="Add a show and tick off an episode — it will wait for you right here."
            action={{ label: "Discover shows", href: "/tv?tab=discover" }}
          />
        )}
      </section>

      <section>
        <SectionHeader
          title="Upcoming"
          subtitle="New episodes and releases on your radar"
          action={
            <button
              type="button"
              onClick={refreshUpcoming}
              disabled={refreshing}
              className="press focusable text-xs font-semibold text-purple disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          }
        />
        <UpcomingList items={upcoming} loading={first} limit={6} />
        {upcoming.length > 6 ? (
          <Link href="/tv?tab=upcoming" className="focusable mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
            See all {upcoming.length} upcoming
          </Link>
        ) : null}
      </section>

      <GettingStarted
        providersReady={Boolean(providersReady)}
        tracked={Number(data?.counts.movie ?? 0) + Number(data?.counts.tv ?? 0) + Number(data?.counts.game ?? 0)}
        watched={Number(data?.watchedCount ?? 0)}
        rated={Number(data?.ratedCount ?? 0)}
        listsCount={Number(data?.listsCount ?? 0)}
        onDismiss={reload}
      />

      <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <PickCard />
        <Link
          href="/recap"
          className="press focusable relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-deep via-surface to-surface p-4"
        >
          <span className="absolute -top-14 -right-10 size-40 rounded-full bg-glow/20 blur-3xl" aria-hidden />
          <span className="relative flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-glow uppercase">
            <IconSparkle size={14} /> Year in review
          </span>
          <span className="relative mt-3">
            <span className="block text-lg font-black tracking-tight text-ink">
              {totalHours ?? 0} hours, {data?.counts.movie ?? 0} films, {data?.counts.tv ?? 0} shows
            </span>
            <span className="mt-1 block text-xs text-muted">See how your taste changed this year.</span>
          </span>
          <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-purple">
            Open your recap <IconArrowRight size={14} />
          </span>
        </Link>
      </section>

      {data?.gamesPlaying.length ? (
        <section>
          <SectionHeader
            title="Currently playing"
            action={
              <Link href="/games?tab=mine" className="focusable text-xs font-semibold text-purple">
                My games
              </Link>
            }
          />
          <MediaRow items={data.gamesPlaying} />
        </section>
      ) : null}

      {(["tv", "movie", "game"] as MediaType[]).map((type) => (
        <section key={type}>
          <SectionHeader
            title={RAIL_TITLES[type]}
            action={
              <Link href={RAIL_LINKS[type]} className="focusable text-xs font-semibold text-purple">
                See all
              </Link>
            }
          />
          {first ? (
            <PosterSkeletonRow />
          ) : data?.popular[type]?.length ? (
            <MediaRow items={data.popular[type]} />
          ) : (
            <Card className="p-4 text-sm text-muted">We couldn&apos;t load popular titles right now.</Card>
          )}
        </section>
      ))}

      {data?.providerError ? (
        <Card className="border-warn/40 bg-warn/10 p-4 text-sm text-ink">
          {data.providerError}
          <p className="mt-1 text-xs text-muted">Your existing library is still available.</p>
        </Card>
      ) : null}

      <section>
        <SectionHeader title="Recent activity" />
        {first ? (
          <div className="shimmer h-24 rounded-2xl bg-elevated" />
        ) : data?.activity.length ? (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {data.activity.slice(0, 8).map((event) => (
              <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated text-glow">
                  <TypeIcon type={event.mediaType} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{event.title}</p>
                  <p className="truncate text-xs text-muted">{event.detail ?? event.action}</p>
                </div>
                <span className="shrink-0 text-[11px] text-faint">{friendlyDate(event.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No activity yet"
            body="Your history fills up as you track things. Start with something you watched recently."
            action={{ label: "Explore movies", href: "/movies" }}
          />
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 p-4">
        <div className="flex items-center gap-3">
          <LumenMark size={32} />
          <div className="text-xs text-muted">
            <p className="font-semibold text-ink">Lumen</p>
            <p>Private, self-hosted, yours.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/settings" className="focusable inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
            Settings
          </Link>
          <Link href="/about" className="focusable text-xs font-semibold text-muted hover:text-ink">
            About
          </Link>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          <IconRefresh size={14} /> Refresh
        </Button>
      </section>
    </div>
  );
}
