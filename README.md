# Série 1 — Suivi de musculation (PWA)

Application personnelle centrée sur le signal qui compte : **la progression de la
série 1 de chaque exercice**, avec alerte de surcharge progressive **par position
de série indépendamment** (cf. `CLAUDE.md`).

Cibles : **téléphone Android** (Chrome) et **ordinateur** (Chrome / Edge), avec les
mêmes données des deux côtés grâce à une **synchronisation Google Drive**.

> 📖 Guide pas-à-pas pour l'utilisation quotidienne (non technique) : **`MANUEL.md`**.

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

## Mise en route (une seule fois)

### 1. Publier l'app sur GitHub Pages

Le téléphone a besoin de l'app en **HTTPS** pour l'installer et l'utiliser
hors-ligne (l'adresse locale `http://<IP-du-PC>:8137` ne le permet pas).

1. Crée un dépôt **public** sur github.com (ex. `serie1`). Le dépôt ne contient
   que le code : `.gitignore` exclut le dossier `private/` (contexte perso et
   vraies données).
2. Dans ce dossier, depuis WSL :
   ```bash
   git init && git add . && git commit -m "Série 1"
   git remote add origin https://github.com/<ton-pseudo>/serie1.git
   git push -u origin master
   ```
3. Sur GitHub : **Settings → Pages → Deploy from a branch → `master` / `(root)`**.
4. Après une minute, l'app est sur `https://<ton-pseudo>.github.io/serie1/`.

Ensuite, chaque `git push` met l'app à jour (le service worker est en « réseau
d'abord » : la nouvelle version arrive au lancement suivant).

### 2. Créer l'identifiant Google pour la synchro (~10 min)

Les libellés de la console Google changent souvent ; l'esprit reste le même.

1. Va sur <https://console.cloud.google.com> → crée un **projet** (ex. « Serie1 »).
2. **API et services → Bibliothèque** → cherche **Google Drive API** → **Activer**.
3. **Google Auth Platform** (écran de consentement OAuth) → **Premiers pas** :
   nom de l'app, ton e-mail, audience **Externe**.
4. **Accès aux données** → ajoute le niveau d'accès `.../auth/drive.file`
   (« fichiers créés par cette application » — l'app ne voit rien d'autre de ton Drive).
5. **Audience → Publier l'application** (passer « En production »). Avec ce seul
   niveau d'accès, non sensible, Google ne devrait pas exiger de validation. Si tu
   restes en mode « Test », ajoute-toi en utilisateur test : ça marche, mais Google
   te redemandera ton accord tous les 7 jours.
6. **Clients → Créer un client → Application Web**. Dans **Origines JavaScript
   autorisées**, ajoute :
   - `https://<ton-pseudo>.github.io`
   - `http://localhost:8137` (pour tester en local sur le PC)
7. Copie l'**ID client** (`xxxx.apps.googleusercontent.com`) dans `js/config.js`
   (`GOOGLE_CLIENT_ID`), puis `git commit` + `git push`. Ce n'est pas un secret.
   (Variante sans commit : le coller dans Réglages → Synchronisation → Options avancées.)

### 3. Relier les appareils

Sur le PC puis sur le téléphone : ouvre l'app, touche **☁ Connecter Google Drive**,
accepte dans la fenêtre Google. Le premier appareil crée le fichier ; les suivants
récupèrent tout.

Sur le téléphone : Chrome → menu ⋮ → **Installer l'application**.
Sur le PC : icône d'installation dans la barre d'adresse de Chrome/Edge.

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
private/              gitignoré : contexte perso + vraies données (jamais publié)
```

## Importer ton carnet papier

`tools/carnet_vers_json.py` convertit un CSV (une ligne = une série) en JSON
importable. Remplis un CSV sur le modèle de `tools/carnet_modele.csv`, rangé
dans `private/donnees/` (hors dépôt), puis :

```bash
python3 tools/carnet_vers_json.py private/donnees/carnet.csv --check   # valide + récap
python3 tools/carnet_vers_json.py private/donnees/carnet.csv           # -> carnet.json à côté
```

Colonnes : `date;exercice;position;poids;reps;duree;rpe;echauffement;seuil`
(seules `date` et `exercice` sont obligatoires ; chaque série a besoin d'au moins
`reps` **ou** `duree` ; `duree` s'écrit `1:30`, `90` ou `90s` ; `echauffement`
= `1`/`oui`/`x` ; la position se numérote toute seule si vide ; `seuil` une seule
fois par exercice). Puis : Réglages → **Importer un JSON (tout)**.

> ⚠️ Cet import **remplace** toutes les séances de l'appareil. À la synchro
> suivante, l'app demandera s'il faut aussi remplacer Drive.

## Importer un historique de mesures corporelles

`tools/mesures_vers_json.py` convertit un/des CSV de suivi corporel (une ligne
par date, une colonne par mesure) en JSON de mesures :

```bash
python3 tools/mesures_vers_json.py a.csv b.csv -o private/donnees/mesures.json
```

Il **fusionne** les mesures de même nom et extrait l'unité collée aux valeurs.
Puis : Réglages → **Importer des mesures** — import **non destructif** (ajoute,
dédoublonne, ré-importable sans risque), qui part ensuite à la synchro normalement.

## Développement

- Pas besoin de toucher `CACHE` dans `sw.js` pour une simple modification de
  contenu (réseau d'abord). L'incrémenter seulement si la liste `ASSETS` change.
- Ne jamais committer de données : vérifier `git status` avant un `git add`.
