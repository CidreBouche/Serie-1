# Série 1 — Suivi de musculation (PWA)

Application personnelle centrée sur le signal qui compte : **la progression de la
série 1 de chaque exercice**, avec alerte de surcharge progressive **par position
de série indépendamment** (cf. `CLAUDE.md`).

Cibles : **téléphone Android** (Chrome) et **ordinateur** (Chrome / Edge), avec les
mêmes données des deux côtés grâce à une **synchronisation Google Drive**.

> 📖 Mise en place pas-à-pas et utilisation au quotidien : **[`manuel/`](manuel/README.md)**
> (un chapitre par fichier).

## Choix technique

**JavaScript vanilla, sans build step** (pas de Node/npm) : HTML + CSS + modules ES
+ IndexedDB + service worker.

- **Local d'abord** : IndexedDB est la mémoire de travail → saisie instantanée,
  fonctionne hors-ligne (salle).
- **Synchro** : la base complète est fusionnée avec un fichier JSON de TON Google
  Drive (`serie1-donnees.json`). Pas de serveur à nous, pas de compte à créer en
  plus du compte Google.
- **Hébergement** : fichiers statiques sur GitHub Pages (HTTPS, gratuit).
- **Installable** : `manifest.webmanifest` + service worker → « Installer l'application ».

## Mise en route

Une seule fois, ~30 min : dépôt GitHub public + GitHub Pages, identifiant Google
OAuth (portée `drive.file`, origines autorisées) copié dans `js/config.js`, puis
connexion de chaque appareil. Procédure détaillée :
[`manuel/01-mise-en-place.md`](manuel/01-mise-en-place.md) et
[`manuel/02-installer-et-relier.md`](manuel/02-installer-et-relier.md).

## Comment marche la synchro

- Chaque écriture est horodatée (`updatedAt`) ; chaque suppression laisse une
  trace (`tombstones`). À la synchro, on **fusionne par enregistrement** : la
  version la plus récente gagne, une suppression l'emporte sur une version plus
  ancienne. Deux appareils peuvent donc travailler chacun de leur côté.
- **Quand ?** Un tap sur la pastille ☁ de l'accueil. Ensuite, tant que la session
  Google est valide (~1 h), l'envoi est automatique quelques secondes après chaque
  modification. Hors-ligne, les modifs attendent.
- **Remplacements complets** (« Tout effacer », import d'une sauvegarde) : une
  fusion ferait revenir les anciennes données, donc l'app **demande quel côté
  garder** au lieu de décider seule. Drive conserve aussi les versions précédentes
  du fichier (clic droit → *Gérer les versions*).
- Le fichier Drive a le même format que l'export JSON : il se réimporte tel quel.

## Lancer en local (développement)

```bash
bash lancer.sh          # → http://localhost:8137
# ou : python3 -m http.server 8137
```

`file://` ne marche pas (modules ES + service worker exigent http).

## Fonctionnalités

- Logger une séance : exercices (catalogue ou création à la volée), charge / reps /
  durée / RPE par série, case « échauffement ».
- Dernière perf affichée **à la même position de série** pendant la saisie.
- Alerte quand une série atteint son seuil de reps, **indépendante des autres séries**.
- Historique par exercice + **graphe de la série 1** ; page Progression (un mini-graphe par exercice).
- Suivi corporel (mesures, courbes à l'échelle du temps).
- Niveau de force (🏆 Squat / Développé couché / Soulevé de terre / Hip thrust).
- Export **CSV** / **JSON**, import complet ou import de mesures.
- **Synchronisation Google Drive** téléphone ↔ ordinateur.

## Structure

```
index.html            coquille + chargement du module
manifest.webmanifest  métadonnées PWA
sw.js                 service worker (réseau d'abord, repli cache ; même origine seulement)
css/styles.css        UI sombre, mobile-first, gros boutons
js/config.js          identifiant client Google (synchro)
js/db.js              IndexedDB : écritures horodatées, traces de suppression, API brute de synchro
js/merge.js           fusion de deux photos de la base (fonction pure)
js/drive.js           transport Google Drive (connexion, lecture/écriture du fichier)
js/sync.js            orchestration de la synchro (époques, choix, envoi automatique)
js/store.js           logique métier (seuil, dernière perf/position, série 1)
js/standards.js       niveaux de force
js/mesures.js         suivi corporel
js/chart.js           graphes SVG
js/exchange.js        exports CSV/JSON + imports
js/ui.js              vues + routeur (hash)
js/app.js             démarrage
tools/                convertisseurs Python (carnet papier, mesures)
manuel/               guide utilisateur, un chapitre par fichier
private/              gitignoré : contexte perso + vraies données (jamais publié)
```

## Convertisseurs (`tools/`)

- `carnet_vers_json.py` : CSV de séances (modèle `carnet_modele.csv`, une ligne =
  une série) → JSON pour « Importer un JSON (tout) ».
- `mesures_vers_json.py` : CSV de suivi corporel → JSON pour « Importer des mesures ».

Mode d'emploi et format des colonnes :
[`manuel/07-sauvegardes-et-imports.md`](manuel/07-sauvegardes-et-imports.md).

## Développement

- Pas besoin de toucher `CACHE` dans `sw.js` pour une simple modification de
  contenu (réseau d'abord). L'incrémenter seulement si la liste `ASSETS` change.
- Ne jamais committer de données : vérifier `git status` avant un `git add`.
