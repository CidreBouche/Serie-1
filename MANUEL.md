# Manuel d'utilisation — Série 1

Guide simple, sans jargon. Cette app sert à noter tes séances de muscu et à voir
si tu **progresses vraiment**, surtout sur ta **première série** de chaque exercice.

---

## 1. Installer l'app (téléphone et ordinateur)

L'app est une page web hébergée à une adresse du type
`https://<ton-pseudo>.github.io/serie1/` (mise en place : voir `README.md`).

- **Téléphone Android (Chrome)** : ouvre l'adresse → menu ⋮ → *Installer
  l'application*. Une icône apparaît comme une vraie appli.
- **Ordinateur (Chrome ou Edge)** : ouvre la même adresse → icône d'installation
  dans la barre d'adresse (ou utilise-la simplement dans un onglet).

Une fois ouverte une première fois, elle marche **sans réseau** (pratique en salle).

---

## 2. Noter une séance

1. Écran d'accueil → **＋ Nouvelle séance**. La date du jour est mise
   automatiquement (tu peux la changer, utile pour rentrer une séance passée).
2. **＋ Ajouter un exercice** : tape les premières lettres. Trois possibilités :
   - ta liste d'exercices déjà créés ;
   - des **suggestions** (exercices courants tout prêts) ;
   - **＋ Créer « … »** pour inventer le tien.
3. Pour chaque série, remplis ce qui te concerne (voir le point suivant) puis
   **Ajouter S1**, **Ajouter S2**, etc. La position (S1, S2, S3…) s'incrémente
   toute seule.

> Astuce : au-dessus des cases, l'app te rappelle ta **dernière perf à la même
> position** (« Dernière S1 : 40 kg × 8 »). C'est ta référence pour te dépasser.

---

## 3. Les cases de saisie : Charge, Reps, Durée, RPE

Chaque série a **quatre champs, que tu peux utiliser ensemble ou séparément** —
c'est fait exprès pour que ça marche pour n'importe quel exercice :

| Champ | Ce que tu mets | Exemples |
|-------|----------------|----------|
| **Charge (kg)** | le poids soulevé. Pour un exercice au poids du corps, c'est le **lest ajouté** (0 = juste ton corps) | `40`, `0`, `15` |
| **Reps** | le nombre de répétitions | `8`, `12` |
| **Durée (min : sec)** | le temps de la série, si l'exercice se mesure en temps (optionnel) | `1 : 30`, `0 : 45` |
| **RPE (1–10)** | *optionnel* : à quel point la série était dure (voir plus bas) | `8`, `9.5` |

Exemples concrets :
- **Développé couché** : Charge `70`, Reps `8`.
- **Tractions au poids du corps** : Charge `0`, Reps `9`.
- **Tractions lestées +10 kg** : Charge `10`, Reps `6`.
- **Gainage** : Charge `0`, Reps vide, Durée `1 : 00`.

Règle : il faut au moins **des reps OU une durée** pour enregistrer une série.
La charge et le RPE sont toujours facultatifs.

### Séries d'échauffement

Coche **« Échauffement »** avant d'ajouter une série d'échauffement. Elle est
alors notée à part (« Éch », grisée) et **ne compte pas comme série de travail** :
- elle **ne prend pas de numéro** (ta 1ʳᵉ vraie série reste **S1**) ;
- elle est **exclue** du graphe de progression, de la série 1 et des alertes ↑.

C'est important : sans ça, un échauffement logué en premier serait pris pour ta
série 1 et fausserait toutes tes courbes.

### Le RPE, c'est quoi ?

Le **RPE** (*intensité perçue*, de 1 à 10) note **à quel point la série était
dure**, en pensant au nombre de répétitions que tu aurais encore pu faire :

- **RPE 10** = maximal, tu n'aurais pas pu en faire une de plus.
- **RPE 9** = il te restait 1 rep.
- **RPE 8** = il te restait 2 reps.
- **7 ou moins** = confortable.

C'est utile pour savoir si un même poids devient plus facile au fil des semaines.
Purement optionnel : laisse la case vide si tu ne veux pas t'en occuper.

---

## 4. L'alerte « ↑ monte » (surcharge progressive)

Chaque exercice a un **seuil de répétitions** (par défaut 10, réglable). Quand
une série atteint ce seuil, l'app affiche un badge **↑ monte** : ça veut dire
*« cette série-là est prête à passer à une charge supérieure la prochaine fois »*.

Le point important : **chaque position de série est indépendante**. Si ta
série 1 est prête à monter, tu montes la charge de la série 1 — sans attendre que
les séries 2, 3, 4 suivent. C'est la clé pour ne plus stagner.

Pour changer le seuil d'un exercice : ouvre-le (tape son nom dans une séance ou
va dans **Exercices**), règle *Seuil de reps* puis **Enregistrer**.

### Ton niveau de force 🏆

Quatre exercices de référence sont rattachés aux standards de force. Ils portent
un nom **précis** (et un **🏆** apparaît à côté du nom quand le lien est actif) :
- **Squat arrière barre libre**
- **Développé couché barre libre**
- **Soulevé de terre conventionnel barre droite**
- **Hip thrust barre libre**

Sur leur détail, l'app affiche ton **niveau** (Novice → Champion) : elle estime
ton 1RM (max sur 1 rep) depuis ta meilleure série 1, le rapporte à ton **poids de
corps** (via 📏 Mesures) et te donne le **prochain palier** à viser.

Pourquoi des noms si précis ? Parce qu'un développé **aux haltères** ou un squat
**à la machine** ne se comparent pas aux mêmes barèmes. Si tu nommes ton exercice
autrement (ex. « Développé couché haltère »), **pas de 🏆, pas de comparaison** —
c'est voulu, ça évite de fausser tes chiffres.

Pour activer : choisis ton **sexe** dans **Réglages → Profil** et enregistre au
moins un **Poids** dans les Mesures (le poids retenu est celui connu **à la date
de la séance**). *(Les standards du Hip thrust sont indicatifs, moins normalisés
que le SBD.)*

---

## 5. Voir sa progression

**Vue d'ensemble** — bouton **📈 Progression** sur l'accueil : un mini-graphe par
exercice, tous sur un seul écran, pour voir d'un coup d'œil où tu progresses.
Chaque carte montre la valeur actuelle et le gain **depuis le début**
(ex. `34 kg ▲ +4`). Tape une carte pour ouvrir le détail.

**Détail d'un exercice** — ouvre-le (depuis **Exercices**, la page Progression,
ou en tapant son nom dans une séance) :
- un **graphe en grand** de ta **série 1** dans le temps ;
- l'**historique** de toutes tes séances sur cet exercice.

> La courbe suit automatiquement ce qui progresse : la **charge** en général,
> mais les **reps** ou la **durée** pour un exercice fait au poids du corps pur
> (charge toujours à 0) ou en gainage. Le petit texte sous le titre te dit lequel
> (« série 1 · charge », « · reps » ou « · durée »).

### Note permanente par exercice

Dans le détail d'un exercice, la **Note permanente** te sert de mémo qui reste
(ex. réglages machine : « siège 4, dossier 2, poignée large »). Elle s'affiche
ensuite en rappel 📌 sur la carte de l'exercice **pendant la séance**. À ne pas
confondre avec les « Notes de séance », qui sont ponctuelles.

---

## 6. Suivi corporel (Mesures)

Bouton **📏 Mesures** sur l'accueil, pour suivre poids, tours (taille, bras,
cuisse…), masse grasse, etc.

- **＋ Nouvelle prise de mesures** : tu choisis une date et tu remplis d'un coup
  toutes les mesures que tu as prises ce jour-là (laisse vide celles non prises).
- **Ajouter une mesure** : choisis dans les suggestions (unité pré-remplie) ou
  tape un nom perso ; pour une mesure perso, choisis l'unité dans la liste
  (`cm`, `kg`, `%`…) ou tape la tienne via « Autre… ».
- Chaque mesure a sa **courbe dans le temps** (axe à l'échelle des dates réelles)
  et son historique. La tendance « depuis le début » est affichée **sans juger**
  (monter/descendre dépend de ton objectif).

---

## 7. Synchronisation et sauvegarde

### Synchronisation Google Drive (téléphone ↔ ordinateur)

Tes données sont enregistrées sur l'appareil **et** dans un fichier de ton Google
Drive (`serie1-donnees.json`). C'est ce fichier qui met le téléphone et
l'ordinateur d'accord, et qui te protège si un appareil est perdu ou vidé.

- **Première fois, sur chaque appareil** : touche **☁ Connecter Google Drive**
  sur l'accueil et accepte dans la fenêtre Google.
- **Au quotidien** : la pastille ☁ en haut de l'accueil te dit où tu en es.
  - *« À jour »* : rien à faire.
  - *« Modifs à envoyer — toucher »* : un tap et c'est synchronisé.
  - Pendant l'heure qui suit un tap, l'envoi se fait **tout seul** après chaque
    modification. Au-delà, Google demande un nouveau tap (une petite fenêtre
    s'ouvre et se referme).
- **En salle sans réseau** : note ta séance normalement ; touche la pastille
  quand tu retrouves du réseau.
- **Bon réflexe** : touche la pastille en ouvrant l'app, pour récupérer ce que tu
  as fait sur l'autre appareil.

Si tu as travaillé des deux côtés, l'app **fusionne** : rien n'est perdu, et pour
une même série modifiée deux fois, la plus récente gagne.

Cas particulier : après un **« Tout effacer »** ou l'**import d'une sauvegarde
complète**, l'app te demande quel côté garder (cet appareil ou Drive) au lieu de
décider seule. En cas d'erreur, Google Drive garde les versions précédentes du
fichier (clic droit sur le fichier → *Gérer les versions*).

### Sauvegardes manuelles

Toujours possibles dans **Réglages → Exporter** :

- **JSON** = sauvegarde complète (à réimporter dans l'app en cas de besoin).
- **CSV** = tableur, pour analyser tes données ailleurs.
- **Importer un JSON (tout)** remplace **tout** le contenu de l'appareil — pour
  restaurer une sauvegarde ou charger tes anciennes données papier.

Pour transcrire ton carnet papier d'un coup, voir `README.md` (section
« Importer ton carnet papier ») : tu remplis un tableur et un petit programme le
convertit pour l'app.

---

## 8. Données d'exemple

Pour découvrir l'app sans risque : **Réglages → ✨ Charger des données
d'exemple**. Ça ajoute des exercices et séances fictifs. Tu peux tout effacer
ensuite avec **Réglages → Tout effacer**.
