/* Ítems generados: cálculos con datos nuevos cada vez y entrenamiento de
 * valores normales. Producen ítems con la misma forma que los del registro,
 * para que el ejecutor, el motor y las estadísticas los traten igual. */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;

  function calcItem(calcId, seed, diffOverride) {
    const c = R.calcById[calcId];
    if (!c) return null;
    const rand = U.rng(seed || Math.floor(Math.random() * 1e9));
    const g = c.generate(rand);
    return {
      id: 'gen:calc:' + calcId,
      topic: 'calculos',
      type: 'calc',
      sub: 'calc',
      concepts: ['calculos.' + calcId],
      diff: diffOverride || c.diff || 2,
      cat: 'calculo',
      title: c.name,
      generated: true,
      header: {
        vignette: g.context ? [g.context] : [],
        labs: g.labs || null,
      },
      steps: [
        {
          kind: 'calc',
          index: 0,
          calc: calcId,
          inputs: g.inputs,
          ask: g.ask || c.ask || 'Calcula: ' + c.name,
          concepts: ['calculos.' + calcId],
          cat: 'calculo',
          err: 'calculo',
          diff: c.diff || 2,
        },
      ],
    };
  }

  function valueLabel(v, x) {
    return U.num(x, v.decimals === undefined ? 1 : v.decimals) + (v.unit ? ' ' + v.unit : '');
  }

  function sampleValue(v, rand, where) {
    const g = v.gen || {};
    const step = g.step || (v.decimals ? Math.pow(10, -v.decimals) : 1);
    const lo = v.low;
    const hi = v.high;
    if (where === 'L') return U.randStep(g.min !== undefined ? g.min : lo * 0.6, lo - step, step, rand);
    if (where === 'H') return U.randStep(hi + step, g.max !== undefined ? g.max : hi * 1.5, step, rand);
    return U.randStep(g.nmin !== undefined ? g.nmin : lo, g.nmax !== undefined ? g.nmax : hi, step, rand);
  }

  /** Genera un ejercicio de entrenamiento de valores. */
  function valueItem(valueId, seed, forcedMode) {
    const v = R.valueById[valueId];
    if (!v) return null;
    const rand = U.rng(seed || Math.floor(Math.random() * 1e9));
    const numeric = typeof v.low === 'number' && typeof v.high === 'number';
    const modes = ['flash'];
    if (numeric) modes.push('dir', 'normal');
    if (v.fill && v.fill.length) modes.push('fill');
    if (v.critical) modes.push('critical');
    const mode = forcedMode && modes.includes(forcedMode) ? forcedMode : U.pick(modes, rand);
    const base = {
      id: 'gen:value:' + valueId + ':' + mode,
      topic: 'valores',
      type: 'value',
      sub: v.category,
      concepts: ['valores.' + valueId],
      diff: mode === 'critical' || mode === 'fill' ? 2 : 1,
      cat: 'valores',
      title: v.name,
      generated: true,
      valueMode: mode,
      header: { vignette: [] },
      steps: [],
    };
    const common = { index: 0, concepts: base.concepts, cat: 'valores', err: 'laboratorio', diff: base.diff };
    const refLine = 'Rango de referencia orientativo: ' + v.ref + (v.unit ? ' ' + v.unit : '') + '.';

    if (mode === 'flash') {
      base.steps.push(
        Object.assign({}, common, {
          kind: 'flash',
          front: v.name + (v.abbr && v.abbr !== v.name ? ' (' + v.abbr + ')' : ''),
          prompt: 'Recuerda: rango de referencia, qué representa y qué significa si está alto o bajo.',
          back: v,
        }),
      );
    } else if (mode === 'dir' || mode === 'normal') {
      const sides = v.oneSided === 'high' ? ['N', 'H'] : v.oneSided === 'low' ? ['L', 'N'] : ['L', 'N', 'H'];
      const where = U.pick(sides, rand);
      const x = sampleValue(v, rand, where);
      const flag = x < v.low ? 'L' : x > v.high ? 'H' : 'N';
      const opts =
        mode === 'dir'
          ? [
              { t: 'Bajo', f: 'L' },
              { t: 'Normal', f: 'N' },
              { t: 'Alto', f: 'H' },
            ]
          : [
              { t: 'Normal', f: 'N' },
              { t: 'Alterado', f: 'X' },
            ];
      const ans = mode === 'dir' ? opts.findIndex((o) => o.f === flag) : flag === 'N' ? 0 : 1;
      const meaning = flag === 'H' ? v.up && v.up.meaning : flag === 'L' ? v.down && v.down.meaning : 'Dentro del rango de referencia.';
      base.steps.push(
        Object.assign({}, common, {
          kind: 'mcq',
          stem: v.name + ': ' + valueLabel(v, x) + '. ¿Cómo lo clasificas?',
          options: opts.map((o, i) => ({
            t: o.t,
            why: i === ans ? refLine + ' ' + (meaning || '') : refLine,
          })),
          answer: ans,
          explain: [refLine, meaning || ''].filter(Boolean),
          pearl: v.pearl || '',
          valueNote: 'Los rangos varían según laboratorio, método y población.',
        }),
      );
      base.diff = 1;
    } else if (mode === 'fill') {
      const f = U.pick(v.fill, rand);
      base.steps.push(
        Object.assign({}, common, {
          kind: 'numeric',
          ask: f.ask,
          answer: f.answer,
          tol: f.tol === undefined ? 0 : f.tol,
          unit: f.unit || v.unit || '',
          explain: [f.explain || refLine],
          pearl: v.pearl || '',
        }),
      );
    } else if (mode === 'critical') {
      const cr = v.critical;
      base.steps.push(
        Object.assign({}, common, {
          kind: 'mcq',
          stem: cr.stem,
          options: cr.options,
          answer: cr.answer,
          explain: cr.explain,
          pearl: cr.pearl || v.pearl || '',
        }),
      );
    }
    return base;
  }

  /** «Laboratorio sorpresa»: toma un ejercicio de laboratorio de cualquier
   *  tema sin indicar el diagnóstico. */
  function surpriseLab(d) {
    const labs = R.items.filter((it) => it.type === 'lab');
    if (!labs.length) return null;
    const scored = labs
      .map((it) => {
        const st = d && d.items[it.id];
        return { it, s: (st ? -Math.min(3, st.n) : 2) + Math.random() * 2 };
      })
      .sort((a, b) => b.s - a.s);
    return scored[0].it;
  }

  S.gen = { calcItem, valueItem, surpriseLab, sampleValue, valueLabel };
})(window.SolMed);
