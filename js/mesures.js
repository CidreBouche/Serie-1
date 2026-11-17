// mesures.js — suivi corporel : types de mesure (catalogue + custom) et relevés.
// Modèle :
//   mesureType : { id, nom, unite, createdAt }
//   mesure     : { id, typeId, date (YYYY-MM-DD), valeur, note, createdAt }

import { getAll, get, put, del, byIndex, uid } from './db.js';

// Unités proposées dans la liste déroulante (+ « Autre… » en saisie libre côté UI).
export const UNITES = ['cm', 'kg', '%', 'kcal', 'bpm'];

// Catalogue de mesures standard (suggestions). Circonférences fiables (ruban) +
// les 2 repères de composition les plus suivis. Le reste se crée en custom.
export const MESURES_STANDARDS = [
  // Circonférences (cm)
  { nom: 'Tour de taille', unite: 'cm' },
  { nom: 'Ventre (nombril)', unite: 'cm' },
  { nom: 'Hanches', unite: 'cm' },
  { nom: 'Bras', unite: 'cm' },
  { nom: 'Cuisse', unite: 'cm' },
  { nom: 'Mollet', unite: 'cm' },
  { nom: 'Cou', unite: 'cm' },
  { nom: 'Poitrine', unite: 'cm' },
  { nom: 'Épaules', unite: 'cm' },
  { nom: 'Avant-bras', unite: 'cm' },
  // Composition
  { nom: 'Poids', unite: 'kg' },
  { nom: 'Masse grasse', unite: '%' },
  { nom: 'Masse musculaire', unite: 'kg' },
];

// ---------- Types de mesure ----------

export async function listMesureTypes() {
  const t = await getAll('mesureTypes');
  return t.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export function getMesureType(id) {
  return get('mesureTypes', id);
}

export async function createMesureType({ nom, unite = '' }) {
  const t = { id: uid(), nom: nom.trim(), unite: (unite || '').trim(), createdAt: Date.now() };
  await put('mesureTypes', t);
  return t;
}

export async function updateMesureType(id, patch) {
  const t = await get('mesureTypes', id);
  if (!t) return null;
  const next = { ...t, ...patch };
  if (next.nom != null) next.nom = String(next.nom).trim();
  if (next.unite != null) next.unite = String(next.unite).trim();
  await put('mesureTypes', next);
  return next;
}

export async function deleteMesureType(id) {
  const ms = await byIndex('mesures', 'typeId', id);
  await Promise.all(ms.map((m) => del('mesures', m.id)));
  await del('mesureTypes', id);
}

// ---------- Relevés ----------

export async function mesuresOfType(typeId) {
  const ms = await byIndex('mesures', 'typeId', typeId);
  return ms.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date.localeCompare(b.date)));
}

export async function addMesure({ typeId, date, valeur, note = '' }) {
  const m = {
    id: uid(),
    typeId,
    date: date || todayISO(),
    valeur: Number(String(valeur).replace(',', '.')),
    note: (note || '').trim(),
    createdAt: Date.now(),
  };
  await put('mesures', m);
  return m;
}

export async function updateMesure(id, patch) {
  const m = await get('mesures', id);
  if (!m) return null;
  const next = { ...m, ...patch };
  if (next.valeur != null) next.valeur = Number(String(next.valeur).replace(',', '.'));
  await put('mesures', next);
  return next;
}

export function deleteMesure(id) {
  return del('mesures', id);
}

// ---------- Agrégats ----------

// Dernier relevé (le plus récent) d'un type.
export async function latestForType(typeId) {
  const ms = await mesuresOfType(typeId);
  return ms.length ? ms[ms.length - 1] : null;
}

// Poids de corps connu à une date donnée (dernier relevé de date ≤ dateISO).
// Utile pour les standards de force (point 3). Cherche un type nommé « Poids ».
export async function poidsCorpsAvant(dateISO) {
  const types = await getAll('mesureTypes');
  const poidsType = types.find((t) => t.nom.toLowerCase() === 'poids');
  if (!poidsType) return null;
  const ms = await mesuresOfType(poidsType.id);
  const avant = ms.filter((m) => m.date <= dateISO);
  return avant.length ? avant[avant.length - 1].valeur : null;
}

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
