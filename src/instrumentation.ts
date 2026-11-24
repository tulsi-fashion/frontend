const HEALTH_PING_INTERVAL_MS = 2 * 60_000;

declare global {
  var __healthPingTimer: ReturnType<typeof setInterval> | undefined;
}

export function register() {
  // Timers only make sense in the long-running Node.js server, not the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/+$/, "");
  if (!frontendUrl) return;

  // Avoid stacking multiple intervals when the module is re-evaluated in dev.
  if (globalThis.__healthPingTimer) return;

  const healthUrl = `${frontendUrl}/api/health`;

  globalThis.__healthPingTimer = setInterval(async () => {
    try {
      const res = await fetch(healthUrl, { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[health-ping] ${healthUrl} responded ${res.status}`);
      }
    } catch (error) {
      console.error(`[health-ping] ${healthUrl} failed:`, error);
    }
  }, HEALTH_PING_INTERVAL_MS);
}
