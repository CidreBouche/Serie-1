// drive.js — transport Google Drive pour la synchro : un seul fichier JSON,
// visible dans le Drive de l'utilisateur.
//
// - Authentification : Google Identity Services (modèle « jeton »), sans backend.
//   Le jeton d'accès dure ~1 h et n'est gardé qu'en mémoire ; en redemander un
//   ouvre brièvement une fenêtre Google, donc seulement sur un geste (tap).
// - Portée `drive.file` : l'app ne voit QUE les fichiers qu'elle a créés, pas le
//   reste du Drive.

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const FILE_NAME = 'serie1-donnees.json';
const LS_FILE = 'serie1.sync.fileId';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

let token = null;
let tokenExp = 0;
let gisPromise = null;

function authError(message) {
  const e = new Error(message);
  e.code = 'auth';
  return e;
}

// Charge la librairie Google (une fois). Appelée en avance au démarrage pour que
// le tap « Synchroniser » ouvre la fenêtre sans délai (sinon le navigateur peut
// la bloquer comme pop-up).
export function loadGIS() {
  if (globalThis.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisPromise = null;
        reject(new Error('Impossible de joindre Google (hors-ligne ?)'));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

export function hasValidToken() {
  return !!token && Date.now() < tokenExp - 60000;
}

// Garantit un jeton valide. `interactive` = on a le droit d'ouvrir la fenêtre Google.
export async function ensureToken(clientId, interactive) {
  if (hasValidToken()) return token;
  if (!interactive) throw authError('Reconnexion Google nécessaire');
  await loadGIS();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(authError('Google a refusé l’accès : ' + (resp.error_description || resp.error)));
        token = resp.access_token;
        tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        resolve(token);
      },
      error_callback: (err) => {
        const t = err && err.type;
        if (t === 'popup_failed_to_open') reject(authError('Fenêtre Google bloquée — autorise les pop-ups pour ce site.'));
        else if (t === 'popup_closed') reject(authError('Connexion Google annulée.'));
        else reject(authError('Connexion Google impossible.'));
      },
    });
    // prompt '' : Google ne redemande le consentement que la première fois.
    client.requestAccessToken({ prompt: '' });
  });
}

export function forget() {
  try {
    if (token && globalThis.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(token, () => {});
  } catch (e) { /* sans importance */ }
  token = null;
  tokenExp = 0;
  localStorage.removeItem(LS_FILE);
}

async function api(url, opts = {}, { allow404 = false } = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (r.status === 401) {
    token = null;
    throw authError('Session Google expirée');
  }
  if (r.status === 404 && allow404) return null;
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).error.message; } catch (e) { /* corps non JSON */ }
    throw new Error(`Google Drive a répondu ${r.status}${detail ? ' — ' + detail : ''}`);
  }
  return r;
}

// Renvoie { data } (contenu du fichier) ou null s'il n'existe pas encore.
export async function load() {
  let id = localStorage.getItem(LS_FILE);
  if (id) {
    const r = await api(`${API}/${id}?fields=id,trashed`, {}, { allow404: true });
    if (!r || (await r.json()).trashed) {
      id = null;
      localStorage.removeItem(LS_FILE);
    }
  }
  if (!id) {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const r = await api(`${API}?q=${q}&orderBy=modifiedTime%20desc&pageSize=5&fields=files(id,modifiedTime)`);
    const { files } = await r.json();
    if (!files || !files.length) return null;
    id = files[0].id;
    localStorage.setItem(LS_FILE, id);
  }
  const r = await api(`${API}/${id}?alt=media`);
  try {
    return { data: await r.json() };
  } catch (e) {
    throw new Error(`Le fichier ${FILE_NAME} sur Drive est illisible (JSON invalide).`);
  }
}

// Écrit le fichier (création au premier appel, remplacement ensuite).
export async function save(data) {
  const body = JSON.stringify(data);
  let id = localStorage.getItem(LS_FILE);
  if (id) {
    await api(`${UPLOAD}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    return;
  }
  const boundary = 'serie1-' + Date.now();
  const meta = JSON.stringify({ name: FILE_NAME, mimeType: 'application/json' });
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await api(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  id = (await r.json()).id;
  localStorage.setItem(LS_FILE, id);
}
