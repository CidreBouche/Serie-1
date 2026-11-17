// sync.js — synchronisation « local d'abord » avec un fichier distant (Google Drive).
//
// IndexedDB reste la mémoire de travail (rapide, hors-ligne). La synchro :
//   1. lit le fichier distant ; 2. fusionne avec la base locale (merge.js) ;
//   3. applique les nouveautés en local ; 4. réécrit le fichier si besoin.
//
// « Époque » : identifiant du jeu de données. Quand un appareil remplace ou efface
// tout (import complet, « Tout effacer »), une fusion ferait revenir les anciennes
// données ; on demande alors explicitement quel côté garder, et le côté gardé
// reçoit une nouvelle époque que les autres appareils adopteront en bloc.
//
// L'état de synchro (époque connue, modifs en attente…) est propre à l'appareil :
// il vit dans localStorage, pas dans la base synchronisée.

import * as db from './db.js';
import * as drive from './drive.js';
import { mergeSnapshots } from './merge.js';
import { GOOGLE_CLIENT_ID } from './config.js';

const K = {
  clientId: 'serie1.sync.clientId',
  on: 'serie1.sync.on',
  epoch: 'serie1.sync.epoch',
  reset: 'serie1.sync.reset',
  dirty: 'serie1.sync.dirty',
  last: 'serie1.sync.last',
};
const CONTENT = ['exercices', 'seances', 'series', 'mesureTypes', 'mesures'];
const AUTO_DELAY = 4000;

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* stockage indisponible */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* idem */ } },
};

let state = 'idle'; // idle | syncing | error | attention
let lastError = '';
let changeCounter = 0;
let running = null;
let autoTimer = null;
const subs = new Set();
let decide = async () => 'cancel';
let afterPull = () => {};

// ---------- Configuration & état ----------
export function clientId() {
  return (ls.get(K.clientId) || GOOGLE_CLIENT_ID || '').trim();
}
export function setClientId(v) {
  v = (v || '').trim();
  if (v) ls.set(K.clientId, v);
  else ls.del(K.clientId);
  notify();
}

export function status() {
  return {
    configured: !!clientId(),
    connected: ls.get(K.on) === '1',
    state,
    dirty: ls.get(K.dirty) === '1',
    needsDecision: ls.get(K.reset) === '1' || state === 'attention',
    last: Number(ls.get(K.last)) || 0,
    error: lastError,
  };
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function notify() {
  subs.forEach((fn) => { try { fn(status()); } catch (e) { console.warn(e); } });
}

// L'UI fournit : la boîte de dialogue de choix, et quoi faire après un rapatriement.
export function setHandlers(h) {
  if (h.decide) decide = h.decide;
  if (h.afterPull) afterPull = h.afterPull;
}

// Oublie la liaison sur CET appareil (les données locales et le fichier Drive restent).
export function disconnect() {
  drive.forget();
  [K.on, K.epoch, K.last].forEach(ls.del);
  state = 'idle';
  lastError = '';
  notify();
}

// ---------- Cœur de la synchro ----------
function normalize(data) {
  const out = { epoch: (data && data.epoch) || '' };
  for (const s of [...db.DATA_STORES, 'tombstones']) out[s] = Array.isArray(data && data[s]) ? data[s] : [];
  return out;
}
const count = (snap) => CONTENT.reduce((n, s) => n + (snap[s] ? snap[s].length : 0), 0);

function buildFile(snap, epoch) {
  const file = { app: 'serie1', version: 3, epoch, savedAt: new Date().toISOString() };
  for (const s of [...db.DATA_STORES, 'tombstones']) file[s] = snap[s] || [];
  return file;
}

async function ask(reason, options, interactive) {
  if (!interactive) {
    const e = new Error('Choix nécessaire');
    e.code = 'decision';
    throw e;
  }
  const choice = await decide({ reason, options });
  return options.includes(choice) ? choice : 'cancel';
}

// `transport` = { load() → {data}|null, save(file) }. Exporté pour les tests.
export async function runSync(transport, interactive = true) {
  const startCounter = changeCounter;
  const local = await db.snapshot();
  const remoteFile = await transport.load();
  let epoch = ls.get(K.epoch) || '';
  let pulled = false;
  let pushed = false;

  if (!remoteFile) {
    // Premier envoi : cet appareil crée le fichier.
    epoch = epoch || db.uid();
    await transport.save(buildFile(local, epoch));
    pushed = true;
  } else {
    const remote = normalize(remoteFile.data);
    const dirty = ls.get(K.dirty) === '1';
    let action = 'merge';
    if (ls.get(K.reset) === '1') {
      action = await ask('reset', ['push', 'pull'], interactive);
    } else if (epoch && remote.epoch && remote.epoch !== epoch) {
      action = dirty ? await ask('epoch', ['pull', 'push'], interactive) : 'pull';
    } else if (!epoch && count(local) && count(remote)) {
      action = await ask('first', ['merge', 'pull', 'push'], interactive);
    }
    if (action === 'cancel') return { cancelled: true };

    if (action === 'push') {
      epoch = db.uid(); // nouvelle époque : les autres appareils adopteront ce jeu
      await transport.save(buildFile(local, epoch));
      pushed = true;
    } else if (action === 'pull') {
      await db.replaceLocal(remote);
      pulled = true;
      epoch = remote.epoch;
      if (!epoch) {
        epoch = db.uid();
        await transport.save(buildFile(remote, epoch));
        pushed = true;
      }
    } else {
      const m = mergeSnapshots(local, remote, db.DATA_STORES);
      if (m.localNeedsUpdate) {
        await db.applyChanges(m.toLocal);
        pulled = true;
      }
      epoch = remote.epoch || epoch || db.uid();
      if (m.remoteNeedsUpdate || !remote.epoch) {
        await transport.save(buildFile(m.merged, epoch));
        pushed = true;
      }
    }
  }

  ls.set(K.epoch, epoch);
  ls.set(K.on, '1');
  ls.set(K.last, Date.now());
  ls.del(K.reset);
  // Si l'utilisateur a modifié quelque chose PENDANT la synchro, on reste « à envoyer ».
  if (changeCounter === startCounter) ls.del(K.dirty);

  if (pulled) {
    // Le sexe est lu en synchrone depuis localStorage : on recopie la valeur synchronisée.
    const s = await db.get('settings', 'sexe');
    if (s && (s.value === 'homme' || s.value === 'femme')) ls.set('serie1.sexe', s.value);
  }
  return { pulled, pushed };
}

// Lance une synchro. `interactive` : autorisé à ouvrir la fenêtre Google / un dialogue.
export function syncNow({ interactive = true, transport = null } = {}) {
  if (running) return running;
  running = (async () => {
    try {
      if (!transport) {
        const id = clientId();
        if (!id) throw new Error('Synchro non configurée (identifiant Google manquant).');
        await drive.ensureToken(id, interactive);
      }
      state = 'syncing';
      lastError = '';
      notify();
      const res = await runSync(transport || drive, interactive);
      state = 'idle';
      if (res.pulled) afterPull(res);
      return res;
    } catch (e) {
      if (e.code === 'decision') {
        state = 'attention';
      } else if (e.code === 'auth' && !interactive) {
        state = 'idle'; // jeton expiré en arrière-plan : on attendra un tap
      } else {
        state = 'error';
        lastError = e.message || String(e);
      }
      return { error: e };
    } finally {
      running = null;
      notify();
    }
  })();
  return running;
}

// ---------- Synchro automatique (silencieuse) ----------
function autoSync() {
  const s = status();
  if (!s.configured || !s.connected || !s.dirty || s.needsDecision) return;
  if (!navigator.onLine || !drive.hasValidToken()) return;
  syncNow({ interactive: false });
}

export function init() {
  db.onLocalChange((kind) => {
    changeCounter++;
    ls.set(K.dirty, '1');
    if (kind === 'reset' && ls.get(K.on) === '1') ls.set(K.reset, '1');
    notify();
    clearTimeout(autoTimer);
    autoTimer = setTimeout(autoSync, AUTO_DELAY);
  });
  window.addEventListener('online', autoSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autoSync();
  });
  // Précharge la librairie Google pour que le tap « Synchroniser » soit immédiat.
  if (clientId() && navigator.onLine) drive.loadGIS().catch(() => {});
}
