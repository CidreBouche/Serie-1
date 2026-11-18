# 8. Dépannage

## Connexion Google

| Message / symptôme | Cause | Solution |
|---|---|---|
| `origin_mismatch`, `redirect_uri_mismatch`, « Erreur 400 » | l'adresse de l'app n'est pas dans les **origines autorisées** du client OAuth | console Google → Clients → ton client → ajouter `https://<pseudo>.github.io` (minuscules, sans chemin, sans `/` final). Attendre quelques minutes |
| « Accès bloqué : … en cours de test », `access_denied` | app Google en mode **Test** et ton compte n'est pas utilisateur test | Audience → **Publier l'application**, ou ajouter ton adresse en utilisateur test |
| « Google n'a pas validé cette application » | normal pour une app perso | **Paramètres avancés → Accéder à …** |
| Rien ne s'ouvre quand tu touches la pastille | fenêtre pop-up bloquée | autoriser les pop-ups pour le site (icône dans la barre d'adresse) |
| Accord redemandé chaque semaine | app restée en mode **Test** | la publier ([chapitre 1, D2](01-mise-en-place.md#d2-lécran-de-consentement)) |
| Pas de pastille ☁ sur l'accueil | aucun identifiant Google configuré | [chapitre 1, étape D](01-mise-en-place.md#étape-d--créer-lidentifiant-google-pour-la-synchro) |

## Synchro

| Symptôme | Que faire |
|---|---|
| ⚠ Synchro échouée | vérifier le réseau, retoucher la pastille. Le message exact est dans **Réglages → Synchronisation** |
| Les données de l'autre appareil n'apparaissent pas | toucher la pastille **sur les deux** : d'abord celui qui a les nouveautés (envoi), puis l'autre (réception) |
| Données disparues ou en double après une mauvaise manip | récupérer une ancienne version du fichier sur Drive ([chapitre 6](06-synchronisation.md#filet-de-sécurité--les-versions-drive)) |
| Fichier `serie1-donnees.json` supprimé de Drive par erreur | le restaurer depuis la corbeille Drive ; sinon, le prochain appareil qui synchronise en recrée un avec ses données |

## Mises à jour de l'app

| Symptôme | Que faire |
|---|---|
| L'ancienne version s'affiche après un `git push` | attendre 1–2 min (déploiement GitHub Pages), puis fermer et rouvrir l'app (Ctrl+F5 sur PC) |
| La page GitHub Pages affiche une erreur 404 | vérifier **Settings → Pages** (`master` / `(root)`) et l'onglet **Actions** |

## Git

| Message | Que faire |
|---|---|
| `detected dubious ownership` | lancer Git **depuis WSL**, pas depuis Windows |
| `remote origin already exists` | `git remote set-url origin https://github.com/<pseudo>/<dépôt>.git` |
| Demande de mot de passe refusée au `git push` | utiliser un jeton GitHub (Settings → Developer settings → Personal access tokens) |

---

Toujours bloqué ? Note le **texte exact** du message (ou fais une capture) : c'est
ce qui permet de trouver la cause.
