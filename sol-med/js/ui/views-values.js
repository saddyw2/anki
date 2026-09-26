/* Valores normales y su interpretación + entrenamiento de valores. */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const { h, icon, rich } = S.ui;

  const DISCLAIMER =
    'Los rangos son orientativos para adultos y varían según laboratorio, método, unidades y población. Rango normal ≠ umbral diagnóstico ≠ umbral terapéutico ≠ valor crítico.';

  const THR_KIND = {
    normal: { label: 'Rango normal', cls: 'violet' },
    diagnostico: { label: 'Umbral diagnóstico', cls: 'rose' },
    terapeutico: { label: 'Umbral terapéutico', cls: 'warn' },
    critico: { label: 'Valor crítico', cls: 'bad' },
    meta: { label: 'Meta terapéutica', cls: 'ok' },
  };

  S.views.valores = function (root) {
    const d = S.ui.derived();
    const cats = R.valueCategories.map((cat) => {
      const list = R.values.filter((v) => v.category === cat.id);
      return h(
        'section.stack',
        h('div.section-title', h('h2', cat.name), h('span.small.muted', list.length + ' parámetros')),
        cat.desc ? h('p.small.muted', cat.desc) : null,
        h(
          'div.value-grid',
          list.map((v) => {
            const st = d.concepts['valores.' + v.id];
            return h(
              'button.value-card',
              { type: 'button', onclick: () => S.ui.go('valor/' + v.id) },
              h('div.row-between', h('span.nm', v.name), st ? S.ui.stateChip(st.mastery, st.n) : null),
              h('span.rg', v.ref + (v.unit ? ' ' + v.unit : '')),
              v.represents ? h('span.tiny.muted', v.represents.slice(0, 90) + (v.represents.length > 90 ? '…' : '')) : null,
            );
          }),
        ),
      );
    });
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Valores normales y su interpretación', 'Normal → alto/bajo → significado → causas → importancia clínica → conducta.'),
        h('div.callout', icon('info'), ' ', DISCLAIMER),
        h('button.btn.btn-primary.btn-block', { type: 'button', onclick: () => S.ui.go('valores-entrenar') }, icon('play'), 'Entrenar valores'),
        cats,
      ),
    );
  };

  function scale(v) {
    if (typeof v.low !== 'number' || typeof v.high !== 'number') return null;
    const range = v.high - v.low;
    const lo = v.low - range;
    const pos = (x) => ((x - lo) / (3 * range)) * 100;
    const dec = v.decimals === undefined ? 1 : v.decimals;
    return h(
      'div.scale',
      { role: 'img', 'aria-label': 'Bajo por debajo de ' + v.low + ', alto por encima de ' + v.high },
      h('div.track'),
      h('span.lbl', { style: { left: pos(v.low) + '%' } }, U.num(v.low, dec)),
      h('span.lbl', { style: { left: pos(v.high) + '%' } }, U.num(v.high, dec)),
      h('span.lbl', { style: { left: '10%' } }, 'Bajo'),
      h('span.lbl', { style: { left: '90%' } }, 'Alto'),
    );
  }

  S.views.valor = function (root, params) {
    const v = R.valueById[params[0]];
    if (!v) return S.ui.go('valores');
    const d = S.ui.derived();
    const st = d.concepts['valores.' + v.id];
    const topics = (v.topics || []).map((id) => R.topicById[id]).filter(Boolean);
    const side = (title, s, cls) =>
      s
        ? h(
            'div.card.stack',
            h('div.row', h('span.chip.' + cls, title)),
            rich('p', s.meaning),
            s.causes && s.causes.length ? h('div', h('div.block-title', 'Principales causas'), h('ul', { style: { margin: 0, paddingLeft: '1.2rem' } }, s.causes.map((c) => rich('li', c)))) : null,
            s.action ? rich('p.small', '**Conducta:** ' + s.action) : null,
          )
        : null;
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead(v.name + (v.abbr && v.abbr !== v.name ? ' (' + v.abbr + ')' : ''), null, 'valores'),
        h(
          'div.card.stack',
          h(
            'div.row-between',
            h('div', h('div.eyebrow', 'Rango de referencia'), h('div.mono', { style: { fontSize: '1.3rem', fontWeight: 500 } }, v.ref + (v.unit ? ' ' + v.unit : ''))),
            st ? S.ui.stateChip(st.mastery, st.n) : h('span.chip', 'Sin practicar'),
          ),
          scale(v),
          v.units ? h('p.small.muted', v.units) : null,
          v.represents ? rich('p', '**Qué representa:** ' + v.represents) : null,
        ),
        h('div.fb-grid', side('Elevado', v.up, 'rose'), side('Disminuido', v.down, 'violet')),
        v.thresholds && v.thresholds.length
          ? h(
              'div.card.stack',
              h('h3', 'Umbrales que no hay que confundir'),
              h(
                'div.thresholds',
                v.thresholds.map((t) =>
                  h('div.thr', h('span.chip.' + (THR_KIND[t.kind] || {}).cls, (THR_KIND[t.kind] || {}).label || t.kind), h('strong.mono', t.value), rich('span.small', t.note || '')),
                ),
              ),
            )
          : null,
        h(
          'div.card.stack',
          v.importance ? rich('p', '**Importancia clínica:** ' + v.importance) : null,
          v.changes ? rich('p', '**Cómo modifica diagnóstico o tratamiento:** ' + v.changes) : null,
          topics.length ? h('div.row', h('span.small.muted', 'Relación con:'), topics.map((t) => h('button.chip.violet', { type: 'button', style: { border: 0, cursor: 'pointer' }, onclick: () => S.ui.go('tema/' + t.id) }, t.short))) : null,
        ),
        v.pearl ? h('div.pearl', icon('pearl'), h('div', h('div.eyebrow', 'Perla de examen'), rich('div', v.pearl))) : null,
        h('p.tiny.muted', DISCLAIMER + (v.sources ? ' Fuentes: ' + v.sources.map((id) => (R.sources[id] ? R.sources[id].short : id)).join(' · ') + '.' : '')),
        h(
          'button.btn.btn-soft.btn-block',
          {
            type: 'button',
            onclick: () =>
              S.ui.runner.start({
                title: 'Entrenar: ' + v.name,
                mode: 'values',
                entries: ['flash', 'dir', 'fill', 'critical', 'normal'].map((m) => ({ gen: { kind: 'value', value: v.id, mode: m } })).filter((e) => {
                  const it = S.gen.valueItem(v.id, 1, e.gen.mode);
                  return it && it.valueMode === e.gen.mode;
                }),
                back: 'valor/' + v.id,
              }),
          },
          icon('play'),
          'Entrenar este valor',
        ),
      ),
    );
  };

  // ---------- Entrenamiento ----------
  const TRAIN = [
    { id: 'flash', title: 'Tarjetas', desc: 'Parámetro → rango e interpretación. Te autoevalúas.' },
    { id: 'normal', title: 'Normal o alterado', desc: 'Clasifica un resultado.' },
    { id: 'dir', title: 'Alto o bajo', desc: 'Identifica la dirección.' },
    { id: 'fill', title: 'Completa el valor', desc: 'Recuerda rangos y umbrales importantes.' },
    { id: 'critical', title: 'Valor crítico', desc: 'Reconoce resultados peligrosos.' },
    { id: 'mix', title: 'Mezcla adaptativa', desc: 'Prioriza los valores que más fallas.' },
  ];

  S.views['valores-entrenar'] = function (root) {
    const cfg = { cats: R.valueCategories.map((c) => c.id), n: 10 };
    const start = (mode) => {
      const d = S.ui.derived(true);
      let pool = R.values.filter((v) => cfg.cats.includes(v.category));
      if (!pool.length) {
        S.ui.toast('Elige al menos una categoría.', 'warn');
        return;
      }
      if (mode !== 'mix' && mode !== 'flash') {
        pool = pool.filter((v) => {
          const it = S.gen.valueItem(v.id, 7, mode);
          return it && it.valueMode === mode;
        });
      }
      if (!pool.length) {
        S.ui.toast('Ningún valor de esas categorías tiene ese tipo de ejercicio.', 'warn');
        return;
      }
      // Prioriza lo débil y lo pendiente; luego lo no visto.
      const ranked = pool
        .map((v) => {
          const st = d.concepts['valores.' + v.id];
          const s = st ? (1 - st.mastery) * 2 + (st.due <= Date.now() ? 1 : 0) : 1.2;
          return { v, s: s + Math.random() * 0.6 };
        })
        .sort((a, b) => b.s - a.s);
      const entries = [];
      for (let i = 0; i < cfg.n; i++) {
        const v = ranked[i % ranked.length].v;
        entries.push({ gen: { kind: 'value', value: v.id, mode: mode === 'mix' ? undefined : mode } });
      }
      S.ui.runner.start({ title: 'Entrenamiento de valores', mode: 'values', entries: U.shuffle(entries), back: 'valores-entrenar' });
    };
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Entrenamiento de valores', 'Recuperación activa de rangos, direcciones, umbrales y valores críticos.', 'valores'),
        h(
          'div.card.stack',
          h('div.label', 'Categorías'),
          S.ui.checks(
            R.valueCategories.map((c) => ({ value: c.id, label: c.name })),
            cfg.cats,
            (v) => (cfg.cats = v),
          ),
          h('div.label', 'Cantidad'),
          S.ui.seg([5, 10, 20].map((n) => ({ value: n, label: String(n) })), cfg.n, (v) => (cfg.n = v), 'Cantidad'),
        ),
        h(
          'div.tiles',
          TRAIN.map((t) => h('button.tile', { type: 'button', onclick: () => start(t.id) }, h('span.ic', icon('flask')), h('span.t', t.title), h('span.d', t.desc))),
        ),
        h(
          'div.card.stack',
          h('h3', 'Interpretación clínica'),
          h('p.small', 'Para interpretar varios valores a la vez, usa «Interpretar laboratorio» o el «Laboratorio sorpresa».'),
          h(
            'div.row',
            h('button.btn.btn-soft', { type: 'button', onclick: () => S.ui.go('modo/lab') }, 'Interpretar laboratorio'),
            h(
              'button.btn',
              {
                type: 'button',
                onclick: () => {
                  const it = S.gen.surpriseLab(S.ui.derived());
                  S.ui.runner.start({ title: 'Laboratorio sorpresa', mode: 'practice', entries: [{ item: it.id }], back: 'valores-entrenar' });
                },
              },
              'Laboratorio sorpresa',
            ),
          ),
        ),
      ),
    );
  };
})(window.SolMed);
