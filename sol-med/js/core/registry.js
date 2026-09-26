/* Registro de contenido médico.
 *
 * Jerarquía: Especialidad → Área → Tema → Subtema → Conceptos → Ítems.
 * Los archivos de content/ solo llaman a SolMed.registry.add*(); el núcleo
 * nunca conoce los temas concretos. Añadir un tema = añadir un archivo.
 */
(function (S) {
  'use strict';

  const R = {
    specialties: {},
    errorTypes: {},
    categories: {},
    sources: {},
    topics: [],
    topicById: {},
    concepts: {},
    items: [],
    itemById: {},
    values: [],
    valueById: {},
    valueCategories: [],
    calcs: [],
    calcById: {},
    comparisons: [],
    finalized: false,
    problems: { errors: [], warnings: [] },
  };

  // Tipo de error por defecto según la categoría de la pregunta.
  const DEFAULT_ERR = {
    concepto: 'conocimiento',
    fisiopatologia: 'conocimiento',
    diagnostico: 'diferencial',
    diferencial: 'diferencial',
    laboratorio: 'laboratorio',
    calculo: 'calculo',
    tratamiento: 'tratamiento',
    secuencia: 'secuencia',
    complicaciones: 'complicaciones',
    integracion: 'razonamiento',
    razonamiento: 'razonamiento',
    valores: 'laboratorio',
  };

  function defineTaxonomy(t) {
    Object.assign(R.specialties, t.specialties || {});
    Object.assign(R.errorTypes, t.errorTypes || {});
    Object.assign(R.categories, t.categories || {});
  }

  function addSources(list) {
    for (const s of list) R.sources[s.id] = s;
  }

  function addValues(category, list) {
    if (!R.valueCategories.find((c) => c.id === category.id)) R.valueCategories.push(category);
    for (const v of list) {
      v.category = category.id;
      R.values.push(v);
      R.valueById[v.id] = v;
    }
  }

  function addCalcs(list) {
    for (const c of list) {
      R.calcs.push(c);
      R.calcById[c.id] = c;
    }
  }

  function addComparisons(list) {
    for (const c of list) R.comparisons.push(c);
  }

  function qualifyConcept(topicId, id) {
    return id.indexOf('.') >= 0 ? id : topicId + '.' + id;
  }

  /** Convierte las distintas formas de autor (mcq, case, progressive,
   *  reasoning, lab) en una forma única: cabecera + lista de pasos. */
  function normalizeItem(topic, raw) {
    const it = {
      id: topic.id + ':' + raw.id,
      localId: raw.id,
      topic: topic.id,
      type: raw.type,
      sub: raw.sub || (topic.subtopics[0] && topic.subtopics[0].id),
      concepts: (raw.concepts || []).map((c) => qualifyConcept(topic.id, c)),
      diff: raw.diff || 2,
      cat: raw.cat || 'concepto',
      err: raw.err,
      title: raw.title || '',
      compare: raw.compare || null,
      header: {
        patient: raw.patient || null,
        vignette: raw.vignette ? [].concat(raw.vignette) : [],
        vitals: raw.vitals || null,
        exam: raw.exam || null,
        labs: raw.labs || null,
        imaging: raw.imaging || null,
        context: raw.context || null,
      },
      steps: [],
      examEligible: raw.type === 'mcq' || raw.type === 'case',
    };

    if (raw.type === 'mcq') {
      it.steps.push(Object.assign({ kind: 'mcq' }, pickStep(raw)));
    } else if (raw.type === 'case') {
      for (const q of raw.questions) it.steps.push(Object.assign({ kind: 'mcq' }, q));
    } else if (raw.type === 'progressive') {
      for (const st of raw.stages) {
        const step = Object.assign({ kind: st.q ? 'mcq' : 'info' }, st.q || {});
        step.stageId = st.id;
        step.reveal = {
          title: st.title,
          text: st.text ? [].concat(st.text) : [],
          vitals: st.vitals || null,
          labs: st.labs || null,
          imaging: st.imaging || null,
          tone: st.tone || null,
        };
        step.end = !!st.end;
        step.goto = st.goto || null;
        it.steps.push(step);
      }
    } else if (raw.type === 'reasoning') {
      for (const p of raw.prompts) it.steps.push(Object.assign({ kind: 'text' }, p));
    } else if (raw.type === 'lab') {
      for (const s of raw.steps) it.steps.push(Object.assign({}, s));
    }

    it.steps.forEach((s, i) => {
      s.index = i;
      s.concepts = s.concepts ? s.concepts.map((c) => qualifyConcept(topic.id, c)) : it.concepts;
      s.cat = s.cat || it.cat;
      s.err = s.err || it.err || DEFAULT_ERR[s.cat] || 'razonamiento';
      s.diff = s.diff || it.diff;
    });
    return it;
  }

  function pickStep(raw) {
    const keys = ['stem', 'options', 'answer', 'explain', 'key', 'altered', 'pearl', 'remember', 'trap'];
    const o = {};
    for (const k of keys) if (raw[k] !== undefined) o[k] = raw[k];
    return o;
  }

  function addTopic(def) {
    const topic = {
      id: def.id,
      kind: def.kind || 'topic',
      name: def.name,
      short: def.short || def.name,
      specialty: def.specialty,
      area: def.area,
      group: def.group || '',
      reviewed: def.reviewed || null,
      sources: def.sources || [],
      summary: def.summary || '',
      subtopics: def.subtopics || [],
      concepts: [],
      sheet: def.sheet || [],
      items: [],
    };
    R.topics.push(topic);
    R.topicById[topic.id] = topic;
    for (const c of def.concepts || []) {
      const id = qualifyConcept(topic.id, c.id);
      const concept = { id, name: c.name, topic: topic.id, sub: c.sub || (topic.subtopics[0] && topic.subtopics[0].id) };
      topic.concepts.push(concept);
      R.concepts[id] = concept;
    }
    for (const raw of def.items || []) {
      const it = normalizeItem(topic, raw);
      topic.items.push(it);
      R.items.push(it);
      R.itemById[it.id] = it;
    }
    return topic;
  }

  /** Crea los módulos transversales (valores y cálculos) a partir de lo
   *  registrado, y valida todo el contenido. Se llama una vez al arrancar. */
  function finalize() {
    if (R.finalized) return R.problems;
    if (R.values.length) {
      addTopic({
        id: 'valores',
        kind: 'tool',
        name: 'Valores normales y su interpretación',
        short: 'Valores',
        specialty: 'transversal',
        area: 'laboratorio',
        subtopics: R.valueCategories.map((c) => ({ id: c.id, name: c.name })),
        concepts: R.values.map((v) => ({ id: 'valores.' + v.id, name: v.name, sub: v.category })),
      });
    }
    if (R.calcs.length) {
      addTopic({
        id: 'calculos',
        kind: 'tool',
        name: 'Cálculos clínicos',
        short: 'Cálculos',
        specialty: 'transversal',
        area: 'calculos',
        subtopics: [{ id: 'calc', name: 'Cálculos' }],
        concepts: R.calcs.map((c) => ({ id: 'calculos.' + c.id, name: c.name, sub: 'calc' })),
      });
    }
    R.finalized = true;
    R.problems = validate();
    return R.problems;
  }

  function flagFor(lab) {
    if (lab.flag) return lab.flag;
    const v = R.valueById[lab.p];
    if (!v || typeof lab.v !== 'number') return 'N';
    if (v.low !== undefined && lab.v < v.low) return 'L';
    if (v.high !== undefined && lab.v > v.high) return 'H';
    return 'N';
  }

  /** Datos de presentación de una fila de laboratorio. */
  function labRow(lab) {
    const v = R.valueById[lab.p] || {};
    return {
      id: lab.p || lab.name,
      name: lab.name || v.name || lab.p,
      abbr: lab.abbr || v.abbr || v.name || lab.name,
      value: lab.text !== undefined ? lab.text : lab.v,
      unit: lab.unit !== undefined ? lab.unit : v.unit || '',
      ref: lab.ref || v.ref || '',
      flag: flagFor(lab),
      known: !!R.valueById[lab.p],
    };
  }

  function validate() {
    const errors = [];
    const warnings = [];
    const seen = {};
    for (const it of R.items) {
      if (seen[it.id]) errors.push('ID duplicado: ' + it.id);
      seen[it.id] = true;
      if (![1, 2, 3].includes(it.diff)) errors.push(it.id + ': dificultad inválida');
      if (!it.concepts.length) errors.push(it.id + ': sin conceptos');
      const topic = R.topicById[it.topic];
      if (!topic.subtopics.find((s) => s.id === it.sub)) errors.push(it.id + ': subtema desconocido ' + it.sub);
      if (!it.steps.length) errors.push(it.id + ': sin pasos');
      const labs = [].concat(it.header.labs || []);
      it.steps.forEach((s) => {
        for (const c of s.concepts) if (!R.concepts[c]) errors.push(it.id + ': concepto desconocido ' + c);
        if (!R.errorTypes[s.err]) errors.push(it.id + ': tipo de error desconocido ' + s.err);
        if (s.reveal && s.reveal.labs) labs.push(...s.reveal.labs);
        if (s.kind === 'mcq') {
          if (!s.stem) errors.push(it.id + '#' + s.index + ': sin enunciado');
          if (!Array.isArray(s.options) || s.options.length < 3 || s.options.length > 5)
            errors.push(it.id + '#' + s.index + ': número de opciones inválido');
          else if (!(s.answer >= 0 && s.answer < s.options.length))
            errors.push(it.id + '#' + s.index + ': respuesta fuera de rango');
          else {
            s.options.forEach((o, i) => {
              if (!o.t) errors.push(it.id + '#' + s.index + ': opción vacía');
              if (!o.why) warnings.push(it.id + '#' + s.index + ': opción ' + i + ' sin explicación');
              if (o.err && !R.errorTypes[o.err]) errors.push(it.id + ': tipo de error desconocido ' + o.err);
              if (o.next && !it.steps.find((x) => x.stageId === o.next))
                errors.push(it.id + ': rama a etapa inexistente ' + o.next);
            });
            const texts = s.options.map((o) => o.t);
            if (new Set(texts).size !== texts.length) errors.push(it.id + ': opciones repetidas');
          }
          if (!s.explain || !s.explain.length) warnings.push(it.id + '#' + s.index + ': sin razonamiento paso a paso');
          if (!s.pearl) warnings.push(it.id + '#' + s.index + ': sin perla');
        } else if (s.kind === 'text') {
          if (!s.q || !s.expected || !(s.points && s.points.length)) errors.push(it.id + '#' + s.index + ': razonamiento incompleto');
        } else if (s.kind === 'calc') {
          const c = R.calcById[s.calc];
          if (!c) errors.push(it.id + ': cálculo desconocido ' + s.calc);
          else {
            const miss = c.inputs.filter((inp) => typeof s.inputs[inp.id] !== 'number');
            if (miss.length) errors.push(it.id + ': faltan datos para ' + s.calc + ': ' + miss.map((m) => m.id).join(','));
          }
        } else if (s.kind === 'flags') {
          if (!labs.length) errors.push(it.id + ': paso de valores sin laboratorio');
        } else if (s.kind === 'info') {
          // narrativo
        } else errors.push(it.id + ': tipo de paso desconocido ' + s.kind);
        if (s.goto && !it.steps.find((x) => x.stageId === s.goto)) errors.push(it.id + ': goto inexistente ' + s.goto);
      });
      for (const l of labs) {
        if (l.p && !R.valueById[l.p]) errors.push(it.id + ': valor de laboratorio desconocido ' + l.p);
        if (!l.p && !l.name) errors.push(it.id + ': fila de laboratorio sin nombre');
      }
    }
    for (const t of R.topics) {
      for (const sid of t.sources) if (!R.sources[sid]) errors.push(t.id + ': fuente desconocida ' + sid);
    }
    for (const v of R.values) {
      if (v.sources) for (const sid of v.sources) if (!R.sources[sid]) errors.push('valor ' + v.id + ': fuente desconocida ' + sid);
      if (!v.ref || !v.name) errors.push('valor ' + v.id + ': ficha incompleta');
    }
    for (const c of R.calcs) {
      if (typeof c.compute !== 'function' || typeof c.generate !== 'function') errors.push('cálculo ' + c.id + ': incompleto');
    }
    for (const cmp of R.comparisons) {
      for (const tid of cmp.topics || []) if (!R.topicById[tid]) errors.push('comparación ' + cmp.id + ': tema ' + tid);
    }
    return { errors, warnings };
  }

  function topicsOf(kind) {
    return R.topics.filter((t) => (kind ? t.kind === kind : true));
  }

  function itemsWhere(fn) {
    return R.items.filter(fn);
  }

  Object.assign(R, {
    defineTaxonomy,
    addSources,
    addValues,
    addCalcs,
    addComparisons,
    addTopic,
    finalize,
    validate,
    labRow,
    flagFor,
    topicsOf,
    itemsWhere,
    DEFAULT_ERR,
  });
  S.registry = R;
})(window.SolMed);
