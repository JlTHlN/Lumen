"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiPost, useApi } from "@/lib/client";
import { IconArrowDown, IconArrowUp } from "@/components/icons";
import { Button, Card, EmptyState, PageHeader, SectionHeader, Skeleton } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";
import { MEDIA_LABEL, type MediaType } from "@/lib/types";
import type { ListsData } from "@/lib/view";

export default function ListsPage() {
  const { data, loading, refresh } = useApi<ListsData>("/api/lists");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState<"all" | MediaType>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const add = params.get("add");
    if (add) setPendingItem(Number(add));
  }, []);

  async function createList() {
    if (!name.trim()) {
      setError("Give your list a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ list: { id: number } }>("/api/lists", {
        action: "create",
        name,
        description: description || null,
        mediaType,
      });
      if (pendingItem) {
        await apiPost("/api/lists", { action: "add_item", id: result.list.id, mediaId: pendingItem });
        setPendingItem(null);
      }
      setName("");
      setDescription("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiPost("/api/lists", body);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Lists" subtitle="Curate anything: best horror, weekend games, rewatch pile." />

      <Card className="space-y-3 p-4">
        <SectionHeader title={pendingItem ? "Create a list and add this title" : "Create a list"} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Best Sci-Fi"
              className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-xs font-semibold text-muted">
            Type
            <select
              value={mediaType}
              onChange={(event) => setMediaType(event.target.value as "all" | MediaType)}
              className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
            >
              <option value="all">Everything</option>
              {(["movie", "tv", "game"] as MediaType[]).map((type) => (
                <option key={type} value={type}>
                  {MEDIA_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs font-semibold text-muted">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="My favourite science-fiction movies."
            className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
          />
        </label>
        {error ? <p className="text-xs text-bad">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Button onClick={createList} disabled={busy}>
            {busy ? "Saving…" : "Create list"}
          </Button>
          {pendingItem ? (
            <span className="text-xs text-muted">A title is waiting to be added to your new list.</span>
          ) : null}
        </div>
      </Card>

      <section>
        <SectionHeader title={`Your lists${data?.lists.length ? ` · ${data.lists.length}` : ""}`} />
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : data?.lists.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.lists.map((list, index) => (
              <Card key={list.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/lists/${list.id}`} className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{list.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{list.description ?? "No description"}</p>
                    <p className="mt-2 text-[11px] font-semibold text-purple">
                      {list.itemCount} items · {list.mediaType === "all" ? "everything" : MEDIA_LABEL[list.mediaType as MediaType]}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={busy || index === 0}
                      onClick={() => act({ action: "reorder", order: swap(data.lists, index, index - 1) })}
                      className="focusable rounded-lg border border-line px-2 text-xs text-muted disabled:opacity-30"
                    >
                      <IconArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={busy || index === data.lists.length - 1}
                      onClick={() => act({ action: "reorder", order: swap(data.lists, index, index + 1) })}
                      className="focusable rounded-lg border border-line px-2 text-xs text-muted disabled:opacity-30"
                    >
                      <IconArrowDown size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/lists/${list.id}`} className="focusable inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
                    Open <IconArrowRight size={13} />
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt("Rename list", list.name);
                      if (next) act({ action: "rename", id: list.id, name: next });
                    }}
                    className="focusable text-xs font-semibold text-muted"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete “${list.name}”? Your tracked titles are not affected.`)) {
                        act({ action: "delete", id: list.id });
                      }
                    }}
                    className="focusable text-xs font-semibold text-bad"
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No lists yet"
            body="Lists can mix watched and unwatched titles, from any category."
          />
        )}
      </section>
    </div>
  );
}

function swap(lists: ListsData["lists"], from: number, to: number) {
  const next = [...lists];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item) => item.id);
}

