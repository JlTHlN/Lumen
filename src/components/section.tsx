"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/lib/client";
import { MediaGrid, MediaGridSkeleton, MediaRow } from "@/components/media-card";
import { useTracking } from "@/components/tracking";
import { UpcomingList, UpNextList } from "@/components/tv-watchlist";
import { RatingDistribution } from "@/components/insights-ui";
import { Button, Card, Chip, EmptyState, ErrorNote, PageHeader, SectionHeader, StatCard, Tabs } from "@/components/ui";
import { MEDIA_LABEL, MEDIA_SINGULAR, statusLabel, statusesFor, type MediaType } from "@/lib/types";
import type { DiscoveryView, ItemView, LibraryData, ListsData, StatsData, UpNextData } from "@/lib/view";
import { IconHeart, IconSearch } from "@/components/icons";

const SECTIONS: Record<MediaType, { base: string; mine: string; empty: string; emptyBody: string }> = {
  movie: { base: "movies", mine: "My Movies", empty: "No movies yet", emptyBody: "Start building your movie history." },
  tv: { base: "tv", mine: "My Shows", empty: "You're not following any shows yet", emptyBody: "Track a show to unlock progress and upcoming episodes." },
  game: { base: "games", mine: "My Games", empty: "Your gaming backlog is empty", emptyBody: "Add games you want to play." },
};

function tabsFor(type: MediaType) {
  const common = [
    { id: "discover", label: "Discover" },
    { id: "mine", label: SECTIONS[type].mine },
    { id: "lists", label: "Lists" },
    { id: "stats", label: "Stats" },
  ];
  return type === "tv"
    ? [{ id: "upnext", label: "Up Next" }, { id: "upcoming", label: "Upcoming" }, ...common]
    : common;
}

export function SectionPage({ type }: { type: MediaType }) {
  const { version } = useTracking();
  const tabs = tabsFor(type);
  const [tab, setTab] = useState(tabs[0].id);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filter, setFilter] = useState("");
  const config = SECTIONS[type];

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && tabsFor(type).some((item) => item.id === requested)) setTab(requested);
  }, [type]);

  function changeTab(id: string) {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url.toString());
  }

  // Only the active tab fetches data.
  const library = useApi<LibraryData>(tab === "mine" || tab === "discover" ? `/api/library?type=${type}` : null, [version]);
  const upnext = useApi<UpNextData>(type === "tv" && (tab === "upnext" || tab === "upcoming") ? "/api/upnext" : null, [version]);
  const recommended = useApi<DiscoveryView>(tab === "discover" ? `/api/discover?type=${type}&kind=recommended` : null, [version]);
  const popular = useApi<DiscoveryView>(tab === "discover" ? `/api/discover?type=${type}&kind=popular` : null, [version]);
  const trending = useApi<DiscoveryView>(tab === "discover" ? `/api/discover?type=${type}&kind=trending` : null, [version]);
  const upcoming = useApi<DiscoveryView>(tab === "discover" ? `/api/discover?type=${type}&kind=upcoming` : null, [version]);
  const lists = useApi<ListsData>(tab === "lists" ? "/api/lists" : null, [version]);
  const stats = useApi<StatsData>(tab === "stats" ? `/api/stats?type=${type}` : null, [version]);

  const filtered = useMemo(() => {
    let items = library.data?.items ?? [];
    if (statusFilter !== "all") items = items.filter((item) => item.entry?.status === statusFilter);
    if (favoritesOnly) items = items.filter((item) => item.entry?.favorite);
    if (filter.trim()) {
      const needle = filter.trim().toLowerCase();
      items = items.filter((item) => item.media.title.toLowerCase().includes(needle));
    }
    return items;
  }, [library.data, statusFilter, favoritesOnly, filter]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of library.data?.items ?? []) if (item.entry) map.set(item.entry.status, (map.get(item.entry.status) ?? 0) + 1);
    return map;
  }, [library.data]);

  const active = (library.data?.items ?? []).filter((item) =>
    type === "game" ? item.entry?.status === "playing" : type === "movie" ? item.entry?.status === "watching" : false,
  );

  const typedLists = (lists.data?.lists ?? []).filter((list) => list.mediaType === "all" || list.mediaType === type);

  return (
    <div className="space-y-5">
      <PageHeader
        title={MEDIA_LABEL[type]}
        subtitle={
          type === "tv" && upnext.data
            ? `${upnext.data.upNext.filter((item) => item.next?.aired && item.started).length} shows to continue · ${upnext.data.upcoming.length} upcoming`
            : library.data
              ? `${library.data.items.length} in your library`
              : "Your personal library"
        }
        actions={
          <Link
            href={`/search?type=${type}`}
            className="press focusable inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-muted hover:border-purple/60 hover:text-ink"
          >
            <IconSearch size={15} /> Search {MEDIA_LABEL[type].toLowerCase()}
          </Link>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={changeTab} />

      {tab === "upnext" ? (
        <>
          {upnext.error && !upnext.data ? <ErrorNote message={upnext.error} onRetry={upnext.refresh} /> : null}
          <UpNextList items={upnext.data?.upNext ?? []} loading={upnext.loading} />
        </>
      ) : null}

      {tab === "upcoming" ? (
        <section>
          <SectionHeader title="Upcoming episodes" subtitle="New and announced episodes for shows you follow" />
          {upnext.error && !upnext.data ? <ErrorNote message={upnext.error} onRetry={upnext.refresh} /> : null}
          <UpcomingList items={upnext.data?.upcoming ?? []} loading={upnext.loading} />
        </section>
      ) : null}

      {tab === "discover" ? (
        <div className="space-y-7">
          {active.length ? (
            <section>
              <SectionHeader title={type === "game" ? "Currently playing" : "Currently watching"} />
              <MediaRow items={active} />
            </section>
          ) : null}
          {recommended.data?.topGenres?.length ? (
            <Rail title={`Because you like ${recommended.data.topGenres.slice(0, 2).join(" & ")}`} api={recommended} type={type} />
          ) : null}
          <Rail title="Popular" api={popular} type={type} />
          <Rail title="Trending" api={trending} type={type} />
          <Rail title={type === "tv" ? "On the air" : "Upcoming releases"} api={upcoming} type={type} />
        </div>
      ) : null}

      {tab === "mine" ? (
        <div className="space-y-4">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter your ${MEDIA_LABEL[type].toLowerCase()}…`}
            className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted/70"
          />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              All · {library.data?.items.length ?? 0}
            </Chip>
            {statusesFor(type).map((status) => (
              <Chip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                {statusLabel(status)}
                {counts.get(status) ? ` · ${counts.get(status)}` : ""}
              </Chip>
            ))}
            <Chip active={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
              <span className="inline-flex items-center gap-1.5">
                <IconHeart size={13} /> Favorites
              </span>
            </Chip>
          </div>
          {library.error && !library.data ? <ErrorNote message={library.error} onRetry={library.refresh} /> : null}
          {library.loading && !library.data ? (
            <MediaGridSkeleton />
          ) : filtered.length ? (
            <MediaGrid items={filtered} />
          ) : (
            <EmptyState
              title={library.data?.items.length ? "Nothing matches that filter" : config.empty}
              body={library.data?.items.length ? "Try another status or clear the filter." : config.emptyBody}
              action={library.data?.items.length ? undefined : { label: `Discover ${MEDIA_LABEL[type].toLowerCase()}`, href: `/${config.base}?tab=discover` }}
            />
          )}
        </div>
      ) : null}

      {tab === "lists" ? (
        <div className="space-y-3">
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-ink">Custom lists</p>
              <p className="text-xs text-muted">Group anything: &ldquo;Best Sci-Fi&rdquo;, &ldquo;Weekend games&rdquo;, &ldquo;Rewatch&rdquo;.</p>
            </div>
            <Link href="/lists">
              <Button>Manage</Button>
            </Link>
          </Card>
          {lists.loading && !lists.data ? (
            <div className="shimmer h-24 rounded-2xl bg-elevated" />
          ) : typedLists.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {typedLists.map((list) => (
                <Link key={list.id} href={`/lists/${list.id}`} className="focusable rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-purple/60">
                  <p className="text-sm font-bold text-ink">{list.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{list.description ?? "No description"}</p>
                  <p className="mt-2 text-[11px] font-semibold text-purple">{list.itemCount} items</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No lists yet" body="Create your first list to organise your library." action={{ label: "Create a list", href: "/lists" }} />
          )}
        </div>
      ) : null}

      {tab === "stats" ? <StatsPanel type={type} data={stats.data} error={stats.error} /> : null}
    </div>
  );
}

function Rail({ title, api, type }: { title: string; api: { data: DiscoveryView | null; loading: boolean; error: string | null; refresh: () => void }; type: MediaType }) {
  if (api.error && !api.data?.items.length) {
    return (
      <section>
        <SectionHeader title={title} />
        <ErrorNote message={`We couldn't load ${title.toLowerCase()} right now.`} onRetry={api.refresh} />
      </section>
    );
  }
  if (!api.loading && !api.data?.items.length) return null;
  return (
    <section>
      <SectionHeader title={title} />
      {api.loading && !api.data ? (
        <div className="no-scrollbar flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="shimmer h-[210px] w-[124px] shrink-0 rounded-xl bg-elevated" />
          ))}
        </div>
      ) : (
        <MediaRow items={api.data?.items ?? []} emptyLabel={`No ${MEDIA_LABEL[type].toLowerCase()} available yet.`} />
      )}
      {api.data?.error ? <p className="mt-2 text-[11px] text-warn">{api.data.error}</p> : null}
    </section>
  );
}

function StatsPanel({ type, data, error }: { type: MediaType; data: StatsData | null; error: string | null }) {
  if (error && !data) return <ErrorNote message={error} />;
  if (!data) return <div className="shimmer h-40 rounded-2xl bg-elevated" />;
  const stats = data.stats as unknown as Record<string, unknown>;
  const show = (key: string, suffix = "") => (stats[key] == null ? "—" : `${String(stats[key])}${suffix}`);
  const obj = (key: string) => stats[key] as { title?: string; rating?: number; runtime?: number; count?: number; episodes?: number } | null | undefined;

  const cards: Array<[string, string]> =
    type === "movie"
      ? [
          ["Movies watched", show("watched")],
          ["Hours watched", show("hours", "h")],
          ["This month", show("thisMonth")],
          ["Average rating", show("averageRating")],
          ["Favourite genre", show("favouriteGenre")],
          ["Liked", show("likedCount")],
        ]
      : type === "tv"
        ? [
            ["Shows completed", show("showsCompleted")],
            ["Episodes watched", show("episodesWatched")],
            ["Hours watched", show("hours", "h")],
            ["Currently watching", show("currentlyWatching")],
            ["Episodes this month", show("episodesThisMonth")],
            ["Favourite genre", show("favouriteGenre")],
          ]
        : [
            ["Games completed", show("gamesCompleted")],
            ["Playing", show("playing")],
            ["Backlog", show("backlog")],
            ["Playtime", show("playtimeHours", "h")],
            ["Average rating", show("averageRating")],
            ["Favourite genre", show("favouriteGenre")],
          ];

  const fun: Array<[string, string]> = [];
  const high = obj("highestRated");
  if (type === "movie") {
    const low = obj("lowestRated");
    const longest = obj("longest");
    if (high) fun.push(["Highest rated", `${high.title} — ${high.rating}`]);
    if (low) fun.push(["Lowest rated", `${low.title} — ${low.rating}`]);
    if (longest) fun.push(["Longest watched", `${longest.title} — ${longest.runtime} min`]);
    if (stats.favouriteYear) fun.push(["Most active year", String(stats.favouriteYear)]);
    if (Number(stats.totalWatches) > Number(stats.watched)) fun.push(["Rewatches", String(Number(stats.totalWatches) - Number(stats.watched))]);
  } else if (type === "tv") {
    const most = obj("mostEpisodes");
    const longest = obj("longestShow");
    if (most) fun.push(["Most episodes in one show", `${most.title} — ${most.count}`]);
    if (longest) fun.push(["Longest show completed", `${longest.title} — ${longest.episodes} eps`]);
    if (stats.busiestMonth) fun.push(["Busiest month", String(stats.busiestMonth)]);
    if (stats.averageRating) fun.push(["Average show rating", String(stats.averageRating)]);
  } else {
    if (high) fun.push(["Highest rated", `${high.title} — ${high.rating}`]);
    if (stats.favouritePlatform) fun.push(["Most completed platform", String(stats.favouritePlatform)]);
    fun.push(["Completed this year", String(stats.completedThisYear ?? 0)]);
    if (stats.oldestCompleted) fun.push(["Oldest game completed", String(stats.oldestCompleted)]);
    if (stats.newestCompleted) fun.push(["Newest game completed", String(stats.newestCompleted)]);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>
      {Array.isArray(stats.distribution) ? (
        <RatingDistribution values={stats.distribution as number[]} />
      ) : null}
      {fun.length ? (
        <Card className="divide-y divide-line">
          {fun.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
              <span className="truncate text-right text-sm font-semibold text-ink">{value}</span>
            </div>
          ))}
        </Card>
      ) : null}
      {data.recommended.length ? (
        <section>
          <SectionHeader title={`More ${data.topGenres.join(" & ")}`} subtitle="Discovery based on genres you rate highly" />
          <MediaRow items={data.recommended as ItemView[]} />
        </section>
      ) : !Number(stats.tracked) ? (
        <EmptyState title={`No ${MEDIA_SINGULAR[type].toLowerCase()} statistics yet`} body="Rate and track a few titles and this page fills up with fun numbers." />
      ) : null}
    </div>
  );
}
