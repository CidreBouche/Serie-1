# Série 1 — PWA de suivi de musculation

Usage personnel. Contexte privé (appareils, historique, brief initial, vraies
données) : `private/` — gitignoré, absent du dépôt. Lire `private/README.md` si besoin.

## But
Logger les séances et faire ressortir le signal de progression fiable : la
**série 1** de chaque exercice. Double progression appliquée **par position de
série**, indépendamment des autres séries.

## Contraintes
- Android (Chrome) + PC (Chrome/Edge). Pas d'iOS.
- Hors-ligne en salle ; saisie rapide (gros boutons, peu de taps).
- Zéro coût, pas de backend à nous : IndexedDB local + synchro d'un fichier Google Drive.
- Dépôt GitHub **public** (GitHub Pages) : aucune donnée ni info perso → `private/`.

## Stack
JS vanilla en modules ES, sans build ni Node. Test : `python3 -m http.server 8137`.
Architecture et arborescence : `README.md`. Guide utilisateur : `MANUEL.md`.

## Invariants
- Écrire en base uniquement via `db.put` / `db.del` (horodatage + traces de
  suppression), sinon la synchro ne voit pas le changement.
- `position` 1, 2, 3… isole la série 1 ; `echauffement: true` → position 0, exclue
  de la série 1, des graphes, des seuils et de la dernière perf.
- Série générique : charge + reps + durée + RPE cumulables. Pas de groupe ni de
  type d'exercice (retirés volontairement).
- Standards de force : rattachés par nom exact (`NOMS`, `js/standards.js`), badge 🏆.
- `sw.js` : réseau d'abord, même origine seulement ; incrémenter `CACHE` seulement
  si la liste `ASSETS` change.
- UI, docs et commentaires en français.
