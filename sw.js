const CACHE = "arcade-4dx-firebase-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./host.html",
  "./play.html",
  "./styles.css",
  "./static.css",
  "./static-app.js",
  "./arcade.js",
  "./firebase-config.js",
  "./firebase-sync.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});


