// app.js — bootstrap : routeur, synchro, service worker.
import { router } from './ui.js';
import * as sync from './sync.js';
import { initSexe } from './standards.js';

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
// Au cas où le DOM est déjà prêt (module chargé tard).
if (document.readyState !== 'loading') router();

sync.init();
initSexe().catch((e) => console.warn('initSexe', e));

// Demande au navigateur de ne pas purger les données de l'app quand il manque de
// place (Chrome l'accorde en général à une PWA installée).
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW non enregistré', e));
  });
}
