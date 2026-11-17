// seed.js — jeu de données d'exemple, réaliste et raconté :
// progression nette de la SÉRIE 1 (le signal du brief), avec des back-off sets
// (S2/S3) qui traînent pour illustrer la double progression PAR POSITION.
import * as store from './store.js';

// Exercices : [nom, seuil]
// (au poids du corps, la charge saisie est le LEST ajouté ; 0 = poids du corps seul)
const EXERCICES = [
  ['Dips', 10],
  ['Développé couché barre libre', 8],
  ['Tractions', 8],
  ['Squat arrière barre libre', 6],
  ['Gainage', 10],
];

// Séances : date ISO → { exercice: [[poids, reps], ...] (index = position) }
// Fil rouge Dips : S1 30→32→34 sur 6 semaines ; les S2/S3 suivent avec retard.
const SEANCES = [
  ['2026-05-29', {
    // 5e valeur = échauffement (true) : exclu de la série 1 et des graphes
    'Dips': [[0, 12, 0, null, true], [30, 8], [30, 6], [30, 5]],
    'Développé couché barre libre': [[40, 10, 0, null, true], [70, 7], [70, 6], [65, 6]],
  }],
  ['2026-06-01', {
    'Tractions': [[10, 7], [10, 6], [8, 6]],
    'Squat arrière barre libre': [[100, 5], [100, 5], [90, 6]],
    // Gainage : [charge, reps, durée_sec] — charge/reps à 0, on suit la durée
    'Gainage': [[0, 0, 45], [0, 0, 40]],
  }],
  ['2026-06-05', {
    'Dips': [[30, 10], [30, 8], [30, 6]],   // S1 atteint le seuil → prête à monter
    'Développé couché barre libre': [[70, 8], [70, 7], [65, 7]],
  }],
  ['2026-06-12', {
    'Dips': [[32, 8], [30, 9], [30, 7]],     // S1 montée à 32
    'Tractions': [[10, 8], [10, 7], [8, 7]],
  }],
  ['2026-06-19', {
    'Dips': [[32, 9], [32, 7], [30, 8]],
    'Squat arrière barre libre': [[105, 5], [100, 6], [95, 6]],
    'Gainage': [[0, 0, 60], [0, 0, 50]],   // durée qui progresse : 45s → 60s
  }],
  ['2026-06-26', {
    'Dips': [[32, 10], [32, 8], [30, 9]],    // S1 seuil de nouveau
    // 4e valeur = RPE (optionnel)
    'Développé couché barre libre': [[72, 8, 0, 8], [70, 8, 0, 9], [67, 7, 0, 9.5]],
  }],
  ['2026-07-03', {
    'Dips': [[34, 8], [32, 9], [32, 7]],     // S1 montée à 34
    'Tractions': [[12, 7], [10, 8], [10, 7]],
  }],
  ['2026-07-10', {
    'Dips': [[34, 9], [34, 7], [32, 8]],
    'Squat arrière barre libre': [[110, 5], [105, 6], [100, 6]],
  }],
];

export async function seedExample() {
  // Crée les exercices et récupère leur id par nom.
  const idByName = new Map();
  for (const [nom, seuil] of EXERCICES) {
    const ex = await store.createExercice({ nom, seuil });
    idByName.set(nom, ex.id);
  }
  // Crée les séances et leurs séries.
  let nbSeries = 0;
  for (const [date, exos] of SEANCES) {
    const seance = await store.createSeance({ date });
    for (const [nom, series] of Object.entries(exos)) {
      const exerciceId = idByName.get(nom);
      let pos = 0; // ne s'incrémente que pour les séries de travail
      for (let i = 0; i < series.length; i++) {
        const [poids, reps, dureeSec = 0, rpe = null, echauffement = false] = series[i];
        if (!echauffement) pos++;
        await store.addSerie({ seanceId: seance.id, exerciceId, position: pos, poids, reps, dureeSec, rpe, echauffement });
        nbSeries++;
      }
    }
  }
  return { exercices: EXERCICES.length, seances: SEANCES.length, series: nbSeries };
}
