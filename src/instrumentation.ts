export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { startScheduler } = await import("./lib/jobs");
    startScheduler();
  } catch {
    /* scheduler is optional */
  }
  try {
    const { startTelegramBot } = await import("./lib/telegram-bot");
    startTelegramBot();
  } catch {
    /* bot is optional */
  }
}
