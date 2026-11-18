# 2. Installer et relier les appareils

Prérequis : l'app est en ligne et l'identifiant Google est en place
([chapitre 1](01-mise-en-place.md)). Compter ~10 min, avec le PC et le
téléphone sous la main.

---

## Installer l'app

- **Téléphone Android (Chrome)** : ouvre `https://<pseudo>.github.io/<dépôt>/`
  → menu ⋮ → **Installer l'application** (ou *Ajouter à l'écran d'accueil*).
  Une icône apparaît, comme une vraie appli.
- **Ordinateur (Chrome ou Edge)** : ouvre la même adresse → icône d'installation
  dans la barre d'adresse. Ou utilise-la simplement dans un onglet.

Une fois ouverte une première fois, elle marche **sans réseau** (pratique en salle).

---

## Relier le premier appareil (crée le fichier Drive)

Commence par l'ordinateur :

1. Ouvre l'app. En haut de l'accueil : la pastille **☁ Connecter Google Drive**.
2. Touche-la → une fenêtre Google s'ouvre → choisis ton compte → accepte.
   - Si Google affiche « Google n'a pas validé cette application » :
     **Paramètres avancés → Accéder à …**. C'est ta propre app.
3. La pastille passe à **☁ À jour · synchro HH:MM**.
4. Vérifie sur <https://drive.google.com> : le fichier **`serie1-donnees.json`**
   est apparu.

## Relier le deuxième appareil

Sur le téléphone, même chose avec **le même compte Google**. L'app trouve le
fichier existant et récupère tout.

> Si les **deux** appareils contenaient déjà des données, l'app demande quoi
> faire : **Fusionner les deux** (recommandé : rien n'est perdu), garder Drive,
> ou garder cet appareil.

---

## Tester la synchro (recommandé la première fois)

### PC → téléphone
1. Sur le PC, crée une séance de test (ex. exercice « Test synchro », une série).
   ~4 secondes après, la pastille repasse à « À jour ».
2. Sur le téléphone, touche la pastille ☁ : la séance apparaît.

### Téléphone → PC
1. Sur le téléphone, ajoute une série à la séance de test.
2. Sur le PC, touche la pastille ☁ : la série apparaît.

> Pourquoi toucher la pastille ? La connexion Google n'est gardée qu'en mémoire
> (~1 h) et se perd à la fermeture de l'app. À l'ouverture, l'app ne va donc pas
> chercher les nouveautés toute seule : c'est le tap qui lance la synchro.

### Suppressions
Supprime la séance de test sur un appareil, puis touche la pastille sur
l'autre : elle disparaît des deux côtés. Ça nettoie au passage.

### L'app installée sur le téléphone
Ouvre l'app **depuis son icône** (pas depuis Chrome) et touche la pastille : la
fenêtre Google doit s'ouvrir puis revenir à l'app. C'est le cas le plus capricieux
selon les téléphones.

---

Ça coince ? → [8. Dépannage](08-depannage.md).
Suite : [3. Noter une séance](03-noter-une-seance.md).
