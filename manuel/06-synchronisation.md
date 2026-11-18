# 6. Synchronisation (téléphone ↔ ordinateur)

Tes données sont enregistrées sur l'appareil **et** dans un fichier de ton Google
Drive (`serie1-donnees.json`). C'est ce fichier qui met le téléphone et
l'ordinateur d'accord, et qui te protège si un appareil est perdu ou vidé.

Mise en place : [chapitre 2](02-installer-et-relier.md).

---

## La pastille ☁ (en haut de l'accueil)

| Ce qu'elle affiche | Ce que ça veut dire |
|---|---|
| ☁ Connecter Google Drive | appareil pas encore relié, ou session Google expirée → touche |
| ☁ Modifs à envoyer — toucher pour synchroniser | des changements attendent → un tap |
| ☁ À jour · synchro HH:MM | rien à faire |
| ⟳ Synchronisation… | en cours |
| ⚠ Synchro : un choix est nécessaire | voir « Remplacements complets » plus bas |
| ⚠ Synchro échouée — toucher pour réessayer | réseau ou Google indisponible → [Dépannage](08-depannage.md) |

## Les bons réflexes

- **En ouvrant l'app** : touche la pastille, pour récupérer ce que tu as fait
  sur l'autre appareil.
- **Pendant l'heure qui suit un tap**, l'envoi se fait **tout seul** quelques
  secondes après chaque modification. Au-delà, Google demande un nouveau tap
  (une petite fenêtre s'ouvre et se referme).
- **En salle sans réseau** : note ta séance normalement ; touche la pastille
  quand tu retrouves du réseau.

Le détail est aussi dans **Réglages → Synchronisation Google Drive** (état,
dernière synchro, bouton *Synchroniser maintenant*).

---

## Travailler des deux côtés

Si tu as modifié des choses sur les deux appareils entre deux synchros, l'app
**fusionne** : rien n'est perdu. Pour un même élément modifié des deux côtés,
la **version la plus récente** gagne. Une suppression l'emporte sur une version
plus ancienne.

## Remplacements complets

Après un **« Tout effacer »** ou l'**import d'une sauvegarde complète**, une
fusion ferait revenir les anciennes données. L'app **demande donc quel côté
garder** au lieu de décider seule :

- **Garder cet appareil (écrase Drive)** — l'autre appareil adoptera ces
  données à sa prochaine synchro ;
- **Garder Drive (remplace cet appareil)** — annule le remplacement local ;
- **Annuler** — rien n'est fait, la question reviendra.

Le même choix apparaît si un autre appareil a tout remplacé alors que celui-ci
avait des modifications non envoyées.

## Filet de sécurité : les versions Drive

Google Drive garde les **versions précédentes** du fichier : sur
drive.google.com, clic droit sur `serie1-donnees.json` → *Gérer les versions*.
Une ancienne version téléchargée se réimporte dans l'app (Réglages → **Importer
un JSON (tout)**) : le fichier Drive a le même format que l'export.

## Délier un appareil

**Réglages → Synchronisation → Options avancées → Délier cet appareil** : la
synchro s'arrête sur cet appareil. Les données restent sur l'appareil **et** sur
Drive.

---

Suite : [7. Sauvegardes et imports](07-sauvegardes-et-imports.md).
