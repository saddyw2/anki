// Pruebas unitarias de Sol MED (sin navegador).
//   node --test tests/unit.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSolMed, scriptList } from './harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
const MIN = 60000;

function fresh() {
  const S = loadSolMed();
  S.store.load();
  S.registry.finalize();
  return S;
}

// ---------------------------------------------------------------- contenido
test('el contenido médico se valida sin errores ni avisos', () => {
  const S = fresh();
  const p = S.registry.problems;
  assert.equal(p.errors.length, 0, p.errors.join('\n'));
  assert.equal(p.warnings.length, 0, p.warnings.join('\n'));
  const R = S.registry;
  const types = new Set(R.items.map((i) => i.type));
  for (const t of ['mcq', 'case', 'progressive', 'reasoning', 'lab']) assert.ok(types.has(t), 'falta tipo ' + t);
  for (const id of ['cad', 'ehh', 'hipotiroidismo', 'hipertiroidismo', 'hsa']) {
    const t = R.topicById[id];
    assert.ok(t, 'falta tema ' + id);
    assert.ok(t.items.filter((i) => i.type === 'mcq').length >= 10, id + ': al menos 10 preguntas');
    assert.ok(t.sheet.length >= 12, id + ': ficha completa');
  }
});

test('cada pregunta tiene una única mejor respuesta y opciones distintas', () => {
  const S = fresh();
  for (const it of S.registry.items)
    for (const s of it.steps)
      if (s.kind === 'mcq') {
        assert.ok(s.answer >= 0 && s.answer < s.options.length, it.id);
        assert.equal(new Set(s.options.map((o) => o.t)).size, s.options.length, it.id);
      }
});

test('los casos progresivos no tienen etapas inalcanzables ni bucles', () => {
  const S = fresh();
  for (const it of S.registry.items.filter((i) => i.type === 'progressive')) {
    const byStage = Object.fromEntries(it.steps.map((s) => [s.stageId, s.index]));
    const reach = new Set();
    const walk = (i, depth) => {
      assert.ok(depth < 40, it.id + ': posible bucle');
      if (i === null || i === undefined || i >= it.steps.length) return;
      reach.add(i);
      const s = it.steps[i];
      const nexts = new Set();
      if (s.kind === 'mcq') for (const o of s.options) if (o.next) nexts.add(byStage[o.next]);
      if (s.goto) nexts.add(byStage[s.goto]);
      else if (!s.end) nexts.add(i + 1);
      for (const n of nexts) walk(n, depth + 1);
    };
    walk(0, 0);
    assert.equal(reach.size, it.steps.length, it.id + ': etapas inalcanzables');
    assert.ok(it.steps.some((s) => s.end), it.id + ': sin cierre');
  }
});

test('el service worker cachea exactamente los scripts de index.html', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const s of scriptList()) assert.ok(sw.includes("'" + s + "'"), 'sw.js no incluye ' + s);
  const listed = [...sw.matchAll(/'((?:js|content)\/[^']+)'/g)].map((m) => m[1]);
  for (const s of listed) assert.ok(scriptList().includes(s), 'sw.js incluye un archivo que no existe en index.html: ' + s);
});

// ---------------------------------------------------------------- cálculos
test('los cálculos dan los valores esperados', () => {
  const S = fresh();
  const c = (id, x) => S.registry.calcById[id].compute(x);
  assert.equal(c('anion_gap', { na: 132, cl: 96, hco3: 9 }), 27);
  assert.equal(Math.round(c('ag_albumina', { na: 136, cl: 104, hco3: 18, alb: 2.0 }) * 10) / 10, 19);
  assert.equal(c('na_corregido', { na: 129, glu: 600 }), 137);
  assert.equal(Math.round(c('osm_calc', { na: 140, glu: 900, bun: 56 })), 350);
  assert.equal(Math.round(c('osm_ef', { na: 138, glu: 540 })), 306);
  assert.equal(c('winter', { hco3: 7, paco2: 19 }), 18.5);
  assert.equal(c('delta_delta', { na: 138, cl: 86, hco3: 20 }), 5);
  assert.equal(Math.round(c('deficit_agua', { peso: 60, na: 160, frac: 0.5 }) * 100) / 100, 4.29);
  assert.equal(Math.round(c('calcio_corregido', { ca: 7.6, alb: 2.5 }) * 10) / 10, 8.8);
});

test('los generadores de cálculos producen datos fisiológicamente plausibles', () => {
  const S = fresh();
  for (const calc of S.registry.calcs) {
    for (let seed = 1; seed <= 300; seed++) {
      const it = S.gen.calcItem(calc.id, seed);
      const x = it.steps[0].inputs;
      const r = calc.compute(x);
      assert.ok(Number.isFinite(r), calc.id + ' no finito con semilla ' + seed);
      if (x.cl !== undefined) assert.ok(x.cl >= 75 && x.cl <= 125, calc.id + ': cloro irreal ' + x.cl);
      if (x.na !== undefined) assert.ok(x.na >= 110 && x.na <= 175, calc.id + ': sodio irreal ' + x.na);
      assert.ok(calc.substitute(x).length > 5);
      assert.ok(calc.interpret(r, x).length > 5);
      assert.ok(calc.implication(r, x).length > 5);
    }
  }
});

test('los ejercicios de valores clasifican bien alto/normal/bajo', () => {
  const S = fresh();
  const R = S.registry;
  for (const v of R.values.filter((x) => typeof x.low === 'number')) {
    for (let seed = 1; seed <= 120; seed++) {
      for (const mode of ['dir', 'normal']) {
        const it = S.gen.valueItem(v.id, seed, mode);
        const step = it.steps[0];
        const m = /: ([\d.,]+)/.exec(step.stem);
        assert.ok(m, v.id + ': sin valor en el enunciado');
        const x = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        const flag = x < v.low ? 'L' : x > v.high ? 'H' : 'N';
        const chosen = step.options[step.answer].t;
        if (mode === 'dir') assert.equal(chosen, { L: 'Bajo', N: 'Normal', H: 'Alto' }[flag], v.id + ' ' + x);
        else assert.equal(chosen, flag === 'N' ? 'Normal' : 'Alterado', v.id + ' ' + x);
        if (v.oneSided === 'high') assert.notEqual(flag, 'L', v.id + ': no debe generar bajos');
        if (v.oneSided === 'low') assert.notEqual(flag, 'H', v.id + ': no debe generar altos');
      }
    }
  }
});

// ---------------------------------------------------------------- motor
function att(S, over) {
  return Object.assign({ id: S.util.uid('a'), t: Date.now(), item: 'cad:q01', step: 0, topic: 'cad', sub: 'dx', concepts: ['cad.criterios'], cat: 'diagnostico', diff: 2, kind: 'mcq', score: 1, mode: 'practice' }, over);
}

test('repetición espaciada: fallo → ≥10 min; aciertos a tiempo → 1, 3 y ×facilidad', () => {
  const S = fresh();
  const E = S.engine;
  const t0 = Date.UTC(2026, 0, 1);
  let list = [att(S, { t: t0, score: 0 })];
  let c = E.derive(list, t0).concepts['cad.criterios'];
  assert.equal(c.due, t0 + 10 * MIN);
  assert.ok(c.mastery <= 0.55);
  list.push(att(S, { t: t0 + 20 * MIN, score: 1 }));
  c = E.derive(list, t0 + 20 * MIN).concepts['cad.criterios'];
  assert.equal(c.interval, 1);
  // Acierto antes de tiempo: no alarga el intervalo.
  list.push(att(S, { t: t0 + 30 * MIN, score: 1 }));
  c = E.derive(list, t0 + 30 * MIN).concepts['cad.criterios'];
  assert.equal(c.interval, 1);
  list.push(att(S, { t: t0 + 20 * MIN + 1 * DAY + 1, score: 1 }));
  c = E.derive(list, t0 + 2 * DAY).concepts['cad.criterios'];
  assert.equal(c.interval, 3);
  list.push(att(S, { t: t0 + 5 * DAY, score: 1 }));
  c = E.derive(list, t0 + 5 * DAY).concepts['cad.criterios'];
  assert.ok(c.interval > 3 && c.interval < 12, 'intervalo ' + c.interval);
});

test('un acierto adivinado no cuenta como dominio', () => {
  const S = fresh();
  const E = S.engine;
  const t0 = Date.UTC(2026, 0, 1);
  const list = [att(S, { t: t0, score: 1, conf: 'guess' })];
  const c = E.derive(list, t0).concepts['cad.criterios'];
  assert.equal(E.effScore(list[0]), 0.5);
  assert.ok(c.lastScore < E.P.passScore);
  assert.ok(c.mastery < 0.5);
});

test('dominio: sin datos 0; aciertos repetidos y retenidos → dominado', () => {
  const S = fresh();
  const E = S.engine;
  const t0 = Date.UTC(2026, 0, 1);
  const list = [];
  for (let i = 0; i < 6; i++) list.push(att(S, { t: t0 + i * 3 * DAY, diff: 3, conf: 'high', kind: i % 2 ? 'case' : 'mcq' }));
  const d = E.derive(list, t0 + 16 * DAY);
  assert.ok(d.concepts['cad.criterios'].mastery >= 0.85, 'dominio ' + d.concepts['cad.criterios'].mastery);
  const topic = S.registry.topicById.cad;
  const tm = E.topicMastery(d, topic);
  assert.ok(tm.m > 0 && tm.m < 0.2, 'el tema no puede estar dominado con un solo concepto');
});

test('la dificultad por tema sube con aciertos y baja con errores', () => {
  const S = fresh();
  const E = S.engine;
  const t0 = Date.UTC(2026, 0, 1);
  const good = [];
  for (let i = 0; i < 5; i++) good.push(att(S, { t: t0 + i, diff: 2 }));
  assert.equal(E.derive(good, t0).topicLevel.cad, 3);
  const bad = [];
  for (let i = 0; i < 5; i++) bad.push(att(S, { t: t0 + i, score: 0 }));
  assert.equal(E.derive(bad, t0).topicLevel.cad, 1);
});

test('«Estudiar ahora» mezcla formatos, no repite ítems y prioriza lo débil con otra pregunta', () => {
  const S = fresh();
  const E = S.engine;
  const now = Date.now();
  // Historial: falló cad:q02 (potasio) hace 2 días.
  const list = [att(S, { t: now - 2 * DAY, item: 'cad:q02', concepts: ['cad.k_tx', 'cad.secuencia'], sub: 'tx', cat: 'secuencia', score: 0, err: 'secuencia' })];
  const d = E.derive(list, now);
  const plan = E.buildStudyNow(d, { size: 10 });
  assert.equal(plan.entries.length, 10);
  const ids = plan.entries.filter((e) => e.item).map((e) => e.item.id);
  assert.equal(new Set(ids).size, ids.length, 'ítems repetidos');
  const kinds = new Set(plan.entries.map((e) => (e.item ? e.item.type : 'gen:' + e.gen.kind)));
  assert.ok(kinds.has('gen:calc'), 'sin cálculo');
  assert.ok([...kinds].some((k) => k === 'case' || k === 'progressive'), 'sin caso');
  assert.ok(kinds.has('lab'), 'sin laboratorio');
  const weak = plan.entries.filter((e) => e.why === 'repaso' || e.why === 'debil');
  assert.ok(weak.length >= 1, 'no prioriza el concepto fallado');
  assert.ok(!ids.includes('cad:q02'), 'repite la misma pregunta fallada teniendo alternativas');
});

test('simulacro: 30 preguntas = 32 min; casos ≈5 min; sin duplicados', () => {
  const S = fresh();
  const E = S.engine;
  const d = E.derive([], Date.now());
  const ex = E.buildExam(d, { format: 'mcq', count: 30, topics: [], diff: 'mixed' });
  assert.equal(ex.questions.length, 30);
  assert.equal(new Set(ex.questions.map((q) => q.item)).size, 30);
  assert.equal(E.examRecommendedSeconds(30, 0), 32 * 60);
  assert.equal(E.examRecommendedSeconds(0, 4), 20 * 60);
  const cases = E.buildExam(d, { format: 'cases', count: 4, topics: [], diff: 'mixed' });
  assert.equal(cases.nCases, 4);
  assert.ok(cases.questions.length >= 8);
  const mixed = E.buildExam(d, { format: 'mixed', count: 20, topics: [], diff: 'mixed' });
  assert.ok(mixed.nMcq > 0 && mixed.nCases > 0);
  const scarce = E.buildExam(d, { format: 'mcq', count: 50, topics: ['hsa'], diff: '3' });
  assert.ok(scarce.shortage, 'debe avisar de que faltan preguntas');
});

test('análisis de tiempo: no confunde rapidez con dominio', () => {
  const S = fresh();
  const ta = S.engine.timeAnalysis([
    { ms: 10000, correct: false, answered: true },
    { ms: 12000, correct: false, answered: true },
    { ms: 60000, correct: true, answered: true },
    { ms: 70000, correct: true, answered: true },
    { ms: 65000, correct: true, answered: true },
  ]);
  assert.equal(ta.fastWrong, 2);
  assert.ok(ta.accFast < ta.accSlow);
});

// ---------------------------------------------------------------- almacenamiento
test('fusión: une intentos, respeta preferencias más recientes y aplica borrados', () => {
  const S = fresh();
  const st = S.store;
  st.addAttempt(att(S, { id: 'a1', t: 1000 }));
  st.setPref('theme', 'dark');
  const local = st.get();
  const remote = { attempts: [att(S, { id: 'a1', t: 1000 }), att(S, { id: 'a2', t: 2000 })], prefs: { theme: 'light' }, prefsAt: local.prefsAt - 1000 };
  const r = st.merge(remote);
  assert.equal(r.added, 1);
  assert.equal(st.get().attempts.length, 2);
  assert.equal(st.get().prefs.theme, 'dark', 'no debe pisar una preferencia más reciente');
  st.merge({ attempts: [], prefs: { theme: 'light', sessionSize: 15 }, prefsAt: Date.now() + 1000 });
  assert.equal(st.get().prefs.theme, 'light');
  // Un borrado hecho en otro dispositivo elimina los intentos anteriores.
  st.merge({ attempts: [], resetAt: 1500 });
  assert.equal(JSON.stringify(st.get().attempts.map((a) => a.id)), JSON.stringify(['a2']));
});

test('respaldo: exportar → importar reproduce el progreso y rechaza archivos ajenos', () => {
  const A = fresh();
  A.store.addAttempt(att(A, { id: 'x1' }));
  A.store.addExam({ id: 'e1', startedAt: Date.now(), finishedAt: Date.now(), result: { total: 1, correct: 1 } });
  const backup = JSON.parse(JSON.stringify(A.store.exportBackup()));
  assert.ok(!JSON.stringify(backup).toLowerCase().includes('password'));
  const B = fresh();
  assert.equal(B.store.inspectBackup({ foo: 1 }).ok, false);
  assert.equal(B.store.inspectBackup(Object.assign({}, backup, { schema: 99 })).ok, false);
  const r = B.store.importBackup(backup, 'merge');
  assert.equal(r.ok, true);
  assert.equal(B.store.get().attempts.length, 1);
  assert.equal(B.store.get().exams.length, 1);
  B.store.importBackup(backup, 'merge');
  assert.equal(B.store.get().attempts.length, 1, 'importar dos veces no duplica');
});

// ---------------------------------------------------------------- sincronización
function fakeDb() {
  const docs = new Map();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const docRef = (p) => ({
    id: p.split('/').pop(),
    path: p,
    get: async () => ({ exists: docs.has(p), data: () => (docs.has(p) ? clone(docs.get(p)) : undefined) }),
    set: async (d) => void docs.set(p, clone(d)),
    delete: async () => void docs.delete(p),
    collection: (c) => colRef(p + '/' + c),
  });
  const colRef = (p) => ({
    path: p,
    doc: (id) => docRef(p + '/' + id),
    get: async () => {
      const list = [...docs.keys()]
        .filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'))
        .map((k) => ({ id: k.split('/').pop(), exists: true, data: () => clone(docs.get(k)) }));
      return { docs: list, size: list.length, empty: !list.length };
    },
  });
  return { doc: docRef, collection: colRef, docs };
}

function device(db, uid) {
  const claude = { use: async (n) => (n === 'db' ? db : n === 'user' ? { id: async () => uid } : null) };
  const S = loadSolMed({ claude });
  S.store.load();
  S.registry.finalize();
  return S;
}

test('sincronización entre dos dispositivos con la base de datos de la cuenta', async () => {
  const db = fakeDb();
  const pc = device(db, 'u_1');
  const phone = device(db, 'u_1');
  let info = await pc.sync.init();
  assert.equal(info.adapter, 'claude');
  await phone.sync.init();
  for (let i = 0; i < 3; i++) pc.store.addAttempt(att(pc, { t: Date.now() - 5000 + i }));
  phone.store.addAttempt(att(phone, { t: Date.now() - 4000 }));
  await pc.sync.syncNow();
  info = await phone.sync.syncNow();
  assert.equal(info.status, 'ok');
  await pc.sync.syncNow();
  assert.equal(pc.store.get().attempts.length, 4);
  assert.equal(phone.store.get().attempts.length, 4);
  // Los datos viven en el espacio privado del usuario.
  assert.ok([...db.docs.keys()].every((k) => k.startsWith('data/users/u_1/')));
  // Cada documento respeta el límite de tamaño.
  for (const v of db.docs.values()) assert.ok(JSON.stringify(v).length < 256 * 1024);
  // Borrar progreso en el PC se propaga al móvil.
  pc.store.reset();
  await pc.sync.syncNow();
  await phone.sync.syncNow();
  assert.equal(phone.store.get().attempts.length, 0);
  phone.store.addAttempt(att(phone, { t: Date.now() + 1 }));
  await phone.sync.syncNow();
  await pc.sync.syncNow();
  assert.equal(pc.store.get().attempts.length, 1);
});

test('sin runtime de Claude, la app funciona en modo local', async () => {
  const S = fresh();
  const info = await S.sync.init();
  assert.equal(info.adapter, 'none');
  assert.equal(info.status, 'local');
});

test('sincronización con muchos intentos: fragmentos de ≤500 y sin pérdidas', async () => {
  const db = fakeDb();
  const a = device(db, 'u_2');
  await a.sync.init();
  const t = Date.now();
  for (let i = 0; i < 1203; i++) a.store.get().attempts.push(att(a, { t: t + i, dev: a.store.get().deviceId }));
  await a.sync.syncNow();
  const logs = [...db.docs.entries()].filter(([k]) => k.includes('/log/'));
  assert.equal(logs.length, 3);
  for (const [, v] of logs) assert.ok(v.attempts.length <= 500);
  const b = device(db, 'u_2');
  await b.sync.init();
  assert.equal(b.store.get().attempts.length, 1203);
});
