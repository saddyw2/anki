/* Utilidades puras (sin DOM). */
(function (S) {
  'use strict';

  const DAY = 86400000;
  const HOUR = 3600000;
  const MIN = 60000;

  function uid(prefix) {
    const rnd = Math.random().toString(36).slice(2, 8);
    return (prefix || '') + Date.now().toString(36) + rnd;
  }

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  function round(x, d) {
    const f = Math.pow(10, d || 0);
    return Math.round(x * f) / f;
  }

  /** Formatea un número con coma decimal (es). */
  function num(x, d) {
    if (x === null || x === undefined || Number.isNaN(x)) return '—';
    const v = d === undefined ? x : round(x, d);
    // Coma decimal y separador de miles a partir de 5 cifras (17.800).
    try {
      return v.toLocaleString('es-ES', { maximumFractionDigits: 6 });
    } catch (e) {
      return String(v).replace('.', ',');
    }
  }

  /** Acepta "7,25" o "7.25". Devuelve NaN si no es un número. */
  function parseNum(s) {
    if (typeof s === 'number') return s;
    if (s === null || s === undefined) return NaN;
    const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
    if (!/^[-+]?\d*\.?\d+$/.test(t)) return NaN;
    return parseFloat(t);
  }

  function pct(x) {
    return Math.round(clamp(x, 0, 1) * 100);
  }

  /** Normaliza texto para comparar palabras clave: minúsculas, sin tildes. */
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9₀-₉⁺⁻%.,/ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Generador pseudoaleatorio reproducible (mulberry32).
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    const r = rand || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pick(arr, rand) {
    const r = rand || Math.random;
    return arr[Math.floor(r() * arr.length)];
  }

  function randInt(lo, hi, rand) {
    const r = rand || Math.random;
    return lo + Math.floor(r() * (hi - lo + 1));
  }

  function randStep(lo, hi, step, rand) {
    const n = Math.round((hi - lo) / step);
    return round(lo + randInt(0, n, rand) * step, 4);
  }

  function groupBy(arr, fn) {
    const out = {};
    for (const x of arr) {
      const k = fn(x);
      (out[k] = out[k] || []).push(x);
    }
    return out;
  }

  function sum(arr, fn) {
    let s = 0;
    for (const x of arr) s += fn ? fn(x) : x;
    return s;
  }

  function mean(arr, fn) {
    return arr.length ? sum(arr, fn) / arr.length : 0;
  }

  function fmtClock(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m).padStart(2, '0');
    return (h ? h + ':' : '') + mm + ':' + String(ss).padStart(2, '0');
  }

  function fmtDuration(ms) {
    const s = Math.round(ms / 1000);
    if (ms > 0 && s < 1) return '<1 s';
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return m + ' min' + (r ? ' ' + r + ' s' : '');
    const h = Math.floor(m / 60);
    return h + ' h ' + (m % 60) + ' min';
  }

  function fmtDate(t) {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(t) {
    if (!t) return '—';
    const d = new Date(t);
    return (
      d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) +
      ' ' +
      d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    );
  }

  /** "en 3 días", "hace 2 h"… */
  function fmtRelative(t, now) {
    const n = now || Date.now();
    const d = t - n;
    const a = Math.abs(d);
    let s;
    if (a < MIN) s = 'menos de 1 min';
    else if (a < HOUR) s = Math.round(a / MIN) + ' min';
    else if (a < DAY) s = Math.round(a / HOUR) + ' h';
    else s = Math.round(a / DAY) + (Math.round(a / DAY) === 1 ? ' día' : ' días');
    return d >= 0 ? 'en ' + s : 'hace ' + s;
  }

  function dayKey(t) {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function deepClone(x) {
    return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  }

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Marcado mínimo del contenido: **negrita**, _cursiva_, saltos de línea.
   *  Todo lo demás se escapa. */
  function rich(s) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])_(.+?)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br>');
  }

  S.util = {
    DAY,
    HOUR,
    MIN,
    uid,
    clamp,
    round,
    num,
    parseNum,
    pct,
    norm,
    rng,
    shuffle,
    pick,
    randInt,
    randStep,
    groupBy,
    sum,
    mean,
    fmtClock,
    fmtDuration,
    fmtDate,
    fmtDateTime,
    fmtRelative,
    dayKey,
    deepClone,
    escapeHtml,
    rich,
  };
})(window.SolMed);
