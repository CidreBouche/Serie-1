// ui.js — vues + routeur (hash). Zéro framework.
import * as store from './store.js';
import { serie1Chart } from './chart.js';
import { exportJSON, exportCSV, importJSONFile, importMesuresFile } from './exchange.js';
import { seedExample } from './seed.js';
import { EXERCICES_STANDARDS } from './exercices_standards.js';
import * as mesures from './mesures.js';
import * as standards from './standards.js';
import * as sync from './sync.js';

const app = () => document.getElementById('app');
const round1 = (v) => Math.round(v * 10) / 10;
// Préfixe 🏆 si l'exercice correspond à un lift standard (badge auto, non stocké).
const nomTrophee = (nom) => (standards.liftDeExercice(nom) ? '🏆 ' : '') + nom;

// Exercices ajoutés à une séance mais encore sans série : ils n'existent pas
// en base tant qu'aucune série n'est saisie, donc on les mémorise ici pour
// qu'ils survivent aux re-rendus (renderSeance recharge la séance depuis la DB).
const addedBySeance = new Map(); // seanceId -> Set(exerciceId)

// ---------- petits helpers DOM ----------
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}

function mount(node) {
  app().replaceChildren(node);
  window.scrollTo(0, 0);
}

export function toast(msg, type = 'info') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = el('div', { id: 'toasts' });
    document.body.appendChild(host);
  }
  const t = el('div', { class: `toast toast-${type}` }, msg);
  host.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

function header(title, { back = null, actions = [] } = {}) {
  return el('header', { class: 'topbar' }, [
    back ? el('button', { class: 'icon-btn', 'aria-label': 'Retour', onclick: () => (location.hash = back) }, '‹') : el('span', { class: 'icon-btn ghost' }, ''),
    el('h1', {}, title),
    el('div', { class: 'topbar-actions' }, actions),
  ]);
}

// Stepper numérique gros doigts.
function stepper({ value = 0, step = 1, min = 0, label = '', inputmode = 'decimal', id = '' }) {
  const input = el('input', { type: 'text', inputmode, value: String(value), class: 'stepper-input', id, 'aria-label': label });
  const clamp = () => {
    let v = parseFloat(input.value.replace(',', '.'));
    if (isNaN(v)) v = min;
    if (v < min) v = min;
    input.value = String(Math.round(v * 100) / 100);
  };
  const bump = (d) => {
    let v = parseFloat(input.value.replace(',', '.'));
    if (isNaN(v)) v = min;
    v = Math.max(min, Math.round((v + d) * 100) / 100);
    input.value = String(v);
  };
  input.addEventListener('blur', clamp);
  const wrap = el('div', { class: 'stepper' }, [
    el('button', { class: 'step-btn', type: 'button', 'aria-label': `moins ${label}`, onclick: () => bump(-step) }, '−'),
    input,
    el('button', { class: 'step-btn', type: 'button', 'aria-label': `plus ${label}`, onclick: () => bump(step) }, '+'),
  ]);
  return { wrap, get: () => parseFloat(input.value.replace(',', '.')) || 0, set: (v) => (input.value = String(v)), input };
}

// Contrôle de durée : deux boxes min : sec. get() renvoie des secondes.
function dureeControl(totalSec = 0) {
  totalSec = Number(totalSec) || 0;
  const mkBox = (val, label, max) => el('input', {
    type: 'text', inputmode: 'numeric', value: val ? String(val) : '', class: 'duree-box',
    placeholder: '0', 'aria-label': label, 'data-max': max,
  });
  const min = mkBox(Math.floor(totalSec / 60), 'minutes', 999);
  const sec = mkBox(totalSec % 60, 'secondes', 59);
  const clampSec = () => {
    let v = parseInt(sec.value, 10);
    if (isNaN(v) || v < 0) { sec.value = sec.value.trim() === '' ? '' : '0'; return; }
    if (v > 59) sec.value = '59';
  };
  sec.addEventListener('blur', clampSec);
  const wrap = el('div', { class: 'duree' }, [
    min, el('span', { class: 'duree-sep' }, ':'), sec,
  ]);
  return {
    wrap,
    get: () => (parseInt(min.value, 10) || 0) * 60 + (parseInt(sec.value, 10) || 0),
    set: (s) => { s = Number(s) || 0; min.value = s ? String(Math.floor(s / 60)) : ''; sec.value = s ? String(s % 60) : ''; },
  };
}

// Contrôle RPE : une box optionnelle (1–10, pas de 0,5). get() renvoie '' si vide.
function rpeControl(value = null) {
  const input = el('input', {
    type: 'text', inputmode: 'decimal', class: 'duree-box',
    value: value == null ? '' : String(value), placeholder: '–', 'aria-label': 'RPE',
  });
  input.addEventListener('blur', () => {
    const raw = input.value.trim().replace(',', '.');
    if (raw === '') { input.value = ''; return; }
    let v = parseFloat(raw);
    if (isNaN(v) || v < 0) { input.value = ''; return; }
    if (v > 10) v = 10;
    input.value = String(Math.round(v * 2) / 2); // arrondi au 0,5
  });
  return {
    wrap: el('div', { class: 'rpe' }, [input]),
    get: () => input.value.trim(),  // '' => enregistré comme null par le store
  };
}

// ======================================================================
// SYNCHRONISATION (pastille d'accueil, panneau Réglages, dialogue de choix)
// ======================================================================
const heure = (ms) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const jourHeure = (ms) => new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Lance une synchro manuelle et dit ce qui s'est passé.
async function syncManuelle() {
  const res = await sync.syncNow({ interactive: true });
  if (res.error) {
    if (res.error.code !== 'decision') toast('Synchro : ' + (res.error.message || 'échec'), 'warn');
  } else if (!res.cancelled) {
    toast('Synchronisé avec Google Drive ✓', 'success');
  }
}

// Pastille d'état sur l'accueil (null si la synchro n'est pas configurée).
function syncChip() {
  const s = sync.status();
  if (!s.configured) return null;
  let txt;
  let cls = '';
  if (s.state === 'syncing') txt = '⟳ Synchronisation…';
  else if (!s.connected) { txt = '☁ Connecter Google Drive'; cls = 'todo'; }
  else if (s.state === 'error') { txt = '⚠ Synchro échouée — toucher pour réessayer'; cls = 'warn'; }
  else if (s.needsDecision) { txt = '⚠ Synchro : un choix est nécessaire'; cls = 'warn'; }
  else if (s.dirty) { txt = '☁ Modifs à envoyer — toucher pour synchroniser'; cls = 'todo'; }
  else txt = `☁ À jour · synchro ${s.last ? heure(s.last) : '—'}`;
  return el('button', { id: 'sync-chip', class: 'sync-chip ' + cls, disabled: s.state === 'syncing', onclick: syncManuelle }, txt);
}

// Panneau complet dans Réglages.
function syncPanel() {
  const s = sync.status();
  const panel = el('div', { id: 'sync-panel', class: 'card stack' });
  const idInput = el('input', { type: 'text', class: 'search', placeholder: 'xxxxxxxx.apps.googleusercontent.com', value: sync.clientId(), autocomplete: 'off', spellcheck: 'false' });
  const idForm = el('div', { class: 'stack' }, [
    el('label', { class: 'mini-label' }, ['Identifiant client Google (OAuth)', idInput]),
    el('button', { class: 'btn btn-ghost', onclick: () => { sync.setClientId(idInput.value); toast('Identifiant enregistré sur cet appareil'); } }, 'Enregistrer l’identifiant'),
  ]);

  if (!s.configured) {
    panel.appendChild(el('p', { class: 'muted small' }, 'Pas encore configurée. La synchro enregistre tes données dans un fichier de ton Google Drive et les partage entre ton téléphone et ton ordinateur. Il faut d’abord créer un identifiant Google (une fois, ~10 min) : voir le README, section « Synchronisation Google Drive ».'));
    panel.appendChild(idForm);
    return panel;
  }

  let etat;
  if (s.state === 'syncing') etat = 'Synchronisation en cours…';
  else if (!s.connected) etat = 'Cet appareil n’est pas encore relié à ton Drive.';
  else if (s.state === 'error') etat = 'Dernière tentative échouée : ' + s.error;
  else if (s.needsDecision) etat = 'Un choix est nécessaire (données remplacées sur un appareil) — lance la synchro.';
  else if (s.dirty) etat = `Des modifications attendent d’être envoyées. Dernière synchro : ${s.last ? jourHeure(s.last) : 'jamais'}.`;
  else etat = `À jour. Dernière synchro : ${s.last ? jourHeure(s.last) : '—'}.`;

  panel.appendChild(el('p', { class: 'small' }, etat));
  panel.appendChild(el('button', { class: 'btn btn-primary', disabled: s.state === 'syncing', onclick: syncManuelle }, s.connected ? 'Synchroniser maintenant' : 'Connecter Google Drive'));
  panel.appendChild(el('p', { class: 'muted small' }, 'Tes données sont dans le fichier « serie1-donnees.json » de ton Drive (l’app ne voit que ce fichier, pas le reste). Tant que la session Google est ouverte (~1 h), l’envoi est automatique après chaque modification ; sinon, un tap sur la pastille de l’accueil suffit.'));
  const details = el('details', {}, [el('summary', { class: 'muted small' }, 'Options avancées'), el('div', { class: 'stack', style: 'margin-top:10px' }, [
    idForm,
    s.connected ? el('button', { class: 'btn btn-ghost', onclick: () => { if (confirm('Délier cet appareil de Drive ? Les données restent sur l’appareil et sur Drive.')) { sync.disconnect(); toast('Appareil délié'); } } }, 'Délier cet appareil') : null,
  ])]);
  panel.appendChild(details);
  return panel;
}

// Dialogue quand la fusion automatique serait risquée. Renvoie le choix.
function askSyncDecision({ reason, options }) {
  const textes = {
    first: ['Deux jeux de données', 'Cet appareil et ton Drive contiennent déjà des données. Que veux-tu faire ?'],
    reset: ['Données remplacées sur cet appareil', 'Depuis la dernière synchro, tu as tout effacé ou importé une sauvegarde complète ici. Une fusion ferait revenir les anciennes données : quel côté garder ?'],
    epoch: ['Données remplacées sur un autre appareil', 'Un autre appareil a remplacé toutes les données sur Drive, alors que celui-ci a des modifications non envoyées. Quel côté garder ?'],
  };
  const libelles = {
    merge: ['Fusionner les deux', 'btn-primary'],
    pull: ['Garder Drive (remplace cet appareil)', 'btn-ghost'],
    push: ['Garder cet appareil (écrase Drive)', 'btn-ghost'],
  };
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'overlay' });
    const close = (v) => { overlay.remove(); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close('cancel'); });
    overlay.appendChild(el('div', { class: 'sheet confirm' }, [
      el('h3', {}, textes[reason][0]),
      el('p', { class: 'muted' }, textes[reason][1]),
      ...options.map((o) => el('button', { class: 'btn ' + libelles[o][1], onclick: () => close(o) }, libelles[o][0])),
      el('button', { class: 'btn btn-ghost', onclick: () => close('cancel') }, 'Annuler'),
      el('p', { class: 'muted small' }, 'Filet de sécurité : Google Drive garde les versions précédentes du fichier (clic droit → Gérer les versions).'),
    ]));
    document.body.appendChild(overlay);
  });
}

sync.setHandlers({
  decide: askSyncDecision,
  // Des données sont arrivées de Drive : on rafraîchit l'écran, sauf si une saisie est en cours.
  afterPull: () => {
    const a = document.activeElement;
    const enSaisie = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
    if (enSaisie) toast('Données mises à jour depuis Drive');
    else router();
  },
});
// Garde la pastille et le panneau à jour quand l'état de synchro change.
sync.subscribe(() => {
  const chip = document.getElementById('sync-chip');
  if (chip) { const n = syncChip(); if (n) chip.replaceWith(n); else chip.remove(); }
  const panel = document.getElementById('sync-panel');
  if (panel) {
    // On ne redessine pas le panneau pendant qu'on y tape l'identifiant.
    if (!panel.contains(document.activeElement) || document.activeElement.tagName !== 'INPUT') panel.replaceWith(syncPanel());
  }
});

// ======================================================================
// ACCUEIL
// ======================================================================
async function renderHome() {
  const seances = await store.listSeances();
  const exs = await store.listExercices();

  const list = el('div', { class: 'stack' });
  if (!seances.length) {
    list.appendChild(el('p', { class: 'muted center' }, 'Aucune séance pour l’instant. Lance-toi !'));
    if (!exs.length) {
      list.appendChild(el('button', { class: 'btn btn-ghost', onclick: loadExampleData }, '✨ Charger des données d’exemple'));
    }
  } else {
    for (const s of seances.slice(0, 12)) {
      const series = await store.seriesOfSeance(s.id);
      const nbEx = new Set(series.map((x) => x.exerciceId)).size;
      list.appendChild(
        el('button', { class: 'card row-link', onclick: () => (location.hash = `#/seance/${s.id}`) }, [
          el('div', {}, [
            el('div', { class: 'card-title' }, store.formatDateFR(s.date)),
            el('div', { class: 'muted small' }, `${nbEx} exercice${nbEx > 1 ? 's' : ''} · ${series.length} série${series.length > 1 ? 's' : ''}`),
          ]),
          el('span', { class: 'chev' }, '›'),
        ])
      );
    }
  }

  const view = el('div', {}, [
    header('Série 1', {
      actions: [
        el('button', { class: 'icon-btn', title: 'Réglages', onclick: () => (location.hash = '#/reglages') }, '⚙'),
      ],
    }),
    el('main', { class: 'container' }, [
      syncChip(),
      el('button', { class: 'btn btn-primary btn-big', onclick: newSeance }, '＋ Nouvelle séance'),
      el('div', { class: 'grid-2' }, [
        el('button', { class: 'btn btn-ghost btn-big', onclick: () => (location.hash = '#/progression') }, '📈 Progression'),
        el('button', { class: 'btn btn-ghost btn-big', onclick: () => (location.hash = '#/mesures') }, '📏 Mesures'),
      ]),
      el('div', { class: 'grid-2' }, [
        el('button', { class: 'btn btn-ghost', onclick: () => (location.hash = '#/exercices') }, `Exercices (${exs.length})`),
        el('button', { class: 'btn btn-ghost', onclick: () => (location.hash = '#/reglages') }, 'Export / Import'),
      ]),
      el('h2', { class: 'section-title' }, 'Dernières séances'),
      list,
    ]),
  ]);
  mount(view);
}

async function newSeance() {
  const s = await store.createSeance({});
  location.hash = `#/seance/${s.id}`;
}

// Charge un jeu d'exemple (données réalistes pour explorer l'app).
async function loadExampleData() {
  const exs = await store.listExercices();
  const seances = await store.listSeances();
  if (exs.length || seances.length) {
    if (!confirm('Des données existent déjà. Ajouter les données d’exemple par-dessus ?')) return;
  }
  const n = await seedExample();
  toast(`Exemple chargé : ${n.exercices} exercices, ${n.seances} séances`, 'success');
  location.hash = '#/';
  router();
}

// ======================================================================
// SÉANCE
// ======================================================================
async function renderSeance(id) {
  const seance = await store.getSeance(id);
  if (!seance) {
    mount(el('div', {}, [header('Séance', { back: '#/' }), el('main', { class: 'container' }, el('p', { class: 'muted' }, 'Séance introuvable.'))]));
    return;
  }
  const series = await store.seriesOfSeance(id);
  const exs = await store.listExercices();
  const exById = new Map(exs.map((e) => [e.id, e]));

  // Exercices actifs = ceux qui ont des séries + ceux ajoutés dans cette vue.
  const activeIds = new Set(series.map((s) => s.exerciceId));
  addedBySeance.get(id)?.forEach((x) => activeIds.add(x));

  const main = el('main', { class: 'container' });

  // Bandeau date + notes
  const dateInput = el('input', { type: 'date', value: seance.date, class: 'date-input', onchange: async (e) => { await store.updateSeance(id, { date: e.target.value }); toast('Date mise à jour'); } });
  const notesInput = el('textarea', { class: 'notes', rows: '1', placeholder: 'Notes de séance (optionnel)…' }, []);
  notesInput.value = seance.notes || '';
  notesInput.addEventListener('change', async () => { await store.updateSeance(id, { notes: notesInput.value }); });
  main.appendChild(el('div', { class: 'seance-meta' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Date'), dateInput]),
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Notes'), notesInput]),
  ]));

  // Une carte par exercice actif
  const orderedActive = [...activeIds].map((eid) => exById.get(eid)).filter(Boolean).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const cards = el('div', { class: 'stack' });
  for (const ex of orderedActive) {
    cards.appendChild(await exerciceCard(seance, ex, series.filter((s) => s.exerciceId === ex.id)));
  }
  main.appendChild(cards);

  main.appendChild(el('button', { class: 'btn btn-ghost btn-big', onclick: () => pickExercice(seance) }, '＋ Ajouter un exercice'));

  mount(el('div', {}, [
    header(store.formatDateFR(seance.date), {
      back: '#/',
      actions: [el('button', { class: 'icon-btn danger', title: 'Supprimer la séance', onclick: () => confirmDeleteSeance(seance) }, '🗑')],
    }),
    main,
  ]));
}

async function exerciceCard(seance, ex, series) {
  // Échauffements (position 0) d'abord, puis séries de travail par position.
  const sorted = [...series].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
  // Le prochain numéro ne compte QUE les séries de travail (échauffements exclus).
  const workSets = sorted.filter((s) => !s.echauffement);
  const nextPos = workSets.length ? Math.max(...workSets.map((s) => s.position)) + 1 : 1;

  const card = el('section', { class: 'card ex-card' });
  card.appendChild(el('div', { class: 'ex-card-head' }, [
    el('button', { class: 'ex-name', onclick: () => (location.hash = `#/exercice/${ex.id}`) }, [
      el('span', {}, nomTrophee(ex.nom)),
    ]),
    el('span', { class: 'muted small' }, `seuil ${ex.seuil}`),
  ]));

  // Rappel : note permanente de l'exercice (réglages machine, etc.)
  if (ex.note && ex.note.trim()) {
    card.appendChild(el('div', { class: 'ex-note' }, [el('span', { class: 'ex-note-ico' }, '📌'), el('span', {}, ex.note.trim())]));
  }

  // Séries déjà saisies (affichage générique : charge / reps / durée)
  const rows = el('div', { class: 'serie-rows' });
  for (const s of sorted) {
    const ech = !!s.echauffement;
    const atteint = !ech && store.seuilAtteint(ex, s.reps);
    rows.appendChild(el('div', { class: 'serie-row' + (!ech && s.position === 1 ? ' s1' : '') + (ech ? ' warmup' : '') }, [
      el('span', { class: 'pos' }, ech ? 'Éch' : `S${s.position}`),
      el('span', { class: 'perf' }, store.formatPerf(s) + (s.rpe ? ` · RPE ${s.rpe}` : '')),
      atteint ? el('span', { class: 'badge up', title: `≥ ${ex.seuil} reps` }, '↑ monte') : el('span', {}, ''),
      el('button', { class: 'mini-btn', 'aria-label': 'Supprimer la série', onclick: async () => { await store.deleteSerie(s.id); renderSeance(seance.id); } }, '×'),
    ]));
  }
  card.appendChild(rows);

  // Ligne d'ajout de série
  const last = await store.lastPerfAtPosition(ex.id, nextPos, seance.id);
  const ref = el('div', { class: 'ref' });
  if (last) {
    ref.appendChild(el('span', { class: 'muted small' }, `Dernière S${nextPos} : ${store.formatPerf(last)} (${store.formatDateFR(last.date)})`));
    if (store.seuilAtteint(ex, last.reps)) ref.appendChild(el('span', { class: 'badge up' }, '↑ prête à monter'));
  } else {
    ref.appendChild(el('span', { class: 'muted small' }, `S${nextPos} — pas d’historique à cette position`));
  }

  // Champs, tous utilisables ensemble : charge, reps, durée (min:sec), RPE.
  const charge = stepper({ value: last ? last.poids : 0, step: 2.5, min: 0, label: 'charge' });
  const reps = stepper({ value: last ? last.reps : 0, step: 1, min: 0, label: 'reps', inputmode: 'numeric' });
  const duree = dureeControl(last ? last.dureeSec : 0);
  const rpe = rpeControl();

  // Case échauffement : la série n'est pas comptée comme série de travail.
  const echInput = el('input', { type: 'checkbox', class: 'ech-check', 'aria-label': 'Échauffement' });
  const addBtn = el('button', { class: 'btn btn-primary' }, `Ajouter S${nextPos}`);
  const syncBtn = () => (addBtn.textContent = echInput.checked ? 'Ajouter un échauffement' : `Ajouter S${nextPos}`);
  echInput.addEventListener('change', syncBtn);

  addBtn.addEventListener('click', async () => {
    const p = charge.get(), r = reps.get(), d = duree.get(), ech = echInput.checked;
    if (r <= 0 && d <= 0) { toast('Renseigne des reps ou une durée', 'warn'); return; }
    await store.addSerie({ seanceId: seance.id, exerciceId: ex.id, position: nextPos, poids: p, reps: r, dureeSec: d, rpe: rpe.get(), echauffement: ech });
    if (!ech && store.seuilAtteint(ex, r)) toast(`S${nextPos} : seuil atteint (≥${ex.seuil}) → monte la charge la prochaine fois`, 'success');
    renderSeance(seance.id);
  });

  card.appendChild(el('div', { class: 'add-serie' }, [
    ref,
    el('div', { class: 'add-grid' }, [
      el('label', { class: 'mini-label' }, ['Charge (kg)', charge.wrap]),
      el('label', { class: 'mini-label' }, ['Reps', reps.wrap]),
    ]),
    el('div', { class: 'add-grid' }, [
      el('label', { class: 'mini-label' }, ['Durée (min : sec) — opt.', duree.wrap]),
      el('label', { class: 'mini-label' }, ['RPE (1–10) — opt.', rpe.wrap]),
    ]),
    el('label', { class: 'ech-row' }, [echInput, el('span', {}, 'Échauffement (ne compte pas comme série de travail)')]),
    addBtn,
  ]));

  return card;
}

// Sélecteur d'exercice (existant ou création à la volée)
async function pickExercice(seance) {
  const exs = await store.listExercices();
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const listWrap = el('div', { class: 'sheet-list' });

  const existants = new Set(exs.map((e) => e.nom.toLowerCase()));

  const renderList = (filter = '') => {
    listWrap.replaceChildren();
    const f = filter.trim().toLowerCase();
    const matchTxt = (t) => (t || '').toLowerCase().includes(f);

    // 1) Tes exercices déjà créés
    const matches = exs.filter((e) => matchTxt(e.nom));
    for (const e of matches) {
      listWrap.appendChild(el('button', { class: 'sheet-item', onclick: () => { addExerciceToSeance(seance, e.id); overlay.remove(); } }, [
        el('span', {}, nomTrophee(e.nom)),
      ]));
    }

    // 2) Suggestions du catalogue standard (celles pas encore créées)
    const suggestions = EXERCICES_STANDARDS
      .filter((s) => !existants.has(s.nom.toLowerCase()))
      .filter((s) => matchTxt(s.nom));
    if (suggestions.length) {
      listWrap.appendChild(el('div', { class: 'sheet-section' }, 'Suggestions'));
      for (const s of suggestions) {
        listWrap.appendChild(el('button', { class: 'sheet-item suggestion', onclick: async () => {
          const e = await store.createExercice(s);
          addExerciceToSeance(seance, e.id);
          overlay.remove();
        } }, [
          el('span', {}, nomTrophee(s.nom)),
        ]));
      }
    }

    // 3) Création libre si le texte ne correspond exactement à rien
    const exact = f && (existants.has(f) || EXERCICES_STANDARDS.some((s) => s.nom.toLowerCase() === f));
    if (f && !exact) {
      listWrap.appendChild(el('button', { class: 'sheet-item create', onclick: async () => {
        const e = await store.createExercice({ nom: search.value });
        addExerciceToSeance(seance, e.id);
        overlay.remove();
      } }, `＋ Créer « ${search.value.trim()} »`));
    }
  };

  const search = el('input', { type: 'text', class: 'search', placeholder: 'Rechercher, choisir une suggestion ou créer…', autofocus: true, oninput: () => renderList(search.value) });
  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-handle' }),
    el('h3', {}, 'Ajouter un exercice'),
    search,
    listWrap,
  ]);
  renderList();
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  setTimeout(() => search.focus(), 50);
}

function addExerciceToSeance(seance, exId) {
  if (!addedBySeance.has(seance.id)) addedBySeance.set(seance.id, new Set());
  addedBySeance.get(seance.id).add(exId);
  renderSeance(seance.id);
}

function confirmDeleteSeance(seance) {
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  overlay.appendChild(el('div', { class: 'sheet confirm' }, [
    el('h3', {}, 'Supprimer cette séance ?'),
    el('p', { class: 'muted' }, `${store.formatDateFR(seance.date)} et toutes ses séries seront effacées.`),
    el('div', { class: 'grid-2' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => overlay.remove() }, 'Annuler'),
      el('button', { class: 'btn btn-danger', onclick: async () => { await store.deleteSeance(seance.id); overlay.remove(); location.hash = '#/'; toast('Séance supprimée'); } }, 'Supprimer'),
    ]),
  ]));
  document.body.appendChild(overlay);
}

// ======================================================================
// PROGRESSION (petits multiples : un mini-graphe par exercice)
// ======================================================================
async function renderProgression() {
  const exs = await store.listExercices(); // déjà trié alphabétiquement
  const items = [];
  for (const ex of exs) {
    items.push({ ex, hist: await store.serie1History(ex.id) });
  }
  const avecCourbe = items.filter((i) => i.hist.length >= 2);
  const sansCourbe = items.filter((i) => i.hist.length < 2);

  const main = el('main', { class: 'container' });

  if (!items.length) {
    main.appendChild(el('p', { class: 'muted center' }, 'Aucun exercice. Logge une séance pour voir tes courbes ici.'));
  }

  for (const { ex, hist } of avecCourbe) {
    const metric = store.serie1Metric(hist);
    const first = metric.valueOf(hist[0]);
    const lastV = metric.valueOf(hist[hist.length - 1]);
    const d = lastV - first;
    const trend = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '▬';

    const card = el('button', { class: 'card prog-card', onclick: () => (location.hash = `#/exercice/${ex.id}`) }, [
      el('div', { class: 'prog-head' }, [
        el('div', { class: 'prog-title' }, [
          el('div', { class: 'card-title' }, nomTrophee(ex.nom)),
          el('div', { class: 'muted small' }, `série 1 · ${metric.label} · ${hist.length} séances`),
        ]),
        el('div', { class: `trend trend-${trend}` }, [
          el('span', { class: 'trend-now' }, metric.format(lastV)),
          el('span', { class: 'trend-delta' }, `${arrow} ${deltaLabel(metric, d)}`),
        ]),
      ]),
      serie1Chart(hist, { valueOf: metric.valueOf, format: metric.format, compact: true }),
    ]);
    main.appendChild(card);
  }

  if (sansCourbe.length) {
    main.appendChild(el('h2', { class: 'section-title' }, 'Pas encore de courbe'));
    for (const { ex, hist } of sansCourbe) {
      main.appendChild(el('button', { class: 'card row-link', onclick: () => (location.hash = `#/exercice/${ex.id}`) }, [
        el('div', {}, [
          el('div', { class: 'card-title' }, nomTrophee(ex.nom)),
          el('div', { class: 'muted small' }, hist.length ? '1 séance — il en faut 2 pour une courbe' : 'aucune donnée de série 1'),
        ]),
        el('span', { class: 'chev' }, '›'),
      ]));
    }
  }

  mount(el('div', {}, [header('Progression', { back: '#/' }), main]));
}

// Étiquette de tendance « depuis le début », signée et formatée selon la métrique.
function deltaLabel(metric, d) {
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  if (metric.key === 'duree') return sign + store.formatDuree(Math.abs(d));
  return sign + (Math.round(Math.abs(d) * 10) / 10);
}

// Carte « Niveau de force » pour un lift standard (null si non concerné).
async function forceLevelCard(ex, hist1) {
  const ev = await standards.evaluerExercice(ex.nom, hist1);
  if (!ev) return null; // pas un lift standard

  const card = el('section', { class: 'card stack' });
  card.appendChild(el('div', { class: 'card-title' }, 'Niveau de force'));

  if (ev.manque === 'perf') {
    card.appendChild(el('p', { class: 'muted small' }, 'Logue une série 1 avec charge et reps pour estimer ton niveau.'));
    return card;
  }
  const e1 = Math.round(ev.best.est1rm);
  card.appendChild(el('div', { class: 'muted small' }, `1RM estimé : ${e1} kg (Epley, d'après S1 ${ev.best.poids}×${ev.best.reps} du ${store.formatDateFR(ev.best.date)})`));

  if (ev.manque === 'sexe') {
    card.appendChild(el('p', { class: 'muted small' }, 'Choisis ton sexe dans Réglages → Profil pour situer ton niveau.'));
    card.appendChild(el('button', { class: 'btn btn-ghost', onclick: () => (location.hash = '#/reglages') }, 'Aller aux Réglages'));
    return card;
  }
  if (ev.manque === 'poids') {
    card.appendChild(el('p', { class: 'muted small' }, 'Renseigne ton poids de corps (📏 Mesures → « Poids ») pour ton niveau relatif.'));
    return card;
  }

  card.appendChild(el('div', { class: 'niveau-ligne' }, [
    el('span', { class: 'niveau-badge' }, ev.niveau),
    el('span', { class: 'muted small' }, `${round1(ev.ratio)}× ton poids (${round1(ev.poidsCorps)} kg)`),
  ]));
  if (ev.prochain) {
    card.appendChild(el('div', { class: 'muted small' }, `Prochain palier : ${ev.prochain.label} à ${ev.prochain.ratio}× = ${Math.round(ev.prochain.kg)} kg`));
  }
  if (ev.approx) card.appendChild(el('div', { class: 'muted small', style: 'font-style:italic' }, 'Standards Hip thrust indicatifs (moins normalisés que le SBD).'));
  return card;
}

// ======================================================================
// DÉTAIL EXERCICE
// ======================================================================
async function renderExercice(id) {
  const ex = await store.getExercice(id);
  if (!ex) { mount(el('div', {}, [header('Exercice', { back: '#/exercices' }), el('main', { class: 'container' }, el('p', { class: 'muted' }, 'Introuvable.'))])); return; }

  const [hist1, series, seances, pretes] = await Promise.all([
    store.serie1History(id),
    store.seriesOfExercice(id),
    store.listSeances(),
    store.positionsPretes(id),
  ]);
  const seanceById = new Map(seances.map((s) => [s.id, s]));

  const main = el('main', { class: 'container' });

  // Graphe série 1
  const metric1 = store.serie1Metric(hist1);
  main.appendChild(el('h2', { class: 'section-title' }, `Progression de la série 1 · ${metric1.label}`));
  main.appendChild(el('div', { class: 'card' }, serie1Chart(hist1, { valueOf: metric1.valueOf, format: metric1.format })));

  // Alertes positions prêtes
  if (pretes.length) {
    main.appendChild(el('div', { class: 'callout' }, [
      el('strong', {}, 'Prêt à monter en charge : '),
      pretes.map((p) => `S${p.position} (${p.poids}kg×${p.reps})`).join(', '),
    ]));
  }

  // Niveau de force (seulement pour les lifts standards : SBD + Hip thrust)
  const nivCard = await forceLevelCard(ex, hist1);
  if (nivCard) main.appendChild(nivCard);

  // Réglage seuil + note permanente
  const seuilStep = stepper({ value: ex.seuil, step: 1, min: 1, label: 'seuil', inputmode: 'numeric' });
  const noteInput = el('textarea', { class: 'notes', rows: '2', placeholder: 'Réglages, rappels (ex. siège 4, dossier 2, poignée large)…' }, []);
  noteInput.value = ex.note || '';
  noteInput.addEventListener('change', async () => { await store.updateExercice(id, { note: noteInput.value }); toast('Note enregistrée'); });
  main.appendChild(el('section', { class: 'card stack' }, [
    el('div', { class: 'ex-card-head' }, [
      el('div', { class: 'card-title' }, ex.nom),
    ]),
    el('label', { class: 'mini-label' }, ['Seuil de reps (double progression)', el('div', { class: 'row-inline' }, [
      seuilStep.wrap,
      el('button', { class: 'btn btn-primary', onclick: async () => { await store.updateExercice(id, { seuil: seuilStep.get() }); toast('Seuil enregistré'); renderExercice(id); } }, 'Enregistrer'),
    ])]),
    el('label', { class: 'mini-label' }, ['Note permanente (réglages, rappels)', noteInput]),
  ]));

  // Historique par séance
  main.appendChild(el('h2', { class: 'section-title' }, 'Historique'));
  const bySeance = new Map();
  for (const s of series) {
    if (!bySeance.has(s.seanceId)) bySeance.set(s.seanceId, []);
    bySeance.get(s.seanceId).push(s);
  }
  const entries = [...bySeance.entries()]
    .map(([sid, arr]) => ({ seance: seanceById.get(sid), arr }))
    .filter((x) => x.seance)
    .sort((a, b) => (b.seance.date === a.seance.date ? b.seance.createdAt - a.seance.createdAt : b.seance.date.localeCompare(a.seance.date)));

  const histWrap = el('div', { class: 'stack' });
  if (!entries.length) histWrap.appendChild(el('p', { class: 'muted' }, 'Aucune séance enregistrée pour cet exercice.'));
  for (const { seance, arr } of entries) {
    arr.sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
    histWrap.appendChild(el('button', { class: 'card row-link', onclick: () => (location.hash = `#/seance/${seance.id}`) }, [
      el('div', {}, [
        el('div', { class: 'card-title' }, store.formatDateFR(seance.date)),
        el('div', { class: 'serie-inline' }, arr.map((s) => el('span', { class: 'chip' + (!s.echauffement && s.position === 1 ? ' s1' : '') + (s.echauffement ? ' warmup' : '') }, `${s.echauffement ? 'Éch' : 'S' + s.position} ${store.formatPerf(s)}`))),
      ]),
      el('span', { class: 'chev' }, '›'),
    ]));
  }
  main.appendChild(histWrap);

  mount(el('div', {}, [header(nomTrophee(ex.nom), { back: '#/exercices' }), main]));
}

// ======================================================================
// LISTE EXERCICES
// ======================================================================
async function renderExercices() {
  const exs = await store.listExercices();
  const main = el('main', { class: 'container' });

  main.appendChild(el('button', { class: 'btn btn-primary btn-big', onclick: () => editExercice(null) }, '＋ Nouvel exercice'));

  const list = el('div', { class: 'stack' });
  if (!exs.length) list.appendChild(el('p', { class: 'muted center' }, 'Aucun exercice.'));
  for (const e of exs) {
    list.appendChild(el('div', { class: 'card row-link' }, [
      el('button', { class: 'grow left', onclick: () => (location.hash = `#/exercice/${e.id}`) }, [
        el('div', { class: 'card-title' }, nomTrophee(e.nom)),
        el('div', { class: 'muted small' }, `seuil ${e.seuil}`),
      ]),
      el('button', { class: 'mini-btn', 'aria-label': 'Modifier', onclick: () => editExercice(e) }, '✎'),
    ]));
  }
  main.appendChild(list);

  mount(el('div', {}, [header('Exercices', { back: '#/' }), main]));
}

function editExercice(ex) {
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const nom = el('input', { type: 'text', class: 'search', placeholder: 'Nom (ex. Dips)', value: ex?.nom || '' });
  const seuil = el('input', { type: 'text', inputmode: 'numeric', class: 'search', value: String(ex?.seuil ?? store.SEUIL_DEFAUT) });

  overlay.appendChild(el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-handle' }),
    el('h3', {}, ex ? 'Modifier l’exercice' : 'Nouvel exercice'),
    el('label', { class: 'mini-label' }, ['Nom', nom]),
    el('label', { class: 'mini-label' }, ['Seuil de reps', seuil]),
    el('button', { class: 'btn btn-primary btn-big', onclick: async () => {
      if (!nom.value.trim()) { toast('Nom requis', 'warn'); return; }
      if (ex) await store.updateExercice(ex.id, { nom: nom.value, seuil: seuil.value });
      else await store.createExercice({ nom: nom.value, seuil: seuil.value });
      overlay.remove();
      renderExercices();
      toast('Enregistré', 'success');
    } }, 'Enregistrer'),
  ]));
  document.body.appendChild(overlay);
  setTimeout(() => nom.focus(), 50);
}

// ======================================================================
// RÉGLAGES / EXPORT-IMPORT
// ======================================================================
async function renderReglages() {
  const main = el('main', { class: 'container' });

  main.appendChild(el('h2', { class: 'section-title' }, 'Synchronisation Google Drive'));
  main.appendChild(syncPanel());

  // Profil — sexe (pour les standards de force). Synchronisé avec le reste.
  main.appendChild(el('h2', { class: 'section-title' }, 'Profil'));
  const sexe = standards.getSexe();
  const btnSexe = (val, label) => el('button', {
    class: 'btn ' + (sexe === val ? 'btn-primary' : 'btn-ghost'),
    onclick: () => { standards.setSexe(val); toast('Profil enregistré'); renderReglages(); },
  }, label);
  main.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'muted small' }, 'Sert à situer ta force par rapport aux standards (Squat, Développé couché, Soulevé de terre, Hip thrust).'),
    el('div', { class: 'grid-2' }, [btnSexe('homme', 'Homme'), btnSexe('femme', 'Femme')]),
  ]));

  main.appendChild(el('h2', { class: 'section-title' }, 'Exporter'));
  main.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'muted small' }, 'Sauvegarde ou analyse externe. Le JSON réimporte tout ; le CSV liste toutes les séries.'),
    el('div', { class: 'grid-2' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => exportJSON() }, '⤓ JSON (sauvegarde)'),
      el('button', { class: 'btn btn-ghost', onclick: () => exportCSV() }, '⤓ CSV (analyse)'),
    ]),
  ]));

  main.appendChild(el('h2', { class: 'section-title' }, 'Importer'));
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files[0]) return;
    if (!confirm('Importer remplacera toutes les données actuelles. Continuer ?')) { fileInput.value = ''; return; }
    try {
      const n = await importJSONFile(fileInput.files[0]);
      toast(`Import réussi (${n.exercices} ex., ${n.seances} séances, ${n.series} séries)`, 'success');
    } catch (e) {
      toast('Import impossible : ' + e.message, 'warn');
    }
    fileInput.value = '';
  });
  main.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'muted small' }, 'Restaure un export JSON. Écrase les données existantes.'),
    el('button', { class: 'btn btn-ghost', onclick: () => fileInput.click() }, '⤒ Importer un JSON (tout)'),
    fileInput,
  ]));

  // Import de mesures — NON destructif (ajoute aux données existantes)
  const mesInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  mesInput.addEventListener('change', async () => {
    if (!mesInput.files[0]) return;
    try {
      const n = await importMesuresFile(mesInput.files[0]);
      toast(`Mesures importées (+${n.nouveauxTypes} type(s), +${n.nouvellesMesures} relevé(s))`, 'success');
      location.hash = '#/mesures';
    } catch (e) {
      toast('Import impossible : ' + e.message, 'warn');
    }
    mesInput.value = '';
  });
  main.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'muted small' }, 'Ajoute des mesures corporelles (ex. export de balance converti via tools/) sans rien écraser.'),
    el('button', { class: 'btn btn-ghost', onclick: () => mesInput.click() }, '⤒ Importer des mesures'),
    mesInput,
  ]));

  main.appendChild(el('h2', { class: 'section-title' }, 'Données d’exemple'));
  main.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'muted small' }, 'Ajoute 4 exercices et 8 séances fictives pour explorer l’app (progression de la série 1, alertes de seuil, graphes).'),
    el('button', { class: 'btn btn-ghost', onclick: loadExampleData }, '✨ Charger des données d’exemple'),
  ]));

  main.appendChild(el('h2', { class: 'section-title' }, 'Zone de danger'));
  main.appendChild(el('div', { class: 'card stack' }, [
    el('button', { class: 'btn btn-danger', onclick: async () => {
      if (!confirm('Effacer TOUTES les données ? Irréversible.')) return;
      const { clearAll } = await import('./db.js');
      await clearAll();
      toast(sync.status().connected ? 'Données effacées sur cet appareil — la prochaine synchro te demandera quoi faire de Drive' : 'Données effacées');
    } }, 'Tout effacer'),
  ]));

  main.appendChild(el('p', { class: 'muted small center', style: 'margin-top:24px' }, 'Série 1 — fonctionne hors-ligne. Les données restent sur l’appareil, et dans TON Google Drive si tu actives la synchro. Rien d’autre.'));

  mount(el('div', {}, [header('Réglages', { back: '#/' }), main]));
}

// ======================================================================
// MESURES (suivi corporel)
// ======================================================================

// Sélecteur d'unité : liste déroulante + « Autre… » en saisie libre.
function unitControl(value = 'cm') {
  const known = mesures.UNITES.includes(value);
  const select = el('select', { class: 'search' }, [
    ...mesures.UNITES.map((u) => el('option', { value: u, selected: known && u === value }, u)),
    el('option', { value: '__autre__', selected: !known }, 'Autre…'),
  ]);
  const autre = el('input', { type: 'text', class: 'search', placeholder: 'unité', value: known ? '' : value, style: known ? 'display:none' : '' });
  select.addEventListener('change', () => { autre.style.display = select.value === '__autre__' ? '' : 'none'; });
  return {
    wrap: el('div', { class: 'stack' }, [select, autre]),
    get: () => (select.value === '__autre__' ? autre.value.trim() : select.value),
  };
}

// Feuille de sélection d'un type de mesure (existant, suggestion, ou custom).
async function pickMesureType(onPick) {
  const types = await mesures.listMesureTypes();
  const existants = new Set(types.map((t) => t.nom.toLowerCase()));
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const listWrap = el('div', { class: 'sheet-list' });

  const render = () => {
    listWrap.replaceChildren();
    const f = search.value.trim().toLowerCase();
    const match = (t) => t.toLowerCase().includes(f);

    for (const t of types.filter((t) => match(t.nom))) {
      listWrap.appendChild(el('button', { class: 'sheet-item', onclick: () => { overlay.remove(); onPick(t); } }, [
        el('span', {}, t.nom), el('span', { class: 'tag' }, t.unite || '—'),
      ]));
    }
    const sugg = mesures.MESURES_STANDARDS.filter((s) => !existants.has(s.nom.toLowerCase()) && match(s.nom));
    if (sugg.length) {
      listWrap.appendChild(el('div', { class: 'sheet-section' }, 'Suggestions'));
      for (const s of sugg) {
        listWrap.appendChild(el('button', { class: 'sheet-item suggestion', onclick: async () => {
          const t = await mesures.createMesureType(s); overlay.remove(); onPick(t);
        } }, [el('span', {}, s.nom), el('span', { class: 'tag' }, s.unite)]));
      }
    }
    const exact = f && (existants.has(f) || mesures.MESURES_STANDARDS.some((s) => s.nom.toLowerCase() === f));
    if (f && !exact) {
      const unit = unitControl('cm');
      listWrap.appendChild(el('div', { class: 'sheet-custom' }, [
        el('div', { class: 'mini-label' }, [`Unité de « ${search.value.trim()} »`, unit.wrap]),
        el('button', { class: 'btn btn-primary', onclick: async () => {
          const t = await mesures.createMesureType({ nom: search.value, unite: unit.get() });
          overlay.remove(); onPick(t);
        } }, `Créer « ${search.value.trim()} »`),
      ]));
    }
  };

  const search = el('input', { type: 'text', class: 'search', placeholder: 'Rechercher, choisir ou créer une mesure…', oninput: render });
  overlay.appendChild(el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-handle' }),
    el('h3', {}, 'Ajouter une mesure'),
    search, listWrap,
  ]));
  render();
  document.body.appendChild(overlay);
  setTimeout(() => search.focus(), 50);
}

// Liste des mesures (petits multiples), comme la page Progression.
async function renderMesures() {
  const types = await mesures.listMesureTypes();
  const main = el('main', { class: 'container' });
  main.appendChild(el('button', { class: 'btn btn-primary btn-big', onclick: () => (location.hash = '#/prise') }, '＋ Nouvelle prise de mesures'));

  if (!types.length) {
    main.appendChild(el('p', { class: 'muted center' }, 'Aucune mesure. Lance une prise pour choisir ce que tu suis (tour de taille, poids…).'));
  }

  for (const t of types) {
    const ms = await mesures.mesuresOfType(t.id);
    const card = el('button', { class: 'card prog-card', onclick: () => (location.hash = `#/mesure/${t.id}`) }, []);
    const head = el('div', { class: 'prog-head' }, [
      el('div', { class: 'prog-title' }, [
        el('div', { class: 'card-title' }, t.nom),
        el('div', { class: 'muted small' }, `${ms.length} relevé${ms.length > 1 ? 's' : ''}${t.unite ? ' · ' + t.unite : ''}`),
      ]),
    ]);
    if (ms.length) {
      const first = ms[0].valeur, lastV = ms[ms.length - 1].valeur, d = Math.round((lastV - first) * 10) / 10;
      head.appendChild(el('div', { class: 'trend' }, [
        el('span', { class: 'trend-now' }, `${round1(lastV)} ${t.unite}`),
        ms.length > 1 ? el('span', { class: 'trend-delta muted' }, `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} depuis le début`) : el('span', {}),
      ]));
    }
    card.appendChild(head);
    card.appendChild(serie1Chart(ms.map((m) => ({ date: m.date, poids: m.valeur })), { valueOf: (x) => x.poids, compact: true, timeAxis: true }));
    main.appendChild(card);
  }

  mount(el('div', {}, [header('Mesures', { back: '#/' }), main]));
}

// Prise de mesures groupée (option A) : une date, plusieurs valeurs d'un coup.
async function renderNouvelleMesure() {
  const types = await mesures.listMesureTypes();
  const main = el('main', { class: 'container' });
  const dateInput = el('input', { type: 'date', value: store.todayISO(), class: 'date-input' });

  main.appendChild(el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Date'), dateInput]));

  const inputs = new Map(); // typeId -> input
  const list = el('div', { class: 'stack' });
  for (const t of types) {
    const last = await mesures.latestForType(t.id);
    const inp = el('input', { type: 'text', inputmode: 'decimal', class: 'mesure-val', placeholder: last ? `dernier : ${round1(last.valeur)}` : '—' });
    inputs.set(t.id, inp);
    list.appendChild(el('label', { class: 'mesure-row' }, [
      el('span', { class: 'mesure-nom' }, [t.nom, el('span', { class: 'tag' }, t.unite || '')]),
      inp,
    ]));
  }
  main.appendChild(list);
  if (!types.length) main.appendChild(el('p', { class: 'muted center' }, 'Ajoute une mesure pour commencer.'));

  main.appendChild(el('button', { class: 'btn btn-ghost btn-big', onclick: () => pickMesureType(() => renderNouvelleMesure()) }, '＋ Ajouter une mesure'));
  main.appendChild(el('button', { class: 'btn btn-primary btn-big', onclick: async () => {
    const date = dateInput.value;
    let n = 0;
    for (const [typeId, inp] of inputs) {
      const raw = inp.value.trim();
      if (raw === '') continue;
      await mesures.addMesure({ typeId, date, valeur: raw });
      n++;
    }
    if (!n) { toast('Renseigne au moins une valeur', 'warn'); return; }
    toast(`${n} mesure${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}`, 'success');
    location.hash = '#/mesures';
  } }, 'Enregistrer'));

  mount(el('div', {}, [header('Prise de mesures', { back: '#/mesures' }), main]));
}

// Détail d'une mesure : courbe (axe temporel) + historique + réglage + suppression.
async function renderMesure(id) {
  const t = await mesures.getMesureType(id);
  if (!t) { mount(el('div', {}, [header('Mesure', { back: '#/mesures' }), el('main', { class: 'container' }, el('p', { class: 'muted' }, 'Introuvable.'))])); return; }
  const ms = await mesures.mesuresOfType(id);
  const main = el('main', { class: 'container' });

  main.appendChild(el('h2', { class: 'section-title' }, `Évolution · ${t.unite || ''}`));
  main.appendChild(el('div', { class: 'card' }, serie1Chart(ms.map((m) => ({ date: m.date, poids: m.valeur })), { valueOf: (x) => x.poids, timeAxis: true })));

  // Ajout rapide d'une valeur à une date
  const dateInput = el('input', { type: 'date', value: new Date().toISOString().slice(0, 10), class: 'date-input' });
  const valInput = el('input', { type: 'text', inputmode: 'decimal', class: 'mesure-val', placeholder: `valeur (${t.unite})` });
  main.appendChild(el('section', { class: 'card stack' }, [
    el('div', { class: 'add-grid' }, [
      el('label', { class: 'mini-label' }, ['Date', dateInput]),
      el('label', { class: 'mini-label' }, [`Valeur (${t.unite})`, valInput]),
    ]),
    el('button', { class: 'btn btn-primary', onclick: async () => {
      if (valInput.value.trim() === '') { toast('Valeur manquante', 'warn'); return; }
      await mesures.addMesure({ typeId: id, date: dateInput.value, valeur: valInput.value });
      toast('Ajouté', 'success'); renderMesure(id);
    } }, 'Ajouter un relevé'),
  ]));

  // Historique (antéchronologique)
  main.appendChild(el('h2', { class: 'section-title' }, 'Historique'));
  const histWrap = el('div', { class: 'stack' });
  if (!ms.length) histWrap.appendChild(el('p', { class: 'muted' }, 'Aucun relevé.'));
  for (const m of [...ms].reverse()) {
    histWrap.appendChild(el('div', { class: 'serie-row' }, [
      el('span', { class: 'pos', style: 'width:auto' }, store.formatDateFR(m.date)),
      el('span', { class: 'perf' }, `${round1(m.valeur)} ${t.unite}`),
      el('span', {}),
      el('button', { class: 'mini-btn', 'aria-label': 'Supprimer', onclick: async () => { await mesures.deleteMesure(m.id); renderMesure(id); } }, '×'),
    ]));
  }
  main.appendChild(histWrap);

  // Zone réglage/suppression du type
  main.appendChild(el('h2', { class: 'section-title' }, 'Réglages de la mesure'));
  main.appendChild(el('div', { class: 'card stack' }, [
    el('button', { class: 'btn btn-danger', onclick: async () => {
      if (!confirm(`Supprimer « ${t.nom} » et ses ${ms.length} relevés ?`)) return;
      await mesures.deleteMesureType(id); location.hash = '#/mesures'; toast('Mesure supprimée');
    } }, 'Supprimer cette mesure'),
  ]));

  mount(el('div', {}, [header(t.nom, { back: '#/mesures' }), main]));
}

// ======================================================================
// ROUTEUR
// ======================================================================
export function router() {
  const hash = location.hash || '#/';
  const [, route, arg] = hash.split('/');
  try {
    if (route === 'seance' && arg) return renderSeance(arg);
    if (route === 'exercice' && arg) return renderExercice(arg);
    if (route === 'exercices') return renderExercices();
    if (route === 'progression') return renderProgression();
    if (route === 'mesures') return renderMesures();
    if (route === 'prise') return renderNouvelleMesure();
    if (route === 'mesure' && arg) return renderMesure(arg);
    if (route === 'reglages') return renderReglages();
    return renderHome();
  } catch (e) {
    console.error(e);
    toast('Erreur : ' + e.message, 'warn');
  }
}
