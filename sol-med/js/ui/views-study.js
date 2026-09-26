/* Cálculos clínicos y comparaciones de alto rendimiento. */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const E = S.engine;
  const { h, icon, rich } = S.ui;

  function calcSession(ids, n, back) {
    const entries = [];
    for (let i = 0; i < n; i++) entries.push({ gen: { kind: 'calc', calc: ids[i % ids.length] } });
    S.ui.runner.start({ title: 'Cálculos clínicos', mode: 'practice', entries: U.shuffle(entries), back });
  }

  // ---------- Cálculos ----------
  S.views.calculos = function (root) {
    const d = S.ui.derived();
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Cálculos clínicos', 'Primero lo intentas; después ves fórmula → sustitución → resultado → interpretación → implicación clínica. Cada ejercicio usa datos nuevos.'),
        h('button.btn.btn-primary.btn-block', { type: 'button', onclick: () => calcSession(R.calcs.map((c) => c.id), 8, 'calculos') }, icon('play'), 'Practicar todos (8 ejercicios)'),
        h(
          'div.stack',
          R.calcs.map((c) => {
            const st = d.concepts['calculos.' + c.id];
            return h(
              'button.card.tight',
              { type: 'button', style: { textAlign: 'left', cursor: 'pointer', width: '100%' }, onclick: () => S.ui.go('calculo/' + c.id) },
              h('div.row-between', h('div', h('h3', c.name), h('div.small.muted.mono', c.formula)), st ? S.ui.stateChip(st.mastery, st.n) : h('span.chip', 'Sin practicar')),
            );
          }),
        ),
      ),
    );
  };

  S.views.calculo = function (root, params) {
    const c = R.calcById[params[0]];
    if (!c) return S.ui.go('calculos');
    const vals = {};
    const out = h('div');
    const fields = c.inputs.map((inp) => {
      const id = 'ci-' + inp.id;
      const input = h('input.input.mono', {
        id,
        inputmode: 'decimal',
        autocomplete: 'off',
        placeholder: inp.example !== undefined ? 'p. ej. ' + U.num(inp.example) : '',
        oninput: () => {
          vals[inp.id] = U.parseNum(input.value);
          compute();
        },
      });
      return h('div.field', h('label', { for: id }, inp.label + (inp.unit ? ' (' + inp.unit + ')' : '')), input);
    });
    function compute() {
      out.innerHTML = '';
      const ready = c.inputs.every((inp) => !isNaN(vals[inp.id]) && vals[inp.id] !== undefined);
      if (!ready) {
        out.appendChild(h('p.small.muted', 'Completa todos los datos para ver el resultado.'));
        return;
      }
      const res = c.compute(vals);
      if (!isFinite(res)) {
        out.appendChild(h('div.callout.warn', 'Con estos datos el cálculo no es válido (revisa que no haya ceros o valores imposibles).'));
        return;
      }
      out.appendChild(
        h(
          'div.fb',
          h('div.fb-sec', h('h4', 'Sustitución'), h('p.mono', c.substitute(vals))),
          h('div.fb-sec', h('h4', 'Resultado'), h('p', h('strong.mono', U.num(res, c.decimals || 0) + ' ' + (c.unit || '')))),
          h('div.fb-sec', h('h4', 'Interpretación'), rich('p', c.interpret(res, vals))),
          h('div.fb-sec', h('h4', 'Implicación clínica'), rich('p', c.implication(res, vals))),
        ),
      );
    }
    compute();
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead(c.name, c.purpose, 'calculos'),
        h(
          'div.card.stack',
          h('div.block-title', 'Fórmula'),
          h('p.mono', c.formula),
          c.notes ? h('ul.small', { style: { margin: 0, paddingLeft: '1.2rem' } }, c.notes.map((n) => rich('li', n))) : null,
          c.pitfall ? h('div.callout.warn', rich('p', '**Error frecuente:** ' + c.pitfall)) : null,
          c.pearl ? h('div.pearl', icon('pearl'), rich('div', c.pearl)) : null,
        ),
        h('button.btn.btn-primary.btn-block', { type: 'button', onclick: () => calcSession([c.id], 5, 'calculo/' + c.id) }, icon('play'), 'Practicar 5 ejercicios'),
        h('div.card.stack', h('h3', 'Calculadora'), h('p.small.muted', 'Para comprobar tus propios casos. No sustituye el juicio clínico.'), h('div.stack', fields), out),
      ),
    );
  };

  // ---------- Comparaciones ----------
  S.views.comparaciones = function (root) {
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Comparaciones de alto rendimiento', 'Qué dato inclina realmente el diagnóstico.'),
        h(
          'div.stack',
          R.comparisons.map((c) =>
            h(
              'button.card.tight',
              { type: 'button', style: { textAlign: 'left', cursor: 'pointer', width: '100%' }, onclick: () => S.ui.go('comparacion/' + c.id) },
              h('div.row-between', h('div', h('h3', c.title), h('div.small.muted', c.subtitle || '')), icon('next')),
            ),
          ),
        ),
      ),
    );
  };

  S.views.comparacion = function (root, params) {
    const c = R.comparisons.find((x) => x.id === params[0]);
    if (!c) return S.ui.go('comparaciones');
    const related = R.items.filter((it) => (it.compare && it.compare.includes(c.id)) || (c.items || []).includes(it.id));
    const table = h(
      'div.table-wrap',
      h(
        'table.table.cmp-table',
        h('thead', h('tr', h('th', 'Rasgo'), c.columns.map((col) => h('th', col)))),
        h('tbody', c.rows.map((r) => h('tr', h('td', r[0]), r.slice(1).map((cell) => rich('td', cell))))),
      ),
    );
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead(c.title, c.subtitle, 'comparaciones'),
        table,
        h('div.pearl', icon('target'), h('div', h('div.eyebrow', 'El dato que inclina'), rich('div', c.decisive))),
        c.pitfalls ? h('div.card.flat.stack', h('h3', 'Trampas frecuentes'), h('ul', { style: { margin: 0, paddingLeft: '1.2rem' } }, c.pitfalls.map((p) => rich('li', p)))) : null,
        related.length
          ? h(
              'button.btn.btn-primary.btn-block',
              {
                type: 'button',
                onclick: () =>
                  S.ui.runner.start({
                    title: c.title,
                    mode: 'practice',
                    entries: U.shuffle(related).slice(0, 8).map((it) => ({ item: it.id })),
                    back: 'comparacion/' + c.id,
                  }),
              },
              icon('play'),
              'Practicar esta comparación (' + Math.min(8, related.length) + ')',
            )
          : null,
        h('p.tiny.muted', 'Fuentes: ' + (c.sources || []).map((id) => (R.sources[id] ? R.sources[id].short : id)).join(' · ')),
      ),
    );
  };
})(window.SolMed);
