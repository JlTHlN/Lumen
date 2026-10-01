import { fail, ok } from "@/lib/api";
import { listNotifications, markAllRead, sendTelegram, unreadCount } from "@/lib/notify";
import { invalidateUpcoming, getUpcoming } from "@/lib/library";
import { checkNewReleases } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [items, unread] = await Promise.all([listNotifications(50), unreadCount()]);
    return ok({ items, unread });
  } catch {
    return fail("We couldn't load notifications.", 503, { items: [], unread: 0 });
  }
}

export async function POST(request: Request) {
  let action = "";
  try {
    action = ((await request.json()) as { action?: string }).action ?? "";
  } catch {
    return fail("Invalid request");
  }

  try {
    if (action === "read") {
      await markAllRead();
      return ok({ items: await listNotifications(50), unread: 0 });
    }
    if (action === "test") {
      return ok(await sendTelegram("🔔 <b>Lumen</b>\nTest notification — new episodes will appear like this."));
    }
    if (action === "refresh_upcoming") {
      await invalidateUpcoming();
      const upcoming = await getUpcoming();
      return ok({ refreshed: true, count: upcoming.length, message: `Found ${upcoming.length} upcoming items.` });
    }
    if (action === "check_new") {
      const created = await checkNewReleases();
      return ok({ created, unread: await unreadCount(), message: `Checked. ${created} new notification${created === 1 ? "" : "s"}.` });
    }
    return fail("Unknown action");
  } catch {
    return fail("We couldn't run that job right now.", 500);
  }
}
