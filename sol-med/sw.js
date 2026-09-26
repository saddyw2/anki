/* Sol MED — service worker (modo sin conexión de la versión PWA).
 * Estrategia: el núcleo de la app se guarda al instalar y se sirve primero
 * desde la caché; las fuentes de Google se guardan al usarse.
 * Cambia VERSION al publicar una versión nueva para renovar la caché.
 * La lista ASSETS debe coincidir con index.html (lo comprueba tests/unit.mjs). */
const VERSION = 'solmed-1.0.0';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/solmed.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'js/core/namespace.js',
  'js/core/util.js',
  'js/core/registry.js',
  'content/taxonomia.js',
  'content/fuentes.js',
  'content/valores/metabolismo.js',
  'content/valores/electrolitos.js',
  'content/valores/renal.js',
  'content/valores/gasometria.js',
  'content/valores/tiroides.js',
  'content/valores/neuro.js',
  'content/calculos.js',
  'content/comparaciones.js',
  'content/temas/cad.js',
  'content/temas/ehh.js',
  'content/temas/hipotiroidismo.js',
  'content/temas/hipertiroidismo.js',
  'content/temas/hsa.js',
  'js/core/store.js',
  'js/core/engine.js',
  'js/core/gen.js',
  'js/core/sync.js',
  'js/ui/dom.js',
  'js/ui/charts.js',
  'js/ui/runner.js',
  'js/ui/views-home.js',
  'js/ui/views-study.js',
  'js/ui/views-values.js',
  'js/ui/views-exam.js',
  'js/ui/views-progress.js',
  'js/ui/views-more.js',
  'js/ui/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith('solmed-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return hit || net;
    }),
  );
});
