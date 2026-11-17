// store.js — accès aux données + logique métier.
// Le cœur du brief : isoler la SÉRIE 1 (position 1) et déclencher l'alerte de
// surcharge PAR POSITION indépendamment des autres séries.

import { getAll, get, put, del, byIndex, uid } from './db.js';

export const SEUIL_DEFAUT = 10;

// ---------- Exercices ----------

export async function listExercices() {
  const ex = await getAll('exercices');
  return ex.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export function getExercice(id) {
  return get('exercices', id);
}

export async function createExercice({ nom, seuil = SEUIL_DEFAUT }) {
  const ex = {
    id: uid(),
    nom: nom.trim(),
    seuil: Number(seuil) || SEUIL_DEFAUT,
    createdAt: Date.now(),
  };
  await put('exercices', ex);
  return ex;
}

export async function updateExercice(id, patch) {
  const ex = await get('exercices', id);
  if (!ex) return null;
  const next = { ...ex, ...patch };
  next.seuil = Number(next.seuil) || SEUIL_DEFAUT;
  await put('exercices', next);
  return next;
}

// ---------- Séances ----------

export async function listSeances() {
  const s = await getAll('seances');
  // Tri antéchronologique : date puis ordre de création.
  return s.sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));
}

export function getSeance(id) {
  return get('seances', id);
}

export async function createSeance({ date, notes = '' } = {}) {
  const s = {
    id: uid(),
    date: date || todayISO(),
    notes: notes.trim(),
    createdAt: Date.now(),
  };
  await put('seances', s);
  return s;
}

export async function updateSeance(id, patch) {
  const s = await get('seances', id);
  if (!s) return null;
  const next = { ...s, ...patch };
  await put('seances', next);
  return next;
}

export async function deleteSeance(id) {
  const series = await byIndex('series', 'seanceId', id);
  await Promise.all(series.map((s) => del('series', s.id)));
  await del('seances', id);
}

// ---------- Séries ----------

export function seriesOfSeance(seanceId) {
  return byIndex('series', 'seanceId', seanceId);
}

export function seriesOfExercice(exerciceId) {
  return byIndex('series', 'exerciceId', exerciceId);
}

export async function addSerie({ seanceId, exerciceId, position, poids, reps, dureeSec = 0, rpe = null, echauffement = false }) {
  const s = {
    id: uid(),
    seanceId,
    exerciceId,
    // Un échauffement ne porte pas de numéro de série de travail (position 0).
    position: echauffement ? 0 : Number(position),
    poids: Number(poids) || 0,
    reps: Number(reps) || 0,
    dureeSec: Number(dureeSec) || 0, // durée en secondes (0 = non renseignée)
    rpe: rpe == null || rpe === '' ? null : Number(rpe),
    echauffement: !!echauffement, // exclu de la série 1, des graphes et des seuils
    createdAt: Date.now(),
  };
  await put('series', s);
  return s;
}

export async function updateSerie(id, patch) {
  const s = await get('series', id);
  if (!s) return null;
  const next = { ...s, ...patch };
  ['position', 'poids', 'reps', 'dureeSec'].forEach((k) => (next[k] = Number(next[k]) || 0));
  next.rpe = next.rpe == null || next.rpe === '' ? null : Number(next.rpe);
  if ('echauffement' in patch) next.echauffement = !!patch.echauffement;
  await put('series', next);
  return next;
}

export function deleteSerie(id) {
  return del('series', id);
}

// ---------- Logique métier ----------

// Dernière perf enregistrée pour un exercice à une POSITION donnée,
// sur une séance strictement antérieure à celle en cours.
export async function lastPerfAtPosition(exerciceId, position, currentSeanceId) {
  const [series, seances] = await Promise.all([seriesOfExercice(exerciceId), getAll('seances')]);
  const seanceById = new Map(seances.map((s) => [s.id, s]));
  const current = seanceById.get(currentSeanceId);

  const candidates = series
    .filter((s) => !s.echauffement && s.position === Number(position) && s.seanceId !== currentSeanceId)
    .map((s) => ({ serie: s, seance: seanceById.get(s.seanceId) }))
    .filter((x) => x.seance);

  // On ne garde que ce qui précède la séance courante (par date puis createdAt).
  const before = candidates.filter((x) => {
    if (!current) return true;
    if (x.seance.date !== current.date) return x.seance.date < current.date;
    return x.seance.createdAt < current.createdAt;
  });

  before.sort((a, b) =>
    b.seance.date === a.seance.date
      ? b.seance.createdAt - a.seance.createdAt
      : b.seance.date.localeCompare(a.seance.date)
  );

  if (!before.length) return null;
  const { serie, seance } = before[0];
  return { poids: serie.poids || 0, reps: serie.reps || 0, dureeSec: serie.dureeSec || 0, date: seance.date };
}

// Le seuil est-il atteint pour cette série ? (double progression par position)
export function seuilAtteint(exercice, reps) {
  return Number(reps) >= (exercice?.seuil ?? SEUIL_DEFAUT);
}

// Historique de la SÉRIE 1 (position 1) d'un exercice, chronologique.
// C'est l'indicateur de progression principal du brief.
export async function serie1History(exerciceId) {
  const [series, seances] = await Promise.all([seriesOfExercice(exerciceId), getAll('seances')]);
  const seanceById = new Map(seances.map((s) => [s.id, s]));
  return series
    .filter((s) => !s.echauffement && s.position === 1)
    .map((s) => ({ ...s, date: seanceById.get(s.seanceId)?.date }))
    .filter((s) => s.date)
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date.localeCompare(b.date)));
}

// Choisit la métrique de progression la plus parlante pour une série d'historique :
// la CHARGE par défaut ; mais si la charge reste toujours à 0 (poids du corps pur,
// gainage), on bascule sur les REPS, puis sur la DURÉE. Évite les courbes plates.
export function serie1Metric(history) {
  const h = history || [];
  const maxCharge = Math.max(0, ...h.map((x) => x.poids || 0));
  const anyReps = h.some((x) => (x.reps || 0) > 0);
  const anyDuree = h.some((x) => (x.dureeSec || 0) > 0);
  if (maxCharge > 0) return { key: 'charge', label: 'charge', valueOf: (x) => x.poids || 0, format: (v) => `${round1(v)} kg` };
  if (anyReps) return { key: 'reps', label: 'reps', valueOf: (x) => x.reps || 0, format: (v) => `${round1(v)} reps` };
  if (anyDuree) return { key: 'duree', label: 'durée', valueOf: (x) => x.dureeSec || 0, format: (v) => formatDuree(v) };
  return { key: 'reps', label: 'reps', valueOf: (x) => x.reps || 0, format: (v) => `${round1(v)} reps` };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// Positions "prêtes à monter en charge" à la dernière séance où l'exercice
// apparaît : pour chaque position, la dernière perf a-t-elle atteint le seuil ?
export async function positionsPretes(exerciceId) {
  const ex = await getExercice(exerciceId);
  if (!ex) return [];
  const [series, seances] = await Promise.all([seriesOfExercice(exerciceId), getAll('seances')]);
  if (!series.length) return [];
  const seanceById = new Map(seances.map((s) => [s.id, s]));

  // Dernière série connue par position (la plus récente par date/création).
  const parPosition = new Map();
  for (const s of series) {
    if (s.echauffement) continue; // les échauffements ne déclenchent pas d'alerte
    const seance = seanceById.get(s.seanceId);
    if (!seance) continue;
    const prev = parPosition.get(s.position);
    const newer =
      !prev ||
      seance.date > prev.date ||
      (seance.date === prev.date && s.createdAt > prev.createdAt);
    if (newer) parPosition.set(s.position, { ...s, date: seance.date });
  }

  return [...parPosition.entries()]
    .filter(([, s]) => seuilAtteint(ex, s.reps))
    .map(([position, s]) => ({ position, poids: s.poids, reps: s.reps, date: s.date }))
    .sort((a, b) => a.position - b.position);
}

// ---------- Utilitaires date ----------

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function formatDateFR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ---------- Formatage générique d'une série (charge / reps / durée) ----------

// Durée en secondes → "m:ss" (ex. 90 → "1:30", 45 → "0:45").
export function formatDuree(sec) {
  sec = Number(sec) || 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Représentation compacte d'une série, en n'affichant que ce qui est renseigné.
// Ex : 40kg×8 · "8 reps" · "1:30" · "40 kg × 8 · 1:30".
export function formatPerf(s) {
  if (!s) return '—';
  const poids = Number(s.poids) || 0;
  const reps = Number(s.reps) || 0;
  const duree = Number(s.dureeSec) || 0;
  let main = '';
  if (poids > 0 && reps > 0) main = `${poids} kg × ${reps}`;
  else if (reps > 0) main = `${reps} reps`;
  else if (poids > 0) main = `${poids} kg`;
  if (duree > 0) main = main ? `${main} · ${formatDuree(duree)}` : formatDuree(duree);
  return main || '—';
}
