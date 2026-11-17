// exchange.js — export CSV/JSON + import JSON (P1 du brief).
import { getAll, put, replaceAll, uid } from './db.js';
import { formatDateFR } from './store.js';

const normNom = (s) => (s || '').trim().toLowerCase();

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function exportJSON() {
  const [exercices, seances, series, mesureTypes, mesures, settings] = await Promise.all([
    getAll('exercices'),
    getAll('seances'),
    getAll('series'),
    getAll('mesureTypes'),
    getAll('mesures'),
    getAll('settings'),
  ]);
  const payload = { app: 'serie1', version: 3, exportedAt: new Date().toISOString(), exercices, seances, series, mesureTypes, mesures, settings };
  download(`serie1-sauvegarde-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// CSV à la maille "série" — la granularité utile pour ré-analyser (cf. série 1).
export async function exportCSV() {
  const [exercices, seances, series] = await Promise.all([
    getAll('exercices'),
    getAll('seances'),
    getAll('series'),
  ]);
  const exById = new Map(exercices.map((e) => [e.id, e]));
  const seById = new Map(seances.map((s) => [s.id, s]));

  const rows = series
    .map((s) => {
      const ex = exById.get(s.exerciceId) || {};
      const se = seById.get(s.seanceId) || {};
      return { date: se.date || '', ...s, ex };
    })
    .sort((a, b) => (a.date === b.date ? (a.ex.nom || '').localeCompare(b.ex.nom || '') || a.position - b.position : a.date.localeCompare(b.date)));

  const header = ['date', 'exercice', 'position', 'poids_kg', 'reps', 'duree_sec', 'rpe', 'echauffement', 'seuil'];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push([
      r.date,
      r.ex.nom || '',
      r.position,
      r.poids,
      r.reps,
      r.dureeSec || 0,
      r.rpe ?? '',
      r.echauffement ? 1 : 0,
      r.ex.seuil ?? '',
    ].map(csvCell).join(';'));
  }
  download(`serie1-series-${stamp()}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
}

// Import NON destructif de mesures : ajoute types + relevés aux données existantes.
// Fusionne les types par nom (réutilise l'id existant) et dédoublonne les relevés
// identiques (type+date+valeur) → réimport idempotent.
export async function importMesuresFile(file) {
  const data = JSON.parse(await file.text());
  if (!data || !Array.isArray(data.mesureTypes) || !Array.isArray(data.mesures)) {
    throw new Error('format de mesures non reconnu');
  }
  const [typesExistants, mesuresExistantes] = await Promise.all([getAll('mesureTypes'), getAll('mesures')]);

  // Map nom normalisé -> id (existant)
  const idParNom = new Map(typesExistants.map((t) => [normNom(t.nom), t.id]));
  const idRemap = new Map(); // ancien id importé -> id dans la base
  let nbTypes = 0;
  for (const t of data.mesureTypes) {
    const cle = normNom(t.nom);
    if (idParNom.has(cle)) {
      idRemap.set(t.id, idParNom.get(cle));
    } else {
      const nouveau = { id: uid(), nom: (t.nom || '').trim(), unite: (t.unite || '').trim(), createdAt: t.createdAt || Date.now() };
      await put('mesureTypes', nouveau);
      idParNom.set(cle, nouveau.id);
      idRemap.set(t.id, nouveau.id);
      nbTypes++;
    }
  }

  const vus = new Set(mesuresExistantes.map((m) => `${m.typeId}|${m.date}|${m.valeur}`));
  let nbMesures = 0;
  for (const m of data.mesures) {
    const typeId = idRemap.get(m.typeId);
    if (!typeId) continue;
    const cle = `${typeId}|${m.date}|${Number(m.valeur)}`;
    if (vus.has(cle)) continue; // doublon
    vus.add(cle);
    await put('mesures', { id: uid(), typeId, date: m.date, valeur: Number(m.valeur), note: (m.note || '').trim(), createdAt: m.createdAt || Date.now() });
    nbMesures++;
  }
  return { nouveauxTypes: nbTypes, nouvellesMesures: nbMesures };
}

export async function importJSONFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.exercices) || !Array.isArray(data.seances) || !Array.isArray(data.series)) {
    throw new Error('format non reconnu');
  }
  const mesureTypes = Array.isArray(data.mesureTypes) ? data.mesureTypes : [];
  const mesures = Array.isArray(data.mesures) ? data.mesures : [];
  const settings = Array.isArray(data.settings) ? data.settings : [];
  await replaceAll({ exercices: data.exercices, seances: data.seances, series: data.series, mesureTypes, mesures, settings });
  // Le sexe est lu en synchrone depuis localStorage : on recopie celui de la sauvegarde.
  const sexe = settings.find((s) => s.id === 'sexe');
  if (sexe && (sexe.value === 'homme' || sexe.value === 'femme')) localStorage.setItem('serie1.sexe', sexe.value);
  location.hash = '#/';
  return { exercices: data.exercices.length, seances: data.seances.length, series: data.series.length, mesureTypes: mesureTypes.length, mesures: mesures.length };
}
