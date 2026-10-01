"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useApi } from "@/lib/client";
import { Button, Card, EmptyState, SectionHeader, Skeleton } from "@/components/ui";
import { LumenMark } from "@/components/brand";
import {
  IconChart,
  IconCheckCircle,
  IconClock,
  IconFilm,
  IconFlame,
  IconGamepad,
  IconLayers,
  IconSparkle,
  IconStarFilled,
  IconTrophy,
  IconTv,
} from "@/components/icons";
import { BadgeGrid } from "@/components/insights-ui";
import type { RecapView } from "@/lib/view";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function RecapPage() {
  const [year, setYear] = useState<number | null>(null);
  const { data, loading, error, refresh } = useApi<RecapView>(`/api/insights?view=recap${year ? `&year=${year}` : ""}`, [year]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }
  if (error && !data) {
    return <EmptyState title="Couldn't build your recap" body={error} action={{ label: "Try again", href: "/recap" }} />;
  }
  if (!data) return null;

  const { recap, achievements, streak } = data;
  const maxMonth = Math.max(1, ...recap.monthBars.map((bar) => bar.count));
  const total = recap.movies + recap.shows + recap.games;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Cover */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-deep via-surface to-surface p-6 text-center sm:p-10">
        <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-glow/20 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex justify-center">
            <LumenMark size={44} />
          </div>
          <p className="mt-4 text-[11px] font-bold tracking-[0.28em] text-glow uppercase">Your year in entertainment</p>
          <h1 className="tnum mt-2 text-6xl font-black tracking-tighter text-ink sm:text-7xl">{recap.year}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">{recap.headline}</p>
          {recap.years.length > 1 ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {recap.years.slice(0, 6).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setYear(option)}
                  className={`press focusable tnum rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    option === recap.year ? "border-purple bg-purple/20 text-ink" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Headline numbers */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigNumber icon={<IconFilm size={18} />} label="Movies" value={recap.movies} />
        <BigNumber icon={<IconTv size={18} />} label="Shows" value={recap.shows} />
        <BigNumber icon={<IconGamepad size={18} />} label="Games" value={recap.games} />
        <BigNumber icon={<IconClock size={18} />} label="Hours" value={recap.hours} />
      </section>

      {total === 0 ? (
        <EmptyState
          title={`Nothing tracked in ${recap.year} yet`}
          body="Watch something and it will show up in this recap. Recaps are built entirely from your own history."
          action={{ label: "Find something to watch", href: "/movies?tab=discover" }}
        />
      ) : null}

      {/* Month chart */}
      <section>
        <SectionHeader
          title="Your year, month by month"
          subtitle={
            recap.busiestMonth
              ? `${MONTHS[recap.busiestMonth.month - 1]} was your biggest month — ${recap.busiestMonth.count} things watched`
              : undefined
          }
        />
        <Card className="p-4 sm:p-5">
          <div className="flex h-40 items-end gap-1.5 sm:gap-2.5">
            {recap.monthBars.map((bar) => (
              <div key={bar.month} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="tnum text-[10px] text-faint">{bar.count || ""}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-purple/40 to-glow transition-all duration-500"
                  style={{ height: `${Math.max(2, (bar.count / maxMonth) * 100)}%`, opacity: bar.count ? 1 : 0.25 }}
                  title={`${MONTHS[bar.month - 1]}: ${bar.count}`}
                />
                <span className="text-[10px] font-semibold text-muted">{MONTHS[bar.month - 1]}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-faint">
            <IconChart size={13} /> Episodes and finished titles counted together
          </p>
        </Card>
      </section>

      {/* Top genres */}
      {recap.topGenres.length ? (
        <section>
          <SectionHeader title="Your taste" subtitle="Genres you reached for most" />
          <Card className="divide-y divide-line">
            {recap.topGenres.map((genre, index) => {
              const pct = Math.round((genre.count / recap.topGenres[0].count) * 100);
              return (
                <div key={genre.genre} className="flex items-center gap-3 px-4 py-3">
                  <span className="tnum w-5 shrink-0 text-sm font-black text-faint">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{genre.genre}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple to-glow" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="tnum shrink-0 text-xs font-bold text-glow">{genre.count}</span>
                </div>
              );
            })}
          </Card>
        </section>
      ) : null}

      {/* Highlights */}
      <section>
        <SectionHeader title="Highlights" />
        <div className="grid gap-3 sm:grid-cols-2">
          {recap.topRated ? (
            <Highlight
              icon={<IconStarFilled size={16} />}
              label="Your highest rated"
              value={recap.topRated.title}
              note={`${recap.topRated.rating.toFixed(1)} / 10`}
              href={`/${recap.topRated.type === "tv" ? "tv" : recap.topRated.type === "game" ? "games" : "movies"}`}
            />
          ) : null}
          {recap.firstOfTheYear ? (
            <Highlight icon={<IconSparkle size={16} />} label="First of the year" value={recap.firstOfTheYear.title} note={recap.firstOfTheYear.date} />
          ) : null}
          {recap.longestMovie ? (
            <Highlight icon={<IconClock size={16} />} label="Longest sitting" value={recap.longestMovie.title} note={`${recap.longestMovie.runtime} minutes`} />
          ) : null}
          {recap.mostEpisodes ? (
            <Highlight icon={<IconTv size={16} />} label="Deepest dive" value={recap.mostEpisodes.title} note={`${recap.mostEpisodes.count} episodes`} />
          ) : null}
          {streak.longest ? (
            <Highlight icon={<IconFlame size={16} />} label="Longest streak" value={`${streak.longest} days`} note="of tracking something" />
          ) : null}
          {recap.episodes ? (
            <Highlight icon={<IconCheckCircle size={16} />} label="Episodes watched" value={String(recap.episodes)} note="across every show" />
          ) : null}
        </div>
      </section>

      {/* Platforms + decades */}
      {recap.platforms.length || recap.decades.length ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {recap.platforms.length ? (
            <Card className="p-4">
              <SectionHeader title="Where you played" size="sm" />
              <ul className="mt-2 space-y-1.5 text-sm">
                {recap.platforms.slice(0, 5).map((entry) => (
                  <li key={entry.platform} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted">{entry.platform}</span>
                    <span className="tnum font-bold text-ink">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {recap.decades.length ? (
            <Card className="p-4">
              <SectionHeader title="When it was made" size="sm" />
              <ul className="mt-2 space-y-1.5 text-sm">
                {recap.decades.slice(0, 5).map((entry) => (
                  <li key={entry.decade} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <IconLayers size={14} /> {entry.decade}
                    </span>
                    <span className="tnum font-bold text-ink">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* Badges */}
      <section>
        <SectionHeader
          title="Badges"
          subtitle={`${achievements.unlocked} of ${achievements.all.length} unlocked · ${achievements.score} points`}
          action={
            <Link href="/profile" className="focusable text-xs font-semibold text-purple">
              Profile
            </Link>
          }
        />
        <BadgeGrid achievements={achievements.all} compact />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 p-4">
        <p className="flex items-center gap-2 text-xs text-muted">
          <IconTrophy size={15} className="text-glow" /> Recaps are built from your own history — nothing leaves your server.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Recalculate
          </Button>
          <Link href="/">
            <Button size="sm" variant="ghost">
              Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function BigNumber({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-4">
      <div className="absolute -top-6 -right-6 size-20 rounded-full bg-purple/10 blur-2xl" aria-hidden />
      <span className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
        <span className="text-glow">{icon}</span>
        {label}
      </span>
      <p className="tnum relative mt-1 text-4xl font-black tracking-tight text-ink">{value}</p>
    </div>
  );
}

function Highlight({
  icon,
  label,
  value,
  note,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-purple/15 text-glow">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">{label}</p>
        <p className="truncate text-sm font-bold text-ink">{value}</p>
        {note ? <p className="tnum truncate text-xs text-muted">{note}</p> : null}
      </div>
    </>
  );
  const classes = "flex items-center gap-3 rounded-2xl border border-line bg-surface/90 p-4";
  return href ? (
    <Link href={href} className={`press focusable ${classes} hover:border-purple/50`}>
      {inner}
    </Link>
  ) : (
    <div className={classes}>{inner}</div>
  );
}
