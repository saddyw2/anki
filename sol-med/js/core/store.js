/* Almacenamiento local y modelo de datos del progreso.
 *
 * El progreso se guarda como un registro de intentos (solo se añaden). Todo
 * lo demás (repetición espaciada, dominio, puntos débiles, dificultad) se
 * recalcula a partir de ese registro en engine.js. Esto hace que fusionar
 * datos de dos dispositivos o de un respaldo sea seguro: se unen los
 * intentos por id y nunca se pisa un dato reciente con uno antiguo.
 */
(function (S) {
  'use strict';
  const U = S.util;
  const KEY = 'solmed.v1';

  const DEFAULT_PREFS = {
    theme: 'system', // 'light' | 'dark' | 'system'
    sessionSize: 10,
    reduceMotion: false,
  };

  let state = null;
  let storageOk = true;
  let storageError = '';
  let saveTimer = null;
  const listeners = [];

  function blank() {
    return {
      schema: S.schema,
      deviceId: U.uid('d'),
      attempts: [],
      exams: [],
      prefs: Object.assign({}, DEFAULT_PREFS),
      prefsAt: 0,
      resume: null,
      resumeAt: 0,
      resetAt: 0,
      meta: { createdAt: Date.now(), lastBackup: 0, lastSync: 0, lastImport: 0 },
    };
  }

  function readRaw() {
    try {
      const raw = window.localStorage.getItem(KEY);
      storageOk = true;
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      storageOk = false;
      storageError = String(e && e.message ? e.message : e);
      return null;
    }
  }

  function upgrade(s) {
    const b = blank();
    const out = Object.assign(b, s || {});
    out.prefs = Object.assign({}, DEFAULT_PREFS, (s && s.prefs) || {});
    out.meta = Object.assign(b.meta, (s && s.meta) || {});
    out.attempts = Array.isArray(out.attempts) ? out.attempts.filter(validAttempt) : [];
    out.exams = Array.isArray(out.exams) ? out.exams.filter((e) => e && e.id) : [];
    out.schema = S.schema;
    return out;
  }

  function validAttempt(a) {
    return a && typeof a.id === 'string' && typeof a.t === 'number' && typeof a.item === 'string' && typeof a.score === 'number';
  }

  function load() {
    state = upgrade(readRaw());
    return state;
  }

  function writeNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      storageOk = true;
      storageError = '';
    } catch (e) {
      storageOk = false;
      storageError = String(e && e.message ? e.message : e);
    }
  }

  function changed(what, opts) {
    if (opts && opts.immediate) writeNow();
    else {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(writeNow, 250);
    }
    for (const fn of listeners.slice()) {
      try {
        fn(what);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function on(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function get() {
    return state;
  }

  function addAttempt(a) {
    const rec = Object.assign({ id: U.uid('a'), t: Date.now(), dev: state.deviceId }, a);
    state.attempts.push(rec);
    changed('attempts', { immediate: true });
    return rec;
  }

  function addExam(exam) {
    const i = state.exams.findIndex((e) => e.id === exam.id);
    if (i >= 0) state.exams[i] = exam;
    else state.exams.push(exam);
    changed('exams', { immediate: true });
  }

  function setPref(k, v) {
    state.prefs[k] = v;
    state.prefsAt = Date.now();
    changed('prefs');
  }

  function setResume(r) {
    state.resume = r;
    state.resumeAt = Date.now();
    changed('resume', { immediate: true });
  }

  function setMeta(k, v) {
    state.meta[k] = v;
    changed('meta');
  }

  /** Une datos de otra fuente (respaldo o nube) sin perder nada reciente. */
  function merge(other) {
    if (!other) return { added: 0 };
    // Un «Borrar progreso» hecho en otro dispositivo también se aplica aquí.
    if ((other.resetAt || 0) > (state.resetAt || 0)) {
      state.resetAt = other.resetAt;
      state.attempts = state.attempts.filter((a) => a.t > state.resetAt);
      state.exams = state.exams.filter((e) => (e.finishedAt || e.startedAt || 0) > state.resetAt);
    }
    const known = new Set(state.attempts.map((a) => a.id));
    let added = 0;
    for (const a of other.attempts || []) {
      if (validAttempt(a) && a.t > (state.resetAt || 0) && !known.has(a.id)) {
        state.attempts.push(a);
        known.add(a.id);
        added++;
      }
    }
    state.attempts.sort((a, b) => a.t - b.t);
    let examsAdded = 0;
    for (const e of other.exams || []) {
      if (!e || !e.id || (e.finishedAt || e.startedAt || 0) <= (state.resetAt || 0)) continue;
      const i = state.exams.findIndex((x) => x.id === e.id);
      if (i < 0) {
        state.exams.push(e);
        examsAdded++;
      } else if ((e.updatedAt || 0) > (state.exams[i].updatedAt || 0)) state.exams[i] = e;
    }
    if ((other.prefsAt || 0) > (state.prefsAt || 0) && other.prefs) {
      state.prefs = Object.assign({}, DEFAULT_PREFS, other.prefs);
      state.prefsAt = other.prefsAt;
    }
    if ((other.resumeAt || 0) > (state.resumeAt || 0)) {
      state.resume = other.resume || null;
      state.resumeAt = other.resumeAt;
    }
    changed('merge', { immediate: true });
    return { added, examsAdded };
  }

  function exportBackup() {
    return {
      app: 'Sol MED',
      kind: 'solmed-backup',
      version: S.version,
      schema: S.schema,
      exportedAt: new Date().toISOString(),
      // Nunca se incluyen contraseñas ni credenciales: Sol MED no las guarda.
      data: {
        attempts: state.attempts,
        exams: state.exams,
        prefs: state.prefs,
        prefsAt: state.prefsAt,
        resume: state.resume,
        resumeAt: state.resumeAt,
        resetAt: state.resetAt || 0,
        meta: { createdAt: state.meta.createdAt },
      },
    };
  }

  /** Comprueba un respaldo antes de importarlo. */
  function inspectBackup(obj) {
    if (!obj || obj.kind !== 'solmed-backup' || !obj.data) return { ok: false, reason: 'El archivo no es un respaldo de Sol MED.' };
    if ((obj.schema || 0) > S.schema)
      return { ok: false, reason: 'El respaldo es de una versión más nueva de Sol MED (' + obj.version + '). Actualiza la app antes de importarlo.' };
    const attempts = Array.isArray(obj.data.attempts) ? obj.data.attempts.filter(validAttempt) : [];
    const exams = Array.isArray(obj.data.exams) ? obj.data.exams : [];
    return { ok: true, attempts: attempts.length, exams: exams.length, exportedAt: obj.exportedAt, version: obj.version };
  }

  function importBackup(obj, mode) {
    const check = inspectBackup(obj);
    if (!check.ok) return check;
    if (mode === 'replace') {
      const keep = { deviceId: state.deviceId, meta: state.meta };
      state = upgrade(obj.data);
      state.deviceId = keep.deviceId;
      state.meta = Object.assign(keep.meta, { lastImport: Date.now() });
      changed('import', { immediate: true });
      return Object.assign(check, { added: state.attempts.length });
    }
    const r = merge(obj.data);
    state.meta.lastImport = Date.now();
    changed('import', { immediate: true });
    return Object.assign(check, r);
  }

  function reset() {
    const keep = { deviceId: state.deviceId, prefs: state.prefs, prefsAt: state.prefsAt, meta: state.meta };
    state = blank();
    Object.assign(state, keep);
    state.resetAt = Date.now();
    state.resumeAt = state.resetAt;
    changed('reset', { immediate: true });
  }

  function status() {
    let bytes = 0;
    try {
      bytes = (window.localStorage.getItem(KEY) || '').length * 2;
    } catch (e) {
      /* sin acceso */
    }
    return { ok: storageOk, error: storageError, bytes, attempts: state.attempts.length, exams: state.exams.length };
  }

  // Para pruebas: permite inyectar un estado.
  function _set(s) {
    state = upgrade(s);
  }

  S.store = {
    load,
    get,
    on,
    addAttempt,
    addExam,
    setPref,
    setResume,
    setMeta,
    merge,
    exportBackup,
    inspectBackup,
    importBackup,
    reset,
    status,
    flush: writeNow,
    _set,
    DEFAULT_PREFS,
  };
})(window.SolMed);
