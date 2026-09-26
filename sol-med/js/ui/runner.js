/* Ejecutor de sesiones de estudio: una pregunta por vez, nunca muestra la
 * respuesta antes de responder, retroalimentación estructurada después, y
 * registro de cada paso en el historial para el motor adaptativo. */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const { h, rich, icon } = S.ui;

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  const CONF = [
    { value: 'high', label: 'Seguro' },
    { value: 'mid', label: 'Dudoso' },
    { value: 'guess', label: 'Adiviné' },
  ];

  // ---------- Resolución de entradas ----------

  /** Una entrada es {item: id} o {gen: {kind, calc|value, seed, mode}}. */
  function resolve(entry) {
    if (entry.item) return typeof entry.item === 'string' ? R.itemById[entry.item] : entry.item;
    const g = entry.gen;
    if (!g.seed) g.seed = Math.floor(Math.random() * 1e9);
    if (g.kind === 'calc') return S.gen.calcItem(g.calc, g.seed);
    if (g.kind === 'value') {
      const it = S.gen.valueItem(g.value, g.seed, g.mode);
      if (it && !g.mode) g.mode = it.valueMode;
      return it;
    }
    return null;
  }

  function serializeEntries(entries) {
    return entries.map((e) => (e.item ? { item: typeof e.item === 'string' ? e.item : e.item.id, why: e.why } : { gen: e.gen, why: e.why }));
  }

  // ---------- Cabecera clínica ----------

  function topicName(id) {
    const t = R.topicById[id];
    return t ? t.short : id;
  }

  function subName(item) {
    const t = R.topicById[item.topic];
    const s = t && t.subtopics.find((x) => x.id === item.sub);
    return s ? s.name : '';
  }

  const TYPE_LABEL = {
    mcq: 'Selección múltiple',
    case: 'Caso clínico',
    progressive: 'Caso progresivo',
    reasoning: 'Razonamiento clínico',
    lab: 'Interpretar laboratorio',
    calc: 'Cálculo clínico',
    value: 'Valores normales',
  };

  function metaChips(item, extra) {
    return h(
      'div.qmeta',
      h('span.chip.rose', TYPE_LABEL[item.type] || item.type),
      h('span.chip', topicName(item.topic)),
      subName(item) && item.topic !== 'calculos' ? h('span.chip', subName(item)) : null,
      h('span.chip.violet', 'Nivel ' + item.diff),
      extra || null,
    );
  }

  /** Viñeta, signos vitales, exploración, laboratorio e imagen. */
  function renderHeader(item, opts) {
    opts = opts || {};
    const hd = item.header;
    const parts = [];
    if (item.title && item.type !== 'mcq' && item.type !== 'value') parts.push(h('h2', item.title));
    if (hd.context) parts.push(rich('p', hd.context));
    if (hd.vignette && hd.vignette.length) parts.push(h('div.vignette', hd.vignette.map((p) => rich('p', p))));
    if (hd.vitals) parts.push(h('div', h('div.block-title', 'Signos vitales'), S.ui.vitalsGrid(hd.vitals)));
    if (hd.exam) parts.push(h('div', h('div.block-title', 'Exploración física'), rich('p', hd.exam)));
    if (hd.labs && hd.labs.length && !opts.hideLabs) parts.push(labsBlock(hd.labs, opts));
    if (hd.imaging) parts.push(h('div', h('div.block-title', 'Imagen y otros estudios'), rich('p', hd.imaging)));
    if (!parts.length) return null;
    return h('div.stack', parts);
  }

  /** Laboratorio sin marcar alteraciones; los rangos se pueden mostrar a
   *  petición (en los ejercicios de laboratorio se ocultan hasta responder). */
  function labsBlock(labs, opts) {
    opts = opts || {};
    const wrap = h('div');
    let showRef = !!opts.showRef;
    const draw = () => {
      wrap.innerHTML = '';
      wrap.appendChild(
        h(
          'div.row-between',
          h('div.block-title', 'Laboratorio'),
          opts.allowRefToggle === false
            ? null
            : h(
                'button.btn.btn-ghost.btn-sm',
                {
                  type: 'button',
                  onclick: () => {
                    showRef = !showRef;
                    draw();
                  },
                },
                showRef ? 'Ocultar rangos' : 'Ver rangos de referencia',
              ),
        ),
      );
      wrap.appendChild(S.ui.labTable(labs, { showRef, showFlags: !!opts.showFlags }));
    };
    draw();
    return wrap;
  }

  // ---------- Selección múltiple ----------

  function mcqOptions(step, state, onPick, locked) {
    const box = h('div.options', { role: 'group', 'aria-label': 'Opciones' });
    step.options.forEach((o, i) => {
      let cls = '';
      if (locked && state.reveal) {
        if (i === step.answer) cls = '.correct';
        else if (i === state.choice) cls = '.wrong';
        else cls = '.dim';
      }
      box.appendChild(
        h(
          'button.opt' + cls,
          {
            type: 'button',
            'aria-pressed': String(state.choice === i),
            disabled: !!locked,
            'data-opt': i,
            onclick: () => onPick(i),
          },
          h('span.letter', LETTERS[i]),
          rich('span', o.t),
        ),
      );
    });
    return box;
  }

  function section(title, content) {
    if (!content || (Array.isArray(content) && !content.length)) return null;
    return h('div.fb-sec', h('h4', title), content);
  }

  function listOf(arr, ordered) {
    if (!arr || !arr.length) return null;
    return h(ordered ? 'ol' : 'ul', arr.filter(Boolean).map((x) => rich('li', x)));
  }

  /** Retroalimentación completa de una pregunta de selección múltiple. */
  function mcqFeedback(step, choice, conf) {
    const correct = choice === step.answer;
    const guessed = correct && conf === 'guess';
    const chosen = choice === null || choice === undefined ? null : step.options[choice];
    const errType = !correct ? (chosen && chosen.err) || step.err : null;
    const verdict = h(
      'div.verdict.' + (guessed ? 'partial' : correct ? 'ok' : 'bad'),
      icon(correct ? 'check' : 'x'),
      h(
        'div',
        h('div', guessed ? 'Correcta, pero la marcaste como adivinada' : correct ? 'Correcta' : chosen ? 'Incorrecta' : 'Sin responder'),
        guessed ? h('div.sub', 'No cuenta como dominio: el concepto volverá pronto con otra pregunta.') : null,
        errType ? h('div.sub', 'Tipo de error: ' + (R.errorTypes[errType] ? R.errorTypes[errType].name : errType)) : null,
      ),
    );
    const others = step.options
      .map((o, i) => ({ o, i }))
      .filter((x) => x.i !== step.answer)
      .map((x) => h('div.why', h('span.letter', LETTERS[x.i]), h('div', rich('div', '**' + x.o.t + '**'), x.o.why ? rich('div.small', x.o.why) : null)));
    const trap = [];
    if (!correct && chosen && chosen.why) trap.push('Elegiste ' + LETTERS[choice] + ': ' + chosen.why);
    if (step.trap) trap.push(step.trap);
    return h(
      'div.fb.fade-in',
      verdict,
      h(
        'div.fb-grid',
        h('div.fb-kv', h('div.k', 'Tu respuesta'), rich('div', chosen ? LETTERS[choice] + '. ' + chosen.t : '—')),
        h('div.fb-kv', h('div.k', 'Respuesta correcta'), rich('div', LETTERS[step.answer] + '. ' + step.options[step.answer].t)),
      ),
      section('Razonamiento clínico paso a paso', listOf(step.explain, true)),
      section('Datos clave', listOf(step.key)),
      section('Valores alterados', listOf(step.altered)),
      section('Por qué la correcta es correcta', step.options[step.answer].why ? rich('p', step.options[step.answer].why) : null),
      section('Por qué las demás son incorrectas', others.length ? h('div.why-list', others) : null),
      trap.length ? section('Error de razonamiento', h('div.callout.warn', trap.map((t) => rich('p', t)))) : null,
      step.pearl ? h('div.pearl', icon('pearl'), h('div', h('div.eyebrow', 'Perla para el examen'), rich('div', step.pearl))) : null,
      section('Qué debo recordar', step.remember ? rich('p', step.remember) : null),
      step.valueNote ? h('p.tiny.muted', step.valueNote) : null,
    );
  }

  // ---------- Cálculos ----------

  function calcFeedback(step, answerVal, ok) {
    const c = R.calcById[step.calc];
    const res = c.compute(step.inputs);
    const dec = c.decimals === undefined ? 0 : c.decimals;
    return h(
      'div.fb.fade-in',
      h(
        'div.verdict.' + (ok ? 'ok' : 'bad'),
        icon(ok ? 'check' : 'x'),
        h(
          'div',
          h('div', ok ? 'Correcto' : isNaN(answerVal) ? 'Sin respuesta válida' : 'Incorrecto'),
          h('div.sub', 'Tu resultado: ' + (isNaN(answerVal) ? '—' : U.num(answerVal)) + ' · Esperado: ' + U.num(res, dec) + ' ' + (c.unit || '') + (c.tolText ? ' (' + c.tolText + ')' : '')),
        ),
      ),
      section('Fórmula', h('p.mono', c.formula)),
      section('Sustitución', h('p.mono', c.substitute(step.inputs))),
      section('Resultado', h('p', h('strong.mono', U.num(res, dec) + ' ' + (c.unit || '')))),
      section('Interpretación', rich('p', c.interpret(res, step.inputs))),
      section('Implicación clínica', rich('p', c.implication(res, step.inputs))),
      c.pitfall ? section('Error frecuente', h('div.callout.warn', rich('p', c.pitfall))) : null,
      c.pearl ? h('div.pearl', icon('pearl'), h('div', h('div.eyebrow', 'Perla'), rich('div', c.pearl))) : null,
    );
  }

  function calcScore(step, val) {
    const c = R.calcById[step.calc];
    const res = c.compute(step.inputs);
    if (isNaN(val)) return 0;
    const tol = c.tol !== undefined ? c.tol : Math.max(0.5, Math.abs(res) * 0.03);
    return Math.abs(val - res) <= tol ? 1 : 0;
  }

  // ---------- Razonamiento abierto ----------

  function autoPoints(step, text) {
    const t = U.norm(text);
    return step.points.map((p) => (p.kw || []).some((k) => t.includes(U.norm(k))));
  }

  // ---------- Valores: ficha breve para tarjetas ----------

  function valueBack(v) {
    return h(
      'div.stack.small',
      h('div', h('strong', 'Referencia: '), h('span.mono', v.ref + (v.unit ? ' ' + v.unit : ''))),
      v.represents ? rich('div', '**Qué representa:** ' + v.represents) : null,
      v.up ? rich('div', '**Alto:** ' + v.up.meaning) : null,
      v.down ? rich('div', '**Bajo:** ' + v.down.meaning) : null,
      v.pearl ? rich('div', '**Perla:** ' + v.pearl) : null,
      h('p.tiny.muted', 'Los rangos varían según laboratorio, método, unidades y población.'),
    );
  }

  // ---------- Sesión ----------

  /**
   * Inicia una sesión.
   * opts: {title, mode, entries:[{item}|{gen}], back}
   */
  function start(opts) {
    const session = {
      id: U.uid('s'),
      title: opts.title || 'Sesión de estudio',
      mode: opts.mode || 'practice',
      back: opts.back || 'inicio',
      entries: serializeEntries(opts.entries || []),
      pos: 0,
      results: [],
      startedAt: Date.now(),
    };
    if (!session.entries.length) {
      S.ui.toast('No hay preguntas disponibles con esos filtros.', 'warn');
      return;
    }
    S.ui.state.session = session;
    persist(session);
    S.ui.go('sesion');
  }

  function persist(session) {
    S.store.setResume({
      kind: 'session',
      title: session.title,
      session: {
        id: session.id,
        title: session.title,
        mode: session.mode,
        back: session.back,
        entries: session.entries,
        pos: session.pos,
        results: session.results,
        startedAt: session.startedAt,
      },
    });
  }

  function resumeFrom(saved) {
    S.ui.state.session = U.deepClone(saved.session);
    S.ui.go('sesion');
  }

  /** Vista de sesión: se vuelve a dibujar paso a paso. */
  function view(root) {
    const session = S.ui.state.session;
    if (!session) {
      S.ui.go('inicio');
      return;
    }
    if (session.pos >= session.entries.length) return summary(root, session);
    const entry = session.entries[session.pos];
    const item = resolve(entry);
    if (!item) {
      session.pos++;
      return view(root);
    }
    runItem(root, session, entry, item);
  }

  function header(session) {
    const n = session.entries.length;
    return h(
      'div.runner-head',
      h(
        'button.icon-btn',
        {
          type: 'button',
          'aria-label': 'Salir de la sesión',
          onclick: async () => {
            const ok = await S.ui.confirm('¿Salir de la sesión?', 'Tu progreso queda guardado. Podrás continuar desde «Continuar donde lo dejaste».', 'Salir');
            if (ok) S.ui.go(session.back || 'inicio');
          },
        },
        icon('x'),
      ),
      h('div.runner-progress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': session.pos }, h('span', { style: { width: (session.pos / n) * 100 + '%' } })),
      h('span.small.muted.num', Math.min(session.pos + 1, n) + '/' + n),
    );
  }

  function runItem(root, session, entry, item) {
    const run = {
      stepIdx: 0,
      scores: [],
      path: [], // decisiones en casos progresivos
      stepState: null,
    };
    const WHY = { repaso: 'Repaso pendiente', debil: 'Punto débil', 'debil-mismo': 'Punto débil', nuevo: 'Concepto nuevo', retencion: 'Verificar retención', caso: 'Caso clínico', laboratorio: 'Laboratorio', calculo: 'Cálculo' };

    const container = h('div.stack');
    root.innerHTML = '';
    root.appendChild(header(session));
    root.appendChild(container);

    function logAttempt(step, score, extra) {
      const rec = Object.assign(
        {
          item: item.id,
          step: step.index,
          topic: item.topic,
          sub: item.sub,
          concepts: step.concepts,
          cat: step.cat,
          diff: step.diff || item.diff,
          kind: item.type,
          score,
          mode: session.mode,
          sess: session.id,
        },
        extra || {},
      );
      S.store.addAttempt(rec);
    }

    function nextStep(fromStep, choiceOpt) {
      let next = null;
      if (choiceOpt && choiceOpt.next) next = item.steps.findIndex((s) => s.stageId === choiceOpt.next);
      else if (fromStep.goto) next = item.steps.findIndex((s) => s.stageId === fromStep.goto);
      else if (!fromStep.end) next = fromStep.index + 1;
      if (next === null || next < 0 || next >= item.steps.length) return finishItem();
      run.stepIdx = next;
      drawStep();
    }

    function finishItem() {
      const score = run.scores.length ? U.mean(run.scores) : 1;
      session.results.push({ item: item.id, title: item.title || (item.steps[0] && item.steps[0].stem) || '', score, type: item.type, topic: item.topic });
      session.pos++;
      persist(session);
      view(root);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function drawStep() {
      const step = item.steps[run.stepIdx];
      container.innerHTML = '';
      const card = h('div.card.fade-in');
      container.appendChild(card);
      card.appendChild(metaChips(item, entry.why && WHY[entry.why] ? h('span.chip.ok', WHY[entry.why]) : null));

      const isLab = item.type === 'lab';
      const flagsDone = isLab && run.flagsDone;

      // Casos progresivos: línea de tiempo de lo revelado hasta ahora.
      if (item.type === 'progressive') {
        const tl = h('div.timeline');
        for (const p of run.path) {
          const st = item.steps[p.step];
          tl.appendChild(stageBlock(st, false, p.decision));
        }
        tl.appendChild(stageBlock(step, true));
        if (item.title) card.appendChild(h('h2', item.title));
        card.appendChild(tl);
      } else {
        const hdr = renderHeader(item, { hideLabs: isLab && !flagsDone && step.kind === 'flags' ? false : false, showRef: flagsDone, showFlags: flagsDone, allowRefToggle: !isLab || flagsDone });
        if (hdr) card.appendChild(hdr);
      }

      const t0 = performance.now();
      const body = h('div.stack', { style: { marginTop: '14px' } });
      card.appendChild(body);
      const elapsed = () => Math.round(performance.now() - t0);

      if (step.kind === 'mcq') drawMcq(step, body, elapsed);
      else if (step.kind === 'text') drawText(step, body, elapsed);
      else if (step.kind === 'flags') drawFlags(step, body, elapsed, card);
      else if (step.kind === 'calc') drawCalc(step, body, elapsed);
      else if (step.kind === 'numeric') drawNumeric(step, body, elapsed);
      else if (step.kind === 'flash') drawFlash(step, body, elapsed);
      else if (step.kind === 'info') drawInfo(step, body);
      const focusable = card.querySelector('.opt, textarea, input, .btn-primary');
      if (focusable && window.innerWidth > 900) focusable.focus({ preventScroll: true });
    }

    function stageBlock(step, current, decision) {
      const rv = step.reveal || {};
      return h(
        'div.stage' + (current ? '.current' : '') + (rv.tone === 'alert' ? '.alert' : ''),
        rv.title ? h('h3', rv.title) : null,
        rv.text && rv.text.length ? h('div.vignette', rv.text.map((p) => rich('p', p))) : null,
        rv.vitals ? S.ui.vitalsGrid(rv.vitals) : null,
        rv.labs ? labsBlock(rv.labs, {}) : null,
        rv.imaging ? rich('p', rv.imaging) : null,
        decision ? h('div.decision', decision) : null,
      );
    }

    function actions(...btns) {
      return h('div.actions.actions-sticky', btns);
    }

    // ---- mcq ----
    function drawMcq(step, body, elapsed) {
      const st = { choice: null, conf: 'mid', reveal: false };
      const stem = rich('p.stem', step.stem);
      const optsWrap = h('div');
      const confBox = h('div.confidence', h('span.small.muted', 'Confianza:'), S.ui.seg(CONF, st.conf, (v) => (st.conf = v), 'Confianza'));
      const submit = h('button.btn.btn-primary', { type: 'button', disabled: true, onclick: answer }, 'Responder');
      const act = actions(submit);
      body.append(stem, optsWrap, confBox, act);
      const pick = (i) => {
        if (st.reveal) return;
        st.choice = i;
        submit.disabled = false;
        drawOpts();
      };
      function drawOpts() {
        optsWrap.innerHTML = '';
        optsWrap.appendChild(mcqOptions(step, st, pick, st.reveal));
      }
      drawOpts();
      const onKey = (e) => {
        if (!document.body.contains(body)) return document.removeEventListener('keydown', onKey);
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        const k = e.key.toUpperCase();
        const idx = LETTERS.indexOf(k) >= 0 ? LETTERS.indexOf(k) : '12345'.indexOf(k);
        if (!st.reveal && idx >= 0 && idx < step.options.length) pick(idx);
        else if (e.key === 'Enter' && !e.repeat) {
          const b = act.querySelector('.btn-primary:not([disabled])');
          if (b) {
            e.preventDefault();
            b.click();
          }
        }
      };
      document.addEventListener('keydown', onKey);

      function answer() {
        if (st.choice === null || st.reveal) return;
        st.reveal = true;
        const ms = elapsed();
        const correct = st.choice === step.answer;
        const chosen = step.options[st.choice];
        const score = correct ? 1 : 0;
        run.scores.push(correct && st.conf === 'guess' ? 0.5 : score);
        logAttempt(step, score, { conf: st.conf, ms, choice: st.choice, err: correct ? null : chosen.err || step.err });
        drawOpts();
        confBox.remove();
        act.remove();
        body.appendChild(mcqFeedback(step, st.choice, st.conf));
        if (item.type === 'progressive') run.path.push({ step: step.index, decision: 'Tu decisión: ' + LETTERS[st.choice] + '. ' + chosen.t + (correct ? ' ✓' : ' ✗') });
        const nextBtn = h('button.btn.btn-primary', { type: 'button', onclick: () => nextStep(step, chosen) }, isLast(step, chosen) ? 'Siguiente pregunta' : 'Continuar', icon('next'));
        body.appendChild(actions(nextBtn));
        nextBtn.focus({ preventScroll: true });
      }
    }

    function isLast(step, chosen) {
      if (chosen && chosen.next) return false;
      if (step.goto) return false;
      return step.end || step.index >= item.steps.length - 1;
    }

    // ---- razonamiento abierto ----
    function drawText(step, body, elapsed) {
      const ta = h('textarea.input', { id: 'reason-' + item.localId + '-' + step.index, placeholder: 'Escribe tu razonamiento antes de ver el esperado…', 'aria-label': step.q });
      const compare = h('button.btn.btn-primary', { type: 'button', onclick: () => doCompare(false) }, 'Comparar con el razonamiento esperado');
      const dunno = h('button.btn.btn-ghost', { type: 'button', onclick: () => doCompare(true) }, 'No lo sé');
      const act = actions(dunno, compare);
      body.append(rich('p.stem', step.q), ta, act);
      function doCompare(blank) {
        const text = blank ? '' : ta.value.trim();
        if (!blank && text.length < 3) {
          S.ui.toast('Escribe al menos una idea, o pulsa «No lo sé».', 'warn');
          ta.focus();
          return;
        }
        const ms = elapsed();
        ta.disabled = true;
        act.remove();
        const marks = autoPoints(step, text);
        const pts = h('div.points');
        const drawPts = () => {
          pts.innerHTML = '';
          step.points.forEach((p, i) =>
            pts.appendChild(
              h(
                'button.point',
                {
                  type: 'button',
                  'aria-pressed': String(marks[i]),
                  onclick: () => {
                    marks[i] = !marks[i];
                    drawPts();
                  },
                },
                h('span.box', marks[i] ? icon('check') : null),
                h('span', rich('span', p.t)),
              ),
            ),
          );
        };
        drawPts();
        body.appendChild(
          h(
            'div.fb.fade-in',
            section('Razonamiento esperado', rich('p', step.expected)),
            section(
              'Autoevaluación: ¿qué incluiste?',
              h('div.stack', h('p.small.muted', 'Sol MED marcó automáticamente los puntos que reconoce en tu texto. Corrige las marcas con honestidad: lo que no mencionaste no cuenta.'), pts),
            ),
            step.pearl ? h('div.pearl', icon('pearl'), h('div', h('div.eyebrow', 'Perla'), rich('div', step.pearl))) : null,
          ),
        );
        const save = h(
          'button.btn.btn-primary',
          {
            type: 'button',
            onclick: () => {
              const score = marks.filter(Boolean).length / marks.length;
              run.scores.push(score);
              logAttempt(step, U.round(score, 2), { ms, err: score < S.engine.P.passScore ? step.err : null, self: true });
              save.disabled = true;
              nextStep(step, null);
            },
          },
          'Guardar y continuar',
          icon('next'),
        );
        body.appendChild(actions(save));
      }
    }

    // ---- marcar valores alterados ----
    function drawFlags(step, body, elapsed, card) {
      const labs = item.header.labs || [];
      const rows = labs.map((l) => R.labRow(l));
      const choice = rows.map(() => null);
      let checked = false;
      const table = h('div');
      const draw = () => {
        table.innerHTML = '';
        table.appendChild(
          S.ui.labTable(labs, {
            showRef: checked,
            showFlags: false,
            flagHead: 'Tu lectura',
            flagCell: (r, i) =>
              h(
                'div.flagpick',
                { role: 'group', 'aria-label': 'Lectura de ' + r.name },
                ['L', 'N', 'H'].map((f) => {
                  let cls = '';
                  if (checked) cls = f === r.flag ? '.right' : choice[i] === f ? '.wrong' : '';
                  return h(
                    'button' + cls,
                    {
                      type: 'button',
                      'aria-pressed': String(choice[i] === f),
                      disabled: checked,
                      'aria-label': { L: 'Bajo', N: 'Normal', H: 'Alto' }[f],
                      onclick: () => {
                        choice[i] = f;
                        draw();
                        submit.disabled = choice.some((c) => c === null);
                      },
                    },
                    { L: '↓', N: 'N', H: '↑' }[f],
                  );
                }),
              ),
          }),
        );
      };
      // En este paso la tabla de la cabecera se sustituye por la interactiva.
      const hdrLabs = card.querySelector('.labs-wrap');
      if (hdrLabs && hdrLabs.parentElement) hdrLabs.parentElement.remove();
      const submit = h('button.btn.btn-primary', { type: 'button', disabled: true, onclick: check }, 'Comprobar');
      body.append(rich('p.stem', step.q || '¿Qué valores están alterados? Marca cada uno como bajo (↓), normal (N) o alto (↑).'), table, actions(submit));
      draw();
      function check() {
        checked = true;
        const ms = elapsed();
        let ok = 0;
        rows.forEach((r, i) => {
          if (choice[i] === r.flag) ok++;
        });
        const score = ok / rows.length;
        run.scores.push(score);
        run.flagsDone = true;
        logAttempt(step, U.round(score, 2), { ms, err: score < S.engine.P.passScore ? 'laboratorio' : null });
        // Cada valor mal clasificado cuenta también para su ficha de valores.
        rows.forEach((r, i) => {
          if (!r.known) return;
          S.store.addAttempt({
            item: 'gen:value:' + r.id + ':lab',
            step: 0,
            topic: 'valores',
            sub: R.valueById[r.id].category,
            concepts: ['valores.' + r.id],
            cat: 'valores',
            diff: 1,
            kind: 'value',
            score: choice[i] === r.flag ? 1 : 0,
            mode: 'values',
            sess: session.id,
            err: choice[i] === r.flag ? null : 'laboratorio',
          });
        });
        draw();
        submit.parentElement.remove();
        const wrong = rows.filter((r, i) => choice[i] !== r.flag);
        body.appendChild(
          h(
            'div.fb.fade-in',
            h(
              'div.verdict.' + (score === 1 ? 'ok' : score >= 0.6 ? 'partial' : 'bad'),
              icon(score === 1 ? 'check' : 'x'),
              h('div', h('div', ok + ' de ' + rows.length + ' valores bien clasificados'), h('div.sub', 'Ya puedes ver los rangos de referencia.')),
            ),
            wrong.length
              ? section(
                  'Revisa',
                  h(
                    'ul',
                    wrong.map((r) => {
                      const v = R.valueById[r.id];
                      return h('li', rich('span', '**' + r.name + '** ' + (typeof r.value === 'number' ? U.num(r.value) : r.value) + ' ' + r.unit + ' → ' + { H: 'alto', L: 'bajo', N: 'normal' }[r.flag] + (r.ref ? ' (ref. ' + r.ref + ')' : '') + (v && r.flag === 'H' && v.up ? '. ' + v.up.meaning : v && r.flag === 'L' && v.down ? '. ' + v.down.meaning : '')));
                    }),
                  ),
                )
              : null,
            step.note ? h('p.small.muted', step.note) : null,
          ),
        );
        body.appendChild(actions(h('button.btn.btn-primary', { type: 'button', onclick: () => nextStep(step, null) }, 'Continuar', icon('next'))));
      }
    }

    // ---- cálculo ----
    function drawCalc(step, body, elapsed) {
      const c = R.calcById[step.calc];
      const data = c.inputs.map((inp) => h('div.vital', h('div.k', inp.label), h('div.v', U.num(step.inputs[inp.id]) + (inp.unit ? ' ' + inp.unit : ''))));
      const id = 'calc-' + (item.localId || 'g') + '-' + step.index;
      const input = h('input.input.mono', { id, inputmode: 'decimal', autocomplete: 'off', placeholder: 'Tu resultado' });
      const submit = h('button.btn.btn-primary', { type: 'button', onclick: check }, 'Comprobar');
      body.append(
        rich('p.stem', step.ask),
        h('div', h('div.block-title', 'Datos'), h('div.vitals', data)),
        h('div.field', h('label', { for: id }, 'Tu resultado' + (c.unit ? ' (' + c.unit + ')' : '')), input),
        h('p.small.muted', 'Primero intenta resolverlo. Después verás fórmula, sustitución, resultado, interpretación e implicación clínica.'),
        actions(submit),
      );
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') check();
      });
      function check() {
        if (input.disabled) return;
        const val = U.parseNum(input.value);
        if (isNaN(val) && input.value.trim()) {
          S.ui.toast('Escribe un número (puedes usar coma o punto decimal).', 'warn');
          return;
        }
        input.disabled = true;
        const ms = elapsed();
        const score = calcScore(step, val);
        run.scores.push(score);
        logAttempt(step, score, { ms, err: score ? null : 'calculo', answerVal: isNaN(val) ? null : val });
        submit.parentElement.remove();
        body.appendChild(calcFeedback(step, val, !!score));
        const nb = h('button.btn.btn-primary', { type: 'button', onclick: () => nextStep(step, null) }, 'Continuar', icon('next'));
        body.appendChild(actions(nb));
        nb.focus({ preventScroll: true });
      }
    }

    // ---- completar un valor ----
    function drawNumeric(step, body, elapsed) {
      const id = 'num-' + step.index;
      const input = h('input.input.mono', { id, inputmode: 'decimal', autocomplete: 'off' });
      const submit = h('button.btn.btn-primary', { type: 'button', onclick: check }, 'Comprobar');
      body.append(rich('p.stem', step.ask), h('div.field', h('label', { for: id }, 'Valor' + (step.unit ? ' (' + step.unit + ')' : '')), input), actions(submit));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') check();
      });
      function check() {
        if (input.disabled) return;
        const val = U.parseNum(input.value);
        input.disabled = true;
        const ok = !isNaN(val) && Math.abs(val - step.answer) <= (step.tol || 0);
        const ms = elapsed();
        run.scores.push(ok ? 1 : 0);
        logAttempt(step, ok ? 1 : 0, { ms, err: ok ? null : 'laboratorio' });
        submit.parentElement.remove();
        body.appendChild(
          h(
            'div.fb.fade-in',
            h('div.verdict.' + (ok ? 'ok' : 'bad'), icon(ok ? 'check' : 'x'), h('div', h('div', ok ? 'Correcto' : 'Incorrecto'), h('div.sub', 'Respuesta: ' + U.num(step.answer) + ' ' + (step.unit || '') + (step.tol ? ' (± ' + U.num(step.tol) + ')' : '')))),
            section('Explicación', listOf(step.explain)),
            step.pearl ? h('div.pearl', icon('pearl'), h('div', h('div.eyebrow', 'Perla'), rich('div', step.pearl))) : null,
          ),
        );
        body.appendChild(actions(h('button.btn.btn-primary', { type: 'button', onclick: () => nextStep(step, null) }, 'Continuar', icon('next'))));
      }
    }

    // ---- tarjeta de memoria ----
    function drawFlash(step, body, elapsed) {
      const card = h('div.flash', h('div.front', step.front), h('p.small.muted', step.prompt));
      const reveal = h('button.btn.btn-primary', { type: 'button', onclick: show }, 'Mostrar respuesta');
      body.append(card, actions(reveal));
      function show() {
        reveal.parentElement.remove();
        body.appendChild(h('div.card.flat.fade-in', valueBack(step.back)));
        const grade = (score, conf) => () => {
          run.scores.push(score);
          logAttempt(step, score, { ms: elapsed(), conf, err: score < 0.6 ? 'laboratorio' : null, self: true });
          nextStep(step, null);
        };
        body.appendChild(
          actions(
            h('button.btn.btn-danger', { type: 'button', onclick: grade(0, 'low') }, 'No lo sabía'),
            h('button.btn', { type: 'button', onclick: grade(0.7, 'low') }, 'Dudé'),
            h('button.btn.btn-primary', { type: 'button', onclick: grade(1, 'high') }, 'Lo sabía'),
          ),
        );
      }
    }

    // ---- etapa narrativa ----
    function drawInfo(step, body) {
      if (item.type === 'progressive') run.path.push({ step: step.index, decision: null });
      body.appendChild(actions(h('button.btn.btn-primary', { type: 'button', onclick: () => nextStep(step, null) }, step.end || step.index >= item.steps.length - 1 ? 'Finalizar caso' : 'Continuar', icon('next'))));
    }

    drawStep();
  }

  function summary(root, session) {
    S.store.setResume(null);
    const res = session.results;
    const avg = res.length ? U.mean(res, (r) => r.score) : 0;
    const d = S.ui.derived(true);
    const concepts = new Set();
    for (const r of res) {
      const it = R.itemById[r.item];
      if (it && r.score < 0.99) it.concepts.forEach((c) => concepts.add(c));
    }
    const failedConcepts = Array.from(concepts);
    root.innerHTML = '';
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Sesión terminada', session.title),
        h(
          'div.card',
          h(
            'div.row',
            S.ui.charts.ring(U.pct(avg), 'Puntuación'),
            h(
              'div.stack.grow',
              h('div', h('strong', res.length + ' ejercicios'), ' · ', U.fmtDuration(Date.now() - session.startedAt)),
              h('p.small.muted', 'La puntuación de los ejercicios de razonamiento es tu autoevaluación. Un acierto marcado como «adiviné» cuenta la mitad.'),
              failedConcepts.length ? h('p.small', failedConcepts.length + ' conceptos pasan a repaso con preguntas distintas.') : h('p.small', 'Sin errores en esta sesión.'),
            ),
          ),
        ),
        h(
          'div.card',
          h('h3', 'Resultados'),
          h(
            'div',
            res.map((r) =>
              h(
                'div.topic-row',
                h('div', h('div', rich('span', U.escapeHtml(truncate(r.title, 90)))), h('div.tiny.muted', (TYPE_LABEL[r.type] || r.type) + ' · ' + topicName(r.topic))),
                h('span.chip.' + (r.score >= 0.99 ? 'ok' : r.score >= 0.6 ? 'warn' : 'bad'), U.pct(r.score) + ' %'),
              ),
            ),
          ),
        ),
        h(
          'div.actions',
          failedConcepts.length
            ? h(
                'button.btn.btn-primary',
                {
                  type: 'button',
                  onclick: () =>
                    start({ title: 'Practicar mis errores', mode: 'weak', entries: S.engine.buildWeakSession(d, failedConcepts, 10), back: 'inicio' }),
                },
                'Practicar mis errores',
              )
            : null,
          h('button.btn', { type: 'button', onclick: () => S.ui.go('inicio') }, 'Volver al inicio'),
        ),
      ),
    );
  }

  function truncate(s, n) {
    s = String(s || '').replace(/\*\*/g, '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  S.ui.runner = {
    start,
    view,
    resumeFrom,
    resolve,
    renderHeader,
    labsBlock,
    mcqOptions,
    mcqFeedback,
    metaChips,
    TYPE_LABEL,
    LETTERS,
    topicName,
    subName,
    truncate,
    valueBack,
    calcFeedback,
  };
})(window.SolMed);
