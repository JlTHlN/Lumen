"use client";

import Link from "next/link";
import { useApi } from "@/lib/client";
import { MediaRow } from "@/components/media-card";
import { Card, EmptyState, SectionHeader, StatCard } from "@/components/ui";
import { useTracking } from "@/components/tracking";
import { LumenMark } from "@/components/brand";
import { BadgeGrid, HeatmapSection, PickCard } from "@/components/insights-ui";
import { IconArrowRight, IconSparkle, IconTrophy } from "@/components/icons";
import type { InsightsAchievements } from "@/lib/view";
import type { HomeData, ListsData } from "@/lib/view";
import type { MediaType } from "@/lib/types";

export default function ProfilePage() {
  const { version } = useTracking();
  const { data } = useApi<HomeData>("/api/home", [version]);
  const { data: lists } = useApi<ListsData>("/api/lists", [version]);
  const { data: badges } = useApi<InsightsAchievements>("/api/insights?view=achievements", [version]);

  if (!data) {
    return <div className="shimmer h-64 rounded-3xl bg-elevated" />;
  }

  const profile = data.settings.profile;
  const favorites = data.favorites ?? [];
  const joined = new Date(profile.joinedAt);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-deep via-surface to-surface p-6 sm:p-8">
        <div className="absolute -top-16 -right-10 size-48 rounded-full bg-glow/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-24 shrink-0 place-items-center rounded-2xl border border-line bg-elevated/70 text-5xl shadow-glow" aria-hidden>
            {profile.avatar || "🎬"}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-black tracking-tight text-ink">{profile.displayName}</h1>
            <p className="text-sm text-muted">@{profile.username}</p>
            <p className="mt-2 max-w-xl text-sm text-muted">{profile.bio}</p>
            <p className="mt-2 text-xs text-faint">
              Tracking since {joined.toLocaleDateString(undefined, { month: "long", year: "numeric" })} · {profile.timezone}
            </p>
          </div>
          <Link
            href="/settings"
            className="press focusable shrink-0 rounded-full border border-line bg-surface/50 px-4 py-2 text-xs font-semibold text-muted hover:border-purple/60 hover:text-ink"
          >
            Edit profile
          </Link>
        </div>
      </section>

      <section>
        <SectionHeader title="Statistics" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Movies" value={String(data.counts.movie ?? 0)} hint={`${data.stats.movie.watched ?? 0} watched`} />
          <StatCard label="Shows" value={String(data.counts.tv ?? 0)} hint={`${data.stats.tv.episodesWatched ?? 0} episodes`} />
          <StatCard label="Games" value={String(data.counts.game ?? 0)} hint={`${data.stats.game.gamesCompleted ?? 0} completed`} />
          <StatCard
            label="Hours"
            value={String(
              Math.round(
                Number(data.stats.movie.hours ?? 0) + Number(data.stats.tv.hours ?? 0) + Number(data.stats.game.playtimeHours ?? 0),
              ),
            )}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Currently watching" />
        <MediaRow items={data.continueWatching} emptyLabel="Nothing in progress." />
      </section>

      <section>
        <SectionHeader title="Currently playing" />
        <MediaRow items={data.gamesPlaying} emptyLabel="No games in progress." />
      </section>

      {favorites.length ? (
        <section>
          <SectionHeader title="Favorites" />
          <MediaRow items={favorites} />
        </section>
      ) : null}

      <section>
        <SectionHeader
          title="Lists"
          action={
            <Link href="/lists" className="focusable inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
              Manage <IconArrowRight size={13} />
            </Link>
          }
        />
        {lists?.lists.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lists.lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="press focusable rounded-2xl border border-line bg-surface p-4 hover:border-purple/60"
              >
                <p className="text-sm font-bold text-ink">{list.name}</p>
                <p className="mt-0.5 text-xs text-muted">{list.itemCount} items</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No lists yet" body="Create a list to group your favourites." action={{ label: "Create a list", href: "/lists" }} />
        )}
      </section>

      {badges ? (
        <section>
          <SectionHeader
            title="Badges"
            subtitle={`${badges.unlocked} of ${badges.all.length} unlocked · ${badges.score} points`}
            action={
              badges.streak.current ? (
                <span className="tnum inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs font-bold text-warn">
                  <IconTrophy size={13} /> {badges.streak.current} day streak
                </span>
              ) : null
            }
          />
          <BadgeGrid achievements={badges.all} compact />
        </section>
      ) : (
        <section>
          <SectionHeader title="Badges" />
          <div className="shimmer h-32 rounded-2xl bg-elevated" />
        </section>
      )}

      <HeatmapSection />

      <PickCard />

      <Link
        href="/recap"
        className="press focusable relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-purple/40 bg-gradient-to-r from-deep via-surface to-surface p-5"
      >
        <span className="absolute -top-12 -right-8 size-40 rounded-full bg-glow/20 blur-3xl" aria-hidden />
        <span className="relative flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-purple/20 text-glow">
            <IconSparkle size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black tracking-tight text-ink">Your year in entertainment</span>
            <span className="block text-xs text-muted">A recap built entirely from your own history.</span>
          </span>
        </span>
        <IconArrowRight size={18} className="relative shrink-0 text-glow" />
      </Link>

      <RecentGrid data={data} />

      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <LumenMark size={28} />
          <p className="text-xs text-muted">Private, self-hosted, yours.</p>
        </div>
        <Link href="/about" className="focusable inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
          About <IconArrowRight size={13} />
        </Link>
      </Card>
    </div>
  );
}

function RecentGrid({ data }: { data: HomeData }) {
  const groups: Array<[string, HomeData["recentlyWatched"], MediaType]> = [
    ["Recently watched", data.recentlyWatched, "movie"],
    ["Recently completed", data.recentlyCompletedShows, "tv"],
    ["Recently played", data.recentlyPlayed, "game"],
  ];
  return (
    <>
      {groups.map(([title, items]) =>
        items.length ? (
          <section key={title}>
            <SectionHeader title={title} />
            <MediaRow items={items} />
          </section>
        ) : null,
      )}
    </>
  );
}
