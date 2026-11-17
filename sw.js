// sw.js — stratégie « RÉSEAU D'ABORD » avec repli sur le cache.
//
// Objectif : tant qu'il y a du réseau, on sert TOUJOURS la dernière version
// (plus besoin de vider le cache à la main après une mise à jour). Le cache ne
// sert que de secours quand on est hors-ligne — par ex. en salle. Un délai de
// sécurité évite de rester bloqué si le réseau est présent mais capricieux.
const CACHE = 'serie1-v11';
const NET_TIMEOUT = 3000; // ms avant de basculer sur le cache si le réseau traîne
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
  './js/store.js',
  './js/db.js',
  './js/chart.js',
  './js/exchange.js',
  './js/seed.js',
  './js/exercices_standards.js',
  './js/mesures.js',
  './js/standards.js',
  './js/config.js',
  './js/merge.js',
  './js/drive.js',
  './js/sync.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (e) => {
  // On précache pour garantir le hors-ligne dès la 1re visite, mais on ne bloque
  // pas l'installation si un fichier manque.
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  // On ne gère que les fichiers de l'app. Les appels vers d'autres domaines
  // (Google Drive, connexion Google) passent tels quels : les re-fabriquer ici
  // leur ferait perdre l'en-tête d'autorisation.
  if (new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(networkFirst(request));
});

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };

    // Filet de sécurité : si le réseau n'a pas répondu à temps, on sert le cache.
    const timer = setTimeout(() => {
      caches.match(request).then((cached) => { if (cached) done(cached); });
    }, NET_TIMEOUT);

    // `no-cache` force une revalidation auprès du serveur (évite qu'un cache HTTP
    // « frais » du navigateur serve une version périmée sans redemander).
    // On passe par l'URL car un Request en mode « navigate » n'est pas reconstructible.
    fetch(request.url, { cache: 'no-cache' })
      .then((res) => {
        clearTimeout(timer);
        // On met à jour le cache avec la version fraîche (pour le hors-ligne futur).
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        done(res);
      })
      .catch(async () => {
        clearTimeout(timer);
        // Hors-ligne : on sert le cache ; pour une navigation, repli sur index.html.
        const cached = await caches.match(request);
        if (cached) return done(cached);
        if (request.mode === 'navigate') {
          const fallback = await caches.match('./index.html');
          if (fallback) return done(fallback);
        }
        done(Response.error());
      });
  });
}
