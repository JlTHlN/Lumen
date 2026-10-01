"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* SWR cache: instant navigation + background refresh.                 */
/* Entries are reused for `FRESH_MS` without a round-trip, and silently */
/* re-fetched when stale.                                               */
/* ------------------------------------------------------------------ */

const FRESH_MS = 20_000;
const store = new Map<string, { data: unknown; at: number }>();
const inflight = new Map<string, Promise<unknown>>();
const subscribers = new Map<string, Set<(data: unknown) => void>>();

function publish(url: string, data: unknown) {
  store.set(url, { data, at: Date.now() });
  subscribers.get(url)?.forEach((fn) => fn(data));
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin" });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data?.error || "Something went wrong. Try again in a moment.");
  return data;
}

function fetchShared<T>(url: string): Promise<T> {
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const request = apiGet<T>(url)
    .then((data) => {
      publish(url, data);
      return data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, request);
  return request;
}

export function prefetch(url: string, maxAgeMs = FRESH_MS) {
  const cached = store.get(url);
  if (cached && Date.now() - cached.at < maxAgeMs) return;
  fetchShared(url).catch(() => undefined);
}

export function invalidate(...prefixes: string[]) {
  for (const key of store.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) store.delete(key);
  }
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data?.error || "We couldn't save that. Try again.");
  return data;
}

export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(() => (url ? ((store.get(url)?.data as T) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url) && !(url && store.has(url)));
  const [nonce, setNonce] = useState(0);
  const urlRef = useRef(url);
  urlRef.current = url;

  useEffect(() => {
    if (!url) return;
    const set = subscribers.get(url) ?? new Set();
    const listener = (next: unknown) => {
      if (urlRef.current === url) setData(next as T);
    };
    set.add(listener);
    subscribers.set(url, set);
    return () => {
      set.delete(listener);
    };
  }, [url]);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const cached = store.get(url);
    const fresh = cached && Date.now() - cached.at < FRESH_MS;
    if (cached) {
      setData(cached.data as T);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (fresh && !nonce) return;
    fetchShared<T>(url)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce, ...deps]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const mutate = useCallback(
    (updater: (previous: T | null) => T | null) => {
      setData((previous) => {
        const next = updater(previous);
        if (url && next) store.set(url, { data: next, at: Date.now() });
        return next;
      });
    },
    [url],
  );

  return { data, error, loading, refresh, mutate, setData };
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------------------------------------------ */
/* Visual helpers                                                      */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  ["#3b1d63", "#7c3aed"],
  ["#1e2a5a", "#4c1d95"],
  ["#4a1d3f", "#a855f7"],
  ["#12233f", "#6d28d9"],
  ["#2c1a4d", "#8b5cf6"],
  ["#33194a", "#6366f1"],
  ["#1d1047", "#9333ea"],
  ["#2b1746", "#c084fc"],
];

export function gradientFor(seed: string): { backgroundImage: string } {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return { backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 100%)` };
}

export function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function episodeCode(season?: number | null, episode?: number | null) {
  return `S${String(season ?? 0).padStart(2, "0")}E${String(episode ?? 0).padStart(2, "0")}`;
}

export function friendlyDate(value: string | null | undefined, withYear = false): string {
  if (!value) return "TBA";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(date) - startOf(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  if (diff < -1 && diff > -7) return `${-diff}d ago`;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(withYear || date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
