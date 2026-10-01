import Link from "next/link";
import { BRAND, LumenMark } from "@/components/brand";
import { PageHeader } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";

export const metadata = { title: "About & credits" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="About & credits" subtitle={BRAND.description} />

      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-deep via-surface to-surface p-6">
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-glow/20 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-4">
          <LumenMark size={64} />
          <div>
            <p className="text-xl font-black tracking-tight text-ink">{BRAND.name}</p>
            <p className="text-sm text-muted">{BRAND.tagline}</p>
            <p className="mt-1 text-[11px] text-faint">v{BRAND.version} · single-user edition</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">Metadata providers</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This product uses the TMDB API but is not endorsed or certified by TMDB. All movie and TV metadata and artwork is supplied by
          <span className="text-ink"> The Movie Database (TMDB)</span>. Their API is free for non-commercial use with attribution.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Game metadata is provided by <span className="text-ink">IGDB</span> (free for non-commercial use, using Twitch developer credentials) or
          <span className="text-ink"> RAWG</span> (free plan for personal and hobby projects, which requires attribution when its data is displayed).
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a className="focusable rounded-full border border-line px-3 py-1.5 font-semibold text-purple" href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            themoviedb.org
          </a>
          <a className="focusable rounded-full border border-line px-3 py-1.5 font-semibold text-purple" href="https://api-docs.igdb.com/" target="_blank" rel="noreferrer">
            api-docs.igdb.com
          </a>
          <a className="focusable rounded-full border border-line px-3 py-1.5 font-semibold text-purple" href="https://rawg.io/apidocs" target="_blank" rel="noreferrer">
            rawg.io/apidocs
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">Offline first</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If a provider is unavailable, or you have not configured any keys yet, {BRAND.name} keeps working: your library, ratings, lists and
          statistics are always stored locally in your own database. Only brand-new searches need the provider.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">Your data</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Exports contain your tracking history, ratings and external IDs — not a copy of a provider&apos;s database. Metadata is re-fetched by those
          IDs if you restore elsewhere.
        </p>
        <Link href="/settings?tab=data" className="focusable mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
          Open data settings <IconArrowRight size={13} />
        </Link>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-ink">Keyboard shortcuts</h2>
        <ul className="mt-2 grid gap-1.5 text-sm text-muted sm:grid-cols-2">
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">/</kbd> Jump to search</li>
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">g</kbd> then <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">h</kbd> Home</li>
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">g</kbd> then <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">m</kbd> Movies</li>
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">g</kbd> then <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">t</kbd> TV Shows</li>
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">g</kbd> then <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">a</kbd> Games</li>
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">g</kbd> then <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">l</kbd> Lists</li>
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">g</kbd> then <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">p</kbd> Profile</li>
          <li><kbd className="rounded border border-line px-1.5 py-0.5 text-xs">g</kbd> then <kbd className="rounded border border-line px-1.5 py-0.5 text-xs">s</kbd> Settings</li>
        </ul>
      </section>
    </div>
  );
}
