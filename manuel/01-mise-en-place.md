# 1. Mettre l'app en ligne

À faire **une seule fois**, depuis l'ordinateur. Compter ~30 min en tout.

Pourquoi en ligne ? Le téléphone n'accepte d'installer l'app et de la faire
marcher hors-ligne que si elle est servie en **HTTPS**. GitHub Pages fournit ça
gratuitement. Les **données**, elles, ne passent jamais par GitHub : elles
restent sur tes appareils et dans ton Google Drive.

Dans ce chapitre, remplace `<pseudo>` par ton nom d'utilisateur GitHub et
`<dépôt>` par le nom du dépôt.

---

## Étape A — Créer le dépôt sur GitHub

Sur <https://github.com> → **New repository** :

| Champ | Valeur |
|---|---|
| Repository name | le nom de ton choix (il apparaîtra dans l'adresse de l'app) |
| Visibility | **Public** — obligatoire pour GitHub Pages gratuit |
| Add a README / .gitignore / license | **ne rien cocher** : le dossier local a déjà ces fichiers, GitHub refuserait le premier envoi |

→ **Create repository**. GitHub affiche alors l'adresse du dépôt
(`https://github.com/<pseudo>/<dépôt>.git`).

> Public veut dire que **le code** est visible de tous. C'est sans risque : le
> fichier `.gitignore` exclut le dossier `private/` (contexte perso, vraies
> données), et aucune donnée de séance n'est dans le code.

## Étape B — Envoyer le code

Toutes les commandes Git se lancent **depuis WSL** (terminal Ubuntu), dans le
dossier de l'app. Depuis Windows, Git refuse avec « dubious ownership ».

```bash
cd ~/forme_physique/app
git init
git branch -M master
git status            # vérifier : aucun dossier private/, aucun .json de données
git add .
git commit -m "Série 1"
git remote add origin https://github.com/<pseudo>/<dépôt>.git
git push -u origin master
```

- Si `git remote add` répond « remote origin already exists », corrige
  l'adresse : `git remote set-url origin https://github.com/<pseudo>/<dépôt>.git`.
- Si Git demande un mot de passe : GitHub n'accepte plus le mot de passe du
  compte, il faut un **jeton** (GitHub → Settings → Developer settings →
  Personal access tokens) ou le gestionnaire d'identifiants de Git.

## Étape C — Activer GitHub Pages

Sur la page du dépôt : **Settings → Pages** :

1. **Source** : *Deploy from a branch*.
2. **Branch** : `master` et dossier `/ (root)` → **Save**.
3. Attendre 1 à 2 minutes (onglet **Actions** : « pages build and deployment »
   doit passer au vert).
4. L'adresse s'affiche en haut de la page Pages :
   **`https://<pseudo>.github.io/<dépôt>/`**. Ouvre-la : l'app doit s'afficher.

> Le fichier vide `.nojekyll` du dépôt dit à GitHub de servir les fichiers tels
> quels, sans les transformer.

---

## Étape D — Créer l'identifiant Google (pour la synchro)

C'est ce qui permet à l'app d'écrire **un fichier dans ton Google Drive**, et
rien d'autre. Les libellés de la console Google changent souvent ; l'esprit
reste le même.

### D1. Le projet et l'API

1. Va sur <https://console.cloud.google.com> avec ton compte Google.
2. En haut, sélecteur de projet → **Nouveau projet** → un nom (ex. « Serie1 »)
   → **Créer**, puis sélectionne-le.
3. Menu ☰ → **API et services → Bibliothèque** → cherche **Google Drive API**
   → **Activer**.

### D2. L'écran de consentement

C'est la fenêtre que Google affichera en te demandant ton accord.

1. Menu ☰ → **Google Auth Platform** (ou *Écran de consentement OAuth*) →
   **Premiers pas** :
   - nom de l'application (ex. « Série 1 ») ;
   - e-mail d'assistance : le tien ;
   - audience : **Externe** ;
   - coordonnées : ton e-mail → accepter les conditions → **Créer**.
2. **Accès aux données** → *Ajouter ou supprimer des niveaux d'accès* →
   cherche `drive.file` → coche **`.../auth/drive.file`** (« voir, modifier,
   créer et supprimer uniquement les fichiers Google Drive que vous utilisez
   avec cette application ») → **Mettre à jour** → **Enregistrer**.
   L'app ne verra **que le fichier qu'elle crée**, pas le reste de ton Drive.
3. **Audience** → **Publier l'application** → confirmer (statut « En
   production »). Avec ce seul niveau d'accès, Google n'exige pas de validation.
   - Si tu restes en mode **Test** : ajoute ton adresse dans *Utilisateurs
     test*. Ça marche, mais Google redemandera ton accord **tous les 7 jours**.

### D3. Le client OAuth

1. **Clients** → **Créer un client** → type **Application Web** → un nom (ex.
   « Série 1 web »).
2. **Origines JavaScript autorisées** → *Ajouter un URI*, deux fois :
   - `https://<pseudo>.github.io` — **exactement** ça : en minuscules, sans le
     nom du dépôt, sans `/` à la fin ;
   - `http://localhost:8137` — pour tester sur le PC (voir `README.md`).
3. **URI de redirection autorisés** : rien (l'app utilise une petite fenêtre,
   pas de redirection).
4. **Créer**. Google affiche l'**ID client** (`xxxx.apps.googleusercontent.com`)
   et un **code secret** : copie l'ID ; le code secret **ne sert pas**, ne le
   copie nulle part.

> Une origine ajoutée ou modifiée peut mettre **quelques minutes** à être prise
> en compte par Google.

### D4. Mettre l'ID dans l'app

Ouvre `js/config.js` et colle l'ID :

```js
export const GOOGLE_CLIENT_ID = 'xxxx.apps.googleusercontent.com';
```

Puis, depuis WSL :

```bash
git add js/config.js
git commit -m "Identifiant Google pour la synchro"
git push
```

**Pourquoi l'ID peut être public ?** Ce n'est pas un mot de passe : c'est
l'équivalent d'un nom d'application, et il est de toute façon lisible par
n'importe qui dans le code de la page. Ce qui protège ton compte, c'est
(1) la liste des **origines autorisées** — Google refuse l'ID venant d'un autre
site — et (2) **ton accord** dans la fenêtre Google. Le code secret, lui, ne doit
jamais être publié : c'est pour ça que l'app n'en a pas besoin.

> Variante sans commit : coller l'ID dans l'app, **Réglages → Synchronisation →
> Options avancées**. Il faut alors le faire sur chaque appareil.

---

## Et ensuite ?

- Chaque `git push` met l'app en ligne à jour en 1 à 2 minutes. Les appareils
  récupèrent la nouvelle version **au lancement suivant** (l'app cherche
  toujours la version en ligne d'abord, et se rabat sur sa copie locale
  hors-ligne).
- Suite : [2. Installer et relier les appareils](02-installer-et-relier.md).
