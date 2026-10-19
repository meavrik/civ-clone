// The installed game's service worker. vite.config.ts writes it out as sw.js with the build's
// files and a version that changes with them; the old version's cache goes when the new one starts.
const CACHE = "epochs-mobile-__VERSION__";
const FILES = __FILES__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("epochs-mobile-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page from the network while there is one, so a new version comes through, else the cached
// game; everything else from the cache (the build's file names change with their contents). Vary
// is ignored: servers vary on Origin, which a module script sends and the install did not.
const SAME = { ignoreVary: true };

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./index.html", SAME).then((hit) => hit ?? Response.error())));
    return;
  }
  event.respondWith(caches.match(req, SAME).then((hit) => hit ?? fetch(req)));
});
