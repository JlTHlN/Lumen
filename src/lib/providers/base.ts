import type { DiscoveryKind, MediaType, NormalizedEpisode, NormalizedMedia } from "@/lib/types";

export interface ProviderTestResult {
  ok: boolean;
  status: "connected" | "auth_failed" | "unavailable" | "not_configured";
  message: string;
}

export interface MediaProvider {
  id: string;
  label: string;
  supports: MediaType[];
  isConfigured(): Promise<boolean>;
  search(query: string, type: MediaType): Promise<NormalizedMedia[]>;
  getDetails(externalId: string, type: MediaType): Promise<NormalizedMedia | null>;
  getDiscovery(kind: DiscoveryKind, type: MediaType): Promise<NormalizedMedia[]>;
  getSeason?(externalId: string, season: number): Promise<NormalizedEpisode[]>;
  testConnection(): Promise<ProviderTestResult>;
}

export class ProviderError extends Error {
  status: "auth_failed" | "unavailable" | "not_configured";
  constructor(message: string, status: "auth_failed" | "unavailable" | "not_configured") {
    super(message);
    this.status = status;
  }
}

/** Simple per-provider throttle so we stay inside documented rate limits. */
export class RateLimiter {
  private last = 0;
  private chain: Promise<void> = Promise.resolve();
  constructor(private readonly minIntervalMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(async () => {
      const wait = this.last + this.minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.last = Date.now();
      return task();
    });
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 12000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...rest, signal: controller.signal, cache: "no-store" });
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("Authentication failed", "auth_failed");
    }
    if (response.status === 429) {
      throw new ProviderError("Rate limited by provider, try again shortly", "unavailable");
    }
    if (!response.ok) {
      throw new ProviderError(`Provider responded with ${response.status}`, "unavailable");
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if ((error as Error)?.name === "AbortError") {
      throw new ProviderError("Provider timed out", "unavailable");
    }
    throw new ProviderError("Could not reach the provider", "unavailable");
  } finally {
    clearTimeout(timer);
  }
}

export function parseYear(date?: string | null): number | null {
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}
