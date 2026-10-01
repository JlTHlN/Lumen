import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { fetchJson } from "@/lib/providers/base";
import { eq, desc } from "drizzle-orm";

export async function sendTelegram(message: string): Promise<{ ok: boolean; message: string }> {
  const settings = await getSettings();
  const { botToken, chatId } = settings.notifications.telegram;
  if (!botToken || !chatId) {
    return { ok: false, message: "Add both a bot token and a chat ID first." };
  }
  try {
    const response = await fetchJson<{ ok?: boolean; description?: string }>(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
      },
    );
    if (response.ok) return { ok: true, message: "Test notification delivered." };
    return { ok: false, message: "Telegram rejected the message. Check the chat ID." };
  } catch {
    return { ok: false, message: "Could not reach Telegram. Verify the bot token." };
  }
}

export async function listNotifications(limit = 30) {
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markAllRead() {
  await db.update(notifications).set({ read: true }).where(eq(notifications.read, false));
}

/** Notification events the user opted into. */
export async function notifyEvent(
  event: keyof import("@/lib/settings").AppSettings["notifications"]["events"],
  title: string,
  body: string,
) {
  const settings = await getSettings();
  if (!settings.notifications.events[event]) return;
  await db.insert(notifications).values({ title, body });
  if (settings.notifications.telegram.botToken && settings.notifications.telegram.chatId) {
    await sendTelegram(`<b>${title}</b>\n${body}`).catch(() => undefined);
  }
}

export async function unreadCount() {
  const rows = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.read, false));
  return rows.length;
}
