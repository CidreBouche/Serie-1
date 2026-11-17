// standards.js — niveaux de force (Novice → Champion) pour SBD + Hip thrust.
// Données fournies par l'utilisateur (fichier TODO) pour le SBD ; Hip thrust est
// indicatif (marqué `approx`). Le niveau se lit sur le 1RM ESTIMÉ (Epley) de la
// série 1, rapporté au poids de corps — sauf « Novice », en kg absolus (voulu :
// les perfs de débutant ne sont pas encore liées au poids de corps).

import { poidsCorpsAvant } from './mesures.js';
import { get, put } from './db.js';

export const NIVEAUX = ['Novice', 'Débutant', 'Intermédiaire', 'Avancé', 'Pro', 'Champion'];

// noviceMaxKg : plafond absolu du Novice. r : ratios (× poids de corps) d'ENTRÉE
// dans chaque palier. Classement = plus haut palier atteint → tranches jointives.
const TABLES = {
  homme: {
    squat:     { noviceMaxKg: 60, r: { intermediaire: 1.25, avance: 1.75, pro: 2.5, champion: 3.0 } },
    bench:     { noviceMaxKg: 40, r: { intermediaire: 1.0, avance: 1.5, pro: 2.0, champion: 2.25 } },
    deadlift:  { noviceMaxKg: 60, r: { intermediaire: 1.5, avance: 2.25, pro: 3.0, champion: 3.5 } },
    hipthrust: { noviceMaxKg: 60, r: { intermediaire: 1.5, avance: 2.25, pro: 3.0, champion: 3.75 }, approx: true },
  },
  femme: {
    squat:     { noviceMaxKg: 40, r: { intermediaire: 1.0, avance: 1.5, pro: 1.75, champion: 2.25 } },
    bench:     { noviceMaxKg: 20, r: { intermediaire: 0.5, avance: 0.75, pro: 1.0, champion: 1.25 } },
    deadlift:  { noviceMaxKg: 60, r: { intermediaire: 1.25, avance: 1.75, pro: 2.25, champion: 3.0 } },
    hipthrust: { noviceMaxKg: 40, r: { intermediaire: 1.25, avance: 2.0, pro: 2.75, champion: 3.5 }, approx: true },
  },
};

// Exercices reconnus : nom SPÉCIFIQUE exact normalisé → clé de lift. Les noms
// sont volontairement précis (barre libre, arrière, conventionnel barre droite)
// pour ne matcher que la vraie variante de référence — un simple « Développé
// couché » (aux haltères p. ex.) ne déclenche donc PAS les standards barre.
const NOMS = {
  'squat arriere barre libre': 'squat',
  'developpe couche barre libre': 'bench',
  'souleve de terre conventionnel barre droite': 'deadlift',
  'hip thrust barre libre': 'hipthrust',
};

function normNom(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export function liftDeExercice(nom) {
  return NOMS[normNom(nom)] || null;
}

// 1RM estimé (Epley). Une seule rep = déjà un 1RM.
export function estime1RM(poids, reps) {
  poids = Number(poids) || 0;
  reps = Number(reps) || 0;
  if (poids <= 0 || reps <= 0) return 0;
  return reps <= 1 ? poids : poids * (1 + reps / 30);
}

// ---------- Réglage du sexe ----------
// Lu en synchrone depuis localStorage (cache), et enregistré aussi dans le store
// `settings` de la base pour suivre la synchro et les sauvegardes.
const sexeValide = (v) => v === 'homme' || v === 'femme';
export function getSexe() {
  const v = localStorage.getItem('serie1.sexe');
  return sexeValide(v) ? v : '';
}
export function setSexe(v) {
  if (!sexeValide(v)) return;
  localStorage.setItem('serie1.sexe', v);
  put('settings', { id: 'sexe', value: v }).catch((e) => console.warn('sexe non enregistré en base', e));
}
// Au démarrage : aligne le cache et la base (migration des versions sans store `settings`).
export async function initSexe() {
  const enBase = await get('settings', 'sexe');
  const cache = getSexe();
  if (enBase && sexeValide(enBase.value)) {
    if (enBase.value !== cache) localStorage.setItem('serie1.sexe', enBase.value);
  } else if (cache) {
    await put('settings', { id: 'sexe', value: cache });
  }
}

// Classe un 1RM estimé. Renvoie { niveau, ratio, approx, prochain:{label,ratio,kg} }.
export function niveauPour(liftKey, sexe, est1rm, poidsCorps) {
  const t = TABLES[sexe] && TABLES[sexe][liftKey];
  if (!t || est1rm <= 0) return null;
  const r = poidsCorps > 0 ? est1rm / poidsCorps : null;

  let niveau;
  if (r == null) {
    niveau = est1rm <= t.noviceMaxKg ? 'Novice' : null; // sans poids : au mieux Novice
  } else if (r >= t.r.champion) niveau = 'Champion';
  else if (r >= t.r.pro) niveau = 'Pro';
  else if (r >= t.r.avance) niveau = 'Avancé';
  else if (r >= t.r.intermediaire) niveau = 'Intermédiaire';
  else niveau = est1rm <= t.noviceMaxKg ? 'Novice' : 'Débutant';

  // Prochain palier (premier seuil de ratio au-dessus du ratio actuel).
  let prochain = null;
  if (r != null) {
    const paliers = [
      ['Intermédiaire', t.r.intermediaire],
      ['Avancé', t.r.avance],
      ['Pro', t.r.pro],
      ['Champion', t.r.champion],
    ];
    for (const [label, ratio] of paliers) {
      if (ratio > r) { prochain = { label, ratio, kg: ratio * poidsCorps }; break; }
    }
  }
  return { niveau, ratio: r, approx: !!t.approx, prochain };
}

// Calcul complet pour un exercice : meilleur 1RM estimé de la série 1, poids de
// corps à la date de cette série, et niveau. `hist1` = série 1 (déjà sans échauff.).
export async function evaluerExercice(nom, hist1) {
  const liftKey = liftDeExercice(nom);
  if (!liftKey) return null; // pas un lift standard
  const sexe = getSexe();

  // Meilleure série 1 chargée (charge + reps), au 1RM estimé le plus haut.
  let best = null;
  for (const h of hist1) {
    const e = estime1RM(h.poids, h.reps);
    if (e > 0 && (!best || e > best.est1rm)) best = { est1rm: e, date: h.date, poids: h.poids, reps: h.reps };
  }
  if (!best) return { liftKey, sexe, manque: 'perf' }; // rien d'estimable (PDC pur / durée)

  const poidsCorps = await poidsCorpsAvant(best.date);
  if (!sexe) return { liftKey, sexe: '', best, poidsCorps, manque: 'sexe' };
  const res = niveauPour(liftKey, sexe, best.est1rm, poidsCorps);
  return { liftKey, sexe, best, poidsCorps, manque: poidsCorps ? null : 'poids', ...res };
}
