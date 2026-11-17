#!/usr/bin/env python3
"""
mesures_vers_json.py — convertit un/des CSV de suivi corporel en JSON de mesures
importable dans l'app « Série 1 » (Réglages → Importer des mesures).

Cible des CSV **déjà convertis** (propres) : une ligne par date, une colonne par
mesure. Les exports bruts d'une balance connectée (ex. xls Fitdays) doivent être
convertis en CSV au préalable.

Format d'entrée attendu :
- 1 colonne de date (en-tête contenant « date »), au format « JJ/MM/AAAA » ou
  « HH:MM JJ/MM/AAAA » (l'heure est ignorée).
- Chaque autre colonne = une mesure ; son en-tête = le nom de la mesure.
- Les valeurs peuvent avoir l'unité collée : « 70.8 kg », « 17.7% », « 69bpm ».
- Colonnes ignorées : Étape, Notes.

Fusion : plusieurs fichiers → les mesures de **même nom** (ex. « Poids ») sont
regroupées en une seule série. La casse/accents sont normalisés pour la fusion.

Utilisation :
  python3 mesures_vers_json.py a_converti.csv [b_converti.csv ...] -o mesures.json
  python3 mesures_vers_json.py *.csv --check
"""
import argparse
import csv
import json
import re
import sys
import unicodedata

IGNORER = {"etape", "note", "notes"}  # colonnes non-mesure (normalisées)


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")


def norm(s):
    return strip_accents((s or "").strip().lower())


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", norm(s)).strip("-")
    return s or "x"


def parse_date(v):
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", v or "")
    if not m:
        return None
    d, mo, y = m.groups()
    return f"{y}-{int(mo):02d}-{int(d):02d}"


NUM_RE = re.compile(r"^\s*([-+]?\d+(?:[.,]\d+)?)\s*(.*?)\s*$")


def parse_valeur(cell):
    """« 70.8 kg » -> (70.8, 'kg') ; « 20.7 » -> (20.7, '') ; vide -> None."""
    if cell is None or cell.strip() == "":
        return None
    m = NUM_RE.match(cell)
    if not m:
        return None
    val = float(m.group(1).replace(",", "."))
    val = int(val) if val.is_integer() else val
    unite = m.group(2).strip()
    return val, unite


def find_date_key(fieldnames):
    for f in fieldnames:
        if norm(f) == "date":
            return f
    return fieldnames[0]  # à défaut, 1re colonne


def build(paths):
    types = {}   # norm_nom -> {id, nom, unite, createdAt}
    mesures = []
    t = 1_700_000_000_000

    for path in paths:
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                continue
            datekey = find_date_key(reader.fieldnames)
            for row in reader:
                date = parse_date(row.get(datekey))
                if not date:
                    continue
                for col, cell in row.items():
                    if col == datekey or norm(col) in IGNORER:
                        continue
                    parsed = parse_valeur(cell)
                    if parsed is None:
                        continue
                    val, unite = parsed
                    key = norm(col)
                    if key not in types:
                        types[key] = {"id": "mt-" + slug(col), "nom": col.strip(), "unite": unite, "createdAt": t}
                        t += 1
                    elif not types[key]["unite"] and unite:
                        types[key]["unite"] = unite  # complète l'unité si trouvée plus tard
                    mesures.append({
                        "id": f"ms-{len(mesures)+1:05d}",
                        "typeId": types[key]["id"],
                        "date": date,
                        "valeur": val,
                        "note": "",
                        "createdAt": t,
                    })
                    t += 1

    return {
        "app": "serie1-mesures",
        "version": 2,
        "mesureTypes": list(types.values()),
        "mesures": mesures,
    }


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="CSV de suivi corporel -> JSON de mesures pour l'app Série 1")
    ap.add_argument("csv", nargs="+", help="fichier(s) CSV convertis")
    ap.add_argument("-o", "--out", default="mesures.json", help="JSON de sortie (déf. mesures.json)")
    ap.add_argument("--check", action="store_true", help="valide et affiche un récap sans écrire")
    args = ap.parse_args()

    try:
        data = build(args.csv)
    except OSError as e:
        sys.exit(f"Erreur de lecture : {e}")

    print(f"✓ {len(data['mesureTypes'])} mesures, {len(data['mesures'])} relevés "
          f"(depuis {len(args.csv)} fichier·s)")
    for mt in sorted(data["mesureTypes"], key=lambda x: x["nom"].lower()):
        n = sum(1 for m in data["mesures"] if m["typeId"] == mt["id"])
        print(f"   • {mt['nom']} [{mt['unite'] or 'sans unité'}] — {n} relevés")

    if args.check:
        return
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"→ écrit : {args.out}")
    print("  Importe-le dans l'app : Réglages → Importer des mesures")


if __name__ == "__main__":
    main()
