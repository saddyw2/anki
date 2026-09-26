/* Inicio, centro de estudio, configuración de modos y fichas de temas. */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const E = S.engine;
  const { h, icon, rich } = S.ui;

  const MODES = [
    { id: 'mcq', type: 'mcq', title: 'Selección múltiple', desc: 'Una mejor respuesta entre 4–5 opciones.', icon: 'list' },
    { id: 'case', type: 'case', title: 'Casos clínicos', desc: 'Pacientes completos, con datos distractores.', icon: 'case' },
    { id: 'progressive', type: 'progressive', title: 'Casos progresivos', desc: 'La información llega por etapas; tus decisiones cuentan.', icon: 'steps' },
    { id: 'reasoning', type: 'reasoning', title: 'Razonamiento clínico', desc: 'Sin opciones: escribes y comparas.', icon: 'brain' },
    { id: 'lab', type: 'lab', title: 'Interpretar laboratorio', desc: 'Resultados sin marcar: tú decides qué está alterado.', icon: 'flask' },
  ];
  S.ui.MODES = MODES;

  function contentTopics() {
    return R.topics.filter((t) => t.kind === 'topic');
  }

  // ---------- Inicio ----------
  S.views.inicio = function (root) {
    const st = S.store.get();
    const d = S.ui.derived();
    const due = E.dueConcepts(d);
    const weak = E.weakPoints(d);
    const allConcepts = R.topics.reduce((n, t) => n + t.concepts.length, 0);
    const seen = Object.keys(d.concepts).filter((id) => R.concepts[id]).length;
    const today = st.attempts.filter((a) => U.dayKey(a.t) === U.dayKey(Date.now()));

    const hero = h(
      'section.hero',
      h('div.eyebrow', 'Centro personal de entrenamiento clínico'),
      h('h1', st.attempts.length ? 'Tu siguiente sesión está lista' : 'Te damos la bienvenida a Sol MED'),
      h(
        'p.small',
        { style: { color: 'var(--ink-2)', maxWidth: '52ch', marginTop: '6px' } },
        st.attempts.length
          ? 'Sol MED combina tus repasos pendientes, tus puntos débiles, conceptos nuevos, un caso, un laboratorio y un cálculo.'
          : 'Empieza con «Estudiar ahora»: Sol MED arranca en nivel intermedio y se adapta a tus respuestas.',
      ),
      h(
        'div.hero-stats',
        h('div.hero-stat', h('div.n', String(due.length)), h('div.l', 'Repasos pendientes')),
        h('div.hero-stat', h('div.n', String(weak.length)), h('div.l', 'Puntos débiles')),
        h('div.hero-stat', h('div.n', String(Math.max(0, allConcepts - seen))), h('div.l', 'Conceptos sin ver')),
      ),
      h(
        'button.btn.btn-primary.btn-block#study-now',
        { type: 'button', onclick: studyNow, style: { minHeight: '56px', fontSize: '1.05rem' } },
        icon('spark'),
        'Estudiar ahora',
      ),
    );

    const parts = [hero];
    const resume = st.resume;
    if (resume && (resume.kind === 'session' || resume.kind === 'exam')) {
      const isExam = resume.kind === 'exam';
      const done = isExam ? Object.keys(resume.exam.answers || {}).length : resume.session.pos;
      const total = isExam ? resume.exam.questions.length : resume.session.entries.length;
      parts.push(
        h(
          'section.card.resume-card',
          h('span.resume-ic', icon(isExam ? 'exam' : 'play')),
          h(
            'div.grow',
            h('div.eyebrow', 'Continuar donde lo dejaste'),
            h('div', h('strong', resume.title || (isExam ? 'Simulacro' : 'Sesión'))),
            h('div.small.muted', (isExam ? 'Respondidas ' : 'Completados ') + done + ' de ' + total + (isExam && resume.exam.deadline ? ' · el tiempo sigue corriendo' : '')),
          ),
          h(
            'button.btn.btn-soft',
            {
              type: 'button',
              id: 'resume-btn',
              onclick: () => (isExam ? S.ui.exam.resume(resume) : S.ui.runner.resumeFrom(resume)),
            },
            'Continuar',
          ),
        ),
      );
    }

    const tiles = [
      ...MODES.map((m) => ({ t: m.title, d: m.desc, icon: m.icon, go: 'modo/' + m.id })),
      { t: 'Valores normales', d: 'Normal → alterado → significado → conducta.', icon: 'flask', go: 'valores' },
      { t: 'Cálculos clínicos', d: 'Anion gap, Na corregido, osmolalidad…', icon: 'ruler', go: 'calculos' },
      { t: 'Comparaciones', d: 'El dato que realmente inclina el diagnóstico.', icon: 'compare', go: 'comparaciones' },
      { t: 'Simulacro', d: 'Examen cronometrado con revisión posterior.', icon: 'exam', go: 'simulacro' },
      { t: 'Contra reloj', d: 'Eficiencia de razonamiento bajo presión.', icon: 'clock', go: 'contrarreloj' },
      { t: 'Repaso recomendado', d: due.length + ' conceptos pendientes hoy.', icon: 'repeat', go: 'repaso' },
      { t: 'Mis puntos débiles', d: weak.length ? weak.length + ' conceptos por reforzar.' : 'Aparecerán cuando falles algo.', icon: 'target', go: 'debiles' },
      { t: 'Mapa de dominio', d: 'Dominio por tema y subtema.', icon: 'map', go: 'dominio' },
      { t: 'Estadísticas', d: 'Evolución, tiempo, retención y errores.', icon: 'chart', go: 'estadisticas' },
      { t: 'Temas', d: 'Fichas de estudio de cada tema.', icon: 'book', go: 'temas' },
      { t: 'Entrenar valores', d: 'Tarjetas, alto o bajo, valor crítico…', icon: 'flask', go: 'valores-entrenar' },
      { t: 'Laboratorio sorpresa', d: 'Una analítica sin decirte el diagnóstico.', icon: 'drop', run: surpriseLab },
      { t: 'Fuentes médicas', d: 'Guías, ediciones y fecha de revisión.', icon: 'source', go: 'fuentes' },
    ];
    parts.push(
      h(
        'section',
        h('div.section-title', h('h2', 'Modos de estudio')),
        h(
          'div.tiles',
          tiles.map((t) => h('button.tile', { type: 'button', onclick: () => (t.run ? t.run() : S.ui.go(t.go)) }, h('span.ic', icon(t.icon)), h('span.t', t.t), h('span.d', t.d))),
        ),
      ),
    );

    parts.push(
      h(
        'section.card',
        h('div.section-title', h('h2', 'Dominio por tema'), h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => S.ui.go('dominio') }, 'Ver mapa')),
        h(
          'div',
          contentTopics().map((t) => {
            const tm = E.topicMastery(d, t);
            return h(
              'div.topic-row',
              h('div', h('strong', t.name), h('div.tiny.muted', tm.seen + ' de ' + tm.total + ' conceptos practicados')),
              h('span.pctv', U.pct(tm.m) + ' %'),
              S.ui.masteryBar(tm.m, tm.seen),
            );
          }),
        ),
        h('p.tiny.muted', { style: { marginTop: '8px' } }, 'El dominio combina precisión, dificultad, retención, errores repetidos y variedad de formatos; los conceptos no practicados cuentan como 0 %.'),
      ),
    );

    if (today.length) {
      parts.push(
        h(
          'section.card.flat',
          h('div.row-between', h('strong', 'Hoy'), h('span.small.muted', today.length + ' respuestas · ' + U.pct(U.mean(today, E.effScore)) + ' % de acierto')),
        ),
      );
    }

    root.appendChild(h('div.stack-lg.fade-in', parts));
  };

  function surpriseLab() {
    const it = S.gen.surpriseLab(S.ui.derived());
    if (it) S.ui.runner.start({ title: 'Laboratorio sorpresa', mode: 'practice', entries: [{ item: it.id }], back: 'inicio' });
  }

  function studyNow() {
    const d = S.ui.derived(true);
    const size = S.store.get().prefs.sessionSize || 10;
    const plan = E.buildStudyNow(d, { size });
    S.ui.runner.start({ title: 'Estudiar ahora', mode: 'studynow', entries: plan.entries, back: 'inicio' });
  }
  S.ui.studyNow = studyNow;

  // ---------- Centro de estudio ----------
  S.views.estudiar = function (root) {
    const d = S.ui.derived();
    const cards = MODES.map((m) => {
      const n = R.items.filter((it) => it.type === m.type).length;
      return h(
        'button.tile',
        { type: 'button', onclick: () => S.ui.go('modo/' + m.id) },
        h('span.ic', icon(m.icon)),
        h('span.t', m.title),
        h('span.d', m.desc),
        h('span.chip', n + ' disponibles'),
      );
    });
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Estudiar', 'Elige un modo o deja que Sol MED arme la sesión por ti.'),
        h('button.btn.btn-primary.btn-block', { type: 'button', onclick: studyNow, style: { minHeight: '56px' } }, icon('spark'), 'Estudiar ahora (sesión inteligente)'),
        h('div.tiles', cards),
        h(
          'div.tiles',
          h('button.tile', { type: 'button', onclick: () => S.ui.go('calculos') }, h('span.ic', icon('ruler')), h('span.t', 'Cálculos clínicos'), h('span.d', 'Siempre con datos nuevos.')),
          h('button.tile', { type: 'button', onclick: () => S.ui.go('valores-entrenar') }, h('span.ic', icon('flask')), h('span.t', 'Entrenar valores'), h('span.d', 'Tarjetas, alto/bajo, valor crítico…')),
          h('button.tile', { type: 'button', onclick: () => S.ui.go('comparaciones') }, h('span.ic', icon('compare')), h('span.t', 'Comparaciones'), h('span.d', 'CAD vs EHH, Graves vs tiroiditis…')),
          h('button.tile', { type: 'button', onclick: () => S.ui.go('simulacro') }, h('span.ic', icon('exam')), h('span.t', 'Simulacro'), h('span.d', 'Examen con temporizador.')),
          h('button.tile', { type: 'button', onclick: () => S.ui.go('contrarreloj') }, h('span.ic', icon('clock')), h('span.t', 'Contra reloj'), h('span.d', '5, 10, 20, 30 o a medida.')),
          h('button.tile', { type: 'button', onclick: () => S.ui.go('temas') }, h('span.ic', icon('book')), h('span.t', 'Fichas de temas'), h('span.d', contentTopics().length + ' temas disponibles.')),
        ),
        h(
          'section.card',
          h('h3', 'Nivel actual por tema'),
          h('p.small.muted', 'Empieza en nivel 2 y sube o baja según tus últimas respuestas en cada tema.'),
          h(
            'div.row',
            { style: { marginTop: '8px' } },
            contentTopics().map((t) => h('span.chip.violet', t.short + ' · N' + E.levelFor(d, t.id))),
          ),
        ),
      ),
    );
  };

  // ---------- Configurar un modo ----------
  S.views.modo = function (root, params) {
    const mode = MODES.find((m) => m.id === params[0]) || MODES[0];
    const cfg = { topics: contentTopics().map((t) => t.id), diff: 'auto', count: 10 };
    const avail = h('p.small.muted');
    const updateAvail = () => {
      const n = E.filterItems({ types: [mode.type], topics: cfg.topics, diff: cfg.diff }).length;
      avail.textContent = n + ' ejercicios disponibles con estos filtros.' + (n < cfg.count ? ' La sesión tendrá ' + n + '.' : '');
    };
    const startBtn = h(
      'button.btn.btn-primary.btn-block',
      {
        type: 'button',
        onclick: () => {
          const d = S.ui.derived(true);
          const items = E.pickForMode(d, { types: [mode.type], topics: cfg.topics, diff: cfg.diff, count: cfg.count });
          S.ui.runner.start({ title: mode.title, mode: 'practice', entries: items.map((it) => ({ item: it.id })), back: 'modo/' + mode.id });
        },
      },
      icon('play'),
      'Empezar',
    );
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead(mode.title, mode.desc, 'estudiar'),
        h(
          'div.card.stack',
          h('div.label', 'Temas'),
          S.ui.checks(
            contentTopics().map((t) => ({ value: t.id, label: t.short })),
            cfg.topics,
            (v) => {
              cfg.topics = v;
              updateAvail();
            },
          ),
          h('div.label', 'Dificultad'),
          S.ui.seg(
            [
              { value: 'auto', label: 'Adaptativa' },
              { value: '1', label: '1 · Fundamentos' },
              { value: '2', label: '2 · Aplicación' },
              { value: '3', label: '3 · Avanzado' },
            ],
            cfg.diff,
            (v) => {
              cfg.diff = v;
              updateAvail();
            },
            'Dificultad',
          ),
          h('div.label', 'Cantidad'),
          S.ui.seg(
            [5, 10, 20].map((n) => ({ value: n, label: String(n) })),
            cfg.count,
            (v) => {
              cfg.count = v;
              updateAvail();
            },
            'Cantidad',
          ),
          avail,
          startBtn,
        ),
        mode.id === 'lab'
          ? h(
              'div.card.stack',
              h('h3', 'Laboratorio sorpresa'),
              h('p.small', 'Una analítica de cualquier tema, sin decirte el diagnóstico.'),
              h(
                'button.btn.btn-soft',
                {
                  type: 'button',
                  onclick: () => {
                    const it = S.gen.surpriseLab(S.ui.derived());
                    S.ui.runner.start({ title: 'Laboratorio sorpresa', mode: 'practice', entries: [{ item: it.id }], back: 'modo/lab' });
                  },
                },
                'Laboratorio sorpresa',
              ),
            )
          : null,
      ),
    );
    updateAvail();
  };

  // ---------- Temas ----------
  S.views.temas = function (root) {
    const d = S.ui.derived();
    const bySpec = U.groupBy(contentTopics(), (t) => t.specialty + '|' + t.area);
    const blocks = Object.keys(bySpec).map((k) => {
      const [sp, ar] = k.split('|');
      const spec = R.specialties[sp] || { name: sp, areas: {} };
      const area = (spec.areas && spec.areas[ar]) || { name: ar };
      return h(
        'section.stack',
        h('div.eyebrow', spec.name + ' · ' + area.name),
        bySpec[k].map((t) => {
          const tm = E.topicMastery(d, t);
          return h(
            'button.card.tight',
            { type: 'button', style: { textAlign: 'left', cursor: 'pointer', width: '100%' }, onclick: () => S.ui.go('tema/' + t.id) },
            h('div.row-between', h('div', h('h3', t.name), h('div.small.muted', (t.group ? t.group + ' · ' : '') + t.items.length + ' ejercicios · revisado ' + U.fmtDate(t.reviewed))), h('span.pctv.mono', U.pct(tm.m) + ' %')),
            h('div', { style: { marginTop: '10px' } }, S.ui.masteryBar(tm.m, tm.seen)),
          );
        }),
      );
    });
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Temas', 'Especialidad → área → tema → subtema → conceptos. Cada tema nuevo se integra automáticamente en preguntas, repaso, estadísticas y mapa de dominio.'),
        blocks,
      ),
    );
  };

  S.views.tema = function (root, params) {
    const t = R.topicById[params[0]];
    if (!t) return S.ui.go('temas');
    const d = S.ui.derived();
    const tm = E.topicMastery(d, t);
    const types = U.groupBy(t.items, (it) => it.type);
    const practice = (type, label) =>
      types[type]
        ? h(
            'button.btn.btn-sm',
            {
              type: 'button',
              onclick: () => {
                const items = E.pickForMode(S.ui.derived(true), { types: [type], topics: [t.id], diff: 'auto', count: 10 });
                S.ui.runner.start({ title: t.short + ' · ' + label, mode: 'practice', entries: items.map((it) => ({ item: it.id })), back: 'tema/' + t.id });
              },
            },
            label + ' (' + types[type].length + ')',
          )
        : null;
    const mixed = h(
      'button.btn.btn-primary',
      {
        type: 'button',
        onclick: () => {
          const items = E.pickForMode(S.ui.derived(true), { types: ['mcq', 'case', 'progressive', 'reasoning', 'lab'], topics: [t.id], diff: 'auto', count: 10 });
          S.ui.runner.start({ title: 'Practicar ' + t.short, mode: 'practice', entries: items.map((it) => ({ item: it.id })), back: 'tema/' + t.id });
        },
      },
      icon('play'),
      'Practicar este tema',
    );
    const sources = t.sources.map((id) => R.sources[id]).filter(Boolean);
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead(t.name, t.summary, 'temas'),
        h(
          'div.card.stack',
          h('div.row-between', h('div', h('div.eyebrow', 'Tu dominio'), h('div.small.muted', tm.seen + ' de ' + tm.total + ' conceptos practicados · nivel actual ' + E.levelFor(d, t.id))), h('span.pctv.mono', U.pct(tm.m) + ' %')),
          S.ui.masteryBar(tm.m, tm.seen),
          h('div.row', mixed, practice('mcq', 'Selección múltiple'), practice('case', 'Casos'), practice('progressive', 'Progresivos'), practice('reasoning', 'Razonamiento'), practice('lab', 'Laboratorio')),
        ),
        h(
          'section.sheet',
          h('h2', 'Ficha del tema'),
          t.sheet.map((sec, i) =>
            h(
              'details',
              { open: i === 0 },
              h('summary', sec.title),
              h(
                'div.body',
                [].concat(sec.body).map((b) => (Array.isArray(b) ? h('ul', b.map((x) => rich('li', x))) : rich('p', b))),
              ),
            ),
          ),
        ),
        h(
          'section.card.flat.stack',
          h('h3', 'Fuentes de este tema'),
          h(
            'ul.small',
            { style: { margin: 0, paddingLeft: '1.2rem' } },
            sources.map((s) => h('li', s.short + (s.edition ? ' · ' + s.edition : '') + (s.year ? ' (' + s.year + ')' : ''))),
          ),
          h('p.tiny.muted', 'Revisión del contenido: ' + U.fmtDate(t.reviewed) + '. Detalle y estado de verificación en Fuentes médicas.'),
        ),
      ),
    );
  };

  // ---------- Más (móvil) ----------
  S.views.mas = function (root) {
    const links = [
      ['temas', 'Temas', 'book'],
      ['calculos', 'Cálculos clínicos', 'ruler'],
      ['comparaciones', 'Comparaciones', 'compare'],
      ['simulacro', 'Simulacro', 'exam'],
      ['contrarreloj', 'Contra reloj', 'clock'],
      ['fuentes', 'Fuentes médicas', 'source'],
      ['ajustes', 'Configuración, respaldo y estado del sistema', 'gear'],
    ];
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Más'),
        h(
          'div.card',
          { style: { padding: '6px 14px' } },
          links.map(([r, l, ic]) =>
            h(
              'button.topic-row',
              { type: 'button', style: { width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }, onclick: () => S.ui.go(r) },
              h('span.row', icon(ic), h('strong', l)),
              icon('next'),
            ),
          ),
        ),
      ),
    );
  };

  S.views.sesion = function (root) {
    if (!S.ui.state.session) {
      const r = S.store.get().resume;
      if (r && r.kind === 'session') S.ui.state.session = U.deepClone(r.session);
    }
    S.ui.runner.view(root);
  };
})(window.SolMed);
