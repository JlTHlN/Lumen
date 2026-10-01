"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiGet, useApi } from "@/lib/client";
import { mediaHref } from "@/components/media-card";
import { useCelebration } from "@/components/celebration";
import { Button, Card, Chip, SectionHeader, Spinner } from "@/components/ui";
import {
  IconArrowRight,
  IconCheckCircle,
  IconClock,
  IconDice,
  IconFilm,
  IconFlame,
  IconGamepad,
  IconGrid,
  IconHeart,
  IconLayers,
  IconList,
  IconRefresh,
  IconSparkle,
  IconStarFilled,
  IconTv,
} from "@/components/icons";
import type { Achievement, HeatmapData, InsightsPickData, StreakInfo } from "@/lib/view";

const BADGE_ICONS: Record<string, (size: number) => ReactNode> = {
  sparkle: (s) => <IconSparkle size={s} />,
  film: (s) => <IconFilm size={s} />,
  tv: (s) => <IconTv size={s} />,
  gamepad: (s) => <IconGamepad size={s} />,
  check: (s) => <IconCheckCircle size={s} />,
  star: (s) => <IconStarFilled size={s} />,
  heart: (s) => <IconHeart size={s} />,
  list: (s) => <IconList size={s} />,
  clock: (s) => <IconClock size={s} />,
  moon: (s) => <IconClock size={s} />,
  sun: (s) => <IconSparkle size={s} />,
  layers: (s) => <IconLayers size={s} />,
  grid: (s) => <IconGrid size={s} />,
  refresh: (s) => <IconRefresh size={s} />,
  flame: (s) => <IconFlame size={s} />,
};

const RARITY: Record<Achievement["rarity"], { ring: string; text: string; label: string }> = {
  common: { ring: "border-line", text: "text-muted", label: "Common" },
  rare: { ring: "border-purple/50", text: "text-glow", label: "Rare" },
  epic: { ring: "border-warn/50", text: "text-warn", label: "Epic" },
};

export function BadgeGrid({
  achievements,
  compact = false,
  onUnlocked,
}: {
  achievements: Achievement[];
  compact?: boolean;
  onUnlocked?: (count: number) => void;
}) {
  const { celebrate } = useCelebration();
  const known = useRef<number | null>(null);

  // Celebrate the first time the badge count grows in this browser.
  useEffect(() => {
    const key = "lumen.badges";
    const stored = Number(window.localStorage.getItem(key) ?? 0);
    const unlocked = achievements.filter((a) => a.unlocked).length;
    if (known.current === null) {
      known.current = unlocked;
      if (unlocked > stored && stored > 0) {
        const newest = achievements.filter((a) => a.unlocked).slice(stored).pop();
        if (newest) celebrate("badge", `${newest.title} — ${newest.description}`);
      }
      window.localStorage.setItem(key, String(unlocked));
      onUnlocked?.(unlocked);
      return;
    }
    if (unlocked > known.current) {
      const newest = achievements.filter((a) => a.unlocked).slice(known.current).pop();
      if (newest) celebrate("badge", `${newest.title} — ${newest.description}`);
      known.current = unlocked;
      window.localStorage.setItem(key, String(unlocked));
      onUnlocked?.(unlocked);
    }
  }, [achievements, celebrate, onUnlocked]);

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: compact ? "repeat(auto-fill, minmax(min(150px, 100%), 1fr))" : "repeat(auto-fill, minmax(min(190px, 100%), 1fr))" }}
    >
      {achievements.map((badge) => {
        const rarity = RARITY[badge.rarity];
        const pct = Math.round((badge.progress / badge.total) * 100);
        return (
          <div
            key={badge.id}
            title={badge.unlocked ? "Unlocked" : `${badge.progress} / ${badge.total}`}
            className={`relative overflow-hidden rounded-2xl border p-3.5 ${
              badge.unlocked ? `${rarity.ring} bg-surface` : "border-line/60 bg-surface/40"
            }`}
          >
            {badge.unlocked ? <div className="absolute -top-8 -right-8 size-20 rounded-full bg-glow/10 blur-2xl" aria-hidden /> : null}
            <div className="relative flex items-start gap-2.5">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                  badge.unlocked ? "bg-purple/20 text-glow" : "bg-elevated text-faint"
                }`}
              >
                {BADGE_ICONS[badge.icon]?.(17) ?? <IconSparkle size={17} />}
              </span>
              <div className="min-w-0">
                <p className={`truncate text-[13px] font-bold ${badge.unlocked ? "text-ink" : "text-muted"}`}>{badge.title}</p>
                <p className="line-clamp-2 text-[11px] leading-snug text-faint">{badge.description}</p>
              </div>
            </div>
            {!badge.unlocked ? (
              <div className="relative mt-2.5">
                <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full bg-line" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <p className="tnum mt-1 text-[10px] text-faint">
                  {badge.progress} / {badge.total}
                </p>
              </div>
            ) : (
              <p className={`relative mt-2 text-[10px] font-bold tracking-[0.14em] uppercase ${rarity.text}`}>{rarity.label}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function level(count: number, max: number) {
  if (!count) return "bg-elevated";
  const ratio = count / Math.max(1, max);
  if (ratio > 0.66) return "bg-glow";
  if (ratio > 0.33) return "bg-purple";
  return "bg-purple/50";
}

export function Heatmap({
  days,
  max,
  streak,
}: {
  days: Array<{ date: string; count: number }>;
  max: number;
  streak: StreakInfo;
}) {
  const weeks: Array<Array<{ date: string; count: number }>> = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <Card className="p-4">
      <SectionHeader
        title="Tracking activity"
        subtitle={`${streak.totalDays} active days`}
        action={
          streak.current > 0 ? (
            <span className="tnum inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs font-bold text-warn">
              <IconFlame size={13} /> {streak.current} day streak
            </span>
          ) : null
        }
      />
      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="flex gap-1">
          {weeks.map((week, index) => (
            <div key={index} className="flex flex-col gap-1">
              {week.map((day) => (
                <span
                  key={day.date}
                  title={`${day.date}: ${day.count} item${day.count === 1 ? "" : "s"}`}
                  className={`size-3 rounded-[3px] ${level(day.count, max)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-faint">
        <span>{streak.bestDay ? `Best day: ${streak.bestDay.date} (${streak.bestDay.count})` : "Start tracking to build a streak"}</span>
        <span className="inline-flex items-center gap-1">
          Less
          {["bg-elevated", "bg-purple/50", "bg-purple", "bg-glow"].map((tone) => (
            <span key={tone} className={`size-2.5 rounded-[3px] ${tone}`} />
          ))}
          More
        </span>
      </div>
      <p className="tnum mt-2 text-[11px] text-muted">Longest streak: {streak.longest} days</p>
    </Card>
  );
}

export function HeatmapSection() {
  const { data } = useApi<HeatmapData>("/api/insights?view=heatmap");
  if (!data) return <div className="shimmer h-44 rounded-2xl bg-elevated" />;
  return (
    <div className="space-y-3">
      <Heatmap days={data.heatmap.days} max={data.heatmap.max} streak={data.streak} />
      {data.fact ? (
        <p className="flex items-start gap-2 rounded-2xl border border-line bg-surface/60 p-3 text-xs text-muted">
          <IconSparkle size={15} className="mt-0.5 shrink-0 text-glow" />
          <span>{data.fact}</span>
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pick for me                                                         */
/* ------------------------------------------------------------------ */

export function PickCard() {
  const [mood, setMood] = useState("any");
  const [pick, setPick] = useState<InsightsPickData["pick"] | null>(null);
  const [moods, setMoods] = useState<Array<{ id: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiGet<InsightsPickData>("/api/insights?view=pick&mood=any")
      .then((data) => {
        setMoods(data.moods);
        setPick(data.pick);
        setMessage(data.message);
      })
      .catch(() => undefined);
  }, []);

  async function roll(nextMood = mood) {
    setBusy(true);
    try {
      const data = await apiGet<InsightsPickData>(`/api/insights?view=pick&mood=${nextMood}`);
      setPick(data.pick);
      setMessage(data.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative overflow-hidden p-4">
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-purple/15 blur-3xl" aria-hidden />
      <div className="relative">
        <SectionHeader title="Can't decide?" subtitle="Lumen picks something from your watchlist" />
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {moods.map((option) => (
            <Chip
              key={option.id}
              active={mood === option.id}
              onClick={() => {
                setMood(option.id);
                void roll(option.id);
              }}
            >
              {option.label}
            </Chip>
          ))}
        </div>

        {pick ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-elevated/50 p-3">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-line">
              {pick.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pick.posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <Link href={mediaHref(pick)} className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{pick.title}</p>
              <p className="truncate text-xs text-muted">
                {[pick.year, (pick.genres ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 truncate text-[11px] text-glow">{pick.reason}</p>
            </Link>
            <Button size="sm" disabled={busy} onClick={() => roll()}>
              {busy ? <Spinner /> : <IconDice size={15} />} Again
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-4 text-center">
            <p className="text-sm text-muted">{message ?? "Nothing to pick from yet."}</p>
            <Link href="/movies?tab=discover" className="focusable mt-2 inline-flex text-xs font-semibold text-purple">
              Browse something to add
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}


/* ------------------------------------------------------------------ */
/* Rating distribution                                                 */
/* ------------------------------------------------------------------ */

export function RatingDistribution({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, n) => sum + n, 0);
  if (!total) return null;
  return (
    <Card className="p-4">
      <SectionHeader title="How you rate" subtitle={`${total} ratings`} size="sm" />
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {values.map((count, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-purple/40 to-glow transition-all duration-500"
              style={{ height: `${Math.max(2, (count / max) * 100)}%`, opacity: count ? 1 : 0.2 }}
              title={`${index + 1}/10: ${count}`}
            />
            <span className="tnum text-[10px] text-faint">{index + 1}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* First-run checklist                                                 */
/* ------------------------------------------------------------------ */

interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export function GettingStarted({
  providersReady,
  tracked,
  watched,
  rated,
  listsCount,
  onDismiss,
}: {
  providersReady: boolean;
  tracked: number;
  watched: number;
  rated: number;
  listsCount: number;
  onDismiss: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [checked, setChecked] = useState(false);

  // localStorage is not available while the server renders this component.
  useEffect(() => {
    setHidden(window.localStorage.getItem("lumen.gettingStarted") === "1");
    setChecked(true);
  }, []);
  const items: ChecklistItem[] = [
    { id: "provider", label: "Connect a metadata provider", hint: "Optional — the built-in catalog works too", href: "/settings?tab=providers", done: providersReady },
    { id: "track", label: "Add your first title", hint: "Tap + on any poster", href: "/search", done: tracked > 0 },
    { id: "watch", label: "Mark something watched", hint: "One tap, everything else is optional", href: "/tv", done: watched > 0 },
    { id: "rate", label: "Rate something", hint: "1–10, in half-point steps", href: "/profile", done: rated > 0 },
    { id: "list", label: "Create a list", hint: "Best sci-fi, weekend games, rewatch pile", href: "/lists", done: listsCount > 0 },
  ];
  const done = items.filter((item) => item.done).length;
  if (!checked || hidden || done === items.length) return null;

  return (
    <Card className="relative overflow-hidden p-4">
      <div className="absolute -top-12 -right-10 size-36 rounded-full bg-glow/15 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-glow uppercase">Get started</p>
            <h2 className="mt-1 text-base font-black tracking-tight text-ink">
              {done} of {items.length} done
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem("lumen.gettingStarted", "1");
              setHidden(true);
              onDismiss();
            }}
            className="press focusable rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-ink"
          >
            Hide
          </button>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
          <div className="h-full rounded-full bg-gradient-to-r from-purple to-glow transition-[width] duration-500" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <ul className="mt-3 divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="press focusable flex items-center gap-3 py-2.5">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border ${
                    item.done ? "border-purple bg-purple text-white" : "border-line text-faint"
                  }`}
                >
                  {item.done ? <IconCheckCircle size={15} /> : <span className="text-[11px] font-bold">{items.indexOf(item) + 1}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${item.done ? "text-muted line-through" : "text-ink"}`}>{item.label}</span>
                  <span className="block truncate text-[11px] text-faint">{item.hint}</span>
                </span>
                <IconArrowRight size={15} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
