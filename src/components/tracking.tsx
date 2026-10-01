"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/client";
import { Button, Chip, Spinner } from "@/components/ui";
import { useCelebration } from "@/components/celebration";
import { IconCheck, IconHeart, IconPlus, IconStarFilled, IconThumbDown, IconThumbUp, IconTrash, IconX } from "@/components/icons";
import {
  MEDIA_SINGULAR,
  statusLabel,
  statusesFor,
  type LibraryEntry,
  type MediaRecord,
  type MediaType,
} from "@/lib/types";

type SheetKind = "status" | "watched" | "edit" | "list" | null;

interface SheetTarget {
  media: MediaRecord;
  entry: LibraryEntry | null;
}

interface TrackingApi {
  version: number;
  refresh: () => void;
  openStatus: (media: MediaRecord, entry: LibraryEntry | null) => void;
  openWatched: (media: MediaRecord, entry: LibraryEntry | null) => void;
  openEdit: (media: MediaRecord, entry: LibraryEntry | null) => void;
  openList: (media: MediaRecord, entry: LibraryEntry | null) => void;
  quickStatus: (media: MediaRecord, status: string) => Promise<void>;
  toggleEpisode: (media: MediaRecord, season: number, episode: number, watched: boolean) => Promise<void>;
}

const TrackingContext = createContext<TrackingApi | null>(null);

export function useTracking(): TrackingApi {
  const context = useContext(TrackingContext);
  if (!context) throw new Error("useTracking must be used inside TrackingProvider");
  return context;
}

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<SheetKind>(null);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  const open = useCallback((next: SheetKind, media: MediaRecord, entry: LibraryEntry | null) => {
    setTarget({ media, entry });
    setKind(next);
  }, []);

  const value = useMemo<TrackingApi>(
    () => ({
      version,
      refresh,
      openStatus: (media, entry) => open("status", media, entry),
      openWatched: (media, entry) => open("watched", media, entry),
      openEdit: (media, entry) => open("edit", media, entry),
      openList: (media, entry) => open("list", media, entry),
      quickStatus: async (media, status) => {
        setBusy(true);
        try {
          await apiPost("/api/library", { action: "set_status", mediaId: media.id, status });
          refresh();
        } finally {
          setBusy(false);
        }
      },
      toggleEpisode: async (media, season, episode, watched) => {
        await apiPost("/api/library", { action: "episode", mediaId: media.id, season, episode, watched });
        refresh();
      },
    }),
    [open, refresh, version],
  );

  useEffect(() => {
    if (!kind) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setKind(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind]);

  return (
    <TrackingContext.Provider value={value}>
      {children}
      {kind && target ? (
        <Sheet
          kind={kind}
          target={target}
          busy={busy}
          onClose={() => setKind(null)}
          onSaved={() => {
            setKind(null);
            refresh();
          }}
        />
      ) : null}
    </TrackingContext.Provider>
  );
}

function Sheet({
  kind,
  target,
  busy,
  onClose,
  onSaved,
}: {
  kind: SheetKind;
  target: SheetTarget;
  busy: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { media, entry } = target;
  const type = media.type as MediaType;
  const { celebrate } = useCelebration();
  const [status, setStatus] = useState(entry?.status ?? (type === "game" ? "backlog" : "want_to_watch"));
  const [rating, setRating] = useState<number>(entry?.rating ?? 8);
  const [hasRating, setHasRating] = useState(entry?.rating != null);
  const [liked, setLiked] = useState<boolean | null>(entry?.liked ?? null);
  const [watchedOn, setWatchedOn] = useState(new Date().toISOString().slice(0, 10));
  const [rewatch, setRewatch] = useState(false);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [platform, setPlatform] = useState(entry?.platform ?? "");
  const [playtime, setPlaytime] = useState(String(entry?.playtimeHours ?? ""));
  const [startedOn, setStartedOn] = useState(entry?.startedOn ?? "");
  const [completedOn, setCompletedOn] = useState(entry?.completedOn ?? "");
  const [favorite, setFavorite] = useState(entry?.favorite ?? false);
  const [lists, setLists] = useState<Array<{ id: number; name: string; mediaType: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (kind !== "list") return;
    apiGet<{ lists: Array<{ id: number; name: string; mediaType: string }> }>("/api/lists")
      .then((data) => setLists(data.lists ?? []))
      .catch(() => setLists([]));
  }, [kind]);

  async function save() {
    setSaving(true);
    try {
      if (kind === "status") {
        await apiPost("/api/library", {
          action: "set_status",
          mediaId: media.id,
          status,
          rating: hasRating ? rating : null,
          liked,
        });
      } else if (kind === "watched") {
        await apiPost("/api/library", {
          action: "mark_watched",
          mediaId: media.id,
          watchedOn,
          rating: hasRating ? rating : null,
          liked,
          rewatch,
          notes: notes || null,
          platform: platform || null,
          playtimeHours: playtime ? Number(playtime) : null,
          startedOn: startedOn || watchedOn,
          completedOn: type === "game" ? completedOn || watchedOn : null,
        });
      } else if (kind === "edit") {
        await apiPost("/api/library", {
          action: "patch",
          mediaId: media.id,
          status,
          rating: hasRating ? rating : null,
          liked,
          favorite,
          notes: notes || null,
          platform: platform || null,
          playtimeHours: playtime ? Number(playtime) : null,
          startedOn: startedOn || null,
          completedOn: completedOn || null,
        });
      }
      const finished =
        kind === "watched" ||
        (kind !== "list" && ["watched", "completed"].includes(status));
      if (finished) {
        celebrate(
          type === "tv" ? "watch" : "complete",
          type === "game" ? `${media.title} completed` : `${media.title} added to your history`,
        );
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const title = kind === "status" ? "Track this" : kind === "watched" ? `Mark as ${type === "game" ? "completed" : "watched"}` : kind === "list" ? "Add to list" : "Your tracking";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="rise relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-8 sm:max-w-lg sm:rounded-3xl sm:pb-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-muted uppercase">{title}</p>
            <h3 className="mt-1 text-lg leading-tight font-bold text-ink">{media.title}</h3>
            <p className="text-xs text-muted">
              {MEDIA_SINGULAR[type]} · {media.year ?? "—"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="focusable rounded-full border border-line px-2.5 py-1 text-xs text-muted">
            Close
          </button>
        </div>

        {(kind === "status" || kind === "edit") && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-muted">Status</p>
            <div className="flex flex-wrap gap-2">
              {statusesFor(type).map((option) => (
                <Chip key={option} active={status === option} onClick={() => setStatus(option)}>
                  {statusLabel(option)}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {kind === "list" ? (
          <div className="mt-5 space-y-2">
            {lists.length ? (
              lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await apiPost("/api/lists", { action: "add_item", id: list.id, mediaId: media.id });
                      onSaved();
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="focusable flex w-full items-center justify-between rounded-xl border border-line bg-elevated/60 px-4 py-3 text-left text-sm text-ink hover:border-purple/60"
                >
                  <span>{list.name}</span>
                  <span className="text-xs text-muted">{list.mediaType}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted">You have no lists yet.</p>
            )}
            <Link
              href={`/lists?add=${encodeURIComponent(media.id)}`}
              className="press focusable mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-3 text-sm font-semibold text-purple"
            >
              <IconPlus size={15} /> Create a new list
            </Link>
          </div>
        ) : null}

        {kind !== "list" ? (
          <>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted">Rating</p>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={hasRating} onChange={(event) => setHasRating(event.target.checked)} />
                  I want to rate this
                </label>
              </div>
              {hasRating ? (
                <div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.1}
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                    className="w-full"
                    aria-label="Rating"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted">
                    <span>1.0</span>
                    <span className="text-base font-bold text-bright">{rating.toFixed(1)} / 10</span>
                    <span>10.0</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-muted">Reaction</p>
              <div className="flex gap-2">
                <Chip active={liked === true} onClick={() => setLiked(liked === true ? null : true)}>
                  <span className="inline-flex items-center gap-1.5">
                    <IconThumbUp size={14} /> Liked
                  </span>
                </Chip>
                <Chip active={liked === false} onClick={() => setLiked(liked === false ? null : false)}>
                  <span className="inline-flex items-center gap-1.5">
                    <IconThumbDown size={14} /> Not for me
                  </span>
                </Chip>
              </div>
            </div>

            {kind === "watched" ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold text-muted">
                  {type === "game" ? "Completed on" : "Watched on"}
                </p>
                <input
                  type="date"
                  value={watchedOn}
                  onChange={(event) => setWatchedOn(event.target.value)}
                  className="w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                />
                {type !== "game" ? (
                  <label className="mt-3 flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={rewatch} onChange={(event) => setRewatch(event.target.checked)} />
                    This was a rewatch
                  </label>
                ) : null}
              </div>
            ) : null}

            {kind === "edit" && type === "game" ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-muted">
                  Platform
                  <input
                    value={platform}
                    onChange={(event) => setPlatform(event.target.value)}
                    placeholder="PC, PS5…"
                    className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Playtime (hours)
                  <input
                    value={playtime}
                    onChange={(event) => setPlaytime(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Started
                  <input
                    type="date"
                    value={startedOn}
                    onChange={(event) => setStartedOn(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Completed
                  <input
                    type="date"
                    value={completedOn}
                    onChange={(event) => setCompletedOn(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                  />
                </label>
              </div>
            ) : null}

            {kind === "edit" ? (
              <label className="mt-4 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
                <span className="inline-flex items-center gap-1.5">
                  <IconHeart size={15} /> Favorite
                </span>
              </label>
            ) : null}

            {kind !== "status" ? (
              <label className="mt-5 block text-xs font-semibold text-muted">
                Notes (optional)
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                  placeholder="A thought to remember this by…"
                />
              </label>
            ) : null}

            <div className="mt-6 flex gap-2">
              <Button onClick={save} disabled={saving || busy} className="flex-1">
                {saving ? <Spinner /> : <IconCheck size={16} />} Save
              </Button>
              {entry ? (
                <Button
                  variant="danger"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await apiPost("/api/library", { action: "remove", mediaId: media.id });
                      onSaved();
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="mt-3 text-center text-[11px] text-muted">Everything except the status is optional.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
