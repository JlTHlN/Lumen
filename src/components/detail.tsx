"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, episodeCode, friendlyDate, gradientFor, useApi } from "@/lib/client";
import { Poster } from "@/components/media-card";
import { useTracking } from "@/components/tracking";
import { useCelebration } from "@/components/celebration";
import { Button, Card, Chip, EmptyState, ErrorNote, ProgressBar, SectionHeader, Skeleton, Spinner, Stars } from "@/components/ui";
import { statusLabel, type MediaType } from "@/lib/types";
import {
  IconCheck,
  IconChevronLeft,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconStarFilled,
  IconThumbDown,
  IconThumbUp,
} from "@/components/icons";
import type { DetailData, EpisodeView } from "@/lib/view";

export function parseSlug(slug: string): { provider: string; externalId: string } {
  const decoded = decodeURIComponent(slug);
  const index = decoded.indexOf("-");
  if (index === -1) return { provider: "local", externalId: decoded };
  return { provider: decoded.slice(0, index), externalId: decoded.slice(index + 1) };
}

interface Meta {
  director?: string | null;
  creator?: string | null;
  cast?: Array<{ name?: string; character?: string } | string>;
  studios?: string[];
  countries?: string[];
  languages?: string[];
  network?: string | null;
  status?: string | null;
  tagline?: string | null;
  homepage?: string | null;
  developers?: string[];
  publishers?: string[];
  platforms?: string[];
  screenshots?: string[];
  website?: string | null;
  metacritic?: number | null;
  averagePlaytime?: number | null;
  storyline?: string | null;
  esrb?: string | null;
  stores?: Array<{ name: string; url: string }>;
  source?: string | null;
  nextEpisodeToAir?: { season: number; episode: number; name: string | null; airDate: string | null } | null;
}

export function DetailView({ type, slug }: { type: MediaType; slug: string }) {
  const { version, refresh, openEdit, openStatus, openWatched, openList } = useTracking();
  const { celebrate } = useCelebration();
  const { provider, externalId } = parseSlug(slug);
  const [requestedSeason, setRequestedSeason] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ season: number; episode: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const scrolledFor = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const season = Number(params.get("season"));
    const episode = Number(params.get("episode"));
    if (season) setRequestedSeason(season);
    if (season && episode) {
      setFocus({ season, episode });
      setExpanded(`${season}-${episode}`);
    }
    setReady(true);
  }, []);

  const apiBase = `/api/media?type=${type}&provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(externalId)}`;
  const url = ready ? `${apiBase}${requestedSeason ? `&season=${requestedSeason}` : ""}` : null;
  const { data, loading, error, refresh: reload, mutate } = useApi<DetailData>(url, [version]);

  const episodes: EpisodeView[] = data?.episodes ?? [];
  const season = data?.season ?? null;

  useEffect(() => {
    if (!focus || season !== focus.season || !episodes.length) return;
    const key = `${focus.season}-${focus.episode}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    requestAnimationFrame(() => document.getElementById(`ep-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [focus, season, episodes.length]);

  if (!data && (loading || !ready)) {
    return (
      <div className="space-y-4">
        <Skeleton className="aspect-[16/7] w-full rounded-3xl" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error && !data) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="Not found" body="We couldn't load this title." action={{ label: "Go home", href: "/" }} />;

  const { media, entry } = data;
  const meta = (media.metadata ?? {}) as Meta;
  const sectionBase = type === "tv" ? "tv" : type === "game" ? "games" : "movies";
  const seasonMeta = media.seasons?.find((item) => item.seasonNumber === season);
  const seasonWatched = episodes.filter((ep) => ep.watched).length;
  const nextAiring = episodes.find((ep) => !ep.aired) ?? null;
  const nextEp = data.nextEpisode;
  const nextEpInfo = nextEp && nextEp.season === season ? episodes.find((ep) => ep.episode === nextEp.episode) : null;
  const caughtUp = !nextEp || (nextEpInfo ? !nextEpInfo.aired : false);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await apiPost("/api/library", { mediaId: media.id, ...body });
      refresh();
    } catch (err) {
      setActionError((err as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  function toggleEpisode(episode: EpisodeView) {
    const watched = !episode.watched;
    mutate((previous) =>
      previous
        ? {
            ...previous,
            watchedEpisodes: Math.max(0, previous.watchedEpisodes + (watched ? 1 : -1)),
            episodes: previous.episodes.map((ep) => (ep.episode === episode.episode ? { ...ep, watched } : ep)),
          }
        : previous,
    );
    void run({ action: "episode", season: episode.season, episode: episode.episode, watched });
  }

  function upToHere(episode: EpisodeView) {
    mutate((previous) =>
      previous
        ? {
            ...previous,
            episodes: previous.episodes.map((ep) => (ep.episode <= episode.episode ? { ...ep, watched: true } : ep)),
          }
        : previous,
    );
    void run({ action: "episode_upto", season: episode.season, episode: episode.episode });
  }

  function seasonAll(watched: boolean) {
    if (season == null) return;
    mutate((previous) =>
      previous ? { ...previous, episodes: previous.episodes.map((ep) => (watched && !ep.aired ? ep : { ...ep, watched })) } : previous,
    );
    void run({ action: "season", season, watched });
  }

  async function refreshMetadata() {
    setBusy(true);
    try {
      await apiGet(`${apiBase}&refresh=1${season ? `&season=${season}` : ""}`);
      reload();
    } catch {
      setActionError("The provider couldn't be reached. Showing your cached copy.");
    } finally {
      setBusy(false);
    }
  }

  const castNames = (meta.cast ?? []).map((person) =>
    typeof person === "string" ? { name: person, character: "" } : { name: person.name ?? "", character: person.character ?? "" },
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl sm:border sm:border-line">
        <div className="absolute inset-0" aria-hidden>
          {media.backdropUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.backdropUrl} alt="" decoding="async" className="h-full w-full scale-110 object-cover opacity-40 blur-sm" />
          ) : (
            <div className="h-full w-full opacity-60" style={gradientFor(media.title)} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-transparent to-transparent" />
        </div>
        <div className="relative grid gap-6 p-4 sm:p-8 md:grid-cols-[220px_1fr] md:gap-8 lg:grid-cols-[260px_1fr]">
          <div className="mx-auto w-36 sm:mx-0 sm:w-full md:w-auto">
            <div className="poster aspect-[2/3] overflow-hidden md:w-[220px] lg:w-[260px]">
              <Poster media={media} variant="detail" priority />
            </div>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] text-glow uppercase">
              {type === "tv" ? "TV Show" : type === "game" ? "Game" : "Movie"}
              {data.ongoing ? <span className="text-glow/70">· Ongoing</span> : null}
            </p>
            <h1 className="mt-2 text-3xl leading-tight font-black tracking-tight text-ink sm:text-4xl">{media.title}</h1>
            {meta.tagline ? <p className="mt-1 text-sm italic text-muted">{meta.tagline}</p> : null}
            <p className="mt-2 text-sm text-muted">
              {[
                media.year,
                type !== "game" && media.runtime ? `${media.runtime} min${type === "tv" ? " / ep" : ""}` : null,
                type === "tv" && media.seasons?.length ? `${media.seasons.length} season${media.seasons.length > 1 ? "s" : ""}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(media.genres ?? []).slice(0, 5).map((genre) => (
                <span key={genre} className="rounded-full border border-line bg-surface/70 px-2 py-0.5 text-[11px] text-muted">
                  {genre}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              {media.externalRating ? (
                <span className="tnum font-bold text-glow">
                  <span className="inline-flex items-center gap-1">{meta.source ?? "External"} <IconStarFilled size={12} /> {media.externalRating.toFixed(1)}</span>
                </span>
              ) : null}
              {entry?.rating != null ? (
                <span className="tnum font-bold text-ink">
                  You <Stars rating={entry.rating} /> {entry.rating.toFixed(1)}
                </span>
              ) : null}
              {entry ? (
                <span className="rounded-full bg-purple/20 px-2 py-0.5 font-semibold text-ink">{statusLabel(entry.status)}</span>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {entry ? (
                <Button onClick={() => openEdit(media, entry)}>Edit tracking</Button>
              ) : (
                <Button onClick={() => openStatus(media, entry)}>
                  <IconPlus size={16} /> Add to library
                </Button>
              )}
              {type !== "tv" ? (
                <Button variant="outline" onClick={() => openWatched(media, entry)}>
                  <IconCheck size={16} /> {type === "game" ? "Completed" : entry?.timesWatched ? "Watched again" : "Watched"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => {
                  mutate((previous) =>
                    previous && previous.entry ? { ...previous, entry: { ...previous.entry, favorite: !previous.entry.favorite } } : previous,
                  );
                  void run({ action: "favorite", favorite: !entry?.favorite });
                }}
              >
                {entry?.favorite ? <IconHeartFilled size={16} /> : <IconHeart size={16} />} Favorite
              </Button>
              <Button variant="ghost" onClick={() => openList(media, entry)}>
                <IconList size={16} /> List
              </Button>
            </div>
          </div>
        </div>
      </section>

      {actionError ? <ErrorNote message={actionError} /> : null}

      {type === "tv" ? (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-muted uppercase">Your progress</p>
              <p className="tnum mt-1 text-sm font-semibold text-ink">
                {data.watchedEpisodes} / {data.totalEpisodes} episodes
              </p>
            </div>
            {nextEp && !caughtUp ? (
              <button
                type="button"
                onClick={() => {
                  setRequestedSeason(nextEp.season);
                  setFocus(nextEp);
                  setExpanded(`${nextEp.season}-${nextEp.episode}`);
                  scrolledFor.current = null;
                }}
                className="press focusable tnum rounded-full border border-purple/60 px-3 py-1.5 text-xs font-bold text-glow"
              >
                Next: {episodeCode(nextEp.season, nextEp.episode)}
              </button>
            ) : (
              <span className="text-right text-xs font-semibold text-good">
                {data.ongoing ? "Caught up" : data.watchedEpisodes ? "All watched" : ""}
                {data.ongoing && (nextAiring || meta.nextEpisodeToAir) ? (
                  <span className="block font-normal text-muted">
                    Next airs {friendlyDate(nextAiring?.airDate ?? meta.nextEpisodeToAir?.airDate)}
                  </span>
                ) : null}
              </span>
            )}
          </div>
          <div className="mt-3">
            <ProgressBar value={data.watchedEpisodes} total={data.totalEpisodes} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {entry?.status !== "watching" ? (
              <Button variant="outline" disabled={busy} onClick={() => run({ action: "set_status", status: "watching" })}>
                <IconPlay size={15} /> I&apos;m watching this
              </Button>
            ) : null}
            <Button variant="ghost" disabled={busy} onClick={() => run({ action: "show" })}>
              Mark all aired episodes watched
            </Button>
          </div>
        </Card>
      ) : null}

      {type === "tv" && media.seasons?.length ? (
        <section>
          <SectionHeader title="Episodes" action={loading ? <Spinner /> : null} />
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {media.seasons.map((item) => (
              <Chip
                key={item.seasonNumber}
                active={season === item.seasonNumber}
                onClick={() => {
                  setRequestedSeason(item.seasonNumber);
                  setFocus(null);
                }}
              >
                S{String(item.seasonNumber).padStart(2, "0")} · {item.episodeCount} eps
                {item.airDate && item.airDate > new Date().toISOString().slice(0, 10) ? " · soon" : ""}
              </Chip>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-bold text-ink">{seasonMeta?.name ?? `Season ${season}`}</p>
                <p className="tnum text-[11px] text-muted">
                  {seasonWatched}/{episodes.length} watched
                  {seasonMeta?.airDate ? ` · ${friendlyDate(seasonMeta.airDate, true)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy || !episodes.length} onClick={() => seasonAll(true)}>
                  <IconCheck size={15} /> Whole season
                </Button>
                {seasonWatched ? (
                  <Button variant="ghost" disabled={busy} onClick={() => seasonAll(false)}>
                    Undo season
                  </Button>
                ) : null}
              </div>
            </div>
            {data.episodeError ? <p className="border-b border-line px-4 py-2 text-[11px] text-warn">{data.episodeError}</p> : null}
            {!episodes.length ? <p className="px-4 py-6 text-sm text-muted">Episode information is unavailable right now.</p> : null}
            <ul className="divide-y divide-line">
              {episodes.map((episode) => {
                const key = `${episode.season}-${episode.episode}`;
                const open = expanded === key;
                const isNext = nextEp?.season === episode.season && nextEp?.episode === episode.episode;
                const gapBefore = !episode.watched && episodes.some((ep) => ep.episode < episode.episode && !ep.watched);
                return (
                  <li
                    key={key}
                    id={`ep-${key}`}
                    className={`px-3 py-3 sm:px-4 ${isNext ? "bg-purple/10" : ""} ${
                      focus && `${focus.season}-${focus.episode}` === key ? "ring-1 ring-purple/60 ring-inset" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        aria-label={
                          episode.watched
                            ? `Mark ${episodeCode(episode.season, episode.episode)} unwatched`
                            : `Mark ${episodeCode(episode.season, episode.episode)} watched`
                        }
                        aria-pressed={episode.watched}
                        disabled={!episode.aired && !episode.watched}
                        onClick={() => toggleEpisode(episode)}
                        className={`press focusable grid size-11 shrink-0 place-items-center rounded-full border-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                          episode.watched ? "border-purple bg-purple text-white" : "border-line bg-elevated text-muted hover:border-purple"
                        }`}
                      >
                        {episode.watched ? <IconCheck size={16} /> : ""}
                      </button>
                      <button type="button" onClick={() => setExpanded(open ? null : key)} className="focusable min-w-0 flex-1 text-left" aria-expanded={open}>
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <p className="text-sm font-semibold text-ink">
                            <span className="tnum text-glow">{episodeCode(episode.season, episode.episode)}</span>
                            {episode.name ? ` · ${episode.name}` : ""}
                          </p>
                          {isNext && !episode.watched ? (
                            <span className="text-[10px] font-bold tracking-wider text-glow uppercase">Up next</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {!episode.aired ? (
                            <span className="rounded-full bg-warn/15 px-1.5 py-0.5 font-semibold text-warn">Airs {friendlyDate(episode.airDate)}</span>
                          ) : (
                            [episode.airDate ? friendlyDate(episode.airDate, true) : null, episode.runtime ? `${episode.runtime} min` : null]
                              .filter(Boolean)
                              .join(" · ") || "Air date unknown"
                          )}
                          {episode.rating ? (
                            <span className="tnum ml-2 inline-flex items-center gap-0.5 text-glow">
                              <IconStarFilled size={10} /> {episode.rating.toFixed(1)}
                            </span>
                          ) : null}
                        </p>
                        {!open && episode.overview ? <p className="mt-1 line-clamp-1 text-xs text-muted/80">{episode.overview}</p> : null}
                      </button>
                    </div>
                    {open ? (
                      <div className="mt-3 space-y-2 pl-[56px]">
                        {episode.stillUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={episode.stillUrl} alt="" loading="lazy" decoding="async" className="w-full max-w-sm rounded-xl border border-line" />
                        ) : null}
                        <p className="text-sm leading-relaxed text-muted">{episode.overview || "No overview available from the provider."}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
                          {episode.airDate ? <span>Air date: {friendlyDate(episode.airDate, true)}</span> : null}
                          {episode.runtime ? <span>Runtime: {episode.runtime} min</span> : null}
                          {meta.network ? <span>Network: {meta.network}</span> : null}
                          {episode.watchedAt ? <span>Watched: {friendlyDate(episode.watchedAt, true)}</span> : null}
                        </div>
                        {episode.guestCast?.length ? <p className="text-[11px] text-muted">Guest cast: {episode.guestCast.slice(0, 6).join(", ")}</p> : null}
                        {gapBefore && episode.aired ? (
                          <Button variant="outline" disabled={busy} onClick={() => upToHere(episode)}>
                            <IconCheck size={15} /> Watched up to here
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}

      {entry ? (
        <Card className="p-4">
          <SectionHeader title="Your tracking" />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Field label="Status" value={statusLabel(entry.status)} />
            <Field label="Your rating" value={entry.rating != null ? `${entry.rating.toFixed(1)} / 10` : "—"} />
            <Field
              label="Reaction"
              value={
                entry.liked === true ? (
                  <span className="inline-flex items-center gap-1 text-good">
                    <IconThumbUp size={14} /> Liked
                  </span>
                ) : entry.liked === false ? (
                  <span className="inline-flex items-center gap-1 text-bad">
                    <IconThumbDown size={14} /> Not for me
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="Favorite"
              value={entry.favorite ? <span className="inline-flex items-center gap-1 text-glow"><IconHeartFilled size={14} /> Yes</span> : "—"}
            />
            {type === "game" ? (
              <>
                <Field label="Platform" value={entry.platform ?? "—"} />
                <Field label="Playtime" value={entry.playtimeHours != null ? `${entry.playtimeHours}h` : "—"} />
                <Field label="Started" value={entry.startedOn ? friendlyDate(entry.startedOn, true) : "—"} />
                <Field label="Completed" value={entry.completedOn ? friendlyDate(entry.completedOn, true) : "—"} />
              </>
            ) : (
              <>
                <Field label={type === "tv" ? "Last episode" : "Last watched"} value={entry.lastWatchedAt ? friendlyDate(entry.lastWatchedAt, true) : "—"} />
                {type === "movie" ? <Field label="Times watched" value={String(entry.timesWatched)} /> : null}
              </>
            )}
          </dl>
          {entry.notes ? <p className="mt-3 rounded-xl bg-elevated/60 p-3 text-sm text-muted">{entry.notes}</p> : null}
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionHeader title="Overview" />
          <p className="text-sm leading-relaxed text-muted">
            {media.overview ?? meta.storyline ?? "No description available from the provider."}
          </p>
          {media.trailerUrl ? (
            <a
              href={media.trailerUrl}
              target="_blank"
              rel="noreferrer"
              className="press focusable mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-glow"
            >
              <IconPlay size={13} /> Watch trailer
            </a>
          ) : null}
        </Card>
        <Card className="p-4">
          <SectionHeader
            title="Details"
            action={
              <button
                type="button"
                onClick={refreshMetadata}
                disabled={busy}
                className="press focusable inline-flex items-center gap-1 text-[11px] font-semibold text-purple disabled:opacity-50"
              >
                <IconRefresh size={13} /> Refresh
              </button>
            }
          />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {meta.director ? <Field label="Director" value={meta.director} /> : null}
            {meta.creator ? <Field label="Created by" value={meta.creator} /> : null}
            {meta.developers?.length ? <Field label="Developers" value={meta.developers.join(", ")} /> : null}
            {meta.publishers?.length ? <Field label="Publishers" value={meta.publishers.join(", ")} /> : null}
            {meta.platforms?.length ? <Field label="Platforms" value={meta.platforms.join(", ")} /> : null}
            {meta.studios?.length ? <Field label="Production" value={meta.studios.slice(0, 3).join(", ")} /> : null}
            {meta.network ? <Field label="Network" value={meta.network} /> : null}
            <Field label="Release" value={media.releaseDate ? friendlyDate(media.releaseDate, true) : "—"} />
            {meta.languages?.length ? <Field label="Languages" value={meta.languages.slice(0, 3).join(", ")} /> : null}
            {meta.countries?.length ? <Field label="Countries" value={meta.countries.slice(0, 3).join(", ")} /> : null}
            {meta.metacritic ? <Field label="Metacritic" value={String(meta.metacritic)} /> : null}
            {meta.averagePlaytime ? <Field label="Avg. playtime" value={`${meta.averagePlaytime}h`} /> : null}
            {meta.esrb ? <Field label="Age rating" value={meta.esrb} /> : null}
            {meta.status ? <Field label="Status" value={meta.status} /> : null}
            <Field label="Source" value={meta.source ?? media.provider} />
          </dl>
          {meta.homepage || meta.website ? (
            <a
              href={(meta.website ?? meta.homepage) as string}
              target="_blank"
              rel="noreferrer"
              className="focusable mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple"
            >
              Official website
            </a>
          ) : null}
        </Card>
      </section>

      {castNames.length ? (
        <section>
          <SectionHeader title="Main cast" />
          <div className="snap-rail no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {castNames.slice(0, 12).map((person) => (
              <div key={`${person.name}-${person.character}`} className="w-28 shrink-0">
                <div
                  className="grid aspect-square place-items-center rounded-2xl border border-line text-center text-xs font-bold"
                  style={gradientFor(person.name || "?")}
                >
                  <span className="px-2 text-ink/90">{person.name}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted">{person.character}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {meta.screenshots?.length ? (
        <section>
          <SectionHeader title="Screenshots" />
          <div className="snap-rail no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {meta.screenshots.filter(Boolean).slice(0, 6).map((shot) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={shot}
                src={shot}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-40 w-auto shrink-0 rounded-xl border border-line object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {meta.stores?.length ? (
        <section>
          <SectionHeader title="Store links" />
          <div className="flex flex-wrap gap-2">
            {meta.stores.map((store) => (
              <a
                key={store.url}
                href={store.url}
                target="_blank"
                rel="noreferrer"
                className="press focusable rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:border-purple/60 hover:text-ink"
              >
                {store.name}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <Link href={`/${sectionBase}`} className="focusable inline-flex text-xs font-semibold text-purple">
        <IconChevronLeft size={14} /> Back to {sectionBase === "tv" ? "TV shows" : sectionBase}
      </Link>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink" title={typeof value === "string" ? value : undefined}>
        {value}
      </dd>
    </div>
  );
}
