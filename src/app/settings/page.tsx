"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiPost, useApi } from "@/lib/client";
import { Button, Card, Chip, PageHeader, SectionHeader, Skeleton, Tabs } from "@/components/ui";
import type { SettingsData } from "@/lib/view";
import { IconArrowRight, IconCheck, IconCheckCircle, IconWarning, IconX } from "@/components/icons";

type TestState = { status: string; message: string } | null;

export default function SettingsPage() {
  const { data, refresh } = useApi<SettingsData>("/api/settings");
  const [tab, setTab] = useState("profile");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tmdbKey, setTmdbKey] = useState("");
  const [igdbId, setIgdbId] = useState("");
  const [igdbSecret, setIgdbSecret] = useState("");
  const [rawgKey, setRawgKey] = useState("");
  const [tgToken, setTgToken] = useState("");
  const [tgChat, setTgChat] = useState("");
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [guide, setGuide] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ summary: Record<string, number>; payload: unknown } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && ["profile", "providers", "cache", "notifications", "appearance", "data"].includes(requested)) setTab(requested);
  }, []);

  if (!data) return <Skeleton className="h-64 w-full" />;
  const settings = data.settings;

  async function save(patch: Record<string, unknown>, message = "Saved") {
    setBusy(true);
    setNotice(null);
    try {
      await apiPost("/api/settings", { patch });
      setNotice(message);
      refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearCache(scope: string) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await apiPost<{ cleared?: boolean }>("/api/settings", { action: "clear_cache", patch: { scope } });
      setNotice(result.cleared ? "Cache cleared" : "Nothing to clear");
      refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test(provider: string) {
    setBusy(true);
    setTests((current) => ({ ...current, [provider]: null }));
    try {
      const result = await apiPost<{ ok: boolean; status: string; message: string }>("/api/providers", { provider });
      setTests((current) => ({ ...current, [provider]: result }));
    } catch (error) {
      setTests((current) => ({
        ...current,
        [provider]: { status: "unavailable", message: (error as Error).message },
      }));
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await apiPost<{ summary: Record<string, number> }>("/api/data", {
        action: "summarize",
        payload,
      });
      setImportSummary({ summary: result.summary, payload });
    } catch {
      setNotice("That file could not be read as a Lumen backup.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Everything is configured here — no config files needed." />

      <Tabs
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "providers", label: "Providers" },
          { id: "cache", label: "Cache" },
          { id: "notifications", label: "Notifications" },
          { id: "appearance", label: "Appearance" },
          { id: "data", label: "Data" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {notice ? <Card className="border-purple/40 bg-purple/10 p-3 text-sm text-ink">{notice}</Card> : null}

      {tab === "profile" ? (
        <Card className="space-y-4 p-4">
          <SectionHeader title="Profile" />
          <ProfileForm settings={settings} onSave={save} busy={busy} />
        </Card>
      ) : null}

      {tab === "providers" ? (
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <SectionHeader title="Movies &amp; TV" subtitle="TMDB provides artwork, cast and episode data" />
            <p className="text-xs text-muted">
              {settings.providers.tmdb.configured
                ? `Configured · ${settings.providers.tmdb.masked ?? "••••••"}`
                : "Not configured — the built-in offline catalog is being used."}
            </p>
            <label className="block text-xs font-semibold text-muted">
              API key / read access token
              <input
                type="password"
                value={tmdbKey}
                onChange={(event) => setTmdbKey(event.target.value)}
                placeholder="••••••••••••"
                className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => save({ providers: { tmdb: { apiKey: tmdbKey } }, onboarding: { completed: true } }, "TMDB key saved")}
              >
                Save key
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => test("tmdb")}>
                Test connection
              </Button>
              <Button variant="ghost" onClick={() => setGuide(guide === "tmdb" ? null : "tmdb")}>
                How do I get this API key?
              </Button>
            </div>
            <TestResult state={tests.tmdb} />
            {guide === "tmdb" ? (
              <Guide
                steps={[
                  "Create a free TMDB account.",
                  "Open your account settings.",
                  "Go to the API section.",
                  "Request a developer API credential.",
                  "Copy the API key (or read access token).",
                  "Paste it above and save.",
                  "Click Test connection.",
                ]}
                href="https://www.themoviedb.org/settings/api"
                label="Open TMDB"
              />
            ) : null}
          </Card>

          <Card className="space-y-4 p-4">
            <SectionHeader title="Games" subtitle="IGDB or RAWG" />
            <div className="flex flex-wrap gap-2">
              {(["igdb", "rawg"] as const).map((option) => (
                <Chip
                  key={option}
                  active={settings.providers.game === option}
                  onClick={() => save({ providers: { game: option } }, `Game provider set to ${option.toUpperCase()}`)}
                >
                  {option.toUpperCase()}
                </Chip>
              ))}
            </div>

            {settings.providers.game === "rawg" ? (
              <>
                <p className="text-xs text-muted">
                  {settings.providers.rawg.configured
                    ? `Configured · ${settings.providers.rawg.masked ?? "••••••"}`
                    : "Not configured."}
                </p>
                <label className="block text-xs font-semibold text-muted">
                  RAWG API key
                  <input
                    type="password"
                    value={rawgKey}
                    onChange={(event) => setRawgKey(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => save({ providers: { rawg: { apiKey: rawgKey } } }, "RAWG key saved")}>
                    Save key
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => test("rawg")}>
                    Test connection
                  </Button>
                  <Button variant="ghost" onClick={() => setGuide(guide === "rawg" ? null : "rawg")}>
                    How do I get this API key?
                  </Button>
                </div>
                <TestResult state={tests.rawg} />
                {guide === "rawg" ? (
                  <Guide
                    steps={[
                      "Create a free RAWG account.",
                      "Open the API documentation page.",
                      "Request an API key for a personal project.",
                      "Copy the key.",
                      "Paste it above and save.",
                      "Click Test connection.",
                    ]}
                    href="https://rawg.io/apidocs"
                    label="Open RAWG"
                  />
                ) : null}
              </>
            ) : (
              <>
                <p className="text-xs text-muted">
                  {settings.providers.igdb.configured
                    ? `Configured · ${settings.providers.igdb.masked ?? "••••••"}`
                    : "Not configured. IGDB uses Twitch developer credentials; the access token is fetched and cached automatically."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-muted">
                    IGDB Client ID
                    <input
                      type="password"
                      value={igdbId}
                      onChange={(event) => setIgdbId(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    IGDB Client Secret
                    <input
                      type="password"
                      value={igdbSecret}
                      onChange={(event) => setIgdbSecret(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      save(
                        { providers: { igdb: { clientId: igdbId, clientSecret: igdbSecret } } },
                        "IGDB credentials saved",
                      )
                    }
                  >
                    Save credentials
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => test("igdb")}>
                    Test connection
                  </Button>
                  <Button variant="ghost" onClick={() => setGuide(guide === "igdb" ? null : "igdb")}>
                    How do I get these credentials?
                  </Button>
                </div>
                <TestResult state={tests.igdb} />
                {guide === "igdb" ? (
                  <Guide
                    steps={[
                      "Create a Twitch developer account.",
                      "Register a new application in the developer console.",
                      "Choose an OAuth redirect URL (it can be localhost).",
                      "Copy the Client ID and Client Secret.",
                      "Paste both above and save.",
                      "Click Test connection — the token is fetched for you.",
                    ]}
                    href="https://dev.twitch.tv/console/apps/create"
                    label="Open Twitch developers"
                  />
                ) : null}
              </>
            )}
            <p className="text-[11px] leading-relaxed text-muted/80">
              Keys are encrypted at rest, never sent to the browser, and never written to logs.
            </p>
          </Card>
          <Link href="/about" className="focusable inline-flex items-center gap-0.5 text-xs font-semibold text-purple">
            See attribution &amp; credits <IconArrowRight size={13} />
          </Link>
        </div>
      ) : null}

      {tab === "cache" ? (
        <Card className="space-y-4 p-4">
          <SectionHeader title="Cache" subtitle={`${data.system.cacheEntries} cached responses · ${data.system.cacheHuman}`} />
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <NumberField
              label="Movie metadata (days)"
              value={settings.cache.movieDays}
              onCommit={(value) => save({ cache: { movieDays: value } }, "Cache updated")}
            />
            <NumberField
              label="Show metadata (days)"
              value={settings.cache.showDays}
              onCommit={(value) => save({ cache: { showDays: value } }, "Cache updated")}
            />
            <NumberField
              label="Episode data (hours)"
              value={settings.cache.episodeHours}
              onCommit={(value) => save({ cache: { episodeHours: value } }, "Cache updated")}
            />
            <NumberField
              label="Popular (hours)"
              value={settings.cache.popularHours}
              onCommit={(value) => save({ cache: { popularHours: value } }, "Cache updated")}
            />
            <NumberField
              label="Upcoming (hours)"
              value={settings.cache.upcomingHours}
              onCommit={(value) => save({ cache: { upcomingHours: value } }, "Cache updated")}
            />
            <NumberField
              label="Refresh job (hours)"
              value={settings.jobs.refreshHours}
              onCommit={(value) => save({ jobs: { refreshHours: value } }, "Cache updated")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => clearCache("discovery")}>
              Clear discovery cache
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => clearCache("all")}>
              Clear everything
            </Button>
          </div>
          <p className="text-[11px] text-muted/80">
            Clearing cache never removes your tracking, ratings, lists or profile.
          </p>
        </Card>
      ) : null}

      {tab === "notifications" ? (
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <SectionHeader title="Telegram" subtitle={settings.notifications.telegram.configured ? "Configured" : "Not configured"} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted">
                Bot token
                <input
                  type="password"
                  value={tgToken}
                  onChange={(event) => setTgToken(event.target.value)}
                  placeholder="••••••••••"
                  className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                Chat ID
                <input
                  type="password"
                  value={tgChat}
                  onChange={(event) => setTgChat(event.target.value)}
                  placeholder="••••••"
                  className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => save({ notifications: { telegram: { botToken: tgToken, chatId: tgChat } } }, "Telegram saved")}
              >
                Save
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => test("telegram")}>
                Test notification
              </Button>
              <Button variant="ghost" onClick={() => setGuide(guide === "telegram" ? null : "telegram")}>
                Setup instructions
              </Button>
            </div>
            <TestResult state={tests.telegram} />
            {guide === "telegram" ? (
              <Guide
                steps={[
                  "Open Telegram and search for @BotFather.",
                  "Send /newbot and follow the prompts.",
                  "Copy the bot token it gives you.",
                  "Paste the bot token here and save (leave Chat ID empty for now).",
                  "Open a chat with your bot and send /start — it replies with your chat ID.",
                  "Paste the chat ID here and save.",
                  "Click Test notification, then try typing a movie title to the bot.",
                ]}
                href="https://core.telegram.org/bots"
                label="Open Telegram docs"
              />
            ) : null}
          </Card>

          <BotCard enabled={settings.notifications.bot?.enabled ?? true} busy={busy} onToggle={(value) => save({ notifications: { bot: { enabled: value } } }, value ? "Bot enabled" : "Bot disabled")} />

          <Card className="space-y-3 p-4">
            <SectionHeader title="Events" />
            {Object.entries(settings.notifications.events).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm text-ink">
                <span className="capitalize">{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => save({ notifications: { events: { [key]: event.target.checked } } }, "Updated")}
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              {(["instant", "daily", "weekly"] as const).map((option) => (
                <Chip
                  key={option}
                  active={settings.notifications.digest === option}
                  onClick={() => save({ notifications: { digest: option } }, "Updated")}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "appearance" ? (
        <Card className="space-y-4 p-4">
          <SectionHeader title="Appearance" />
          <div className="flex flex-wrap gap-2">
            {(["dark", "system"] as const).map((option) => (
              <Chip key={option} active={settings.appearance.theme === option} onClick={() => save({ appearance: { theme: option } }, "Updated")}>
                {option === "dark" ? "Dark" : "Follow system"}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted">Accent colour: purple (more accents arrive in a future version).</p>
        </Card>
      ) : null}

      {tab === "data" ? (
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <SectionHeader title="Backup" subtitle="Your history belongs to you" />
            <div className="flex flex-wrap gap-2">
              <a href="/api/data?format=json" className="focusable inline-flex rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white">
                Export JSON
              </a>
              <a href="/api/data?format=txt" className="focusable inline-flex rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink">
                Export TXT
              </a>
            </div>
            <p className="text-[11px] text-muted/80">
              Exports contain your tracking data and external IDs — never API secrets.
            </p>
          </Card>

          <Card className="space-y-3 p-4">
            <SectionHeader title="Import" />
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImportFile(file);
              }}
              className="w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
            />
            {importSummary ? (
              <div className="space-y-3 rounded-xl border border-line bg-elevated/50 p-3 text-sm">
                <p className="font-bold text-ink">Detected</p>
                <ul className="grid grid-cols-2 gap-1 text-xs text-muted sm:grid-cols-5">
                  <li>Movies: {importSummary.summary.movies}</li>
                  <li>Shows: {importSummary.summary.shows}</li>
                  <li>Games: {importSummary.summary.games}</li>
                  <li>Episodes: {importSummary.summary.episodes}</li>
                  <li>Lists: {importSummary.summary.lists}</li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await apiPost("/api/data", {
                          action: "import",
                          payload: importSummary.payload,
                          mode: "merge",
                          refetch: true,
                        });
                        setNotice("Import complete");
                        setImportSummary(null);
                        refresh();
                      } catch (error) {
                        setNotice((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Merge (recommended)
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm("Replace removes your current tracking data first. Continue?")) return;
                      setBusy(true);
                      try {
                        await apiPost("/api/data", {
                          action: "import",
                          payload: importSummary.payload,
                          mode: "replace",
                          refetch: true,
                        });
                        setNotice("Import complete");
                        setImportSummary(null);
                        refresh();
                      } catch (error) {
                        setNotice((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Replace
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4">
            <SectionHeader title="Danger zone" />
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Delete every tracked title, rating, episode and list? This cannot be undone.")) return;
                setBusy(true);
                try {
                  await apiPost("/api/data", { action: "delete" });
                  setNotice("All personal tracking data deleted");
                  refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete all my tracking data
            </Button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function TestResult({ state }: { state: TestState }) {
  if (!state) return null;
  const good = state.status === "connected";
  const tone = good ? "text-good" : state.status === "auth_failed" ? "text-bad" : "text-warn";
  const Mark = good ? IconCheckCircle : state.status === "auth_failed" ? IconX : IconWarning;
  return (
    <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      <Mark size={14} /> {state.message}
    </p>
  );
}

function Guide({ steps, href, label }: { steps: string[]; href: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-elevated/50 p-4">
      <ol className="space-y-1.5 text-sm text-muted">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="font-bold text-purple">{index + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
      <a href={href} target="_blank" rel="noreferrer" className="focusable mt-3 inline-flex items-center gap-0.5 text-xs font-bold text-purple">
        {label} <IconArrowRight size={13} />
      </a>
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <input
        value={local}
        inputMode="numeric"
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          const parsed = Number(local);
          if (Number.isFinite(parsed) && parsed > 0) onCommit(parsed);
          else setLocal(String(value));
        }}
        className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}

function ProfileForm({
  settings,
  onSave,
  busy,
}: {
  settings: SettingsData["settings"];
  onSave: (patch: Record<string, unknown>, message?: string) => void;
  busy: boolean;
}) {
  const [displayName, setDisplayName] = useState(settings.profile.displayName);
  const [username, setUsername] = useState(settings.profile.username);
  const [bio, setBio] = useState(settings.profile.bio);
  const [avatar, setAvatar] = useState(settings.profile.avatar);
  const [timezone, setTimezone] = useState(settings.profile.timezone);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-muted">
        Display name
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-xs font-semibold text-muted">
        Username
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-xs font-semibold text-muted">
        Avatar (emoji)
        <input
          value={avatar}
          onChange={(event) => setAvatar(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-xs font-semibold text-muted">
        Timezone
        <input
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="Europe/Berlin"
          className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="block text-xs font-semibold text-muted sm:col-span-2">
        Bio
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-line bg-elevated/60 px-3 py-2 text-sm text-ink"
        />
      </label>
      <div className="sm:col-span-2">
        <Button
          disabled={busy}
          onClick={() =>
            onSave(
              { profile: { displayName, username, bio, avatar, timezone } },
              "Profile saved",
            )
          }
        >
          Save profile
        </Button>
      </div>
    </div>
  );
}

interface BotStatus {
  enabled: boolean;
  configured: boolean;
  chatLinked: boolean;
  active: boolean;
  username: string | null;
  lastPollAt: string | null;
  lastUpdateAt: string | null;
  lastError: string | null;
  handled: number;
}

function BotCard({ enabled, busy, onToggle }: { enabled: boolean; busy: boolean; onToggle: (value: boolean) => void }) {
  const { data, refresh } = useApi<BotStatus>("/api/telegram");
  useEffect(() => {
    const id = window.setInterval(refresh, 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const status = !data
    ? { tone: "text-muted", text: "Checking…" }
    : !data.configured
      ? { tone: "text-muted", text: "Add a bot token above to enable the bot." }
      : !data.enabled
        ? { tone: "text-muted", text: "Bot is turned off." }
        : data.active && !data.chatLinked
          ? { tone: "text-warn", text: "Listening — send /start to the bot to get your chat ID, then save it above." }
          : data.active
            ? { tone: "text-good", text: `Listening${data.username ? ` as @${data.username}` : ""}` }
            : { tone: "text-warn", text: data.lastError ?? "Connecting to Telegram…" };

  return (
    <Card className="space-y-3 p-4">
      <SectionHeader title="Telegram bot" subtitle="Add and track titles by chatting with your bot" />
      <label className="flex items-center justify-between gap-3 text-sm text-ink">
        <span>Accept commands from Telegram</span>
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => onToggle(event.target.checked)} />
      </label>
      <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status.tone}`}>
        {data?.active ? <IconCheckCircle size={14} /> : data?.lastError ? <IconWarning size={14} /> : null}
        {status.text}
      </p>
      {data?.handled ? <p className="text-[11px] text-muted">{data.handled} messages handled since the server started.</p> : null}
      <div className="rounded-xl border border-line bg-elevated/50 p-3 text-xs leading-relaxed text-muted">
        <p className="mb-1 font-semibold text-ink">What you can send</p>
        <ul className="space-y-0.5">
          <li><span className="text-ink">Any title</span>, e.g. “dune”: searches movies, shows and games</li>
          <li><code className="text-bright">/movie</code>, <code className="text-bright">/show</code>, <code className="text-bright">/game</code> + title: search one type</li>
          <li><code className="text-bright">/upnext</code>: your next episodes, tap the check button to mark them watched</li>
        </ul>
        <p className="mt-2">Tap a result to add it, set its status, mark it watched, rate it or favourite it. Only your saved chat ID can control the library.</p>
      </div>
    </Card>
  );
}
