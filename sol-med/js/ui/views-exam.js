/* Simulacro de examen y entrenamiento contra reloj. */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const E = S.engine;
  const { h, icon, rich } = S.ui;
  const RN = S.ui.runner;
  const LET = RN.LETTERS;

  const TIMED_LEVELS = [
    { value: 'relajado', label: 'Relajado', sec: 90 },
    { value: 'estandar', label: 'Estándar', sec: 64 },
    { value: 'intensivo', label: 'Intensivo', sec: 45 },
  ];

  function contentTopics() {
    return R.topics.filter((t) => t.kind === 'topic');
  }

  function qItem(q) {
    return R.itemById[q.item];
  }
  function qStep(q) {
    const it = qItem(q);
    return it ? it.steps[q.step] : null;
  }

  // ---------- Configuración del simulacro ----------
  S.views.simulacro = function (root) {
    const cfg = { format: 'mcq', count: 30, topics: contentTopics().map((t) => t.id), diff: 'mixed', timer: 'recommended', customMin: 32 };
    const summary = h('div.card.flat.stack');
    const countBox = h('div');

    function plan() {
      return E.buildExam(S.ui.derived(true), cfg);
    }
    function drawCount() {
      countBox.innerHTML = '';
      const opts = cfg.format === 'cases' ? [2, 4, 6] : cfg.format === 'mixed' ? [12, 20, 30] : [10, 20, 30, 50];
      if (!opts.includes(cfg.count)) cfg.count = opts[opts.length - 1] === 50 ? 30 : opts[1];
      countBox.appendChild(
        S.ui.seg(
          opts.map((n) => ({ value: n, label: String(n) + (cfg.format === 'cases' ? ' casos' : '') })),
          cfg.count,
          (v) => {
            cfg.count = v;
            drawSummary();
          },
          'Cantidad',
        ),
      );
    }
    function drawSummary() {
      const p = plan();
      const rec = E.examRecommendedSeconds(p.nMcq, p.nCases);
      const secs = cfg.timer === 'none' ? null : cfg.timer === 'custom' ? Math.round(cfg.customMin * 60) : rec;
      summary.innerHTML = '';
      summary.append(
        h('h3', 'Antes de empezar'),
        h(
          'div.kpis',
          h('div.kpi', h('div.n', String(p.nMcq)), h('div.l', 'Preguntas')),
          h('div.kpi', h('div.n', String(p.nCases)), h('div.l', 'Casos (' + (p.questions.length - p.nMcq) + ' preguntas)')),
          h('div.kpi', h('div.n', secs ? U.fmtClock(secs * 1000) : '—'), h('div.l', secs ? 'Tiempo' : 'Sin tiempo')),
          h('div.kpi', h('div.n', cfg.diff === 'mixed' ? 'Mixta' : 'N' + cfg.diff), h('div.l', 'Dificultad')),
        ),
        h('p.small', 'Temas: ' + cfg.topics.map((id) => R.topicById[id].short).join(', ')),
        h('p.small.muted', 'Tiempo recomendado: ' + U.fmtClock(rec * 1000) + ' (30 preguntas = 32 min; ≈5 min por caso). Durante el examen no verás respuestas; la revisión se abre al finalizar.'),
        p.shortage
          ? h('div.callout.warn', 'El banco actual no tiene suficientes ítems con estos filtros: el simulacro tendrá ' + p.nMcq + ' preguntas y ' + p.nCases + ' casos. Amplía temas o dificultad para más.')
          : null,
      );
      startBtn.disabled = !p.questions.length;
      startBtn.onclick = () => startExam({ kind: 'exam', title: 'Simulacro', config: Object.assign({}, cfg), plan: p, seconds: secs });
    }
    const startBtn = h('button.btn.btn-primary.btn-block', { type: 'button' }, icon('play'), 'Comenzar simulacro');
    const customInput = h('input.input.mono', {
      id: 'exam-custom-min',
      type: 'number',
      min: 1,
      max: 600,
      value: cfg.customMin,
      oninput: () => {
        cfg.customMin = Math.max(1, Math.min(600, Number(customInput.value) || 1));
        drawSummary();
      },
    });
    const customWrap = h('div.field', { hidden: true }, h('label', { for: 'exam-custom-min' }, 'Minutos'), customInput);
    drawCount();
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Simulacro de examen', 'Configura, revisa el resumen y empieza. El temporizador sigue corriendo aunque recargues la página.'),
        h(
          'div.card.stack',
          h('div.label', 'Formato'),
          S.ui.seg(
            [
              { value: 'mcq', label: 'Selección múltiple' },
              { value: 'cases', label: 'Casos clínicos' },
              { value: 'mixed', label: 'Mixto' },
            ],
            cfg.format,
            (v) => {
              cfg.format = v;
              cfg.count = v === 'cases' ? 4 : v === 'mixed' ? 20 : 30;
              drawCount();
              drawSummary();
            },
            'Formato',
          ),
          h('div.label', 'Cantidad'),
          countBox,
          h('div.label', 'Temas'),
          S.ui.checks(
            contentTopics().map((t) => ({ value: t.id, label: t.short })),
            cfg.topics,
            (v) => {
              cfg.topics = v.length ? v : cfg.topics;
              drawSummary();
            },
          ),
          h('div.label', 'Dificultad'),
          S.ui.seg(
            [
              { value: 'mixed', label: 'Mixta' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ],
            cfg.diff,
            (v) => {
              cfg.diff = v;
              drawSummary();
            },
            'Dificultad',
          ),
          h('div.label', 'Temporizador'),
          S.ui.seg(
            [
              { value: 'recommended', label: 'Recomendado' },
              { value: 'custom', label: 'Personalizado' },
              { value: 'none', label: 'Sin tiempo' },
            ],
            cfg.timer,
            (v) => {
              cfg.timer = v;
              customWrap.hidden = v !== 'custom';
              drawSummary();
            },
            'Temporizador',
          ),
          customWrap,
        ),
        summary,
        startBtn,
        h('button.btn.btn-ghost', { type: 'button', onclick: () => S.ui.go('historial') }, 'Ver simulacros anteriores'),
      ),
    );
    drawSummary();
  };

  // ---------- Contra reloj ----------
  S.views.contrarreloj = function (root) {
    const cfg = { count: 10, level: 'estandar', custom: 15, topics: contentTopics().map((t) => t.id) };
    const info = h('p.small.muted');
    const customInput = h('input.input.mono', {
      id: 'timed-custom',
      type: 'number',
      min: 1,
      max: 60,
      value: cfg.custom,
      oninput: () => {
        cfg.custom = Math.max(1, Math.min(60, Number(customInput.value) || 1));
        upd();
      },
    });
    const customWrap = h('div.field', { hidden: true }, h('label', { for: 'timed-custom' }, 'Número de preguntas'), customInput);
    const n = () => (cfg.count === 'custom' ? cfg.custom : cfg.count);
    const lvl = () => TIMED_LEVELS.find((l) => l.value === cfg.level);
    function upd() {
      const avail = E.filterItems({ types: ['mcq'], topics: cfg.topics }).length;
      info.textContent =
        Math.min(n(), avail) + ' preguntas · ' + U.fmtClock(Math.min(n(), avail) * lvl().sec * 1000) + ' en total (' + lvl().sec + ' s por pregunta).' + (avail < n() ? ' Solo hay ' + avail + ' preguntas con estos temas.' : '');
    }
    upd();
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Entrenamiento contra reloj', 'Para ganar eficiencia de razonamiento, no para responder a la ligera: el resultado valora la precisión junto con el tiempo.'),
        h(
          'div.card.stack',
          h('div.label', 'Preguntas'),
          S.ui.seg(
            [5, 10, 20, 30, 'custom'].map((v) => ({ value: v, label: v === 'custom' ? 'Personalizado' : String(v) })),
            cfg.count,
            (v) => {
              cfg.count = v;
              customWrap.hidden = v !== 'custom';
              upd();
            },
            'Preguntas',
          ),
          customWrap,
          h('div.label', 'Nivel'),
          S.ui.seg(TIMED_LEVELS.map((l) => ({ value: l.value, label: l.label })), cfg.level, (v) => {
            cfg.level = v;
            upd();
          }, 'Nivel'),
          h('div.label', 'Temas'),
          S.ui.checks(
            contentTopics().map((t) => ({ value: t.id, label: t.short })),
            cfg.topics,
            (v) => {
              cfg.topics = v.length ? v : cfg.topics;
              upd();
            },
          ),
          info,
          h(
            'button.btn.btn-primary.btn-block',
            {
              type: 'button',
              onclick: () => {
                const items = E.pickForMode(S.ui.derived(true), { types: ['mcq'], topics: cfg.topics, diff: 'auto', count: n() });
                if (!items.length) return S.ui.toast('No hay preguntas con esos temas.', 'warn');
                const plan = { questions: items.map((it) => ({ item: it.id, step: 0 })), nMcq: items.length, nCases: 0 };
                startExam({ kind: 'timed', title: 'Contra reloj · ' + lvl().label, config: Object.assign({}, cfg), plan, seconds: items.length * lvl().sec });
              },
            },
            icon('clock'),
            'Empezar',
          ),
        ),
      ),
    );
  };

  // ---------- Ejecución ----------
  function startExam(o) {
    const now = Date.now();
    const exam = {
      id: U.uid('x'),
      kind: o.kind,
      title: o.title,
      config: o.config,
      questions: o.plan.questions,
      nMcq: o.plan.nMcq,
      nCases: o.plan.nCases,
      startedAt: now,
      totalMs: o.seconds ? o.seconds * 1000 : null,
      deadline: o.seconds ? now + o.seconds * 1000 : null,
      answers: {},
      flags: {},
      times: {},
      current: 0,
      warned: {},
      updatedAt: now,
    };
    S.ui.state.exam = exam;
    saveResume(exam);
    S.ui.go('simulacro-run');
  }

  function saveResume(exam) {
    exam.updatedAt = Date.now();
    S.store.setResume({ kind: 'exam', title: exam.title, exam });
  }

  function resume(saved) {
    S.ui.state.exam = U.deepClone(saved.exam);
    S.ui.go('simulacro-run');
  }

  let tick = null;

  S.views['simulacro-run'] = function (root) {
    let exam = S.ui.state.exam;
    if (!exam) {
      const r = S.store.get().resume;
      if (r && r.kind === 'exam') exam = S.ui.state.exam = U.deepClone(r.exam);
    }
    if (!exam) return S.ui.go('simulacro');
    if (exam.finishedAt) return S.ui.go('simulacro-resultado/' + exam.id);
    if (exam.deadline && Date.now() >= exam.deadline) return finalize(exam, 'timeout');

    const timed = exam.kind === 'timed';
    let enteredAt = Date.now();
    let showNav = false;
    let quickVerdict = null;

    const timerEl = h('span.timer', { role: 'timer', 'aria-live': 'off' });
    const body = h('div.stack');
    root.appendChild(body);

    function leaveQuestion() {
      const i = exam.current;
      exam.times[i] = (exam.times[i] || 0) + (Date.now() - enteredAt);
      enteredAt = Date.now();
    }

    function go(i) {
      if (i < 0 || i >= exam.questions.length) return;
      leaveQuestion();
      exam.current = i;
      quickVerdict = null;
      saveResume(exam);
      draw();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function counts() {
      const total = exam.questions.length;
      const answered = Object.keys(exam.answers).length;
      const flagged = Object.keys(exam.flags).filter((k) => exam.flags[k]).length;
      return { total, answered, pending: total - answered, flagged };
    }

    function updateTimer() {
      if (!exam.deadline) {
        timerEl.textContent = 'Sin límite de tiempo';
        return;
      }
      const left = exam.deadline - Date.now();
      timerEl.textContent = 'Tiempo restante: ' + U.fmtClock(left);
      timerEl.classList.toggle('warn', left <= Math.min(exam.totalMs * 0.25, 5 * 60000) && left > 60000);
      timerEl.classList.toggle('crit', left <= 60000);
      // Avisos progresivos, discretos y una sola vez. Si varios umbrales se
      // cruzan a la vez (p. ej., al volver tras cerrar la app), solo se
      // muestra el más urgente.
      const due = [];
      if (exam.totalMs >= 4 * 60000 && left <= exam.totalMs * 0.25 && !exam.warned.q25) due.push(['q25', 'Queda aproximadamente el 25 % del tiempo.', 'warn']);
      if (exam.totalMs > 10 * 60000 && left <= 5 * 60000 && !exam.warned.m5) due.push(['m5', 'Quedan 5 minutos.', 'warn']);
      if (exam.totalMs > 2 * 60000 && left <= 60000 && !exam.warned.m1) due.push(['m1', 'Último minuto.', 'bad']);
      if (due.length) {
        for (const d of due) exam.warned[d[0]] = true;
        const last = due[due.length - 1];
        if (left > 0) S.ui.toast(last[1], last[2]);
      }
      if (left <= 0) {
        stopTick();
        leaveQuestion();
        finalize(exam, 'timeout');
      }
    }

    function stopTick() {
      clearInterval(tick);
      tick = null;
    }
    stopTick();
    tick = setInterval(() => {
      if (!document.body.contains(timerEl)) return stopTick();
      updateTimer();
    }, 1000);

    function draw() {
      body.innerHTML = '';
      const q = exam.questions[exam.current];
      const item = qItem(q);
      const step = qStep(q);
      const c = counts();
      const head = h(
        'div.row-between',
        h('div.row', h('strong', exam.title), h('span.small.muted.num', 'Pregunta ' + (exam.current + 1) + '/' + c.total)),
        timerEl,
      );
      body.appendChild(head);
      body.appendChild(h('div.runner-progress', h('span', { style: { width: (c.answered / c.total) * 100 + '%' } })));
      if (!item || !step) {
        body.appendChild(h('div.callout.warn', 'Esta pregunta ya no existe en el banco actual. Pasa a la siguiente.'));
      } else {
        const card = h('div.card.stack.fade-in');
        const groupInfo = q.caseGroup ? exam.questions.filter((x) => x.caseGroup === q.caseGroup) : null;
        card.appendChild(
          RN.metaChips(item, groupInfo ? h('span.chip', 'Pregunta ' + (groupInfo.indexOf(q) + 1) + ' de ' + groupInfo.length + ' del caso') : null),
        );
        const hdr = RN.renderHeader(item, {});
        if (hdr) card.appendChild(hdr);
        card.appendChild(rich('p.stem', step.stem));
        const st = { choice: exam.answers[exam.current] !== undefined ? exam.answers[exam.current] : null, reveal: false };
        const locked = timed && st.choice !== null;
        card.appendChild(
          RN.mcqOptions(step, st, (i) => {
            if (timed && exam.answers[exam.current] !== undefined) return;
            exam.answers[exam.current] = i;
            if (timed) {
              const ok = i === step.answer;
              quickVerdict = ok;
              // Registro inmediato del intento en contra reloj.
            }
            saveResume(exam);
            draw();
          }, locked),
        );
        if (timed && quickVerdict !== null) {
          card.appendChild(h('div.verdict.' + (quickVerdict ? 'ok' : 'bad'), icon(quickVerdict ? 'check' : 'x'), h('div', quickVerdict ? 'Correcta' : 'Incorrecta', h('div.sub', 'La explicación completa estará en la revisión.'))));
        }
        body.appendChild(card);
      }

      // Navegación
      const isLast = exam.current === exam.questions.length - 1;
      if (timed) {
        body.appendChild(
          h(
            'div.actions.actions-sticky',
            isLast
              ? h('button.btn.btn-primary', { type: 'button', onclick: () => askFinish() }, 'Finalizar')
              : h('button.btn.btn-primary', { type: 'button', disabled: exam.answers[exam.current] === undefined, onclick: () => go(exam.current + 1) }, 'Siguiente', icon('next')),
          ),
        );
        return;
      }
      body.appendChild(
        h(
          'div.actions.actions-sticky.exam-actions',
          h('button.btn', { type: 'button', disabled: exam.current === 0, 'aria-label': 'Anterior', onclick: () => go(exam.current - 1) }, icon('back'), h('span.lbl', 'Anterior')),
          h(
            'button.btn' + (exam.flags[exam.current] ? '.btn-soft' : ''),
            {
              type: 'button',
              'aria-pressed': String(!!exam.flags[exam.current]),
              'aria-label': exam.flags[exam.current] ? 'Marcada para revisar' : 'Revisar después',
              onclick: () => {
                exam.flags[exam.current] = !exam.flags[exam.current];
                saveResume(exam);
                draw();
              },
            },
            icon('flag'),
            h('span.lbl', exam.flags[exam.current] ? 'Marcada' : 'Revisar después'),
          ),
          isLast
            ? h('button.btn.btn-primary', { type: 'button', onclick: () => askFinish() }, 'Entregar')
            : h('button.btn.btn-primary', { type: 'button', onclick: () => go(exam.current + 1) }, 'Siguiente', icon('next')),
        ),
      );
      const navCard = h(
        'div.card.stack',
        h(
          'div.row-between',
          h('strong', 'Navegador de preguntas'),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => ((showNav = !showNav), draw()) }, showNav ? 'Ocultar' : 'Mostrar'),
        ),
        h('div.small.muted', 'Respondidas ' + c.answered + '/' + c.total + ' · Pendientes ' + c.pending + ' · Revisar ' + c.flagged),
      );
      if (showNav) {
        navCard.appendChild(
          h(
            'div.qnav',
            exam.questions.map((_, i) =>
              h(
                'button' + (exam.answers[i] !== undefined ? '.answered' : '') + (exam.flags[i] ? '.flagged' : '') + (i === exam.current ? '.current' : ''),
                { type: 'button', onclick: () => go(i), 'aria-label': 'Pregunta ' + (i + 1) },
                String(i + 1),
              ),
            ),
          ),
        );
        navCard.appendChild(
          h(
            'div.legend',
            h('span', h('i', { style: { background: 'var(--violet-soft)' } }), 'Respondida'),
            h('span', h('i'), 'Pendiente'),
            h('span', h('i', { style: { background: 'var(--warn)' } }), 'Revisar'),
            h('span', h('i', { style: { borderColor: 'var(--rose)' } }), 'Actual'),
          ),
        );
      }
      navCard.appendChild(h('button.btn.btn-ghost', { type: 'button', onclick: () => askFinish() }, 'Entregar simulacro'));
      body.appendChild(navCard);
      updateTimer();
    }

    async function askFinish() {
      const c = counts();
      const bodyEl = h(
        'div.stack',
        h('p', 'Respondidas ' + c.answered + '/' + c.total),
        h('p', 'Pendientes ' + c.pending),
        timed ? null : h('p', 'Marcadas para revisar ' + c.flagged),
        c.pending ? h('div.callout.warn', 'Tienes preguntas sin responder. Si entregas ahora, contarán como no respondidas.') : null,
      );
      const ok = await S.ui.dialog({
        title: timed ? '¿Finalizar?' : '¿Entregar el simulacro?',
        body: bodyEl,
        buttons: [
          { label: 'Seguir respondiendo', value: false },
          { label: c.pending ? 'Entregar de todos modos' : 'Entregar', value: true, primary: true },
        ],
      });
      if (!ok) return;
      stopTick();
      leaveQuestion();
      finalize(exam, 'user');
    }

    draw();
    updateTimer();
  };

  /** Corrige, registra intentos y guarda el resultado. */
  function finalize(exam, reason) {
    clearInterval(tick);
    tick = null;
    const now = Date.now();
    exam.finishedAt = now;
    exam.endReason = reason;
    const usedMs = exam.totalMs ? Math.min(exam.totalMs, now - exam.startedAt) : now - exam.startedAt;
    const rows = exam.questions.map((q, i) => {
      const it = qItem(q);
      const step = qStep(q);
      const answered = exam.answers[i] !== undefined;
      const correct = !!(step && answered && exam.answers[i] === step.answer);
      return { i, q, it, step, answered, correct, ms: exam.times[i] || 0 };
    });
    for (const r of rows) {
      if (!r.it || !r.step) continue;
      const chosen = r.answered ? r.step.options[exam.answers[r.i]] : null;
      S.store.addAttempt({
        item: r.it.id,
        step: r.step.index,
        topic: r.it.topic,
        sub: r.it.sub,
        concepts: r.step.concepts,
        cat: r.step.cat,
        diff: r.step.diff || r.it.diff,
        kind: r.it.type,
        score: r.correct ? 1 : 0,
        ms: r.ms,
        choice: r.answered ? exam.answers[r.i] : null,
        err: r.correct ? null : r.answered ? (chosen && chosen.err) || r.step.err : null,
        unanswered: !r.answered,
        timeout: !r.answered && reason === 'timeout',
        mode: exam.kind,
        sess: exam.id,
      });
    }
    const correct = rows.filter((r) => r.correct).length;
    const answered = rows.filter((r) => r.answered).length;
    exam.result = {
      total: rows.length,
      correct,
      incorrect: answered - correct,
      unanswered: rows.length - answered,
      usedMs,
      availableMs: exam.totalMs,
      avgMs: rows.length ? usedMs / rows.length : 0,
    };
    exam.updatedAt = now;
    S.store.addExam(U.deepClone(exam));
    S.store.setResume(null);
    S.ui.state.exam = null;
    if (reason === 'timeout') S.ui.toast('Tiempo agotado: el simulacro se entregó automáticamente.', 'warn', 5000);
    S.ui.go('simulacro-resultado/' + exam.id);
  }

  function findExam(id) {
    return S.store.get().exams.find((e) => e.id === id);
  }

  function rowsOf(exam) {
    return exam.questions.map((q, i) => {
      const it = qItem(q);
      const step = qStep(q);
      const answered = exam.answers[i] !== undefined;
      return { i, q, it, step, answered, correct: !!(step && answered && exam.answers[i] === step.answer), ms: exam.times[i] || 0 };
    });
  }

  function breakdown(rows, keyFn, labelFn) {
    const g = U.groupBy(rows.filter((r) => r.it), keyFn);
    return Object.keys(g)
      .map((k) => ({ k, label: labelFn(k), n: g[k].length, ok: g[k].filter((r) => r.correct).length }))
      .sort((a, b) => a.ok / a.n - b.ok / b.n);
  }

  function breakdownCard(title, list) {
    if (!list.length) return null;
    return h(
      'div.card.stack',
      h('h3', title),
      h(
        'div.hbars',
        list.map((b) =>
          h(
            'div.hbar',
            h('span', b.label),
            h('span.mono.small', b.ok + '/' + b.n + ' · ' + U.pct(b.ok / b.n) + ' %'),
            h('div.bar.state-' + (b.ok / b.n >= 0.85 ? 'mastered' : b.ok / b.n >= 0.7 ? 'good' : b.ok / b.n >= 0.45 ? 'progress' : 'weak'), h('span', { style: { width: U.pct(b.ok / b.n) + '%' } })),
          ),
        ),
      ),
    );
  }

  // ---------- Resultados ----------
  S.views['simulacro-resultado'] = function (root, params) {
    const exam = findExam(params[0]);
    if (!exam) return S.ui.go('historial');
    const r = exam.result;
    const rows = rowsOf(exam);
    const pct = r.total ? U.pct(r.correct / r.total) : 0;
    const ta = E.timeAnalysis(rows.map((x) => ({ ms: x.ms, correct: x.correct, answered: x.answered })));
    const insights = [];
    if (ta) {
      insights.push('Mediana por pregunta: ' + U.fmtDuration(ta.median) + '.');
      if (ta.accFast !== null && ta.accSlow !== null)
        insights.push('Acierto en las preguntas que respondiste más rápido: ' + U.pct(ta.accFast) + ' %; en las más lentas: ' + U.pct(ta.accSlow) + ' %.');
      if (ta.fastWrong) insights.push(ta.fastWrong + ' errores con respuesta muy rápida: posible lectura apresurada del enunciado o de los datos.');
      if (ta.slowWrong) insights.push(ta.slowWrong + ' errores tras mucho tiempo: probable laguna de conocimiento, no de velocidad.');
    }
    if (r.unanswered && exam.endReason === 'timeout') insights.push(r.unanswered + ' preguntas quedaron sin responder por tiempo agotado: conviene practicar contra reloj.');
    if (exam.totalMs && r.usedMs < exam.totalMs * 0.5 && pct < 70) insights.push('Terminaste con mucho tiempo sobrante y precisión baja: la rapidez no reflejó dominio.');
    const failed = [];
    for (const x of rows) if (!x.correct && x.step) for (const c of x.step.concepts) if (!failed.includes(c)) failed.push(c);
    const catLabel = (k) => (R.categories[k] ? R.categories[k].name : k);
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Resultados', exam.title + ' · ' + U.fmtDateTime(exam.finishedAt), 'historial'),
        h(
          'div.card',
          h(
            'div.row',
            S.ui.charts.ring(pct, 'Puntuación'),
            h(
              'div.stack.grow',
              h('div', h('strong', { style: { fontSize: '1.2rem' } }, r.correct + ' / ' + r.total), ' correctas'),
              h('div.small.muted', exam.endReason === 'timeout' ? 'Entregado automáticamente al agotarse el tiempo.' : 'Entregado por ti.'),
            ),
          ),
        ),
        h(
          'div.kpis',
          h('div.kpi', h('div.n', String(r.correct)), h('div.l', 'Correctas')),
          h('div.kpi', h('div.n', String(r.incorrect)), h('div.l', 'Incorrectas')),
          h('div.kpi', h('div.n', String(r.unanswered)), h('div.l', 'Sin responder')),
          h('div.kpi', h('div.n', pct + '%'), h('div.l', 'Porcentaje')),
          h('div.kpi', h('div.n', U.fmtClock(r.usedMs)), h('div.l', 'Tiempo utilizado')),
          h('div.kpi', h('div.n', r.availableMs ? U.fmtClock(r.availableMs) : '—'), h('div.l', 'Tiempo disponible')),
          h('div.kpi', h('div.n', U.fmtDuration(r.avgMs)), h('div.l', 'Promedio por pregunta')),
          h('div.kpi', h('div.n', String(exam.nCases || 0)), h('div.l', 'Casos')),
        ),
        insights.length ? h('div.card.stack', h('h3', 'Manejo del tiempo'), h('ul', { style: { margin: 0, paddingLeft: '1.2rem' } }, insights.map((t) => h('li', t)))) : null,
        breakdownCard('Por tema', breakdown(rows, (x) => x.it.topic, (k) => R.topicById[k].name)),
        breakdownCard('Por subtema', breakdown(rows, (x) => x.it.topic + '|' + x.it.sub, (k) => {
          const [t, s] = k.split('|');
          const tp = R.topicById[t];
          const sb = tp.subtopics.find((y) => y.id === s);
          return tp.short + ' · ' + (sb ? sb.name : s);
        })),
        breakdownCard('Por tipo de pregunta', breakdown(rows, (x) => x.step.cat, catLabel)),
        breakdownCard('Por dificultad', breakdown(rows, (x) => String(x.step.diff || x.it.diff), (k) => 'Nivel ' + k)),
        h(
          'div.actions',
          h('button.btn.btn-primary', { type: 'button', onclick: () => S.ui.go('simulacro-revision/' + exam.id) }, 'Revisar preguntas'),
          failed.length
            ? h(
                'button.btn.btn-soft',
                {
                  type: 'button',
                  onclick: () => S.ui.runner.start({ title: 'Practicar mis errores', mode: 'weak', entries: E.buildWeakSession(S.ui.derived(true), failed, 10), back: 'simulacro-resultado/' + exam.id }),
                },
                'Practicar mis errores',
              )
            : null,
          h('button.btn', { type: 'button', onclick: () => S.ui.go(exam.kind === 'timed' ? 'contrarreloj' : 'simulacro') }, 'Nuevo intento'),
        ),
        failed.length ? h('p.small.muted', 'Los conceptos fallados ya están en «Mis puntos débiles» y se volverán a evaluar con preguntas distintas.') : null,
      ),
    );
  };

  // ---------- Revisión posterior ----------
  S.views['simulacro-revision'] = function (root, params) {
    const exam = findExam(params[0]);
    if (!exam) return S.ui.go('historial');
    const rows = rowsOf(exam);
    let idx = Number(params[1] || 0);
    if (!(idx >= 0 && idx < rows.length)) idx = 0;
    const r = rows[idx];
    const nav = h(
      'div.qnav',
      rows.map((x, i) =>
        h(
          'button' + (x.correct ? '.correct' : x.answered ? '.incorrect' : '') + (i === idx ? '.current' : ''),
          { type: 'button', onclick: () => S.ui.go('simulacro-revision/' + exam.id + '/' + i), 'aria-label': 'Pregunta ' + (i + 1) },
          String(i + 1),
        ),
      ),
    );
    const parts = [S.ui.pageHead('Revisión', exam.title, 'simulacro-resultado/' + exam.id), h('div.card.stack', nav, h('div.legend', h('span', h('i', { style: { background: 'var(--ok-bg)' } }), 'Correcta'), h('span', h('i', { style: { background: 'var(--bad-bg)' } }), 'Incorrecta'), h('span', h('i'), 'Sin responder')))];
    if (!r.it || !r.step) parts.push(h('div.callout.warn', 'Esta pregunta ya no existe en el banco actual.'));
    else {
      const card = h('div.card.stack');
      card.appendChild(RN.metaChips(r.it, h('span.chip', 'Tiempo: ' + U.fmtDuration(r.ms))));
      const hdr = RN.renderHeader(r.it, { showRef: true });
      if (hdr) card.appendChild(hdr);
      card.appendChild(rich('p.stem', r.step.stem));
      const st = { choice: r.answered ? exam.answers[r.i] : null, reveal: true };
      card.appendChild(RN.mcqOptions(r.step, st, () => {}, true));
      if (!r.answered) card.appendChild(h('div.callout.warn', exam.endReason === 'timeout' ? 'Sin responder por tiempo agotado.' : 'Sin responder.'));
      card.appendChild(RN.mcqFeedback(r.step, r.answered ? exam.answers[r.i] : null, null));
      if (r.step.key && r.step.key.length) card.appendChild(h('div.callout', rich('p', '**Qué debí reconocer:** ' + r.step.key.join('; '))));
      parts.push(card);
    }
    parts.push(
      h(
        'div.actions',
        h('button.btn', { type: 'button', disabled: idx === 0, onclick: () => S.ui.go('simulacro-revision/' + exam.id + '/' + (idx - 1)) }, icon('back'), 'Anterior'),
        h('button.btn.btn-primary', { type: 'button', disabled: idx >= rows.length - 1, onclick: () => S.ui.go('simulacro-revision/' + exam.id + '/' + (idx + 1)) }, 'Siguiente', icon('next')),
      ),
    );
    root.appendChild(h('div.stack-lg.fade-in', parts));
  };

  S.ui.exam = { resume, finalize, startExam, TIMED_LEVELS };
})(window.SolMed);
