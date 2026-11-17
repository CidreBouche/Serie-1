// db.js — wrapper minimal et promisifié autour d'IndexedDB.
//
// Stores de données (synchronisés) : exercices, seances, series, mesureTypes,
// mesures, settings. Store technique : tombstones (traces de suppression).
//
// Pour que deux appareils puissent fusionner leurs données :
//  - chaque écriture pose `updatedAt` sur l'enregistrement ;
//  - chaque suppression laisse une « tombstone » { key, store, id, deletedAt }.
// Les fonctions « brutes » (snapshot / applyChanges / replaceLocal) servent à la
// synchro : elles n'horodatent rien et ne déclenchent pas le signal de changement.

const DB_NAME = 'serie1-db';
const DB_VERSION = 3;
export const DATA_STORES = ['exercices', 'seances', 'series', 'mesureTypes', 'mesures', 'settings'];
// « Tout effacer » et l'import complet vident ces stores (le profil est géré à part).
const CONTENT_STORES = ['exercices', 'seances', 'series', 'mesureTypes', 'mesures'];
const ALL_STORES = [...DATA_STORES, 'tombstones'];

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('exercices')) {
        db.createObjectStore('exercices', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('seances')) {
        const s = db.createObjectStore('seances', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('series')) {
        const s = db.createObjectStore('series', { keyPath: 'id' });
        s.createIndex('seanceId', 'seanceId');
        s.createIndex('exerciceId', 'exerciceId');
      }
      // v2 — suivi corporel
      if (!db.objectStoreNames.contains('mesureTypes')) {
        db.createObjectStore('mesureTypes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mesures')) {
        const m = db.createObjectStore('mesures', { keyPath: 'id' });
        m.createIndex('typeId', 'typeId');
        m.createIndex('date', 'date');
      }
      // v3 — synchronisation : réglages synchronisés + traces de suppression
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('tombstones')) {
        db.createObjectStore('tombstones', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode = 'readonly') {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction annulée'));
  });
}

// ---------- Signal de changement local (écouté par la synchro) ----------
// kind : 'write' (ajout/modif/suppression) | 'reset' (tout effacé / tout remplacé)
let _onChange = null;
export function onLocalChange(fn) {
  _onChange = fn;
}
function changed(kind) {
  try {
    if (_onChange) _onChange(kind);
  } catch (e) {
    console.warn('onLocalChange', e);
  }
}

export const tombKey = (store, id) => `${store}:${id}`;

// ---------- Lecture ----------
export async function getAll(store) {
  return reqToPromise((await tx(store)).getAll());
}

export async function get(store, id) {
  return reqToPromise((await tx(store)).get(id));
}

export async function byIndex(store, index, value) {
  const os = await tx(store);
  return reqToPromise(os.index(index).getAll(value));
}

// ---------- Écriture (horodatée) ----------
export async function put(store, value) {
  value.updatedAt = Date.now();
  const os = await tx(store, 'readwrite');
  await reqToPromise(os.put(value));
  changed('write');
  return value;
}

export async function del(store, id) {
  const db = await openDB();
  const t = db.transaction([store, 'tombstones'], 'readwrite');
  t.objectStore(store).delete(id);
  t.objectStore('tombstones').put({ key: tombKey(store, id), store, id, deletedAt: Date.now() });
  await txDone(t);
  changed('write');
}

// Efface le contenu (séances, exercices, mesures…). Le profil (settings) reste.
export async function clearAll() {
  const db = await openDB();
  const names = [...CONTENT_STORES, 'tombstones'];
  const t = db.transaction(names, 'readwrite');
  names.forEach((n) => t.objectStore(n).clear());
  await txDone(t);
  changed('reset');
}

// Import en masse (remplace tout le contenu) — utilisé par l'import JSON complet.
export async function replaceAll(data) {
  const db = await openDB();
  const t = db.transaction(ALL_STORES, 'readwrite');
  [...CONTENT_STORES, 'tombstones'].forEach((n) => t.objectStore(n).clear());
  for (const n of CONTENT_STORES) (data[n] || []).forEach((r) => t.objectStore(n).put(r));
  // Le profil n'est remplacé que si la sauvegarde en contient un.
  if (Array.isArray(data.settings) && data.settings.length) {
    t.objectStore('settings').clear();
    data.settings.forEach((r) => t.objectStore('settings').put(r));
  }
  await txDone(t);
  changed('reset');
}

// ---------- API brute pour la synchronisation ----------

// Photo complète de la base : { exercices:[…], …, settings:[…], tombstones:[…] }.
export async function snapshot() {
  const db = await openDB();
  const t = db.transaction(ALL_STORES, 'readonly');
  const out = {};
  await Promise.all(ALL_STORES.map(async (n) => { out[n] = await reqToPromise(t.objectStore(n).getAll()); }));
  return out;
}

// Applique un différentiel calculé par la fusion, sans horodater ni signaler.
//   puts : { store: [enregistrements] }   dels : { store: [ids] }
//   tombPuts : [tombstones]               tombDels : [keys]
export async function applyChanges({ puts = {}, dels = {}, tombPuts = [], tombDels = [] }) {
  const db = await openDB();
  const t = db.transaction(ALL_STORES, 'readwrite');
  for (const [store, records] of Object.entries(puts)) records.forEach((r) => t.objectStore(store).put(r));
  for (const [store, ids] of Object.entries(dels)) ids.forEach((id) => t.objectStore(store).delete(id));
  tombPuts.forEach((tb) => t.objectStore('tombstones').put(tb));
  tombDels.forEach((k) => t.objectStore('tombstones').delete(k));
  await txDone(t);
}

// Remplace TOUTE la base locale par une photo distante (sans signaler).
export async function replaceLocal(snap) {
  const db = await openDB();
  const t = db.transaction(ALL_STORES, 'readwrite');
  for (const n of ALL_STORES) {
    t.objectStore(n).clear();
    (snap[n] || []).forEach((r) => t.objectStore(n).put(r));
  }
  await txDone(t);
}

// Identifiant robuste (randomUUID indispo hors contexte sécurisé → repli).
export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
