import application from "./.open-next/worker.js";
export * from "./.open-next/worker.js";

export default {
  fetch(request, env, ctx) { return application.fetch(request, env, ctx); },
};
