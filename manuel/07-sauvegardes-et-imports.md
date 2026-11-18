# 7. Sauvegardes et imports

## Sauvegardes manuelles

En plus de la synchro Drive, toujours possibles dans **Réglages → Exporter** :

- **JSON** = sauvegarde complète (à réimporter dans l'app en cas de besoin).
- **CSV** = tableur, pour analyser tes données ailleurs.

## Restaurer une sauvegarde

**Réglages → ⤒ Importer un JSON (tout)** remplace **tout** le contenu de
l'appareil (séances, exercices, mesures). À la synchro suivante, l'app demandera
s'il faut aussi remplacer Drive ([chapitre 6](06-synchronisation.md#remplacements-complets)).

---

## Importer ton carnet papier

Pour transcrire tes anciennes séances d'un coup : tu remplis un tableur, et un
petit programme Python le convertit pour l'app. À faire sur l'ordinateur.

1. Copie le modèle `tools/carnet_modele.csv` dans `private/donnees/carnet.csv`
   (dossier privé, jamais publié) et remplis-le : **une ligne = une série**.
2. Colonnes : `date;exercice;position;poids;reps;duree;rpe;echauffement;seuil`
   - seules `date` et `exercice` sont obligatoires ;
   - chaque série a besoin d'au moins `reps` **ou** `duree` ;
   - `duree` s'écrit `1:30`, `90` ou `90s` ;
   - `echauffement` = `1`, `oui` ou `x` ;
   - `position` se numérote toute seule si vide ;
   - `seuil` : une seule fois par exercice suffit.
3. Depuis WSL, dans le dossier de l'app :
   ```bash
   python3 tools/carnet_vers_json.py private/donnees/carnet.csv --check   # vérifie + récap
   python3 tools/carnet_vers_json.py private/donnees/carnet.csv           # crée carnet.json à côté
   ```
4. Dans l'app : **Réglages → ⤒ Importer un JSON (tout)** → choisis
   `carnet.json`.

> ⚠️ Cet import **remplace** toutes les séances de l'appareil. Fais-le de
> préférence **avant** d'avoir noté des séances dans l'app, ou exporte d'abord
> un JSON de sécurité.

## Importer un historique de mesures

Pour charger un historique de suivi corporel (une ligne par date, une colonne
par mesure, ex. export de balance déjà converti en CSV) :

```bash
python3 tools/mesures_vers_json.py a.csv b.csv -o private/donnees/mesures.json
```

Le programme **fusionne** les mesures de même nom (ex. « Poids » présent dans
deux fichiers) et lit l'unité collée aux valeurs (`70.8 kg`, `17.7%`).

Puis dans l'app : **Réglages → ⤒ Importer des mesures**. Cet import est **non
destructif** : il ajoute, ignore les doublons, et peut être relancé sans risque.
Les mesures ajoutées partent ensuite à la synchro normalement.

---

## Données d'exemple

Pour découvrir l'app sans risque : **Réglages → ✨ Charger des données
d'exemple**. Ça ajoute des exercices et séances fictifs. Tu peux tout effacer
ensuite avec **Réglages → Tout effacer** (l'app demandera à la synchro suivante
quel côté garder).

---

Suite : [8. Dépannage](08-depannage.md).
