// chart.js — mini graphe en ligne (SVG), zéro dépendance.
// Trace une métrique de la série 1 dans le temps. Deux modes :
//  - normal (détail exercice) : axes, graduations, dates ;
//  - compact (sparkline pour la page Progression) : juste la courbe.
// La valeur tracée est fournie par `valueOf` (charge / reps / durée selon l'exo).

import { formatDateFR, formatPerf } from './store.js';

export function serie1Chart(history, opts = {}) {
  const valueOf = opts.valueOf || ((h) => h.poids || 0);
  const compact = !!opts.compact;
  const width = opts.width || (compact ? 300 : 320);
  const height = opts.height || (compact ? 54 : 160);

  const wrap = document.createElement('div');
  wrap.className = 'chart' + (compact ? ' chart-compact' : '');

  const pts = (history || []).map((h) => ({ date: h.date, value: valueOf(h), raw: h }));

  if (!pts.length) {
    wrap.innerHTML = compact ? '' : '<p class="muted">Pas encore de données de série 1.</p>';
    return wrap;
  }
  if (pts.length === 1) {
    if (compact) {
      wrap.innerHTML = '<p class="muted small">1 seule séance</p>';
    } else {
      const p = pts[0];
      wrap.innerHTML = `<p class="muted">Une seule séance : <strong>${formatPerf(p.raw)}</strong> le ${formatDateFR(p.date)}. Le graphe s'affichera dès la 2ᵉ.</p>`;
    }
    return wrap;
  }

  const padL = compact ? 4 : 34;
  const padR = compact ? 4 : 12;
  const padT = compact ? 6 : 14;
  const padB = compact ? 6 : 26;
  const w = width, h = height;

  const ys = pts.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const ySpan = yMax - yMin || 1;

  // Position en X : soit index équi-réparti, soit proportionnelle à la DATE
  // réelle (axe temporel) — utile pour des relevés espacés irrégulièrement.
  let xFrac;
  if (opts.timeAxis) {
    const ts = pts.map((p) => Date.parse(p.date) || 0);
    const tMin = ts[0], tMax = ts[ts.length - 1], tSpan = tMax - tMin || 1;
    xFrac = (i) => (ts[i] - tMin) / tSpan;
  } else {
    xFrac = (i) => i / (pts.length - 1);
  }
  const xOf = (i) => padL + xFrac(i) * (w - padL - padR);
  const yOf = (v) => padT + (1 - (v - yMin) / ySpan) * (h - padT - padB);

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${xOf(pts.length - 1).toFixed(1)},${h - padB} L${xOf(0).toFixed(1)},${h - padB} Z`;

  let axes = '';
  if (!compact) {
    const yticks = [yMin, yMin + ySpan / 2, yMax];
    axes =
      yticks
        .map((v) => {
          const y = yOf(v).toFixed(1);
          return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" class="grid"/>
                  <text x="${padL - 6}" y="${(+y + 3).toFixed(1)}" class="ytick" text-anchor="end">${round1(v)}</text>`;
        })
        .join('') +
      `<text x="${xOf(0).toFixed(1)}" y="${h - 8}" class="xtick" text-anchor="start">${formatDateFR(pts[0].date)}</text>
       <text x="${xOf(pts.length - 1).toFixed(1)}" y="${h - 8}" class="xtick" text-anchor="end">${formatDateFR(pts[pts.length - 1].date)}</text>`;
  }

  const dotR = compact ? 2.2 : 3.5;
  const dots = pts
    .map((p, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.value).toFixed(1)}" r="${dotR}" class="dot"><title>${formatDateFR(p.date)} — ${formatPerf(p.raw)}</title></circle>`)
    .join('');

  wrap.innerHTML = `
  <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Progression de la série 1" preserveAspectRatio="xMidYMid meet">
    ${axes}
    <path d="${area}" class="area"/>
    <path d="${line}" class="stroke"/>
    ${dots}
  </svg>`;
  return wrap;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
