"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { apiPost, episodeCode, friendlyDate, gradientFor, initials } from "@/lib/client";
import { nextAfter } from "@/lib/episodes";
import { useTracking } from "@/components/tracking";
import { ProgressBar, RatingBadge, Skeleton, Spinner } from "@/components/ui";
import { statusLabel, type LibraryEntry, type MediaRecord, type MediaType } from "@/lib/types";
import { IconCheck, IconHeartFilled, IconPlus } from "@/components/icons";

export function mediaHref(media: { type: string; provider: string; externalId: string }) {
  const base = media.type === "tv" ? "tv" : media.type === "game" ? "games" : "movies";
  return `/${base}/${media.provider}-${media.externalId}`;
}

/** Serve a smaller TMDB variant for grid artwork. Non-TMDB URLs pass through. */
function sizedPoster(url: string, variant: "card" | "detail" | "back") {
  if (!url.includes("image.tmdb.org")) return url;
  const sizes = { card: "w342", detail: "w500", back: "w1280" } as const;
  return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${sizes[variant]}/`);
}

export function Poster({
  media,
  className = "",
  rounded = "",
  variant = "card",
  priority = false,
}: {
  media: Pick<MediaRecord, "title" | "posterUrl" | "type">;
  className?: string;
  rounded?: string;
  variant?: "card" | "detail" | "back";
  priority?: boolean;
}) {
  if (media.posterUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sizedPoster(media.posterUrl, variant)}
        alt={`${media.title} artwork`}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        className={`h-full w-full object-cover ${rounded} ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className} ${rounded}`}
      style={gradientFor(media.title)}
      aria-hidden
    >
      <span className="font-display text-2xl font-black tracking-tight text-white/85">{initials(media.title)}</span>
    </div>
  );
}

function QuickButton({ entry, onClick }: { entry: LibraryEntry | null; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={entry ? "Edit tracking" : "Add to library"}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className={`press focusable absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-full border text-sm font-bold backdrop-blur-sm ${
        entry
          ? "border-purple bg-purple/90 text-white"
          : "border-white/25 bg-black/60 text-white hover:border-purple hover:bg-purple/80"
      }`}
    >
      {entry ? <IconCheck size={15} /> : <IconPlus size={16} />}
    </button>
  );
}

export function MediaCard({ media, entry }: { media: MediaRecord; entry: LibraryEntry | null }) {
  const { openStatus, openEdit } = useTracking();

  return (
    <div className="group relative w-full">
      <Link href={mediaHref(media)} className="press poster poster-tilt focusable block aspect-[2/3] overflow-hidden rounded-xl">
        <Poster media={media} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="tnum truncate text-[11px] font-semibold text-white/90">{media.year ?? ""}</p>
          {media.externalRating ? <RatingBadge value={media.externalRating} /> : null}
        </div>
        {entry?.favorite ? (
          <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-glow">
            <IconHeartFilled size={12} />
          </span>
        ) : null}
      </Link>
      <QuickButton entry={entry} onClick={() => (entry ? openEdit(media, entry) : openStatus(media, entry))} />
      <Link href={mediaHref(media)} className="mt-2 block">
        <p className="truncate text-[13px] leading-tight font-semibold text-ink">{media.title}</p>
        <p className="truncate text-[11px] text-muted">
          {entry ? statusLabel(entry.status) : (media.genres ?? []).slice(0, 1).join(" ") || media.year}
        </p>
        {entry?.rating != null ? <RatingBadge value={entry.rating} label="you" /> : null}
      </Link>
    </div>
  );
}

export function ContinueCard({
  item,
}: {
  item: {
    media: MediaRecord;
    entry: LibraryEntry | null;
    watchedEpisodes?: number;
    totalEpisodes?: number;
    nextEpisode?: { season: number; episode: number } | null;
    next?: { season: number; episode: number; name: string | null; aired: boolean; airDate?: string | null } | null;
  };
}) {
  const { refresh } = useTracking();
  const serverNext = item.next ?? item.nextEpisode ?? null;
  const [local, setLocal] = useState<{ season: number; episode: number } | null | undefined>(undefined);
  const [extra, setExtra] = useState(0);
  const [busy, setBusy] = useState(false);
  const key = serverNext ? `${serverNext.season}-${serverNext.episode}` : "none";
  useEffect(() => {
    setLocal(undefined);
    setExtra(0);
  }, [key]);
  const next = local === undefined ? serverNext : local;
  const aired = local === undefined ? (item.next ? item.next.aired : true) : true;
  const { media } = item;

  async function watchNext() {
    if (!next || busy) return;
    const target = next;
    setBusy(true);
    setLocal(nextAfter(media, target.season, target.episode));
    setExtra((value) => value + 1);
    try {
      await apiPost("/api/library", { action: "episode", mediaId: media.id, season: target.season, episode: target.episode, watched: true });
      refresh();
    } catch {
      setLocal(undefined);
      setExtra(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative w-[260px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-card @md/content:w-[300px]">
      <Link
        href={next ? `${mediaHref(media)}?season=${next.season}&episode=${next.episode}` : mediaHref(media)}
        className="press focusable block"
      >
        <div className="relative aspect-[16/9]">
          {media.backdropUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sizedPoster(media.backdropUrl, "back")}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <Poster media={media} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate text-sm font-bold text-white">{media.title}</p>
            <p className="tnum truncate text-xs font-semibold text-glow">
              {next ? episodeCode(next.season, next.episode) : "All caught up"}
              {local === undefined && item.next?.name ? <span className="font-normal text-white/70"> · {item.next.name}</span> : null}
            </p>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <ProgressBar value={(item.watchedEpisodes ?? 0) + extra} total={item.totalEpisodes ?? 1} />
          <p className="tnum mt-1 text-[11px] text-muted">
            {(item.watchedEpisodes ?? 0) + extra} / {item.totalEpisodes ?? 0} episodes
            {next && local === undefined && item.next?.airDate ? ` · ${friendlyDate(item.next.airDate)}` : ""}
          </p>
        </div>
        {next && aired ? (
          <button
            type="button"
            onClick={watchNext}
            disabled={busy}
            aria-label={`Mark ${episodeCode(next.season, next.episode)} watched`}
            className="press focusable grid size-11 shrink-0 place-items-center rounded-full bg-purple text-white shadow-glow hover:bg-bright disabled:opacity-60"
          >
            {busy ? <Spinner /> : <IconCheck size={18} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MediaRow({
  items,
  emptyLabel = "Nothing here yet.",
}: {
  items: Array<{ media: MediaRecord; entry: LibraryEntry | null }>;
  emptyLabel?: string;
}) {
  if (!items.length) return <p className="text-sm text-muted">{emptyLabel}</p>;
  return (
    <div className="snap-rail no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {items.map((item) => (
        <div
          key={`${item.media.provider}-${item.media.id}`}
          className="w-[140px] shrink-0 @md/content:w-[158px] @xl/content:w-[172px]"
        >
          <MediaCard media={item.media} entry={item.entry} />
        </div>
      ))}
    </div>
  );
}

export function MediaGrid({
  items,
  empty,
}: {
  items: Array<{ media: MediaRecord; entry: LibraryEntry | null }>;
  empty?: ReactNode;
}) {
  if (!items.length) return <>{empty ?? null}</>;
  return (
    <div
      className="grid gap-x-3 gap-y-6"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))" }}
    >
      {items.map((item) => (
        <MediaCard key={`${item.media.provider}-${item.media.id}`} media={item.media} entry={item.entry} />
      ))}
    </div>
  );
}

export function MediaGridSkeleton({ count = 14 }: { count?: number }) {
  return (
    <div
      className="grid gap-x-3 gap-y-6"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))" }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <Skeleton className="mt-1 h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}
