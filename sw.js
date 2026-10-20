// Offline after the first visit: cache the page and every clip; serve from cache, refresh in the background.
const CACHE = "kiki-v2";
const FILES = [
  "./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "clips/open.mp3",
  "clips/close.mp3",
  "clips/stop.mp3",
  "clips/vol_up.mp3",
  "clips/vol_down.mp3",
  "clips/lights_on.mp3",
  "clips/lights_off.mp3",
  "clips/red.mp3",
  "clips/green.mp3",
  "clips/blue.mp3",
  "clips/white.mp3",
  "clips/purple.mp3",
  "clips/cyan.mp3",
  "clips/yellow.mp3",
  "clips/orange.mp3",
  "clips/pink.mp3",
  "clips/bri_up.mp3",
  "clips/bri_down.mp3",
  "clips/bri_low.mp3",
  "clips/bri_high.mp3",
  "clips/bri_1.mp3",
  "clips/bri_2.mp3",
  "clips/bri_3.mp3",
  "clips/bri_4.mp3",
  "clips/bri_5.mp3",
  "clips/bri_6.mp3",
  "clips/bri_7.mp3",
  "clips/bri_8.mp3",
  "clips/bri_9.mp3",
  "clips/bri_10.mp3",
  "clips/rainbow.mp3",
  "clips/flowing.mp3",
  "clips/breathing.mp3",
  "clips/gradual.mp3",
  "clips/magic.mp3",
  "clips/auto.mp3",
  "clips/sport.mp3",
  "clips/grad_rb.mp3",
  "clips/grad_rg.mp3",
  "clips/grad_bg.mp3",
  "clips/ice_flow.mp3",
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.headers.has("range")) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  })));
});
