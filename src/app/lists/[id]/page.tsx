"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { IconArrowDown, IconArrowUp, IconChevronLeft } from "@/components/icons";
import { useState } from "react";
import { apiPost, useApi } from "@/lib/client";
import { MediaGrid } from "@/components/media-card";
import { useTracking } from "@/components/tracking";
import { Button, Card, EmptyState, SectionHeader, Skeleton } from "@/components/ui";
import { MEDIA_LABEL, type MediaType } from "@/lib/types";
import type { ListDetailData } from "@/lib/view";

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id ?? 0);
  const { version, refresh } = useTracking();
  const { data, loading, refresh: reload } = useApi<ListDetailData>(`/api/lists?id=${id}`, [version]);
  const [busy, setBusy] = useState(false);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiPost("/api/lists", body);
      reload();
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Skeleton className="h-40 w-full" />;
  if (!data) return <EmptyState title="List not found" body="It may have been deleted." action={{ label: "All lists", href: "/lists" }} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/lists" className="focusable inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
            <IconChevronLeft size={13} /> All lists
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">{data.list.name}</h1>
          <p className="text-sm text-muted">
            {data.list.description ?? "No description"} ·{" "}
            {data.list.mediaType === "all" ? "everything" : MEDIA_LABEL[data.list.mediaType as MediaType]}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              const name = window.prompt("Rename list", data.list.name);
              if (name) act({ action: "rename", id, name });
            }}
          >
            Rename
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Delete this list? Your tracked titles are not affected.")) return;
              await act({ action: "delete", id });
              window.location.href = "/lists";
            }}
          >
            Delete list
          </Button>
        </div>
      </div>

      <section>
        <SectionHeader title={`${data.items.length} items`} action={
          <Link href="/search" className="focusable text-xs font-semibold text-purple">
            + Add from search
          </Link>
        } />
        {data.items.length ? (
          <div className="space-y-3">
            {data.items.map((item, index) => (
              <Card key={item.media.id} className="flex items-center gap-3 p-3">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-muted">{index + 1}</span>
                <Link href={`/${item.media.type === "tv" ? "tv" : item.media.type === "game" ? "games" : "movies"}/${item.media.provider}-${item.media.externalId}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.media.title}</p>
                  <p className="truncate text-xs text-muted">
                    {[item.media.year, (item.media.genres ?? [])[0]].filter(Boolean).join(" · ")}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={busy || index === 0}
                    onClick={() => act({ action: "reorder_items", id, order: moveItem(data.items.map((row) => row.media.id), index, index - 1) })}
                    className="focusable grid size-8 place-items-center rounded-lg border border-line text-xs text-muted disabled:opacity-30"
                  >
                      <IconArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={busy || index === data.items.length - 1}
                    onClick={() => act({ action: "reorder_items", id, order: moveItem(data.items.map((row) => row.media.id), index, index + 1) })}
                    className="focusable grid size-8 place-items-center rounded-lg border border-line text-xs text-muted disabled:opacity-30"
                  >
                      <IconArrowDown size={14} />
                  </button>
                  <Button variant="ghost" disabled={busy} onClick={() => act({ action: "remove_item", id, mediaId: item.media.id })}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="This list is empty"
            body="Use the + button on any card, or add from search results."
            action={{ label: "Search titles", href: "/search" }}
          />
        )}
      </section>

      {data.items.length ? (
        <section>
          <SectionHeader title="Grid view" />
          <MediaGrid items={data.items} />
        </section>
      ) : null}
    </div>
  );
}

function moveItem(ids: number[], from: number, to: number) {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
