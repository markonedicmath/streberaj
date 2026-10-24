import application from "./.open-next/worker.js";
export * from "./.open-next/worker.js";

export default {
  fetch(request, env, ctx) { return application.fetch(request, env, ctx); },
  scheduled(_controller, env, ctx) {
    if (!env.APP_URL || !env.CRON_SECRET) return;
    ctx.waitUntil(fetch(new URL("/api/sync?automatic=1", env.APP_URL), {
      method: "POST", headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    }).then((response) => {
      if (!response.ok) throw new Error(`Sinhronizacija nije uspela (${response.status}).`);
    }));
  },
};
