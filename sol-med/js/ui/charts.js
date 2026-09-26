/* Gráficos SVG ligeros (sin librerías): línea, columnas y anillo.
 * Una sola serie por gráfico, un solo eje, colores desde los tokens del
 * tema, y capa de información al pasar el puntero o tocar. */
(function (S) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  let tipEl = null;
  function tip(show, x, y, html) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tip';
      tipEl.setAttribute('role', 'status');
      document.body.appendChild(tipEl);
    }
    if (!show) {
      tipEl.hidden = true;
      return;
    }
    tipEl.hidden = false;
    tipEl.innerHTML = html;
    const w = tipEl.offsetWidth;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 12));
    tipEl.style.left = left + 'px';
    tipEl.style.top = Math.max(8, y - 44) + 'px';
  }

  /** Línea con área. points: [{label, y (0..yMax) | null, tip}] */
  function lineChart(points, opts) {
    opts = opts || {};
    const W = 640;
    const H = opts.height || 200;
    const m = { l: 38, r: 14, t: 12, b: 26 };
    const yMax = opts.yMax || 1;
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': opts.label || '' });
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const x = (i) => m.l + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
    const y = (v) => m.t + ih - (v / yMax) * ih;
    const grid = el('g', { class: 'grid' }, svg);
    const axis = el('g', { class: 'axis' }, svg);
    const ticks = opts.ticks || [0, 0.5, 1].map((f) => f * yMax);
    for (const tv of ticks) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(tv), y2: y(tv) }, grid);
      const t = el('text', { x: m.l - 6, y: y(tv) + 4, 'text-anchor': 'end' }, axis);
      t.textContent = opts.yFmt ? opts.yFmt(tv) : tv;
    }
    const every = Math.max(1, Math.ceil(points.length / 6));
    points.forEach((p, i) => {
      if (i % every === 0 || i === points.length - 1) {
        const t = el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, axis);
        t.textContent = p.label;
      }
    });
    // Segmentos continuos (los días sin datos cortan la línea).
    let seg = [];
    const segs = [];
    points.forEach((p, i) => {
      if (p.y === null || p.y === undefined) {
        if (seg.length) segs.push(seg);
        seg = [];
      } else seg.push([x(i), y(p.y)]);
    });
    if (seg.length) segs.push(seg);
    for (const sg of segs) {
      if (sg.length > 1) {
        const d = sg.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
        el('path', { class: 'area', d: d + ' L' + sg[sg.length - 1][0].toFixed(1) + ' ' + y(0) + ' L' + sg[0][0].toFixed(1) + ' ' + y(0) + ' Z' }, svg);
        el('path', { class: 'line', d }, svg);
      }
    }
    const cross = el('line', { class: 'cross', y1: m.t, y2: m.t + ih, x1: 0, x2: 0, visibility: 'hidden' }, svg);
    points.forEach((p, i) => {
      if (p.y === null || p.y === undefined) return;
      el('circle', { class: 'dot', cx: x(i), cy: y(p.y), r: points.length > 20 ? 3.5 : 4.5 }, svg);
    });
    // Capa de interacción: una franja por punto.
    const slot = points.length > 1 ? iw / (points.length - 1) : iw;
    points.forEach((p, i) => {
      const r = el('rect', { class: 'hit', x: x(i) - slot / 2, y: m.t, width: slot, height: ih }, svg);
      const show = (ev) => {
        cross.setAttribute('x1', x(i));
        cross.setAttribute('x2', x(i));
        cross.setAttribute('visibility', 'visible');
        tip(true, ev.clientX, ev.clientY, p.tip || p.label + ': ' + (p.y === null ? 'sin datos' : opts.yFmt ? opts.yFmt(p.y) : p.y));
      };
      r.addEventListener('pointermove', show);
      r.addEventListener('pointerdown', show);
      r.addEventListener('pointerleave', () => {
        cross.setAttribute('visibility', 'hidden');
        tip(false);
      });
    });
    return svg;
  }

  /** Columnas. points: [{label, v, tip}] */
  function columnChart(points, opts) {
    opts = opts || {};
    const W = 640;
    const H = opts.height || 160;
    const m = { l: 32, r: 10, t: 10, b: 24 };
    const max = Math.max(opts.min || 1, ...points.map((p) => p.v));
    const nice = niceMax(max);
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': opts.label || '' });
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const bw = iw / points.length;
    const y = (v) => m.t + ih - (v / nice) * ih;
    const grid = el('g', { class: 'grid' }, svg);
    const axis = el('g', { class: 'axis' }, svg);
    for (const tv of [0, nice / 2, nice]) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(tv), y2: y(tv) }, grid);
      const t = el('text', { x: m.l - 6, y: y(tv) + 4, 'text-anchor': 'end' }, axis);
      t.textContent = Math.round(tv);
    }
    const every = Math.max(1, Math.ceil(points.length / 6));
    points.forEach((p, i) => {
      const bx = m.l + i * bw + Math.max(1, bw * 0.18);
      const w = Math.max(2, bw - 2 * Math.max(1, bw * 0.18));
      if (p.v > 0) {
        const hgt = Math.max(2, ih - (y(p.v) - m.t));
        el('path', { class: 'barm' + (opts.alt ? ' alt' : ''), d: roundTop(bx, y(p.v), w, hgt, Math.min(4, w / 2)) }, svg);
      }
      if (i % every === 0 || i === points.length - 1) {
        const t = el('text', { x: bx + w / 2, y: H - 6, 'text-anchor': 'middle' }, axis);
        t.textContent = p.label;
      }
      const r = el('rect', { class: 'hit', x: m.l + i * bw, y: m.t, width: bw, height: ih }, svg);
      const show = (ev) => tip(true, ev.clientX, ev.clientY, p.tip || p.label + ': ' + p.v);
      r.addEventListener('pointermove', show);
      r.addEventListener('pointerdown', show);
      r.addEventListener('pointerleave', () => tip(false));
    });
    return svg;
  }

  function roundTop(x, y, w, h, r) {
    return (
      'M' + x + ' ' + (y + h) + ' V' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
      ' H' + (x + w - r) + ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + ' V' + (y + h) + ' Z'
    );
  }

  function niceMax(v) {
    if (v <= 5) return 5;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const f of [1, 2, 2.5, 5, 10]) if (v <= f * p) return f * p;
    return 10 * p;
  }

  /** Anillo de porcentaje. */
  function ring(pct, label) {
    const svg = el('svg', { viewBox: '0 0 120 120', class: 'score-ring', role: 'img', 'aria-label': (label || '') + ' ' + pct + ' %' });
    const r = 50;
    const c = 2 * Math.PI * r;
    el('circle', { cx: 60, cy: 60, r, fill: 'none', stroke: 'var(--surface-3)', 'stroke-width': 10 }, svg);
    el(
      'circle',
      {
        cx: 60,
        cy: 60,
        r,
        fill: 'none',
        stroke: 'var(--violet)',
        'stroke-width': 10,
        'stroke-linecap': 'round',
        'stroke-dasharray': ((pct / 100) * c).toFixed(1) + ' ' + c.toFixed(1),
        transform: 'rotate(-90 60 60)',
      },
      svg,
    );
    const t = el('text', { x: 60, y: 66, 'text-anchor': 'middle', fill: 'var(--ink)', 'font-size': 24, 'font-weight': 700, 'font-family': 'var(--font-display)' }, svg);
    t.textContent = pct + '%';
    return svg;
  }

  S.ui.charts = { lineChart, columnChart, ring, tip };
})(window.SolMed);
