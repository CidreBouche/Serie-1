// merge.js — fusion de deux photos de la base (locale + distante). Fonction pure,
// sans accès à la base ni au réseau, pour pouvoir la tester isolément.
//
// Règles :
//  - par enregistrement (même id) : la version la plus récente gagne (updatedAt) ;
//  - une suppression (tombstone) l'emporte sur toute version plus ancienne qu'elle ;
//    un enregistrement réécrit APRÈS sa suppression ressuscite (et la trace tombe).

export const stampOf = (r) => (r && (r.updatedAt || r.createdAt)) || 0;

export function mergeSnapshots(local, remote, stores) {
  const merged = {};
  const toLocal = { puts: {}, dels: {}, tombPuts: [], tombDels: [] };
  let localNeedsUpdate = false;
  let remoteNeedsUpdate = false;

  // Union des traces de suppression (la plus récente par clé).
  const lTomb = new Map((local.tombstones || []).map((t) => [t.key, t]));
  const rTomb = new Map((remote.tombstones || []).map((t) => [t.key, t]));
  const tomb = new Map(lTomb);
  for (const [k, t] of rTomb) {
    const p = tomb.get(k);
    if (!p || t.deletedAt > p.deletedAt) tomb.set(k, t);
  }

  for (const s of stores) {
    const L = new Map((local[s] || []).map((r) => [r.id, r]));
    const R = new Map((remote[s] || []).map((r) => [r.id, r]));
    const out = [];
    const puts = [];
    const dels = [];

    for (const id of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(id);
      const r = R.get(id);
      let win;
      let fromLocal = false;
      let fromRemote = false;
      if (l && r) {
        if (stampOf(r) > stampOf(l)) { win = r; fromRemote = true; }
        else if (stampOf(l) > stampOf(r)) { win = l; fromLocal = true; }
        else win = l; // identiques : rien à propager
      } else if (l) { win = l; fromLocal = true; }
      else { win = r; fromRemote = true; }

      const key = `${s}:${id}`;
      const t = tomb.get(key);
      if (t) {
        if (stampOf(win) <= t.deletedAt) win = null; // supprimé après sa dernière écriture
        else tomb.delete(key); // réécrit après suppression : il revit
      }

      if (win) {
        out.push(win);
        if (fromRemote) { puts.push(win); localNeedsUpdate = true; }
        if (fromLocal) remoteNeedsUpdate = true;
      } else {
        if (l) { dels.push(id); localNeedsUpdate = true; }
        if (r) remoteNeedsUpdate = true;
      }
    }
    merged[s] = out;
    if (puts.length) toLocal.puts[s] = puts;
    if (dels.length) toLocal.dels[s] = dels;
  }

  // Différentiel sur les traces de suppression elles-mêmes.
  merged.tombstones = [...tomb.values()];
  for (const [k, t] of tomb) {
    const l = lTomb.get(k);
    if (!l || l.deletedAt !== t.deletedAt) { toLocal.tombPuts.push(t); localNeedsUpdate = true; }
    const r = rTomb.get(k);
    if (!r || r.deletedAt !== t.deletedAt) remoteNeedsUpdate = true;
  }
  for (const k of lTomb.keys()) if (!tomb.has(k)) { toLocal.tombDels.push(k); localNeedsUpdate = true; }
  for (const k of rTomb.keys()) if (!tomb.has(k)) remoteNeedsUpdate = true;

  return { merged, toLocal, localNeedsUpdate, remoteNeedsUpdate };
}
