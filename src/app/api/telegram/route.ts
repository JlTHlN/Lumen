import { ok } from "@/lib/api";
import { botState } from "@/lib/telegram-bot";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const state = botState();
  return ok({
    enabled: settings.notifications.bot.enabled,
    configured: Boolean(settings.notifications.telegram.botToken),
    chatLinked: Boolean(settings.notifications.telegram.chatId),
    active: state.active,
    username: state.username,
    lastPollAt: state.lastPollAt,
    lastUpdateAt: state.lastUpdateAt,
    lastError: state.lastError,
    handled: state.handled,
  });
}
