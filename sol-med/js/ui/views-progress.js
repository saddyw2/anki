/* Repaso recomendado, puntos débiles, mapa de dominio, estadísticas e
 * historial de simulacros. */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const E = S.engine;
  const { h, icon, rich } = S.ui;

  function contentTopics() {
    return R.topics.filter((t) => t.kind === 'topic');
  }

  function conceptPath(c) {
    const t = R.topicById[c.topic];
    const sub = t && t.subtopics.find((s) => s.id === c.sub);
    return (t ? t.short : '') + (sub ? ' · ' + sub.name : '');
  }

  // ---------- Resumen de progreso ----------
  S.views.progreso = function (root) {
    const d = S.ui.derived();
    const st = S.store.get();
    const due = E.dueConcepts(d);
    const weak = E.weakPoints(d);
    const ret = E.retentionRate(d);
    const acc7 = st.attempts.filter((a) => a.t > Date.now() - 7 * U.DAY);
    const links = [
      ['repaso', 'Repaso recomendado', due.length + ' pendientes', 'repeat'],
      ['debiles', 'Mis puntos débiles', weak.length + ' conceptos', 'target'],
      ['dominio', 'Mapa de dominio', 'Por tema y subtema', 'map'],
      ['estadisticas', 'Estadísticas', 'Evolución y errores', 'chart'],
      ['historial', 'Simulacros', st.exams.length + ' realizados', 'exam'],
    ];
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Mi progreso'),
        h(
          'div.kpis',
          h('div.kpi', h('div.n', String(st.attempts.length)), h('div.l', 'Respuestas totales')),
          h('div.kpi', h('div.n', acc7.length ? U.pct(U.mean(acc7, E.effScore)) + '%' : '—'), h('div.l', 'Acierto 7 días')),
          h('div.kpi', h('div.n', ret.rate === null ? '—' : U.pct(ret.rate) + '%'), h('div.l', 'Retención (' + ret.checks + ' repasos)')),
          h('div.kpi', h('div.n', String(Object.keys(d.concepts).filter((k) => d.concepts[k].mastery >= 0.85).length)), h('div.l', 'Conceptos dominados')),
        ),
        h(
          'div.tiles',
          links.map(([r, t, dsc, ic]) => h('button.tile', { type: 'button', onclick: () => S.ui.go(r) }, h('span.ic', icon(ic)), h('span.t', t), h('span.d', dsc))),
        ),
      ),
    );
  };

  // ---------- Repaso recomendado ----------
  S.views.repaso = function (root) {
    const d = S.ui.derived(true);
    const due = E.dueConcepts(d);
    const next = E.upcoming(d, Date.now(), 7);
    const startReview = () => {
      const entries = E.buildWeakSession(d, due.map((x) => x.id), Math.min(12, Math.max(5, due.length)));
      entries.forEach((e) => (e.why = 'repaso'));
      S.ui.runner.start({ title: 'Repaso recomendado', mode: 'review', entries, back: 'repaso' });
    };
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Repaso recomendado', 'Repetición espaciada por concepto: cada repaso usa una pregunta, un paciente, un laboratorio o un cálculo distinto. Al demostrar dominio, el intervalo crece.'),
        due.length
          ? h('button.btn.btn-primary.btn-block', { type: 'button', onclick: startReview }, icon('play'), 'Repasar ahora (' + due.length + ')')
          : h('div.card.empty', h('p', 'No tienes repasos pendientes ahora.'), h('p.small.muted', next.length ? 'El próximo: ' + next[0].concept.name + ', ' + U.fmtRelative(next[0].st.due) + '.' : 'Estudia con «Estudiar ahora» para programar repasos.')),
        due.length
          ? h(
              'div.card',
              h('h3', 'Pendientes hoy'),
              due.map((x) =>
                h(
                  'div.topic-row',
                  h('div', h('strong', x.concept.name), h('div.tiny.muted', conceptPath(x.concept) + ' · vencido ' + U.fmtRelative(x.st.due).replace('hace ', 'hace '))),
                  S.ui.stateChip(x.st.mastery, x.st.n),
                ),
              ),
            )
          : null,
        next.length
          ? h(
              'div.card',
              h('h3', 'Próximos 7 días'),
              next.slice(0, 20).map((x) =>
                h('div.topic-row', h('div', h('strong', x.concept.name), h('div.tiny.muted', conceptPath(x.concept))), h('span.small.muted', U.fmtRelative(x.st.due))),
              ),
            )
          : null,
      ),
    );
  };

  // ---------- Mis puntos débiles ----------
  const GROUPS = [
    ['diferencial', 'Conceptos que confundo (diagnóstico diferencial)'],
    ['valores', 'Valores normales problemáticos'],
    ['calculo', 'Fórmulas y cálculos'],
    ['laboratorio', 'Interpretación de laboratorio'],
    ['conocimiento', 'Conocimiento'],
    ['razonamiento', 'Razonamiento'],
    ['tratamiento', 'Tratamientos'],
    ['secuencia', 'Secuencias terapéuticas'],
    ['complicaciones', 'Complicaciones'],
  ];

  S.views.debiles = function (root) {
    const d = S.ui.derived(true);
    const groups = E.weakGroups(d);
    const all = E.weakPoints(d);
    const practice = (ids, title) => S.ui.runner.start({ title, mode: 'weak', entries: E.buildWeakSession(d, ids, 10), back: 'debiles' });
    const sections = GROUPS.filter(([k]) => groups[k] && groups[k].length).map(([k, label]) =>
      h(
        'div.card',
        h('div.section-title', h('h3', label), h('button.btn.btn-soft.btn-sm', { type: 'button', onclick: () => practice(groups[k].map((w) => w.id), label) }, 'Practicar')),
        groups[k].map((w) =>
          h(
            'div.topic-row',
            h(
              'div',
              h('strong', w.concept.name),
              h('div.tiny.muted', conceptPath(w.concept) + ' · ' + w.st.n + ' intentos · ' + w.st.lapses + ' fallos' + (w.st.due ? ' · próximo repaso ' + U.fmtRelative(w.st.due) : '')),
            ),
            h('span.pctv', U.pct(w.st.mastery) + ' %'),
            S.ui.masteryBar(w.st.mastery, w.st.n),
          ),
        ),
      ),
    );
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Mis puntos débiles', 'Conceptos con dominio bajo o con el último intento fallado, agrupados por el tipo de error que cometiste.'),
        all.length
          ? h('button.btn.btn-primary.btn-block', { type: 'button', onclick: () => practice(all.map((w) => w.id), 'Practicar mis puntos débiles') }, icon('target'), 'Practicar mis puntos débiles')
          : h('div.card.empty', h('p', 'Todavía no hay puntos débiles.'), h('p.small.muted', 'Aparecerán aquí cuando falles un concepto o lo respondas adivinando.')),
        sections,
      ),
    );
  };

  // ---------- Mapa de dominio ----------
  S.views.dominio = function (root) {
    const d = S.ui.derived(true);
    const st = S.store.get();
    const topics = R.topics;
    const bySpec = U.groupBy(topics, (t) => t.specialty);
    const catOrder = ['diagnostico', 'laboratorio', 'tratamiento', 'complicaciones', 'fisiopatologia', 'diferencial', 'secuencia', 'integracion', 'calculo', 'concepto'];
    const blocks = Object.keys(bySpec).map((sp) => {
      const spec = R.specialties[sp] || { name: sp };
      return h(
        'section.stack',
        h('div.eyebrow', spec.name),
        bySpec[sp].map((t) => {
          const tm = E.topicMastery(d, t);
          const cats = E.byCategory(st.attempts, (a) => a.topic === t.id);
          const subRows = t.subtopics
            .map((s) => ({ s, m: E.subtopicMastery(d, t, s.id) }))
            .filter((x) => x.m)
            .map((x) =>
              h('div.hbar', h('span', x.s.name), h('span.mono.small', U.pct(x.m.m) + ' % · ' + x.m.seen + '/' + x.m.total), S.ui.masteryBar(x.m.m, x.m.seen)),
            );
          const catChips = catOrder
            .filter((k) => cats[k])
            .map((k) => h('span.chip.' + (cats[k].acc >= 0.8 ? 'ok' : cats[k].acc >= 0.6 ? 'warn' : 'bad'), (R.categories[k] ? R.categories[k].name : k) + ' ' + U.pct(cats[k].acc) + ' %'));
          return h(
            'details.card',
            { style: { padding: '0' } },
            h(
              'summary',
              { style: { listStyle: 'none', cursor: 'pointer', padding: '16px 18px' } },
              h('div.row-between', h('div', h('h3', t.name), h('div.tiny.muted', tm.seen + ' de ' + tm.total + ' conceptos practicados')), h('span.pctv.mono', { style: { fontSize: '1.2rem' } }, U.pct(tm.m) + ' %')),
              h('div', { style: { marginTop: '10px' } }, S.ui.masteryBar(tm.m, tm.seen)),
            ),
            h(
              'div.stack',
              { style: { padding: '0 18px 18px' } },
              catChips.length ? h('div.row', catChips) : null,
              h('div.hbars', subRows),
              t.kind === 'topic' ? h('button.btn.btn-sm.btn-soft', { type: 'button', onclick: () => S.ui.go('tema/' + t.id) }, 'Abrir tema') : null,
            ),
          );
        }),
      );
    });
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead(
          'Mapa de dominio',
          'El dominio no es solo el porcentaje de aciertos: pondera dificultad, recencia, retención tras días sin ver el concepto, errores repetidos, variedad de formatos (preguntas, casos, laboratorio) y penaliza los aciertos adivinados.',
        ),
        h(
          'div.legend',
          [
            ['var(--muted)', 'Sin datos'],
            ['var(--bad)', 'Débil < 45 %'],
            ['var(--warn)', 'En progreso'],
            ['var(--violet)', 'Bien ≥ 70 %'],
            ['var(--ok)', 'Dominado ≥ 85 %'],
          ].map(([c, l]) => h('span', h('i', { style: { background: c, borderColor: c } }), l)),
        ),
        blocks,
      ),
    );
  };

  // ---------- Estadísticas ----------
  S.views.estadisticas = function (root) {
    const st = S.store.get();
    const d = S.ui.derived(true);
    const C = S.ui.charts;
    if (!st.attempts.length) {
      root.appendChild(
        h('div.stack-lg.fade-in', S.ui.pageHead('Estadísticas'), h('div.card.empty', h('p', 'Aún no hay datos.'), h('p.small.muted', 'Las gráficas aparecen después de tus primeras respuestas.'))),
      );
      return;
    }
    const days = E.dailySeries(st.attempts, 30);
    const shortDay = (k) => k.slice(8) + '/' + k.slice(5, 7);
    const accPts = days.map((x) => ({ label: shortDay(x.day), y: x.acc, tip: shortDay(x.day) + ': ' + (x.acc === null ? 'sin práctica' : U.pct(x.acc) + ' % de acierto en ' + x.n + ' respuestas') }));
    const volPts = days.map((x) => ({ label: shortDay(x.day), v: x.n, tip: shortDay(x.day) + ': ' + x.n + ' respuestas' }));

    const topicRows = R.topics.map((t) => ({ t, tm: E.topicMastery(d, t) })).sort((a, b) => b.tm.m - a.tm.m);
    const errs = E.errorCounts(st.attempts);
    const errRows = Object.keys(errs)
      .map((k) => ({ k, n: errs[k] }))
      .sort((a, b) => b.n - a.n);
    const errMax = Math.max(1, ...errRows.map((x) => x.n));
    const modeTime = U.groupBy(st.attempts.filter((a) => a.ms), (a) => a.kind);
    const exams = st.exams.slice().sort((a, b) => a.finishedAt - b.finishedAt);
    const examPts = exams.map((e, i) => ({ label: String(i + 1), y: e.result.total ? e.result.correct / e.result.total : 0, tip: U.fmtDate(e.finishedAt) + ' · ' + e.title + ': ' + e.result.correct + '/' + e.result.total }));
    const ret = E.retentionRate(d);
    const strong = Object.values(d.concepts)
      .filter((c) => c.mastery >= 0.8 && R.concepts[c.id])
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 6);
    const recurrent = Object.values(d.concepts)
      .filter((c) => c.lapses >= 2 && R.concepts[c.id])
      .sort((a, b) => b.lapses - a.lapses)
      .slice(0, 6);

    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Estadísticas', 'Solo lo que ayuda a decidir qué estudiar.'),
        h('div.card.stack', h('h3', 'Evolución del acierto (30 días)'), C.lineChart(accPts, { yMax: 1, yFmt: (v) => Math.round(v * 100) + '%', label: 'Acierto diario' }), h('p.tiny.muted', 'Los días sin práctica cortan la línea.')),
        h('div.card.stack', h('h3', 'Volumen de práctica (30 días)'), C.columnChart(volPts, { label: 'Respuestas por día' })),
        h(
          'div.card.stack',
          h('h3', 'Rendimiento por tema'),
          h(
            'div.hbars',
            topicRows.map((x) => h('div.hbar', h('span', x.t.name), h('span.mono.small', U.pct(x.tm.m) + ' %'), S.ui.masteryBar(x.tm.m, x.tm.seen))),
          ),
        ),
        h(
          'div.fb-grid',
          h(
            'div.card.stack',
            h('h3', 'Fortalezas'),
            strong.length ? h('ul', { style: { margin: 0, paddingLeft: '1.2rem' } }, strong.map((c) => h('li', R.concepts[c.id].name + ' · ' + U.pct(c.mastery) + ' %'))) : h('p.small.muted', 'Aún ningún concepto supera el 80 %.'),
          ),
          h(
            'div.card.stack',
            h('h3', 'Errores recurrentes'),
            recurrent.length ? h('ul', { style: { margin: 0, paddingLeft: '1.2rem' } }, recurrent.map((c) => h('li', R.concepts[c.id].name + ' · ' + c.lapses + ' fallos'))) : h('p.small.muted', 'Sin conceptos fallados dos o más veces.'),
          ),
        ),
        errRows.length
          ? h(
              'div.card.stack',
              h('h3', 'Tipos de error'),
              h(
                'div.hbars',
                errRows.map((x) =>
                  h('div.hbar', h('span', R.errorTypes[x.k] ? R.errorTypes[x.k].name : x.k), h('span.mono.small', String(x.n)), h('div.bar', h('span', { style: { width: (x.n / errMax) * 100 + '%', background: 'var(--rose)' } }))),
                ),
              ),
            )
          : null,
        h(
          'div.card.stack',
          h('h3', 'Tiempo y retención'),
          h(
            'div.kpis',
            Object.keys(modeTime).map((k) =>
              h('div.kpi', h('div.n', U.fmtDuration(E.median(modeTime[k].map((a) => a.ms)))), h('div.l', 'Mediana · ' + (S.ui.runner.TYPE_LABEL[k] || k))),
            ),
            h('div.kpi', h('div.n', ret.rate === null ? '—' : U.pct(ret.rate) + '%'), h('div.l', 'Retención tras ≥1 día')),
          ),
        ),
        examPts.length
          ? h('div.card.stack', h('h3', 'Simulacros'), C.lineChart(examPts, { yMax: 1, yFmt: (v) => Math.round(v * 100) + '%', label: 'Puntuación por simulacro' }), h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => S.ui.go('historial') }, 'Ver historial'))
          : null,
        h(
          'details.card',
          h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Tabla de datos por tema'),
          h(
            'div.table-wrap',
            { style: { marginTop: '10px' } },
            h(
              'table.table',
              h('thead', h('tr', h('th', 'Tema'), h('th.num', 'Dominio'), h('th.num', 'Conceptos'), h('th.num', 'Respuestas'), h('th.num', 'Acierto'))),
              h(
                'tbody',
                topicRows.map((x) => {
                  const at = st.attempts.filter((a) => a.topic === x.t.id);
                  return h('tr', h('td', x.t.name), h('td.num', U.pct(x.tm.m) + ' %'), h('td.num', x.tm.seen + '/' + x.tm.total), h('td.num', String(at.length)), h('td.num', at.length ? U.pct(U.mean(at, E.effScore)) + ' %' : '—'));
                }),
              ),
            ),
          ),
        ),
      ),
    );
  };

  // ---------- Historial ----------
  S.views.historial = function (root) {
    const exams = S.store.get().exams.slice().sort((a, b) => b.finishedAt - a.finishedAt);
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Simulacros realizados', null, 'progreso'),
        exams.length
          ? h(
              'div.card',
              exams.map((e) =>
                h(
                  'button.topic-row',
                  { type: 'button', style: { width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }, onclick: () => S.ui.go('simulacro-resultado/' + e.id) },
                  h('div', h('strong', e.title), h('div.tiny.muted', U.fmtDateTime(e.finishedAt) + ' · ' + e.result.total + ' preguntas · ' + U.fmtClock(e.result.usedMs))),
                  h('span.chip.' + (e.result.correct / e.result.total >= 0.7 ? 'ok' : 'warn'), U.pct(e.result.correct / e.result.total) + ' %'),
                ),
              ),
            )
          : h('div.card.empty', h('p', 'Aún no hay simulacros.'), h('button.btn.btn-primary', { type: 'button', onclick: () => S.ui.go('simulacro') }, 'Hacer un simulacro')),
      ),
    );
  };
})(window.SolMed);
