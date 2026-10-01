"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { prefetch, useApi } from "@/lib/client";
import { LumenMark, LumenWordmark, BRAND } from "@/components/brand";
import { IconSparkle as IconSparkleShim } from "@/components/icons";
import {
  IconBell,
  IconFilm,
  IconGamepad,
  IconHome,
  IconInfo,
  IconList,
  IconMenu,
  IconSearch,
  IconSettings,
  IconTv,
  IconUser,
  IconX,
} from "@/components/icons";

const PRIMARY = [
  { href: "/", label: "Home", icon: IconHome, api: "/api/home" },
  { href: "/movies", label: "Movies", icon: IconFilm, api: "/api/library?type=movie" },
  { href: "/tv", label: "TV", icon: IconTv, api: "/api/upnext" },
  { href: "/games", label: "Games", icon: IconGamepad, api: "/api/library?type=game" },
  { href: "/lists", label: "Lists", icon: IconList, api: "/api/lists" },
  { href: "/profile", label: "Profile", icon: IconUser, api: "/api/home" },
];

const SECONDARY = [
  { href: "/search", label: "Search", icon: IconSearch },
  { href: "/recap", label: "Your recap", icon: IconSparkleShim },
  { href: "/notifications", label: "Notifications", icon: IconBell },
  { href: "/settings", label: "Settings", icon: IconSettings },
  { href: "/about", label: "About & credits", icon: IconInfo },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            onMouseEnter={() => prefetch(item.api)}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`press focusable flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
              isActive(pathname, item.href)
                ? "bg-purple/20 text-ink shadow-inner shadow-purple/10"
                : "text-muted hover:bg-elevated hover:text-ink"
            }`}
          >
            <item.icon size={19} className="shrink-0" />
            {item.label === "TV" ? "TV Shows" : item.label}
          </Link>
        ))}
      </nav>
      <div className="my-4 h-px bg-line" />
      <nav className="flex flex-col gap-0.5" aria-label="Secondary">
        {SECONDARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`press focusable flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
              isActive(pathname, item.href) ? "bg-purple/20 text-ink" : "text-muted hover:bg-elevated hover:text-ink"
            }`}
          >
            <item.icon size={17} className="shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: notes } = useApi<{ unread: number }>("/api/notifications", [pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    const media = window.matchMedia("(min-width: 1024px)");
    const onResize = () => media.matches && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    media.addEventListener("change", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onResize);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    const warm = () => ["/api/home", "/api/upnext", "/api/lists"].forEach((url) => prefetch(url));
    const id = window.setTimeout(warm, 800);
    return () => window.clearTimeout(id);
  }, []);

  const unread = notes?.unread ?? 0;

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-line bg-surface/70 px-4 py-6 backdrop-blur lg:flex xl:w-72">
        <Link href="/" className="press focusable mb-8 inline-flex rounded-xl px-2 py-1" aria-label={BRAND.name}>
          <LumenWordmark size={22} />
        </Link>
        <NavLinks pathname={pathname} />
        <p className="mt-auto px-3 pt-6 text-[11px] leading-relaxed text-faint">
          Metadata by TMDB, IGDB &amp; RAWG. Not endorsed by any provider.
          <br />
          <span className="text-muted/70">v{BRAND.version}</span>
        </p>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="slide-in absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col overflow-y-auto border-r border-line bg-surface px-4 py-5">
            <div className="mb-6 flex items-center justify-between">
              <Link href="/" onClick={() => setDrawerOpen(false)} className="press focusable rounded-xl">
                <LumenWordmark />
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="press focusable grid size-10 place-items-center rounded-full border border-line text-muted"
                aria-label="Close menu"
              >
                <IconX size={18} />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64 xl:pl-72">
        <header className="glass sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              className="press focusable grid size-10 place-items-center rounded-full border border-line bg-elevated text-muted hover:text-ink"
            >
              <IconMenu size={18} />
            </button>
            <Link href="/" className="press focusable inline-flex items-center rounded-lg" aria-label={BRAND.name}>
              <LumenMark size={28} />
              <span className="ml-2 text-base font-black tracking-tight text-ink">Lumen</span>
            </Link>
          </div>
          <Link
            href="/search"
            className="press focusable hidden max-w-xl flex-1 items-center gap-3 rounded-full border border-line bg-elevated/70 px-4 py-2.5 text-sm text-muted hover:border-purple/40 hover:text-ink lg:flex"
          >
            <IconSearch size={16} className="shrink-0" />
            <span>Search movies, shows and games…</span>
            <kbd className="ml-auto hidden rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-faint xl:inline-block">/</kbd>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/search"
              aria-label="Search"
              className="press focusable grid size-10 place-items-center rounded-full border border-line bg-elevated text-muted hover:text-ink lg:hidden"
            >
              <IconSearch size={18} />
            </Link>
            <Link
              href="/notifications"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              className="press focusable relative grid size-10 place-items-center rounded-full border border-line bg-elevated text-muted hover:text-ink"
            >
              <IconBell size={18} />
              {unread ? (
                <span className="tnum absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-bright px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          </div>
        </header>

        <KeyboardShortcuts />

        <main className="app-container cq pt-6 pb-28 lg:pb-14">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-30 flex border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Primary"
      >
        {PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onTouchStart={() => prefetch(item.api)}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`press focusable flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${
              isActive(pathname, item.href) ? "text-glow" : "text-muted"
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** `/` focuses the search bar; `g h/m/t/g/l/p/s` jumps to a page. */
function KeyboardShortcuts() {
  useEffect(() => {
    let pending = false;
    const timeout = { current: 0 as number };
    const go = (path: string) => {
      pending = false;
      window.location.href = path;
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        window.location.href = "/search";
        return;
      }
      if (event.key === "g") {
        pending = true;
        window.clearTimeout(timeout.current);
        timeout.current = window.setTimeout(() => (pending = false), 1200);
        return;
      }
      if (!pending) return;
      switch (event.key) {
        case "h":
          return go("/");
        case "m":
          return go("/movies");
        case "t":
          return go("/tv");
        case "a":
          return go("/games"); // (g already used as prefix)
        case "l":
          return go("/lists");
        case "p":
          return go("/profile");
        case "s":
          return go("/settings");
        case "n":
          return go("/notifications");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
