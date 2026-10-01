import { fail, ok } from "@/lib/api";
import { igdbProvider, rawgProvider, tmdbProvider, localProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let provider = "";
  try {
    const body = (await request.json()) as { provider?: string };
    provider = body.provider ?? "";
  } catch {
    return fail("Invalid request");
  }

  try {
    switch (provider) {
      case "tmdb":
        return ok(await tmdbProvider.testConnection());
      case "igdb":
        return ok(await igdbProvider.testConnection());
      case "rawg":
        return ok(await rawgProvider.testConnection());
      case "local":
        return ok(await localProvider.testConnection());
      case "telegram": {
        const { sendTelegram } = await import("@/lib/notify");
        const result = await sendTelegram("🎬 <b>Lumen</b>\nTest notification — your setup works!");
        return ok({ ok: result.ok, status: result.ok ? "connected" : "unavailable", message: result.message });
      }
      default:
        return fail("Unknown provider");
    }
  } catch {
    return ok({
      ok: false,
      status: "unavailable",
      message: "The provider could not be reached. Your library is unaffected.",
    });
  }
}
