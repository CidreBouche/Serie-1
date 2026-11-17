#!/usr/bin/env python3
"""
carnet_vers_json.py — transforme un CSV de carnet papier en JSON importable
dans l'app « Série 1 » (Réglages → Importer un JSON).

Tu remplis un CSV simple (une ligne = une série), le script génère la structure
imbriquée (exercices / seances / series) avec les bons id et clés étrangères.

--- Format du CSV attendu -----------------------------------------------------
Séparateur : ';' ou ',' (auto-détecté). Encodage UTF-8. Une ligne d'en-tête.

Colonnes reconnues (ordre libre, insensible à la casse/accents) :
  date       (obligatoire)  ex. 2025-09-15   ou  15/09/2025
  exercice   (obligatoire)  ex. Dips lestées
  position   (optionnel)    1, 2, 3…  — si vide, numéroté automatiquement
                            dans l'ordre des lignes, par (date, exercice)
  poids      (semi-oblig.)  ex. 32.5  ou  32,5   (0 = poids du corps ; charge/lest)
  reps       (semi-oblig.)  ex. 8
  duree      (semi-oblig.)  ex. 1:30  ou  90  ou  90s   (durée d'une série)
  rpe          (optionnel)  ex. 8.5
  echauffement (optionnel)  1 / oui / x → série d'échauffement (exclue série 1,
                            graphes et seuils ; ne consomme pas de numéro de série)
  seuil        (optionnel)  seuil de reps de l'exercice (déf. 10)

Chaque série doit avoir AU MOINS un « reps » ou une « duree ».
(Ni groupe musculaire ni type d'exercice : volontairement retirés du modèle.)

Toutes les lignes d'une même DATE sont regroupées dans une seule séance.
Le « seuil » peut n'être renseigné que sur une seule ligne de l'exercice ;
il s'applique alors à toutes ses lignes.

--- Utilisation ---------------------------------------------------------------
  python3 carnet_vers_json.py carnet.csv                 # -> carnet.json
  python3 carnet_vers_json.py carnet.csv -o sortie.json
  python3 carnet_vers_json.py carnet.csv --check         # valide sans écrire

⚠️ L'import dans l'app REMPLACE toutes les données existantes. Fais-le une fois,
   ou pars d'un export JSON de l'app si tu veux fusionner à la main.
"""
import argparse
import csv
import io
import json
import re
import sys
import unicodedata

SEUIL_DEFAUT = 10


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm_key(s):
    return strip_accents((s or "").strip().lower())


def slug(s):
    s = strip_accents((s or "").strip().lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "x"


def parse_duree(v):
    """« 1:30 » | « 90 » | « 90s » | « 1m30 » -> secondes (int). Vide -> 0."""
    v = (v or "").strip().lower().replace(" ", "")
    if v == "":
        return 0
    m = re.match(r"^(\d+):(\d{1,2})$", v)          # 1:30
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    m = re.match(r"^(\d+)m(\d{1,2})?s?$", v)        # 1m30 / 1m
    if m:
        return int(m.group(1)) * 60 + int(m.group(2) or 0)
    m = re.match(r"^(\d+)s$", v)                     # 90s
    if m:
        return int(m.group(1))
    if v.isdigit():                                  # 90 (secondes)
        return int(v)
    raise ValueError(f"durée invalide : « {v} » (attendu 1:30, 90, 90s ou 1m30)")


def parse_date(v):
    v = (v or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        return v
    m = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$", v)  # JJ/MM/AAAA
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    raise ValueError(f"date invalide : « {v} » (attendu AAAA-MM-JJ ou JJ/MM/AAAA)")


def parse_num(v, champ, ligne, autoriser_vide=False):
    v = (v or "").strip().replace(",", ".")
    if v == "":
        if autoriser_vide:
            return None
        raise ValueError(f"ligne {ligne} : « {champ} » manquant")
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except ValueError:
        raise ValueError(f"ligne {ligne} : « {champ} » n'est pas un nombre (« {v} »)")


def detect_dialect(sample):
    # ';' prioritaire (Excel FR), sinon ','
    return ";" if sample.count(";") >= sample.count(",") else ","


def build(rows, sep):
    reader = csv.DictReader(io.StringIO(rows), delimiter=sep)
    if not reader.fieldnames:
        raise ValueError("CSV vide ou sans en-tête")

    # mappe les en-têtes réels -> noms canoniques
    canon = {}
    for f in reader.fieldnames:
        k = norm_key(f)
        if k in ("date",):
            canon[f] = "date"
        elif k in ("exercice", "exo", "nom"):
            canon[f] = "exercice"
        elif k in ("position", "serie", "pos"):
            canon[f] = "position"
        elif k in ("poids", "poids_kg", "charge", "kg"):
            canon[f] = "poids"
        elif k in ("reps", "rep", "repetitions"):
            canon[f] = "reps"
        elif k in ("duree", "durée", "temps", "duration"):
            canon[f] = "duree"
        elif k in ("rpe",):
            canon[f] = "rpe"
        elif k in ("echauffement", "échauffement", "warmup", "ech"):
            canon[f] = "echauffement"
        elif k in ("seuil", "seuil_reps"):
            canon[f] = "seuil"

    besoins = {"date", "exercice"}
    presents = set(canon.values())
    manque = besoins - presents
    if manque:
        raise ValueError(
            f"colonnes obligatoires manquantes : {', '.join(sorted(manque))}. "
            f"En-têtes lus : {', '.join(reader.fieldnames)}"
        )
    if not ({"reps", "duree"} & presents):
        raise ValueError(
            "il faut au moins une colonne « reps » ou « duree ». "
            f"En-têtes lus : {', '.join(reader.fieldnames)}"
        )

    exercices = {}   # nom -> dict
    seances = {}     # date -> dict
    series = []
    compteur_pos = {}  # (date, nom) -> prochaine position auto
    t = 1_700_000_000_000  # base createdAt (incrémenté pour garder l'ordre)

    for i, raw in enumerate(reader, start=2):  # start=2 : ligne 1 = en-tête
        row = {canon.get(k, k): v for k, v in raw.items()}
        if not (row.get("date") or "").strip() and not (row.get("exercice") or "").strip():
            continue  # ligne vide

        date = parse_date(row.get("date"))
        nom = (row.get("exercice") or "").strip()
        if not nom:
            raise ValueError(f"ligne {i} : exercice manquant")
        poids = parse_num(row.get("poids"), "poids", i, autoriser_vide=True) or 0
        reps = parse_num(row.get("reps"), "reps", i, autoriser_vide=True) or 0
        duree = parse_duree(row.get("duree"))
        rpe = parse_num(row.get("rpe"), "rpe", i, autoriser_vide=True)
        ech = (row.get("echauffement") or "").strip().lower() in ("1", "oui", "o", "x", "yes", "true", "vrai", "echauffement", "warmup")
        if reps <= 0 and duree <= 0:
            raise ValueError(f"ligne {i} : renseigne au moins « reps » ou « duree »")

        # exercice (créé une fois, métadonnées prises au premier passage non vide)
        if nom not in exercices:
            exercices[nom] = {
                "id": "ex-" + slug(nom),
                "nom": nom,
                "seuil": SEUIL_DEFAUT,
                "createdAt": t,
            }
            t += 1
        ex = exercices[nom]
        if (row.get("seuil") or "").strip():
            ex["seuil"] = parse_num(row.get("seuil"), "seuil", i)

        # séance (une par date)
        if date not in seances:
            seances[date] = {"id": "se-" + date, "date": date, "notes": "", "createdAt": t}
            t += 1

        # position : un échauffement ne consomme pas de numéro (position 0) ;
        # sinon explicite, ou auto-incrémentée par date+exercice (travail seul).
        if ech:
            position = 0
        else:
            pos_raw = (row.get("position") or "").strip()
            if pos_raw:
                position = int(parse_num(pos_raw, "position", i))
            else:
                key = (date, nom)
                position = compteur_pos.get(key, 0) + 1
            compteur_pos[(date, nom)] = position

        series.append({
            "id": f"sr-{len(series)+1:05d}",
            "seanceId": seances[date]["id"],
            "exerciceId": ex["id"],
            "position": position,
            "poids": poids,
            "reps": reps,
            "dureeSec": duree,
            "rpe": rpe,
            "echauffement": ech,
            "createdAt": t,
        })
        t += 1

    return {
        "app": "serie1",
        "version": 1,
        "exercices": list(exercices.values()),
        "seances": sorted(seances.values(), key=lambda s: s["date"]),
        "series": series,
    }


def main():
    # Console Windows en cp1252 : on force l'UTF-8 pour l'affichage (✓, accents).
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

    ap = argparse.ArgumentParser(description="Carnet CSV -> JSON importable dans l'app Série 1")
    ap.add_argument("csv", help="fichier CSV du carnet")
    ap.add_argument("-o", "--out", help="fichier JSON de sortie (déf. même nom en .json)")
    ap.add_argument("--check", action="store_true", help="valide et affiche un récap sans écrire")
    args = ap.parse_args()

    try:
        with open(args.csv, "r", encoding="utf-8-sig") as f:
            contenu = f.read()
    except OSError as e:
        sys.exit(f"Impossible de lire {args.csv} : {e}")

    sep = detect_dialect(contenu.splitlines()[0] if contenu.strip() else "")
    try:
        data = build(contenu, sep)
    except ValueError as e:
        sys.exit(f"Erreur : {e}")

    print(f"✓ {len(data['exercices'])} exercices, "
          f"{len(data['seances'])} séances, {len(data['series'])} séries "
          f"(séparateur détecté : « {sep} »)")
    for ex in data["exercices"]:
        n = sum(1 for s in data["series"] if s["exerciceId"] == ex["id"])
        print(f"   • {ex['nom']} [seuil {ex['seuil']}] — {n} séries")

    if args.check:
        return

    out = args.out or re.sub(r"\.csv$", "", args.csv, flags=re.I) + ".json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"→ écrit : {out}")
    print("  Importe-le dans l'app : Réglages → Importer un JSON")


if __name__ == "__main__":
    main()
