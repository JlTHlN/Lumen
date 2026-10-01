"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDebounced, useApi } from "@/lib/client";
import { Poster, mediaHref } from "@/components/media-card";
import { useTracking } from "@/components/tracking";
import { Button, Card, EmptyState, PageHeader, RatingBadge, SectionHeader, Skeleton } from "@/components/ui";
import { MEDIA_LABEL, statusLabel, type MediaType } from "@/lib/types";
import type { DiscoveryView } from "@/lib/view";
import { IconCheck, IconPlus, IconSearch } from "@/components/icons";

const TYPES: MediaType[] = ["movie", "tv", "game"];

export default function SearchPage() {
  const [type, setType] = useState<MediaType>("movie");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const { version } = useTracking();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("type");
    if (initial === "tv" || initial === "game" || initial === "movie") setType(initial);
    const q = params.get("q");
    if (q) setQuery(q);
  }, []);

  const url = debounced.length >= 2 ? `/api/search?type=${type}&q=${encodeURIComponent(debounced)}` : null;
  const { data, loading, error } = useApi<DiscoveryView>(url, [version, type]);

  const suggestions = useApi<DiscoveryView>(
    debounced.length < 2 ? `/api/discover?type=${type}&kind=trending` : null,
    [type, version],
  );

  const items = data?.items ?? suggestions.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Search" subtitle="Local cache first, then your metadata provider." />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, genres…"
            className="w-full rounded-full border border-line bg-surface py-3 pr-4 pl-11 text-sm text-ink placeholder:text-muted/70"
            autoFocus
          />
          <IconSearch size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        </div>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as MediaType)}
          aria-label="Search mode"
          className="focusable rounded-full border border-line bg-surface px-3 py-3 text-sm font-semibold text-ink"
        >
          {TYPES.map((option) => (
            <option key={option} value={option}>
              {MEDIA_LABEL[option]}
            </option>
          ))}
        </select>
      </div>

      {data?.error ? (
        <Card className="border-warn/40 bg-warn/10 p-3 text-xs text-ink">
          {data.error}
          <span className="mt-0.5 block text-muted">Everything you already track stays available.</span>
        </Card>
      ) : null}
      {error ? <Card className="border-bad/40 bg-bad/10 p-3 text-xs text-ink">{error}</Card> : null}

      <SectionHeader
        title={debounced.length >= 2 ? `Results for “${debounced}”` : `Trending ${MEDIA_LABEL[type].toLowerCase()}`}
        action={data?.offline ? <span className="text-[11px] text-warn">offline catalog</span> : null}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {items.map((item) => (
            <ResultRow key={`${item.media.provider}-${item.media.id}`} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing found"
          body={`No ${MEDIA_LABEL[type].toLowerCase()} matched that search. Try another spelling, or connect a provider in settings.`}
          action={{ label: "Open settings", href: "/settings" }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {TYPES.filter((option) => option !== type).map((option) => (
          <Button key={option} variant="outline" onClick={() => setType(option)}>
            Search {MEDIA_LABEL[option].toLowerCase()} instead
          </Button>
        ))}
      </div>
    </div>
  );
}

function ResultRow({ item }: { item: DiscoveryView["items"][number] }) {
  const { openStatus, openWatched } = useTracking();
  const entry = item.entry;
  return (
    <Card className="flex items-center gap-3 p-2.5">
      <Link href={mediaHref(item.media)} className="shrink-0">
        <div className="h-20 w-14 overflow-hidden rounded-lg border border-line">
          <Poster media={item.media} />
        </div>
      </Link>
      <Link href={mediaHref(item.media)} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{item.media.title}</p>
        <p className="truncate text-xs text-muted">
          {[item.media.year, (item.media.genres ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {item.media.externalRating ? <RatingBadge value={item.media.externalRating} /> : null}
          {entry ? (
            <span className="rounded-full border border-purple/50 bg-purple/15 px-2 py-0.5 text-[10px] font-bold text-bright">
              {statusLabel(entry.status)}
            </span>
          ) : (
            <span className="text-[10px] text-muted">not in your library</span>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Button onClick={() => openStatus(item.media, entry)}>
          {entry ? <IconCheck size={15} /> : <IconPlus size={15} />} {entry ? "Tracked" : "Add"}
        </Button>
        {item.media.type !== "tv" ? (
          <Button variant="outline" onClick={() => openWatched(item.media, entry)}>
            Watched
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
