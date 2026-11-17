// exercices_standards.js — catalogue d'exercices courants pour l'autocomplete.
// Sert uniquement de SUGGESTIONS : un tap crée l'exercice avec son seuil
// pré-rempli. La saisie libre reste toujours possible.
// (Pour un exo au poids du corps, il suffit de laisser la charge à 0.)

export const EXERCICES_STANDARDS = [
  // — Push —
  { nom: 'Développé couché barre libre', seuil: 8 },
  { nom: 'Développé couché haltères', seuil: 10 },
  { nom: 'Développé incliné barre libre', seuil: 8 },
  { nom: 'Développé incliné haltères', seuil: 8 },
  { nom: 'Développé militaire barre libre', seuil: 8 },
  { nom: 'Développé militaire haltères', seuil: 10 },
  { nom: 'Dips', seuil: 10 },
  { nom: 'Pompes', seuil: 20 },
  { nom: 'Élévations latérales haltères', seuil: 15 },
  { nom: 'Écarté couché haltères', seuil: 12 },
  { nom: 'Pec deck', seuil: 12 },
  { nom: 'Extension triceps poulie', seuil: 12 },
  { nom: 'Barre au front', seuil: 10 },

  // — Pull —
  { nom: 'Tractions pronation', seuil: 8 },
  { nom: 'Tractions supination', seuil: 8 },
  { nom: 'Rowing barre', seuil: 8 },
  { nom: 'Rowing haltère', seuil: 10 },
  { nom: 'Tirage vertical', seuil: 10 },
  { nom: 'Tirage horizontal', seuil: 10 },
  { nom: 'Face pull', seuil: 15 },
  { nom: 'Curl biceps barre', seuil: 10 },
  { nom: 'Curl supination haltères', seuil: 12 },
  { nom: 'Curl marteau haltères', seuil: 12 },
  { nom: 'Curl pupitre supination haltères', seuil: 10 },
  { nom: 'Bayesian curl', seuil: 12 },

  // — Legs —
  { nom: 'Squat arrière barre libre', seuil: 6 },
  { nom: 'Squat avant barre libre', seuil: 6 },
  { nom: 'Hack squat', seuil: 8 },
  { nom: 'Presse à cuisses', seuil: 10 },
  { nom: 'Soulevé de terre conventionnel barre droite', seuil: 5 },
  { nom: 'Soulevé de terre roumain barre', seuil: 8 },
  { nom: 'Fentes marchées haltères', seuil: 10 },
  { nom: 'Fentes bulgares haltères', seuil: 10 },
  { nom: 'Leg curl', seuil: 12 },
  { nom: 'Leg extension', seuil: 12 },
  { nom: 'Hip thrust barre libre', seuil: 10 },
  { nom: 'Mollets debout', seuil: 15 },
  { nom: 'Mollets assis', seuil: 15 },

  // — Core — (mesurés au poids du corps ; souvent en durée pour le gainage)
  { nom: 'Gainage ventral', seuil: 10 },
  { nom: 'Gainage latéral', seuil: 10 },
  { nom: 'Relevés de jambes', seuil: 15 },
  { nom: 'Crunch', seuil: 20 },
  { nom: 'Roue abdominale', seuil: 12 },
];
