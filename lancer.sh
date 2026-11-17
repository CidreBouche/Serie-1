#!/usr/bin/env bash
# Lance l'app en local pour la tester / l'installer sur ton téléphone.
# Une PWA a besoin d'être servie en http(s) (le service worker ne marche pas en file://).
cd "$(dirname "$0")"
echo "→ App servie sur http://localhost:8137"
echo "  Sur ton téléphone (même Wi-Fi) : http://<IP-du-PC>:8137"
python3 -m http.server 8137
