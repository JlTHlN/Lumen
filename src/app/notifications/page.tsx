"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost, useApi } from "@/lib/client";
import { Button, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import type { NotificationsData } from "@/lib/view";
import { IconBell, IconCheck, IconCheckCircle, IconRefresh, IconSend } from "@/components/icons";

export default function NotificationsPage() {
  const { data, refresh } = useApi<NotificationsData>("/api/notifications");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiPost<{ message?: string; created?: number; count?: number }>(
        "/api/notifications",
        { action },
      );
      setMessage(
        result.message ??
          (action === "check_new" ? `Checked. ${result.created ?? 0} new notifications.` : "Done."),
      );
      refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" subtitle="New episodes and releases for things you follow." />

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run("check_new")}>
          <IconCheckCircle size={15} /> Check for new episodes
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run("refresh_upcoming")}>
          <IconRefresh size={15} /> Refresh upcoming
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run("test")}>
          <IconSend size={15} /> Send Telegram test
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => run("read")}>
          <IconCheck size={15} /> Mark all read
        </Button>
      </div>
      {message ? <Card className="p-3 text-sm text-ink">{message}</Card> : null}

      <SectionHeader title={`Inbox${data?.unread ? ` · ${data.unread} unread` : ""}`} />
      {data?.items.length ? (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {data.items.map((item) => (
            <Link
              key={item.id}
              href={item.href ?? "#"}
              className={`flex items-start gap-3 px-4 py-3 ${item.read ? "" : "bg-purple/10"}`}
            >
              <IconBell size={17} className="mt-0.5 shrink-0 text-glow" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-muted">{item.body}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted">
                {new Date(item.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notifications yet"
          body="Enable events in settings and follow shows that are still airing."
          action={{ label: "Notification settings", href: "/settings" }}
        />
      )}
    </div>
  );
}
