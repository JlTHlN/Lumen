"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiPost, episodeCode, friendlyDate } from "@/lib/client";
import { nextAfter } from "@/lib/episodes";
import { Poster, mediaHref } from "@/components/media-card";
import { useTracking } from "@/components/tracking";
import { Card, EmptyState, ProgressBar, SectionHeader, Spinner } from "@/components/ui";
import type { UpcomingView, UpNextView } from "@/lib/view";
import { IconCheck, IconChevronRight } from "@/components/icons";

export function UpNextRow({ item, compact = false }: { item: UpNextView; compact?: boolean }) {
  const { refresh } = useTracking();
  const [advanced, setAdvanced] = useState<{ season: number; episode: number } | null | undefined>(undefined);
  const [extraWatched, setExtraWatched] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serverKey = item.next ? `${item.next.season}-${item.next.episode}-${item.watchedEpisodes}` : "done";

  // Server data caught up with our optimistic state → drop the local override.
  useEffect(() => {
    setAdvanced(undefined);
    setExtraWatched(0);
  }, [serverKey]);

  const current = advanced === undefined ? (item.next ? { season: item.next.season, episode: item.next.episode } : null) : advanced;
  const isServerNext = advanced === undefined;
  const aired = isServerNext ? item.next?.aired ?? false : true;
  const watched = (item.watchedEpisodes ?? 0) + extraWatched;
  const total = item.totalEpisodes ?? 0;

  async function markWatched() {
    if (!current || busy) return;
    const target = current;
    setBusy(true);
    setError(null);
    setAdvanced(nextAfter(item.media, target.season, target.episode));
    setExtraWatched((value) => value + 1);
    try {
      await apiPost("/api/library", { action: "episode", mediaId: item.media.id, season: target.season, episode: target.episode, watched: true });
      refresh();
    } catch (err) {
      setAdvanced(undefined);
      setExtraWatched(0);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const href = current ? `${mediaHref(item.media)}?season=${current.season}&episode=${current.episode}` : mediaHref(item.media);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 transition-colors hover:border-purple/50">
      <Link href={href} className={`relative shrink-0 overflow-hidden rounded-xl border border-line ${compact ? "h-16 w-12" : "h-20 w-14 sm:h-[72px] sm:w-32"}`}>
        {item.next?.stillUrl && isServerNext && !compact ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.next.stillUrl} alt="" loading="lazy" decoding="async" className="hidden h-full w-full object-cover sm:block" />
        ) : null}
        <div className={item.next?.stillUrl && isServerNext && !compact ? "h-full sm:hidden" : "h-full"}>
          <Poster media={item.media} />
        </div>
      </Link>
      <Link href={href} className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{item.media.title}</p>
        {current ? (
          <p className="truncate text-xs text-bright">
            <span className="font-bold">{episodeCode(current.season, current.episode)}</span>
            {isServerNext && item.next?.name ? <span className="text-muted"> · {item.next.name}</span> : null}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-good">
            <IconCheck size={13} /> All caught up
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-muted">
          {!current
            ? item.ongoing
              ? "Waiting for new episodes"
              : "Finished"
            : isServerNext && item.next?.airDate
              ? `${aired ? "Aired" : "Airs"} ${friendlyDate(item.next.airDate)}`
              : `${Math.max(0, total - watched)} left`}
        </p>
        {!compact ? (
          <div className="mt-1.5 flex items-center gap-2">
            <ProgressBar value={watched} total={total} />
            <span className="shrink-0 text-[10px] text-muted">
              {watched}/{total}
            </span>
          </div>
        ) : null}
        {error ? <p className="mt-1 text-[11px] text-bad">{error}</p> : null}
      </Link>
      {current && aired ? (
        <button
          type="button"
          onClick={markWatched}
          disabled={busy}
          aria-label={`Mark ${item.media.title} ${episodeCode(current.season, current.episode)} watched`}
          className="focusable grid size-12 shrink-0 place-items-center rounded-full border-2 border-purple bg-purple/15 text-lg font-bold text-bright transition active:scale-95 hover:bg-purple hover:text-white disabled:opacity-60"
        >
          {busy ? <Spinner /> : <IconCheck size={18} />}
        </button>
      ) : current ? (
        <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted">
          {friendlyDate(item.next?.airDate)}
        </span>
      ) : null}
    </div>
  );
}

export function UpNextList({ items, loading }: { items: UpNextView[]; loading?: boolean }) {
  if (loading && !items.length) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="shimmer h-24 rounded-2xl bg-elevated" />
        ))}
      </div>
    );
  }
  const watchNow = items.filter((item) => item.next?.aired && item.started && item.entry?.status !== "on_hold");
  const notStarted = items.filter((item) => item.next?.aired && !item.started);
  const paused = items.filter((item) => item.next?.aired && item.started && item.entry?.status === "on_hold");
  const waiting = items.filter((item) => !item.next?.aired);

  if (!items.length) {
    return (
      <EmptyState
        title="Your watchlist is empty"
        body="Add a show and it appears here with its next episode, ready to tick off."
        action={{ label: "Discover shows", href: "/tv?tab=discover" }}
      />
    );
  }

  const groups: Array<[string, UpNextView[]]> = [
    ["Watch next", watchNow],
    ["Not started", notStarted],
    ["On hold", paused],
    ["Waiting for new episodes", waiting],
  ];

  return (
    <div className="space-y-6">
      {groups.map(([title, group]) =>
        group.length ? (
          <section key={title}>
            <SectionHeader title={`${title} · ${group.length}`} />
            <div className="grid gap-2 xl:grid-cols-2">
              {group.map((item) => (
                <UpNextRow key={item.media.id} item={item} />
              ))}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}

export function UpcomingList({ items, loading, limit }: { items: UpcomingView[]; loading?: boolean; limit?: number }) {
  if (loading && !items.length) return <div className="shimmer h-32 rounded-2xl bg-elevated" />;
  if (!items.length) {
    return (
      <Card className="p-4 text-sm text-muted">
        Nothing scheduled. Shows you follow that are still airing or have an announced season appear here automatically.
      </Card>
    );
  }
  const shown = typeof limit === "number" ? items.slice(0, limit) : items;
  const groups = new Map<string, UpcomingView[]>();
  for (const entry of shown) {
    const key = entry.airDate ? friendlyDate(entry.airDate) : "Date to be announced";
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([label, group]) => (
        <div key={label}>
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.16em] text-bright uppercase">{label}</p>
          <div className="space-y-2">
            {group.map((entry) => (
              <UpcomingRow key={`${entry.media.id}-${entry.kind}-${entry.season ?? ""}-${entry.episode ?? ""}`} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UpcomingRow({ entry }: { entry: UpcomingView }) {
  const query =
    entry.kind === "episode"
      ? `?season=${entry.season}&episode=${entry.episode}`
      : entry.kind === "season" && entry.season
        ? `?season=${entry.season}`
        : "";
  return (
    <Link
      href={`${mediaHref(entry.media)}${query}`}
      className="focusable flex items-center gap-3 rounded-2xl border border-line bg-surface px-2.5 py-2 transition-colors hover:border-purple/60"
    >
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-line">
        <Poster media={entry.media} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{entry.media.title}</p>
        <p className="truncate text-xs text-muted">
          {entry.kind === "episode" ? (
            <>
              <span className="font-bold text-bright">{episodeCode(entry.season, entry.episode)}</span>
              {entry.name ? ` · ${entry.name}` : " · New episode"}
            </>
          ) : entry.kind === "season" ? (
            <>
              <span className="font-bold text-bright">Season {entry.season}</span> · {entry.airDate ? "Premieres" : "Announced"}
            </>
          ) : (
            <>Release · {entry.media.type === "game" ? "Game" : "Movie"}</>
          )}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-bright">{friendlyDate(entry.airDate)}</span>
      <IconChevronRight size={15} className="shrink-0 text-faint" />
    </Link>
  );
}
