/* Sincronización PC ↔ cuenta ↔ Android.
 *
 * Adaptadores:
 *  - "claude": cuando Sol MED se abre como Artifact privado en claude.ai.
 *    La cuenta de Claude identifica a la persona y la base de datos del
 *    Artifact guarda el progreso en su espacio privado
 *    (data/users/<id>/…), invisible para cualquier otra persona.
 *  - ninguno: versión local (archivo o servidor propio). El progreso queda
 *    en este dispositivo; se puede mover con Exportar/Importar respaldo.
 *
 * Modelo de datos remoto (cada dispositivo escribe solo sus propios
 * fragmentos de intentos, así dos dispositivos nunca se pisan):
 *   data/users/<uid>/profile                    {prefs, prefsAt, resume, resumeAt, updatedAt}
 *   data/users/<uid>/profile/log/<device>-<n>   {attempts: [...], device, n}
 *   data/users/<uid>/profile/exams/<examId>     {exam}
 */
(function (S) {
  'use strict';
  const CHUNK = 500;

  const st = {
    adapter: 'none', // 'none' | 'claude'
    status: 'local', // 'local' | 'connecting' | 'ok' | 'error' | 'offline'
    lastSync: 0,
    lastError: '',
    busy: false,
    pushedIds: null,
    listeners: [],
  };
  let cloud = null;
  let timer = null;

  function emit() {
    for (const fn of st.listeners) {
      try {
        fn(info());
      } catch (e) {
        console.error(e);
      }
    }
  }

  function info() {
    return {
      adapter: st.adapter,
      status: st.status,
      lastSync: st.lastSync,
      lastError: st.lastError,
      busy: st.busy,
    };
  }

  function onChange(fn) {
    st.listeners.push(fn);
  }

  async function init() {
    const c = typeof window !== 'undefined' ? window.claude : null;
    if (!c || typeof c.use !== 'function') {
      st.adapter = 'none';
      st.status = 'local';
      emit();
      return info();
    }
    st.status = 'connecting';
    emit();
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) throw new Error('La base de datos de la cuenta no está disponible en esta vista.');
      const id = await user.id();
      if (!id) throw new Error('No hay una sesión de Claude con identidad en esta vista.');
      cloud = { db, base: 'data/users/' + id };
      st.adapter = 'claude';
      await syncNow();
      window.addEventListener('online', () => schedule(500));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') schedule(500);
        else flushSoon();
      });
      // Solo los cambios del usuario programan una subida; los que produce
      // la propia sincronización (merge, meta) no, para no entrar en bucle.
      S.store.on((what) => {
        if (what !== 'merge' && what !== 'meta') schedule(4000);
      });
    } catch (e) {
      st.adapter = 'none';
      st.status = 'local';
      st.lastError = String((e && e.message) || e);
      emit();
    }
    return info();
  }

  function schedule(ms) {
    if (st.adapter !== 'claude') return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow().catch(() => {}), ms);
  }

  function flushSoon() {
    schedule(50);
  }

  function profileRef() {
    return cloud.db.doc(cloud.base + '/profile');
  }

  async function pull() {
    const dev = S.store.get().deviceId;
    const [prof, logs, exams] = await Promise.all([
      profileRef().get(),
      profileRef().collection('log').get(),
      profileRef().collection('exams').get(),
    ]);
    const remote = { attempts: [], exams: [], prefs: null, prefsAt: 0, resume: null, resumeAt: 0, resetAt: 0 };
    if (prof.exists) {
      const p = prof.data();
      remote.resetAt = p.resetAt || 0;
      remote.prefs = p.prefs || null;
      remote.prefsAt = p.prefsAt || 0;
      remote.resume = p.resume || null;
      remote.resumeAt = p.resumeAt || 0;
    }
    // Fragmentos escritos por este dispositivo, en orden.
    const own = [];
    for (const doc of logs.docs) {
      const d = doc.data() || {};
      for (const a of d.attempts || []) remote.attempts.push(a);
      if (d.device === dev) own.push(d);
    }
    own.sort((a, b) => a.n - b.n);
    const ownList = [];
    for (const d of own) for (const a of d.attempts || []) ownList.push(a);
    for (const doc of exams.docs) {
      const d = doc.data() || {};
      if (d.exam) remote.exams.push(d.exam);
    }
    return { remote, ownList };
  }

  async function push(ownList) {
    const s = S.store.get();
    const dev = s.deviceId;
    const remoteIds = st.pushedIds;
    const resetAt = s.resetAt || 0;
    let base = ownList;
    // Tras «Borrar progreso», los fragmentos de este dispositivo que aún
    // contienen intentos anteriores se eliminan y se reescriben desde cero.
    // (Los de otros dispositivos se filtran al fusionar y cada uno limpia
    // los suyos en su próxima sincronización.)
    if (resetAt && ownList.some((a) => a.t <= resetAt)) {
      const docs = await profileRef().collection('log').get();
      for (const doc of docs.docs) {
        const d = doc.data() || {};
        if (d.device === dev) await profileRef().collection('log').doc(doc.id).delete();
      }
      for (const a of ownList) remoteIds.delete(a.id);
      base = [];
    }
    // Todo intento local que la nube no tiene (incluidos los importados de
    // un respaldo) se sube en los fragmentos de este dispositivo. Se añaden
    // al final, así los fragmentos completos anteriores no se reescriben.
    const pending = s.attempts.filter((a) => !remoteIds.has(a.id)).sort((a, b) => a.t - b.t);
    if (pending.length) {
      const list = base.concat(pending);
      const first = Math.floor(base.length / CHUNK);
      for (let n = first; n * CHUNK < list.length; n++) {
        const part = list.slice(n * CHUNK, (n + 1) * CHUNK);
        await profileRef()
          .collection('log')
          .doc(dev + '-' + String(n).padStart(4, '0'))
          .set({ device: dev, n, attempts: part, updatedAt: Date.now() });
        for (const a of part) remoteIds.add(a.id);
      }
    }
    // Simulacros: uno por documento.
    for (const e of s.exams) {
      if (e.syncedAt && e.syncedAt >= (e.updatedAt || 0)) continue;
      const copy = JSON.parse(JSON.stringify(e));
      delete copy.syncedAt;
      await profileRef().collection('exams').doc(e.id).set({ exam: copy, updatedAt: Date.now() });
      e.syncedAt = Date.now();
    }
    await profileRef().set({
      prefs: s.prefs,
      prefsAt: s.prefsAt || 0,
      resume: s.resume || null,
      resumeAt: s.resumeAt || 0,
      resetAt: s.resetAt || 0,
      updatedAt: Date.now(),
    });
  }

  async function syncNow() {
    if (st.adapter !== 'claude' || !cloud) return info();
    if (st.busy) return info();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      st.status = 'offline';
      emit();
      return info();
    }
    st.busy = true;
    emit();
    try {
      const { remote, ownList } = await pull();
      st.pushedIds = new Set(remote.attempts.map((a) => a.id));
      for (const e of remote.exams) e.syncedAt = e.updatedAt || Date.now();
      S.store.merge(remote);
      await push(ownList);
      st.lastSync = Date.now();
      st.status = 'ok';
      st.lastError = '';
      S.store.setMeta('lastSync', st.lastSync);
    } catch (e) {
      st.status = navigator.onLine === false ? 'offline' : 'error';
      st.lastError = describe(e);
    } finally {
      st.busy = false;
      emit();
    }
    return info();
  }

  function describe(e) {
    if (!e) return 'Error desconocido';
    if (e.code === 'quota_exceeded') return 'Se alcanzó el límite de almacenamiento de la cuenta para Sol MED. Exporta un respaldo.';
    if (e.code === 'resource_exhausted') return 'Demasiadas sincronizaciones seguidas; se reintentará en unos minutos.';
    if (e.code === 'unavailable') return 'El servicio no respondió; se reintentará.';
    if (e.code === 'revoked' || e.code === 'not_granted') return 'Esta vista ya no tiene acceso a la base de datos de la cuenta.';
    return String(e.message || e);
  }

  S.sync = { init, syncNow, info, onChange, CHUNK };
})(window.SolMed);
