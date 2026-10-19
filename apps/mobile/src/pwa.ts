/** The service worker that keeps the installed game playable offline (built by vite.config.ts; none in dev). */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
