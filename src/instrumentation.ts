export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Create the database schema on boot. This is what makes a fresh Docker
  // deployment work with no manual migration step.
  try {
    const { runStartup } = await import("./db/startup");
    const result = await runStartup();
    if (result.database && result.schema) {
      console.log("[startup] database ready, schema verified");
    } else {
      console.error(`[startup] database=${result.database} schema=${result.schema} ${result.error ?? ""}`);
    }
  } catch (error) {
    console.error("[startup] initialisation failed:", error instanceof Error ? error.message : error);
  }

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
