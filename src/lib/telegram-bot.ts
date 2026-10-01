import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { getSettings, getSettingValue, setSettingValue } from "./settings";
import { getMediaDetails, searchMedia } from "./providers";
import {
  applyStatus,
  defaultStatus,
  episodeProgress,
  getEntry,
  getLibraryForMediaIds,
  getUpNext,
  logWatch,
  nextUnwatched,
  recordActivity,
  removeEntry,
  saveEntry,
  setEpisodeWatched,
  toMediaRecord,
  totalEpisodes,
} from "./library";
import { MEDIA_SINGULAR, statusLabel, statusesFor, type MediaRecord, type MediaType } from "./types";

/* ------------------------------------------------------------------ */
/* Telegram types (only the fields we use)                             */
/* ------------------------------------------------------------------ */

interface TgChat {
  id: number;
}
interface TgMessage {
  message_id: number;
  chat: TgChat;
  text?: string;
  photo?: unknown[];
}
interface TgCallback {
  id: string;
  data?: string;
  message?: TgMessage;
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
}
type Button = { text: string; callback_data?: string; url?: string };
type Keyboard = Button[][];

export interface BotState {
  active: boolean;
  username: string | null;
  lastPollAt: string | null;
  lastUpdateAt: string | null;
  lastError: string | null;
  handled: number;
}

const globalForBot = globalThis as typeof globalThis & {
  __tgBotStarted?: boolean;
  __tgBotState?: BotState;
  __tgBotToken?: string;
};

export function botState(): BotState {
  globalForBot.__tgBotState ??= {
    active: false,
    username: null,
    lastPollAt: null,
    lastUpdateAt: null,
    lastError: null,
    handled: 0,
  };
  return globalForBot.__tgBotState;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function esc(value: string | null | undefined) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function code(season: number, episode: number) {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

const TYPE_ICON: Record<MediaType, string> = { movie: "🎬", tv: "📺", game: "🎮" };

/** Telegram API call. Never throws, never logs the token. */
async function tg<T>(token: string, method: string, body: Record<string, unknown> = {}, timeoutMs = 15000): Promise<T | null> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; error_code?: number };
    if (!json.ok) {
      if (!String(json.description ?? "").includes("message is not modified")) {
        botState().lastError =
          json.error_code === 401
            ? "Bot token was rejected by Telegram."
            : json.error_code === 409
              ? "Another instance is polling this bot (or a webhook is set)."
              : json.description ?? "Telegram request failed.";
      }
      return null;
    }
    return (json.result ?? null) as T | null;
  } catch {
    if (method === "getUpdates") botState().lastError = "Could not reach Telegram.";
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function appLink(media: MediaRecord): string | null {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  if (!base || /localhost|127\.0\.0\.1/.test(base) || !/^https?:\/\//.test(base)) return null;
  const section = media.type === "tv" ? "tv" : media.type === "game" ? "games" : "movies";
  return `${base}/${section}/${media.provider}-${media.externalId}`;
}

async function loadMedia(mediaId: number, ensureDetails = false): Promise<MediaRecord | null> {
  let rows = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1);
  if (!rows.length) return null;
  if (ensureDetails && !rows[0].detailsFetchedAt) {
    try {
      await getMediaDetails(rows[0].type as MediaType, rows[0].provider, rows[0].externalId);
      rows = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1);
    } catch {
      /* keep list-level data */
    }
  }
  return toMediaRecord(rows[0]);
}

async function renderCard(mediaId: number): Promise<{ text: string; keyboard: Keyboard; photo: string | null } | null> {
  const media = await loadMedia(mediaId, true);
  if (!media) return null;
  const type = media.type as MediaType;
  const entry = await getEntry(media.id);

  const lines = [`${TYPE_ICON[type]} <b>${esc(media.title)}</b>${media.year ? ` (${media.year})` : ""}`];
  const facts = [
    MEDIA_SINGULAR[type],
    (media.genres ?? []).slice(0, 3).join(", "),
    media.externalRating ? `★ ${media.externalRating.toFixed(1)}` : null,
    type !== "game" && media.runtime ? `${media.runtime} min` : null,
  ].filter(Boolean);
  lines.push(esc(facts.join(" · ")));

  if (entry) {
    const mine = [`<b>${esc(statusLabel(entry.status))}</b>`];
    if (entry.rating != null) mine.push(`your rating ${entry.rating.toFixed(1)}`);
    if (entry.liked === true) mine.push("👍");
    if (entry.favorite) mine.push("♥");
    lines.push(`\n✅ In your library: ${mine.join(" · ")}`);
  } else {
    lines.push("\n➕ Not in your library yet");
  }

  if (type === "tv") {
    const watched = await episodeProgress(media.id);
    const total = totalEpisodes(media);
    const next = nextUnwatched(media, watched);
    if (total) lines.push(`Progress: ${watched.length}/${total} episodes${next ? ` · next ${code(next.season, next.episode)}` : ""}`);
  }
  if (media.overview) {
    const overview = media.overview.length > 280 ? `${media.overview.slice(0, 277)}…` : media.overview;
    lines.push(`\n<i>${esc(overview)}</i>`);
  }

  const keyboard: Keyboard = [];
  const statuses = statusesFor(type);
  for (let index = 0; index < statuses.length; index += 2) {
    keyboard.push(
      statuses.slice(index, index + 2).map((status) => ({
        text: `${entry?.status === status ? "● " : ""}${statusLabel(status)}`,
        callback_data: `s:${media.id}:${status}`,
      })),
    );
  }
  const actions: Button[] = [];
  if (type !== "tv") actions.push({ text: type === "game" ? "🏁 Completed" : entry?.timesWatched ? "✓ Watched again" : "✓ Watched", callback_data: `w:${media.id}` });
  else if (entry) actions.push({ text: "▶ Next episode ✓", callback_data: `n:${media.id}` });
  actions.push({ text: entry?.favorite ? "♥ Favorite" : "♡ Favorite", callback_data: `f:${media.id}` });
  keyboard.push(actions);
  keyboard.push(
    [6, 7, 8, 9, 10].map((value) => ({
      text: entry?.rating != null && Math.round(entry.rating) === value ? `★${value}●` : `★${value}`,
      callback_data: `r:${media.id}:${value}`,
    })),
  );
  const last: Button[] = [];
  const link = appLink(media);
  if (link) last.push({ text: "Open in app ↗", url: link });
  if (entry) last.push({ text: "🗑 Remove", callback_data: `x:${media.id}` });
  if (last.length) keyboard.push(last);

  const text = lines.join("\n");
  return { text, keyboard, photo: media.posterUrl ?? null };
}

async function sendCard(token: string, chatId: number, mediaId: number) {
  const card = await renderCard(mediaId);
  if (!card) return sendText(token, chatId, "That title is no longer available.");
  if (card.photo && card.text.length <= 1000) {
    const sent = await tg(token, "sendPhoto", {
      chat_id: chatId,
      photo: card.photo,
      caption: card.text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: card.keyboard },
    });
    if (sent) return;
  }
  await sendText(token, chatId, card.text, card.keyboard);
}

async function refreshCard(token: string, message: TgMessage, mediaId: number) {
  const card = await renderCard(mediaId);
  if (!card) return;
  const target = { chat_id: message.chat.id, message_id: message.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: card.keyboard } };
  if (message.photo) await tg(token, "editMessageCaption", { ...target, caption: card.text.slice(0, 1024) });
  else await tg(token, "editMessageText", { ...target, text: card.text, disable_web_page_preview: true });
}

async function sendText(token: string, chatId: number, text: string, keyboard?: Keyboard) {
  await tg(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

async function search(token: string, chatId: number, query: string, types: MediaType[]) {
  const perType = types.length > 1 ? 3 : 8;
  const results = await Promise.all(types.map((type) => searchMedia(query, type).catch(() => ({ items: [], offline: true, error: "failed" }))));
  const items = results.flatMap((result) => result.items.slice(0, perType));
  if (!items.length) {
    await sendText(token, chatId, `Nothing found for “${esc(query)}”. Try a different spelling, or /movie, /show, /game.`);
    return;
  }
  const entries = await getLibraryForMediaIds(items.map((item) => item.id));
  const keyboard: Keyboard = items.map((item) => [
    {
      text: `${entries.has(item.id) ? "✅" : TYPE_ICON[item.type]} ${item.title}${item.year ? ` (${item.year})` : ""}`.slice(0, 60),
      callback_data: `p:${item.id}`,
    },
  ]);
  const offline = results.some((result) => result.offline && result.error);
  await sendText(
    token,
    chatId,
    `🔎 Results for <b>${esc(query)}</b>${offline ? "\n<i>(provider offline — local results)</i>" : ""}\nTap a title to add or track it.`,
    keyboard,
  );
}

async function renderUpNext(): Promise<{ text: string; keyboard: Keyboard }> {
  const items = (await getUpNext()).filter((item) => item.next?.aired && item.entry?.status !== "on_hold").slice(0, 8);
  if (!items.length) return { text: "📺 You're all caught up! Nothing aired is waiting.", keyboard: [] };
  const lines = ["📺 <b>Up next</b>"];
  const keyboard: Keyboard = [];
  for (const item of items) {
    const next = item.next!;
    lines.push(`• <b>${esc(item.media.title)}</b> — ${code(next.season, next.episode)}${next.name ? ` · ${esc(next.name)}` : ""}`);
    keyboard.push([
      { text: `✓ ${item.media.title.slice(0, 32)} ${code(next.season, next.episode)}`, callback_data: `e:${item.media.id}:${next.season}:${next.episode}` },
    ]);
  }
  lines.push("\nTap to mark an episode watched.");
  return { text: lines.join("\n"), keyboard };
}

const HELP = [
  "🎬 <b>Lumen bot</b>",
  "",
  "Just type a title to search movies, shows and games.",
  "",
  "/movie <i>title</i> — search movies",
  "/show <i>title</i> — search TV shows",
  "/game <i>title</i> — search games",
  "/upnext — next episodes, tap to tick off",
  "/help — this message",
  "",
  "Tap a result to add it, set a status, mark it watched, rate it or favourite it.",
].join("\n");

/* ------------------------------------------------------------------ */
/* Update handling                                                     */
/* ------------------------------------------------------------------ */

async function handleMessage(token: string, message: TgMessage) {
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();
  if (!text) return;
  const match = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  if (!match) return search(token, chatId, text.slice(0, 100), ["movie", "tv", "game"]);

  const command = match[1].toLowerCase();
  const arg = match[2].trim().slice(0, 100);
  const typed: Record<string, MediaType> = { movie: "movie", m: "movie", film: "movie", show: "tv", tv: "tv", s: "tv", series: "tv", anime: "tv", game: "game", g: "game" };

  if (command in typed) {
    if (!arg) return sendText(token, chatId, `Send it with a title, e.g. <code>/${command} ${typed[command] === "game" ? "Hades" : typed[command] === "tv" ? "Severance" : "Interstellar"}</code>`);
    return search(token, chatId, arg, [typed[command]]);
  }
  if (command === "upnext" || command === "next") {
    const { text: body, keyboard } = await renderUpNext();
    return sendText(token, chatId, body, keyboard.length ? keyboard : undefined);
  }
  if (command === "search" || command === "add") {
    if (!arg) return sendText(token, chatId, "Send a title after the command, e.g. <code>/add Dune</code>");
    return search(token, chatId, arg, ["movie", "tv", "game"]);
  }
  return sendText(token, chatId, HELP);
}

async function handleCallback(token: string, callback: TgCallback) {
  const answer = (text?: string) => tg(token, "answerCallbackQuery", { callback_query_id: callback.id, ...(text ? { text } : {}) });
  const message = callback.message;
  const [action, rawId, a, b] = (callback.data ?? "").split(":");
  const mediaId = Number(rawId);
  if (!message || !Number.isFinite(mediaId)) return answer();

  if (action === "p") {
    await answer();
    return sendCard(token, message.chat.id, mediaId);
  }

  const media = await loadMedia(mediaId, true);
  if (!media) return answer("That title is no longer available.");
  const type = media.type as MediaType;

  switch (action) {
    case "s": {
      if (!statusesFor(type).includes(a)) return answer("Unknown status");
      await applyStatus(media, a);
      await answer(`${media.title}: ${statusLabel(a)}`);
      return refreshCard(token, message, mediaId);
    }
    case "w": {
      const existing = await getEntry(media.id);
      await logWatch(media, { rewatch: Boolean(existing?.timesWatched) });
      await answer(type === "game" ? "Marked completed 🏁" : "Marked watched ✓");
      return refreshCard(token, message, mediaId);
    }
    case "f": {
      const existing = await getEntry(media.id);
      await saveEntry(media.id, { status: existing?.status ?? defaultStatus(type), favorite: !existing?.favorite });
      await answer(existing?.favorite ? "Removed from favorites" : "Added to favorites ♥");
      return refreshCard(token, message, mediaId);
    }
    case "r": {
      const value = Math.min(10, Math.max(1, Number(a)));
      const existing = await getEntry(media.id);
      await saveEntry(media.id, { status: existing?.status ?? defaultStatus(type), rating: value });
      await answer(`Rated ${value}/10`);
      return refreshCard(token, message, mediaId);
    }
    case "x": {
      await removeEntry(media.id);
      await answer("Removed from your library");
      return refreshCard(token, message, mediaId);
    }
    case "n": {
      const next = nextUnwatched(media, await episodeProgress(media.id));
      if (!next) return answer("You're all caught up!");
      await setEpisodeWatched(media, next.season, next.episode, true);
      await recordActivity(media, "episode", `${code(next.season, next.episode)} watched (Telegram)`);
      await answer(`✓ ${code(next.season, next.episode)} watched`);
      return refreshCard(token, message, mediaId);
    }
    case "e": {
      const season = Number(a);
      const episode = Number(b);
      if (!season || !episode) return answer();
      await setEpisodeWatched(media, season, episode, true);
      await recordActivity(media, "episode", `${code(season, episode)} watched (Telegram)`);
      await answer(`✓ ${media.title} ${code(season, episode)}`);
      const { text, keyboard } = await renderUpNext();
      await tg(token, "editMessageText", {
        chat_id: message.chat.id,
        message_id: message.message_id,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
      return;
    }
    default:
      return answer();
  }
}

async function handleUpdate(token: string, allowedChatId: string, update: TgUpdate) {
  const chat = update.message?.chat ?? update.callback_query?.message?.chat;
  if (!chat) return;
  // Only the configured chat may control the library.
  if (!allowedChatId || String(chat.id) !== allowedChatId.trim()) {
    if (update.callback_query) await tg(token, "answerCallbackQuery", { callback_query_id: update.callback_query.id, text: "Not authorised" });
    else
      await sendText(
        token,
        chat.id,
        `🔒 This bot is private.\n\nYour chat ID is <code>${chat.id}</code>.\nPaste it into <b>Settings → Notifications → Chat ID</b> in Lumen to connect this chat.`,
      );
    return;
  }
  if (update.callback_query) await handleCallback(token, update.callback_query);
  else if (update.message) await handleMessage(token, update.message);
}

/* ------------------------------------------------------------------ */
/* Long-polling loop (works behind NAT, no public URL needed)          */
/* ------------------------------------------------------------------ */

async function prepare(token: string) {
  const me = await tg<{ username?: string }>(token, "getMe");
  if (!me) return false;
  botState().username = me.username ?? null;
  await tg(token, "deleteWebhook", { drop_pending_updates: false });
  await tg(token, "setMyCommands", {
    commands: [
      { command: "movie", description: "Search movies" },
      { command: "show", description: "Search TV shows" },
      { command: "game", description: "Search games" },
      { command: "upnext", description: "Next episodes to watch" },
      { command: "help", description: "How to use the bot" },
    ],
  });
  return true;
}

async function loop() {
  const state = botState();
  for (;;) {
    try {
      const settings = await getSettings();
      const { botToken, chatId } = settings.notifications.telegram;
      if (!settings.notifications.bot.enabled || !botToken) {
        state.active = false;
        globalForBot.__tgBotToken = undefined;
        await sleep(15000);
        continue;
      }
      if (globalForBot.__tgBotToken !== botToken) {
        if (!(await prepare(botToken))) {
          state.active = false;
          await sleep(60000);
          continue;
        }
        globalForBot.__tgBotToken = botToken;
      }
      const offset = await getSettingValue<number>("telegram_offset", 0);
      const updates = await tg<TgUpdate[]>(
        botToken,
        "getUpdates",
        { offset, timeout: 25, allowed_updates: ["message", "callback_query"] },
        40000,
      );
      state.lastPollAt = new Date().toISOString();
      if (updates === null) {
        state.active = false;
        await sleep(10000);
        continue;
      }
      state.active = true;
      state.lastError = null;
      for (const update of updates) {
        try {
          await handleUpdate(botToken, chatId, update);
          state.handled += 1;
          state.lastUpdateAt = new Date().toISOString();
        } catch {
          state.lastError = "A bot command failed to process.";
        }
        await setSettingValue("telegram_offset", update.update_id + 1);
      }
    } catch {
      state.active = false;
      await sleep(10000);
    }
  }
}

export function startTelegramBot() {
  if (globalForBot.__tgBotStarted) return;
  globalForBot.__tgBotStarted = true;
  setTimeout(() => void loop(), 3000);
}
