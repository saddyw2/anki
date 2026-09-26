/* Motor adaptativo de Sol MED.
 *
 * Entrada: el registro de intentos (store) y el contenido (registry).
 * Salida (derivada, nunca guardada): estado de repetición espaciada por
 * concepto, dominio, puntos débiles, nivel de dificultad por tema y la
 * selección de ítems para cada modo de estudio.
 */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const { DAY, MIN, HOUR } = U;

  // ---- Parámetros del algoritmo (documentados en CONTINUIDAD.md) ----
  const P = {
    passScore: 0.6, // puntuación mínima para considerar un paso superado
    relearnDelay: 10 * MIN, // un concepto fallado vuelve tras ≥10 min, con otro ítem
    firstInterval: 1, // días
    secondInterval: 3,
    easeStart: 2.3,
    easeMin: 1.3,
    easeMax: 2.8,
    itemCooldown: 20 * HOUR, // no repetir el mismo ítem antes de esto si hay alternativas
    recencyDecay: 0.8, // peso de intentos antiguos en la precisión
    levelWindow: 6, // intentos recientes para ajustar la dificultad
  };

  const DIFF_W = { 1: 0.8, 2: 1, 3: 1.25 };

  /** Puntuación efectiva: un acierto marcado como "adiviné" vale la mitad y
   *  no demuestra dominio. */
  function effScore(a) {
    if (a.conf === 'guess' && a.score >= 1) return 0.5;
    return a.score;
  }

  /** Recalcula todo el estado derivado. Es barato: miles de intentos
   *  se procesan en milisegundos. */
  function derive(attempts, now) {
    now = now || Date.now();
    const concepts = {};
    const items = {};
    const topicLevel = {};
    const topicRecent = {};
    const sorted = attempts.slice().sort((a, b) => a.t - b.t);

    for (const a of sorted) {
      const s = effScore(a);
      const pass = s >= P.passScore;

      // Estado por ítem
      const is = items[a.item] || (items[a.item] = { n: 0, last: 0, lastScore: 0, wrong: 0 });
      is.n++;
      is.last = a.t;
      is.lastScore = s;
      if (!pass) is.wrong++;

      // Nivel de dificultad por tema (se ajusta con una ventana de intentos)
      if (a.topic && a.mode !== 'values') {
        const rec = topicRecent[a.topic] || (topicRecent[a.topic] = []);
        rec.push({ s, diff: a.diff || 2 });
        if (rec.length > P.levelWindow) rec.shift();
        const lvl = topicLevel[a.topic] || 2;
        if (rec.length >= 5) {
          const acc = U.mean(rec, (x) => x.s);
          const atLevel = rec.filter((x) => x.diff >= lvl).length;
          if (acc >= 0.8 && atLevel >= 3 && lvl < 3) {
            topicLevel[a.topic] = lvl + 1;
            rec.length = 0;
          } else if (acc <= 0.4 && lvl > 1) {
            topicLevel[a.topic] = lvl - 1;
            rec.length = 0;
          } else topicLevel[a.topic] = lvl;
        } else topicLevel[a.topic] = lvl;
      }

      for (const cid of a.concepts || []) {
        const c =
          concepts[cid] ||
          (concepts[cid] = {
            id: cid,
            n: 0,
            correct: 0,
            interval: 0,
            ease: P.easeStart,
            due: 0,
            last: 0,
            lastScore: 0,
            lapses: 0,
            streak: 0,
            hist: [],
            errs: {},
            kinds: {},
            retained: 0,
            retentionChecks: 0,
          });
        const wasDue = c.n === 0 || a.t >= c.due;
        const gapDays = c.last ? (a.t - c.last) / DAY : 0;
        c.n++;
        if (pass) c.correct++;
        c.hist.push({ t: a.t, s, diff: a.diff || 2, kind: a.kind, mode: a.mode });
        if (c.hist.length > 12) c.hist.shift();
        c.kinds[a.kind] = (c.kinds[a.kind] || 0) + 1;
        if (!pass && a.err) c.errs[a.err] = (c.errs[a.err] || 0) + 1;
        if (c.n > 1 && gapDays >= 1) {
          c.retentionChecks++;
          if (pass) c.retained++;
        }

        if (!pass) {
          c.lapses++;
          c.streak = 0;
          c.interval = 0;
          c.ease = Math.max(P.easeMin, c.ease - 0.2);
          c.due = a.t + P.relearnDelay;
        } else if (wasDue) {
          c.streak++;
          let next;
          if (c.interval <= 0) next = P.firstInterval;
          else if (c.interval < P.secondInterval) next = P.secondInterval;
          else next = c.interval * c.ease;
          if (a.conf === 'low') {
            next = Math.max(1, next * 0.6);
            c.ease = Math.max(P.easeMin, c.ease - 0.05);
          } else if (a.conf === 'high' && s >= 1) {
            c.ease = Math.min(P.easeMax, c.ease + 0.05);
          }
          if (a.conf === 'guess') next = 1;
          // Preguntas difíciles bien respondidas espacian un poco más.
          if ((a.diff || 2) === 3 && s >= 1) next *= 1.1;
          c.interval = U.round(next, 2);
          c.due = a.t + c.interval * DAY;
        } else {
          // Acierto antes de tiempo: no alarga el intervalo (evita inflarlo
          // al responder varias preguntas del mismo concepto seguidas).
          c.streak++;
        }
        c.last = a.t;
        c.lastScore = s;
      }
    }

    for (const id in concepts) concepts[id].mastery = mastery(concepts[id], now);
    return { concepts, items, topicLevel, now };
  }

  /** Dominio de un concepto (0–1). No es solo % de aciertos: combina
   *  precisión reciente ponderada por dificultad, cantidad de evidencia,
   *  retención demostrada, errores repetidos, variedad de formatos y
   *  si el repaso está atrasado. */
  function mastery(c, now) {
    if (!c || !c.n) return 0;
    let wsum = 0;
    let ssum = 0;
    const h = c.hist;
    for (let i = 0; i < h.length; i++) {
      const w = Math.pow(P.recencyDecay, h.length - 1 - i) * DIFF_W[h[i].diff || 2];
      wsum += w;
      ssum += w * h[i].s;
    }
    const acc = wsum ? ssum / wsum : 0;
    const evidence = Math.min(1, c.n / 4);
    let m = acc * (0.55 + 0.45 * evidence);
    // Retención: aciertos tras ≥1 día sin verlo.
    if (c.retentionChecks) m += 0.08 * (c.retained / c.retentionChecks);
    // Errores repetidos.
    if (c.lapses >= 2) m *= c.lapses >= 4 ? 0.85 : 0.92;
    // Variedad: demostrarlo en casos/laboratorio además de preguntas.
    const kinds = Object.keys(c.kinds).length;
    if (kinds >= 2) m += 0.03;
    // Repaso muy atrasado: el dominio se considera menos seguro.
    if (c.due && now > c.due + Math.max(1, c.interval) * DAY) m *= 0.9;
    // Si el último intento falló, no puede figurar como dominado.
    if (c.lastScore < P.passScore) m = Math.min(m, 0.55);
    return U.clamp(m, 0, 1);
  }

  function masteryLabel(m, n) {
    if (!n) return { id: 'new', label: 'Sin datos' };
    if (m >= 0.85) return { id: 'mastered', label: 'Dominado' };
    if (m >= 0.7) return { id: 'good', label: 'Bien' };
    if (m >= 0.45) return { id: 'progress', label: 'En progreso' };
    return { id: 'weak', label: 'Débil' };
  }

  // ---- Agregados para mapa de dominio y estadísticas ----

  function topicMastery(d, topic) {
    const cs = topic.concepts;
    if (!cs.length) return { m: 0, seen: 0, total: 0 };
    let seen = 0;
    const m = U.mean(cs, (c) => {
      const st = d.concepts[c.id];
      if (st && st.n) seen++;
      return st ? st.mastery : 0;
    });
    return { m, seen, total: cs.length };
  }

  function subtopicMastery(d, topic, subId) {
    const cs = topic.concepts.filter((c) => c.sub === subId);
    if (!cs.length) return null;
    let seen = 0;
    const m = U.mean(cs, (c) => {
      const st = d.concepts[c.id];
      if (st && st.n) seen++;
      return st ? st.mastery : 0;
    });
    return { m, seen, total: cs.length };
  }

  /** Precisión por categoría (diagnóstico, laboratorio, tratamiento…). */
  function byCategory(attempts, filter) {
    const out = {};
    for (const a of attempts) {
      if (filter && !filter(a)) continue;
      const k = a.cat || 'concepto';
      const o = out[k] || (out[k] = { n: 0, s: 0 });
      o.n++;
      o.s += effScore(a);
    }
    for (const k in out) out[k].acc = out[k].s / out[k].n;
    return out;
  }

  // ---- Puntos débiles y repaso ----

  function weakPoints(d, limit) {
    const list = [];
    for (const id in d.concepts) {
      const c = d.concepts[id];
      const concept = R.concepts[id];
      if (!concept) continue;
      if (c.mastery < 0.6 || c.lastScore < P.passScore) {
        const topErr = Object.keys(c.errs).sort((a, b) => c.errs[b] - c.errs[a])[0] || null;
        list.push({
          id,
          concept,
          st: c,
          topErr,
          severity: (1 - c.mastery) * (1 + Math.min(c.lapses, 4) * 0.25),
        });
      }
    }
    list.sort((a, b) => b.severity - a.severity);
    return limit ? list.slice(0, limit) : list;
  }

  /** Agrupa los puntos débiles por la naturaleza del error (sección 13). */
  function weakGroups(d) {
    const groups = {};
    for (const w of weakPoints(d)) {
      let g;
      if (w.concept.topic === 'valores') g = 'valores';
      else if (w.concept.topic === 'calculos') g = 'calculo';
      else g = w.topErr || 'conocimiento';
      (groups[g] = groups[g] || []).push(w);
    }
    return groups;
  }

  function dueConcepts(d, now) {
    now = now || Date.now();
    const out = [];
    for (const id in d.concepts) {
      const c = d.concepts[id];
      if (!R.concepts[id]) continue;
      if (c.due && c.due <= now) out.push({ id, concept: R.concepts[id], st: c, overdue: now - c.due });
    }
    out.sort((a, b) => a.st.mastery - b.st.mastery || b.overdue - a.overdue);
    return out;
  }

  function upcoming(d, now, days) {
    now = now || Date.now();
    const lim = now + (days || 7) * DAY;
    const out = [];
    for (const id in d.concepts) {
      const c = d.concepts[id];
      if (!R.concepts[id]) continue;
      if (c.due > now && c.due <= lim) out.push({ id, concept: R.concepts[id], st: c });
    }
    out.sort((a, b) => a.st.due - b.st.due);
    return out;
  }

  // ---- Selección de ítems ----

  /** Candidatos que cubren un concepto, prefiriendo ítems no vistos o no
   *  vistos recientemente, y distintos del último que se falló. */
  function itemsForConcept(cid, d, opts) {
    opts = opts || {};
    const now = d.now;
    const pool = R.items.filter(
      (it) =>
        it.steps.some((s) => s.concepts.includes(cid)) &&
        (!opts.types || opts.types.includes(it.type)) &&
        (!opts.exclude || !opts.exclude.has(it.id)),
    );
    return pool
      .map((it) => {
        const st = d.items[it.id];
        let score = 0;
        if (!st) score += 3;
        else {
          const age = now - st.last;
          if (age < P.itemCooldown) score -= 5;
          else score += Math.min(2, age / (3 * DAY));
          if (st.lastScore < P.passScore) score -= 1.5; // preferir otro ítem distinto al fallado
        }
        return { it, score: score + Math.random() * 0.5 };
      })
      .sort((a, b) => b.score - a.score);
  }

  function levelFor(d, topicId) {
    return d.topicLevel[topicId] || 2;
  }

  /** Puntuación genérica de un ítem para una sesión. */
  function scoreItem(it, d, ctx) {
    const st = d.items[it.id];
    const now = d.now;
    let s = 0;
    const level = ctx.fixedDiff || levelFor(d, it.topic);
    s -= Math.abs(it.diff - level) * 1.2;
    if (!st) s += 1.5;
    else {
      const age = now - st.last;
      if (age < P.itemCooldown) s -= 6;
      else s += Math.min(1.5, age / (5 * DAY));
    }
    let due = 0;
    let weak = 0;
    for (const s2 of it.steps)
      for (const cid of s2.concepts) {
        const c = d.concepts[cid];
        if (!c) continue;
        if (c.due && c.due <= now) due++;
        if (c.mastery < 0.6 && c.n) weak++;
      }
    s += Math.min(due, 3) * 1.2 + Math.min(weak, 3) * 1.4;
    return s + Math.random() * 0.8;
  }

  function filterItems(opts) {
    return R.items.filter(
      (it) =>
        (!opts.types || opts.types.includes(it.type)) &&
        (!opts.topics || !opts.topics.length || opts.topics.includes(it.topic)) &&
        (!opts.diff || opts.diff === 'auto' || it.diff === Number(opts.diff)),
    );
  }

  /** Selección para un modo concreto (selección múltiple, casos…). */
  function pickForMode(d, opts) {
    const pool = filterItems(opts);
    const ctx = { fixedDiff: opts.diff && opts.diff !== 'auto' ? Number(opts.diff) : null };
    const scored = pool.map((it) => ({ it, s: scoreItem(it, d, ctx) })).sort((a, b) => b.s - a.s);
    const chosen = [];
    const conceptCount = {};
    for (const { it } of scored) {
      if (chosen.length >= (opts.count || 10)) break;
      const key = it.concepts[0];
      if ((conceptCount[key] || 0) >= 2 && scored.length > (opts.count || 10) * 1.5) continue;
      conceptCount[key] = (conceptCount[key] || 0) + 1;
      chosen.push(it);
    }
    return U.shuffle(chosen);
  }

  /** «Estudiar ahora»: sesión inteligente, no aleatoria.
   *  Mezcla repasos pendientes, puntos débiles, conceptos nuevos, formatos
   *  variados (casos, laboratorio, cálculo) y una verificación de retención
   *  de algo ya dominado. Devuelve entradas {item} o {gen} (generado). */
  function buildStudyNow(d, opts) {
    const size = (opts && opts.size) || 10;
    const now = d.now;
    const out = [];
    const used = new Set();
    const usedConcepts = new Set();
    const reasons = {};

    function take(it, why) {
      if (!it || used.has(it.id) || out.length >= size) return false;
      used.add(it.id);
      for (const s of it.steps) for (const c of s.concepts) usedConcepts.add(c);
      out.push({ item: it, why });
      reasons[why] = (reasons[why] || 0) + 1;
      return true;
    }

    function takeGen(gen, why) {
      if (out.length >= size) return false;
      out.push({ gen, why });
      reasons[why] = (reasons[why] || 0) + 1;
      return true;
    }

    const content = R.topics.filter((t) => t.kind === 'topic');
    const contentTopicIds = new Set(content.map((t) => t.id));

    // 1) Repasos pendientes (hasta 35 %)
    const due = dueConcepts(d, now);
    const dueBudget = Math.ceil(size * 0.35);
    let n = 0;
    for (const x of due) {
      if (n >= dueBudget) break;
      if (usedConcepts.has(x.id)) continue;
      if (x.concept.topic === 'calculos') {
        if (takeGen({ kind: 'calc', calc: x.id.split('.')[1] }, 'repaso')) n++;
        usedConcepts.add(x.id);
        continue;
      }
      if (x.concept.topic === 'valores') {
        if (takeGen({ kind: 'value', value: x.id.split('.')[1] }, 'repaso')) n++;
        usedConcepts.add(x.id);
        continue;
      }
      const cand = itemsForConcept(x.id, d, { exclude: used })[0];
      if (cand && cand.score > -4 && take(cand.it, 'repaso')) n++;
    }

    // 2) Puntos débiles (hasta 25 %)
    const weakBudget = Math.ceil(size * 0.25);
    n = 0;
    for (const w of weakPoints(d)) {
      if (n >= weakBudget) break;
      if (usedConcepts.has(w.id)) continue;
      if (w.concept.topic === 'calculos') {
        if (takeGen({ kind: 'calc', calc: w.id.split('.')[1] }, 'debil')) n++;
        continue;
      }
      if (w.concept.topic === 'valores') {
        if (takeGen({ kind: 'value', value: w.id.split('.')[1] }, 'debil')) n++;
        continue;
      }
      const cand = itemsForConcept(w.id, d, { exclude: used })[0];
      if (cand && cand.score > -4 && take(cand.it, 'debil')) n++;
    }

    // 3) Verificación de retención de algo dominado (1)
    const mastered = Object.values(d.concepts)
      .filter((c) => c.mastery >= 0.8 && R.concepts[c.id] && contentTopicIds.has(R.concepts[c.id].topic) && !usedConcepts.has(c.id))
      .sort((a, b) => a.last - b.last);
    if (mastered.length) {
      const cand = itemsForConcept(mastered[0].id, d, { exclude: used })[0];
      if (cand && cand.score > -4) take(cand.it, 'retencion');
    }

    // 4) Formatos variados: un caso/progresivo, un laboratorio, un cálculo
    const byType = (types) =>
      filterItems({ types })
        .filter((it) => !used.has(it.id))
        .map((it) => ({ it, s: scoreItem(it, d, {}) }))
        .sort((a, b) => b.s - a.s)[0];
    const c1 = byType(['case', 'progressive']);
    if (c1 && c1.s > -3) take(c1.it, 'caso');
    const l1 = byType(['lab']);
    if (l1 && l1.s > -3) take(l1.it, 'laboratorio');
    if (R.calcs.length) {
      const calcIds = R.calcs.map((c) => c.id);
      const pref = calcIds
        .map((id) => ({ id, st: d.concepts['calculos.' + id] }))
        .sort((a, b) => (a.st ? a.st.mastery : -1) - (b.st ? b.st.mastery : -1))[0];
      takeGen({ kind: 'calc', calc: pref.id }, 'calculo');
    }

    // 5) Conceptos nuevos y el resto, por puntuación
    const rest = filterItems({ types: ['mcq', 'case', 'reasoning', 'lab', 'progressive'] })
      .filter((it) => !used.has(it.id))
      .map((it) => {
        const isNew = it.concepts.some((c) => !d.concepts[c]);
        return { it, s: scoreItem(it, d, {}) + (isNew ? 1.5 : 0), isNew };
      })
      .sort((a, b) => b.s - a.s);
    for (const r of rest) {
      if (out.length >= size) break;
      if (r.it.concepts.every((c) => usedConcepts.has(c)) && rest.length > size) continue;
      take(r.it, r.isNew ? 'nuevo' : 'practica');
    }

    // Orden: empezar con algo accesible, intercalar formatos.
    const order = { repaso: 1, retencion: 2, nuevo: 3, practica: 3, debil: 4, calculo: 5, laboratorio: 6, caso: 7 };
    out.sort((a, b) => (order[a.why] || 5) - (order[b.why] || 5));
    return { entries: out, reasons };
  }

  /** Práctica de puntos débiles o de errores de un simulacro, siempre con
   *  ítems distintos a los ya fallados cuando existen. */
  function buildWeakSession(d, conceptIds, size) {
    size = size || 10;
    const out = [];
    const used = new Set();
    const failedItems = new Set(Object.keys(d.items).filter((k) => d.items[k].lastScore < P.passScore));
    for (const cid of conceptIds) {
      if (out.length >= size) break;
      const concept = R.concepts[cid];
      if (!concept) continue;
      if (concept.topic === 'calculos') {
        out.push({ gen: { kind: 'calc', calc: cid.split('.')[1] }, why: 'debil' });
        continue;
      }
      if (concept.topic === 'valores') {
        out.push({ gen: { kind: 'value', value: cid.split('.')[1] }, why: 'debil' });
        continue;
      }
      const cands = itemsForConcept(cid, d, { exclude: used });
      const fresh = cands.find((c) => !failedItems.has(c.it.id));
      const chosen = fresh || cands[0];
      if (chosen) {
        used.add(chosen.it.id);
        out.push({ item: chosen.it, why: fresh ? 'debil' : 'debil-mismo' });
      }
    }
    return out;
  }

  // ---- Simulacro ----

  const EXAM_TIME = {
    mcqPerQuestionSec: (32 * 60) / 30, // 30 preguntas = 32 min
    casePerCaseSec: 5 * 60,
  };

  function examRecommendedSeconds(nMcq, nCases) {
    return Math.round(nMcq * EXAM_TIME.mcqPerQuestionSec + nCases * EXAM_TIME.casePerCaseSec);
  }

  /** Construye un simulacro. Devuelve {questions, nMcq, nCases, shortage}. */
  function buildExam(d, cfg) {
    const topics = cfg.topics && cfg.topics.length ? cfg.topics : null;
    const diffOpt = cfg.diff === 'mixed' || cfg.diff === 'auto' ? null : Number(cfg.diff);
    const pool = (type) =>
      R.items.filter(
        (it) => it.type === type && (!topics || topics.includes(it.topic)) && (!diffOpt || it.diff === diffOpt),
      );
    let mcqWanted = 0;
    let caseWanted = 0;
    if (cfg.format === 'mcq') mcqWanted = cfg.count;
    else if (cfg.format === 'cases') caseWanted = cfg.count;
    else {
      caseWanted = Math.max(1, Math.round(cfg.count * 0.25));
      mcqWanted = Math.max(0, cfg.count - caseWanted);
    }
    const spread = (items, n) => {
      // Reparte entre temas y prioriza lo no visto o lo débil.
      const byTopic = U.groupBy(
        items.map((it) => ({ it, s: scoreItem(it, d, { fixedDiff: diffOpt }) })).sort((a, b) => b.s - a.s),
        (x) => x.it.topic,
      );
      const keys = U.shuffle(Object.keys(byTopic));
      const out = [];
      let i = 0;
      while (out.length < n && keys.some((k) => byTopic[k].length)) {
        const k = keys[i % keys.length];
        if (byTopic[k].length) out.push(byTopic[k].shift().it);
        i++;
      }
      return out;
    };
    const mcqs = spread(pool('mcq'), mcqWanted);
    const cases = spread(pool('case'), caseWanted);
    const questions = [];
    for (const it of U.shuffle(mcqs)) questions.push({ item: it.id, step: 0 });
    for (const it of U.shuffle(cases)) it.steps.forEach((s, i) => questions.push({ item: it.id, step: i, caseGroup: it.id }));
    return {
      questions,
      nMcq: mcqs.length,
      nCases: cases.length,
      shortage: mcqs.length < mcqWanted || cases.length < caseWanted,
      wanted: { mcq: mcqWanted, cases: caseWanted },
    };
  }

  // ---- Estadísticas ----

  function dailySeries(attempts, days, now) {
    now = now || Date.now();
    const out = [];
    const byDay = U.groupBy(attempts, (a) => U.dayKey(a.t));
    for (let i = days - 1; i >= 0; i--) {
      const t = now - i * DAY;
      const k = U.dayKey(t);
      const list = byDay[k] || [];
      out.push({ day: k, t, n: list.length, acc: list.length ? U.mean(list, effScore) : null });
    }
    return out;
  }

  function errorCounts(attempts) {
    const out = {};
    for (const a of attempts) if (effScore(a) < P.passScore && a.err) out[a.err] = (out[a.err] || 0) + 1;
    return out;
  }

  function retentionRate(d) {
    let checks = 0;
    let ok = 0;
    for (const id in d.concepts) {
      checks += d.concepts[id].retentionChecks;
      ok += d.concepts[id].retained;
    }
    return { checks, rate: checks ? ok / checks : null };
  }

  /** Análisis de tiempo que no confunde rapidez con dominio. */
  function timeAnalysis(rows) {
    // rows: [{ms, correct, answered}]
    const answered = rows.filter((r) => r.answered);
    if (!answered.length) return null;
    const med = median(answered.map((r) => r.ms));
    const fastWrong = answered.filter((r) => r.ms < med * 0.6 && !r.correct).length;
    const slowRight = answered.filter((r) => r.ms > med * 1.6 && r.correct).length;
    const slowWrong = answered.filter((r) => r.ms > med * 1.6 && !r.correct).length;
    const fast = answered.filter((r) => r.ms <= med);
    const slow = answered.filter((r) => r.ms > med);
    return {
      median: med,
      fastWrong,
      slowRight,
      slowWrong,
      accFast: fast.length ? fast.filter((r) => r.correct).length / fast.length : null,
      accSlow: slow.length ? slow.filter((r) => r.correct).length / slow.length : null,
    };
  }

  function median(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  S.engine = {
    P,
    derive,
    mastery,
    masteryLabel,
    effScore,
    topicMastery,
    subtopicMastery,
    byCategory,
    weakPoints,
    weakGroups,
    dueConcepts,
    upcoming,
    itemsForConcept,
    levelFor,
    filterItems,
    pickForMode,
    buildStudyNow,
    buildWeakSession,
    buildExam,
    examRecommendedSeconds,
    EXAM_TIME,
    dailySeries,
    errorCounts,
    retentionRate,
    timeAnalysis,
    median,
  };
})(window.SolMed);
