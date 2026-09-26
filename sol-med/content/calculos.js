/* Cálculos clínicos. Cada cálculo define su fórmula, cómo generar
 * ejercicios nuevos, la sustitución y la interpretación.
 * Para añadir un cálculo: agrega un objeto con la misma forma. */
(function (S) {
  'use strict';
  const U = S.util;
  const n = (x, d) => U.num(x, d === undefined ? 0 : d);

  function scenario(rand, list) {
    return list[Math.floor(rand() * list.length)];
  }

  S.registry.addCalcs([
    {
      id: 'anion_gap',
      name: 'Anion gap',
      purpose: 'Clasificar una acidosis metabólica: con anion gap alto (se acumula un ácido no medido) o normal (pérdida de bicarbonato o ganancia de cloro).',
      formula: 'AG = Na⁺ − (Cl⁻ + HCO₃⁻)',
      inputs: [
        { id: 'na', label: 'Na⁺', unit: 'mEq/L', example: 134 },
        { id: 'cl', label: 'Cl⁻', unit: 'mEq/L', example: 98 },
        { id: 'hco3', label: 'HCO₃⁻', unit: 'mEq/L', example: 10 },
      ],
      unit: 'mEq/L',
      decimals: 0,
      tol: 1,
      tolText: '± 1',
      diff: 1,
      compute: (x) => x.na - (x.cl + x.hco3),
      substitute: (x) => 'AG = ' + n(x.na) + ' − (' + n(x.cl) + ' + ' + n(x.hco3) + ') = ' + n(x.na - x.cl - x.hco3),
      interpret: (r) =>
        r > 12
          ? 'Anion gap **elevado** (>12 mEq/L, rango orientativo 8–12): se acumulan aniones no medidos.'
          : r < 8
            ? 'Anion gap **bajo**: piensa primero en hipoalbuminemia.'
            : 'Anion gap **normal**: si hay acidosis, es hiperclorémica.',
      implication: (r) =>
        r > 12
          ? 'Busca cetoacidosis (β-OHB), acidosis láctica, insuficiencia renal o tóxicos. Corrige por albúmina y calcula el delta-delta para detectar trastornos mixtos.'
          : 'Si hay acidosis con AG normal: diarrea, acidosis tubular o reposición abundante con salino (típica en la recuperación de la CAD).',
      pitfall: 'No incluir el potasio si el rango de referencia de tu laboratorio no lo incluye, y no olvidar corregir por albúmina.',
      pearl: 'En la recuperación de la CAD el anion gap se cierra antes que el bicarbonato: la acidosis residual suele ser hiperclorémica.',
      generate(rand) {
        const s = scenario(rand, ['cad', 'cad', 'diarrea', 'lactica']);
        let x;
        if (s === 'cad') x = { na: U.randInt(128, 140, rand), cl: U.randInt(92, 104, rand), hco3: U.randInt(5, 15, rand) };
        else if (s === 'diarrea') x = { na: U.randInt(134, 142, rand), cl: U.randInt(110, 116, rand), hco3: U.randInt(13, 18, rand) };
        else x = { na: U.randInt(135, 142, rand), cl: U.randInt(96, 104, rand), hco3: U.randInt(12, 18, rand) };
        const ctx = {
          cad: 'Joven con diabetes tipo 1, vómitos y respiración profunda.',
          diarrea: 'Paciente con diarrea acuosa abundante durante 4 días.',
          lactica: 'Paciente séptico con hipotensión.',
        }[s];
        return { inputs: x, context: ctx, ask: 'Calcula el anion gap.' };
      },
    },
    {
      id: 'ag_albumina',
      name: 'Anion gap corregido por albúmina',
      purpose: 'Evitar que una hipoalbuminemia oculte una acidosis con anion gap alto.',
      formula: 'AG corregido = AG + 2,5 × (4,0 − albúmina [g/dL])',
      inputs: [
        { id: 'na', label: 'Na⁺', unit: 'mEq/L', example: 136 },
        { id: 'cl', label: 'Cl⁻', unit: 'mEq/L', example: 104 },
        { id: 'hco3', label: 'HCO₃⁻', unit: 'mEq/L', example: 18 },
        { id: 'alb', label: 'Albúmina', unit: 'g/dL', example: 2.0 },
      ],
      unit: 'mEq/L',
      decimals: 1,
      tol: 1,
      tolText: '± 1',
      diff: 2,
      compute: (x) => x.na - (x.cl + x.hco3) + 2.5 * (4 - x.alb),
      substitute: (x) => {
        const ag = x.na - x.cl - x.hco3;
        return 'AG = ' + n(x.na) + ' − (' + n(x.cl) + ' + ' + n(x.hco3) + ') = ' + n(ag) + ' → AG corregido = ' + n(ag) + ' + 2,5 × (4,0 − ' + n(x.alb, 1) + ') = ' + n(ag + 2.5 * (4 - x.alb), 1);
      },
      interpret: (r, x) => {
        const ag = x.na - x.cl - x.hco3;
        return r > 12 && ag <= 12
          ? 'El AG medido (' + n(ag) + ') parecía normal, pero corregido es **' + n(r, 1) + '**: hay una acidosis con anion gap alto oculta por la hipoalbuminemia.'
          : r > 12
            ? 'Anion gap corregido **elevado** (' + n(r, 1) + ').'
            : 'Anion gap corregido normal (' + n(r, 1) + ').';
      },
      implication: (r) => (r > 12 ? 'Busca cetoácidos, lactato, insuficiencia renal o tóxicos, aunque el AG sin corregir pareciera normal.' : 'Si hay acidosis, estudia causas de acidosis hiperclorémica.'),
      pitfall: 'Olvidar la corrección en pacientes críticos, cirróticos o desnutridos, en quienes la albúmina suele estar baja.',
      pearl: 'Por cada 1 g/dL que baja la albúmina, el AG «normal» baja ~2,5 mEq/L.',
      generate(rand) {
        const x = { na: U.randInt(132, 142, rand), cl: U.randInt(100, 110, rand), hco3: U.randInt(14, 20, rand), alb: U.randStep(1.6, 3.2, 0.1, rand) };
        return { inputs: x, context: 'Paciente en UCI con sepsis y desnutrición.', ask: 'Calcula el anion gap corregido por albúmina.' };
      },
    },
    {
      id: 'na_corregido',
      name: 'Sodio corregido por hiperglucemia',
      purpose: 'Estimar el sodio que tendría el paciente si la glucosa fuera normal: la hiperglucemia arrastra agua fuera de las células y diluye el sodio.',
      formula: 'Na⁺ corregido = Na⁺ medido + 1,6 × (glucosa − 100) / 100',
      inputs: [
        { id: 'na', label: 'Na⁺ medido', unit: 'mEq/L', example: 130 },
        { id: 'glu', label: 'Glucosa', unit: 'mg/dL', example: 700 },
      ],
      unit: 'mEq/L',
      decimals: 1,
      tol: 1.5,
      tolText: '± 1,5',
      diff: 2,
      notes: ['Factor clásico 1,6 (Katz). Con glucosa >400 mg/dL algunos autores prefieren 2,4 (Hillier): Sol MED acepta el resultado con 1,6 y muestra ambos en la explicación.'],
      compute: (x) => x.na + (1.6 * (x.glu - 100)) / 100,
      substitute: (x) =>
        'Na corregido = ' + n(x.na) + ' + 1,6 × (' + n(x.glu) + ' − 100) / 100 = ' + n(x.na + (1.6 * (x.glu - 100)) / 100, 1) + '  (con factor 2,4: ' + n(x.na + (2.4 * (x.glu - 100)) / 100, 1) + ')',
      interpret: (r, x) =>
        (r > 145 ? 'Sodio corregido **alto** (' + n(r, 1) + '): hay un déficit de agua libre importante' : r < 135 ? 'Sodio corregido bajo (' + n(r, 1) + '): hiponatremia verdadera' : 'Sodio corregido normal (' + n(r, 1) + ')') +
        (x.na < 135 ? ', aunque el sodio medido (' + n(x.na) + ') parecía bajo.' : '.'),
      implication: (r) =>
        r > 145
          ? 'Tras la reanimación inicial con cristaloide isotónico, suele pasarse a un líquido hipotónico (salino al 0,45 %) si el paciente está estable. Vigila que la osmolalidad baje de forma gradual.'
          : 'Tras la reanimación inicial, suele mantenerse el cristaloide isotónico.',
      pitfall: 'Interpretar un sodio medido de 130 en un EHH como «hiponatremia»: al corregirlo suele revelar hipernatremia.',
      pearl: 'Si al bajar la glucosa el sodio medido **no sube**, el paciente está recibiendo demasiada agua libre.',
      generate(rand) {
        const s = scenario(rand, ['ehh', 'cad']);
        const x = s === 'ehh' ? { na: U.randInt(128, 146, rand), glu: U.randInt(650, 1200, rand) } : { na: U.randInt(126, 138, rand), glu: U.randInt(300, 650, rand) };
        return { inputs: x, context: s === 'ehh' ? 'Mujer de 78 años, confusa, con poliuria durante 10 días.' : 'Varón de 22 años con diabetes tipo 1 y vómitos.', ask: 'Calcula el sodio corregido (factor 1,6).' };
      },
    },
    {
      id: 'osm_calc',
      name: 'Osmolalidad sérica calculada',
      purpose: 'Estimar la osmolalidad total y compararla con la medida (gap osmolar).',
      formula: 'Osm = 2 × Na⁺ + glucosa/18 + BUN/2,8',
      inputs: [
        { id: 'na', label: 'Na⁺', unit: 'mEq/L', example: 140 },
        { id: 'glu', label: 'Glucosa', unit: 'mg/dL', example: 900 },
        { id: 'bun', label: 'BUN', unit: 'mg/dL', example: 56 },
      ],
      unit: 'mOsm/kg',
      decimals: 0,
      tol: 3,
      tolText: '± 3',
      diff: 2,
      notes: ['Si el laboratorio informa urea en lugar de BUN: BUN = urea / 2,14 (o bien urea/6 en lugar de BUN/2,8).'],
      compute: (x) => 2 * x.na + x.glu / 18 + x.bun / 2.8,
      substitute: (x) =>
        'Osm = 2 × ' + n(x.na) + ' + ' + n(x.glu) + '/18 + ' + n(x.bun) + '/2,8 = ' + n(2 * x.na) + ' + ' + n(x.glu / 18, 1) + ' + ' + n(x.bun / 2.8, 1) + ' = ' + n(2 * x.na + x.glu / 18 + x.bun / 2.8),
      interpret: (r) => (r > 320 ? 'Osmolalidad total **>320 mOsm/kg**: cumple el criterio osmolar del EHH (2024).' : r > 295 ? 'Osmolalidad elevada.' : r < 275 ? 'Osmolalidad baja.' : 'Osmolalidad normal.'),
      implication: (r) =>
        r > 320
          ? 'Calcula también la efectiva (sin urea). El tratamiento debe bajarla de forma gradual (≈3–8 mOsm/kg/h, JBDS).'
          : 'Compárala con la medida: un gap osmolar >10 sugiere alcoholes tóxicos.',
      pitfall: 'Usar la osmolalidad total para explicar el coma: la urea no es osmóticamente efectiva.',
      pearl: 'Gap osmolar = medida − calculada; >10 sugiere metanol o etilenglicol.',
      generate(rand) {
        const x = { na: U.randInt(132, 155, rand), glu: U.randInt(500, 1300, rand), bun: U.randInt(25, 90, rand) };
        return { inputs: x, context: 'Anciano con demencia, obnubilado, con signos de deshidratación.', ask: 'Calcula la osmolalidad sérica total.' };
      },
    },
    {
      id: 'osm_ef',
      name: 'Osmolalidad efectiva',
      purpose: 'Medir la tonicidad (lo que desplaza agua y afecta a las neuronas). Es el criterio osmolar del EHH.',
      formula: 'Osm efectiva = 2 × Na⁺ + glucosa/18',
      inputs: [
        { id: 'na', label: 'Na⁺', unit: 'mEq/L', example: 140 },
        { id: 'glu', label: 'Glucosa', unit: 'mg/dL', example: 900 },
      ],
      unit: 'mOsm/kg',
      decimals: 0,
      tol: 3,
      tolText: '± 3',
      diff: 1,
      compute: (x) => 2 * x.na + x.glu / 18,
      substitute: (x) => 'Osm efectiva = 2 × ' + n(x.na) + ' + ' + n(x.glu) + '/18 = ' + n(2 * x.na) + ' + ' + n(x.glu / 18, 1) + ' = ' + n(2 * x.na + x.glu / 18),
      interpret: (r) =>
        r > 320
          ? 'Osmolalidad efectiva **>320**: hiperosmolalidad marcada, que puede explicar estupor o coma.'
          : r > 300
            ? 'Osmolalidad efectiva **>300**: cumple el criterio osmolar del EHH (2024).'
            : 'Osmolalidad efectiva ≤300: no cumple el criterio osmolar del EHH.',
      implication: (r) =>
        r > 300
          ? 'Si además la glucosa es ≥600, el β-OHB <3,0 y no hay acidosis relevante → EHH. Reposición de volumen primero; la insulina, a dosis más bajas y cuando la glucosa deje de bajar solo con líquidos.'
          : 'Si el paciente está en coma con osmolalidad efectiva <320, busca otra causa del coma.',
      pitfall: 'Aplicar el umbral antiguo (>320, de 2009) como único criterio: en 2024 es >300 efectiva o >320 total.',
      pearl: 'Coma + osmolalidad efectiva <320 → busca otra causa (ictus, sepsis, tóxicos, convulsiones).',
      generate(rand) {
        const x = { na: U.randInt(130, 158, rand), glu: U.randInt(250, 1300, rand) };
        return { inputs: x, context: 'Paciente con hiperglucemia y deterioro del nivel de conciencia.', ask: 'Calcula la osmolalidad efectiva.' };
      },
    },
    {
      id: 'winter',
      name: 'Compensación respiratoria esperada (fórmula de Winter)',
      purpose: 'En una acidosis metabólica, comprobar si la respuesta respiratoria es la adecuada o si hay un trastorno respiratorio asociado.',
      formula: 'PaCO₂ esperada = 1,5 × HCO₃⁻ + 8 (± 2)',
      inputs: [
        { id: 'hco3', label: 'HCO₃⁻', unit: 'mEq/L', example: 8 },
        { id: 'paco2', label: 'PaCO₂ medida', unit: 'mmHg', example: 20 },
      ],
      unit: 'mmHg',
      decimals: 0,
      tol: 1,
      tolText: 'valor central ± 1',
      diff: 2,
      compute: (x) => 1.5 * x.hco3 + 8,
      substitute: (x) => 'PaCO₂ esperada = 1,5 × ' + n(x.hco3) + ' + 8 = ' + n(1.5 * x.hco3 + 8, 1) + ' (rango ' + n(1.5 * x.hco3 + 6, 1) + '–' + n(1.5 * x.hco3 + 10, 1) + ')',
      interpret: (r, x) => {
        const lo = r - 2;
        const hi = r + 2;
        if (x.paco2 > hi) return 'La PaCO₂ medida (' + n(x.paco2) + ') es **mayor** que la esperada (' + n(lo) + '–' + n(hi) + '): hay una **acidosis respiratoria** asociada.';
        if (x.paco2 < lo) return 'La PaCO₂ medida (' + n(x.paco2) + ') es **menor** que la esperada (' + n(lo) + '–' + n(hi) + '): hay una **alcalosis respiratoria** asociada.';
        return 'La PaCO₂ medida (' + n(x.paco2) + ') está dentro de lo esperado (' + n(lo) + '–' + n(hi) + '): compensación respiratoria adecuada.';
      },
      implication: (r, x) =>
        x.paco2 > r + 2
          ? 'Busca fatiga respiratoria, sedación, neumonía o coma: el paciente puede necesitar soporte ventilatorio. Si se intuba, hay que mantener la hiperventilación para no agravar la acidosis.'
          : x.paco2 < r - 2
            ? 'Busca causas de hiperventilación primaria: sepsis, salicilatos, embolia pulmonar, dolor.'
            : 'El trastorno es una acidosis metabólica simple compensada.',
      pitfall: 'Considerar «normal» una PaCO₂ de 40 en una acidosis metabólica grave: indica fallo respiratorio.',
      pearl: 'La compensación respiratoria completa tarda 12–24 h en desarrollarse.',
      generate(rand) {
        const hco3 = U.randInt(4, 16, rand);
        const expected = 1.5 * hco3 + 8;
        const kind = scenario(rand, ['ok', 'ok', 'resp-acid', 'resp-alk']);
        const paco2 = Math.round(kind === 'ok' ? expected + (rand() * 3 - 1.5) : kind === 'resp-acid' ? expected + 6 + rand() * 10 : Math.max(10, expected - 6 - rand() * 6));
        return { inputs: { hco3, paco2 }, context: 'Acidosis metabólica en un paciente con cetoacidosis diabética.', ask: 'Calcula la PaCO₂ esperada (valor central) y compárala con la medida.' };
      },
    },
    {
      id: 'delta_delta',
      name: 'Delta-delta (ΔAG / ΔHCO₃⁻)',
      purpose: 'En una acidosis con anion gap alto, detectar si coexiste una acidosis hiperclorémica o una alcalosis metabólica.',
      formula: 'Δ/Δ = (AG − 12) / (24 − HCO₃⁻)',
      inputs: [
        { id: 'na', label: 'Na⁺', unit: 'mEq/L', example: 136 },
        { id: 'cl', label: 'Cl⁻', unit: 'mEq/L', example: 100 },
        { id: 'hco3', label: 'HCO₃⁻', unit: 'mEq/L', example: 12 },
      ],
      unit: '',
      decimals: 1,
      tol: 0.2,
      tolText: '± 0,2',
      diff: 3,
      notes: ['Usa AG normal = 12 y HCO₃⁻ normal = 24 (valores convencionales).'],
      compute: (x) => (x.na - x.cl - x.hco3 - 12) / (24 - x.hco3),
      substitute: (x) => {
        const ag = x.na - x.cl - x.hco3;
        return 'AG = ' + n(ag) + ' → Δ/Δ = (' + n(ag) + ' − 12) / (24 − ' + n(x.hco3) + ') = ' + n(ag - 12) + ' / ' + n(24 - x.hco3) + ' = ' + n((ag - 12) / (24 - x.hco3), 2);
      },
      interpret: (r) =>
        r < 1
          ? 'Δ/Δ **<1**: el bicarbonato bajó más de lo que explica el anion gap → hay además una **acidosis con AG normal (hiperclorémica)**.'
          : r > 2
            ? 'Δ/Δ **>2**: el bicarbonato está más alto de lo esperado → hay además una **alcalosis metabólica** (por ejemplo, por vómitos).'
            : 'Δ/Δ entre 1 y 2: acidosis con anion gap alto **pura**.',
      implication: (r) =>
        r < 1
          ? 'En la CAD es típico durante la fase de recuperación con suero salino, o si hubo diarrea.'
          : r > 2
            ? 'En la CAD con muchos vómitos, la alcalosis puede «normalizar» el pH y hacer pasar la cetoacidosis inadvertida.'
            : 'No hay un segundo trastorno metabólico.',
      pitfall: 'Aplicarlo cuando el anion gap es normal: solo tiene sentido en acidosis con AG alto.',
      pearl: 'Una CAD con muchos vómitos puede tener un pH casi normal: el delta-delta lo delata.',
      generate(rand) {
        const kind = scenario(rand, ['pure', 'hcl', 'alk']);
        const hco3 = kind === 'alk' ? U.randInt(18, 21, rand) : kind === 'pure' ? U.randInt(8, 14, rand) : U.randInt(6, 14, rand);
        const dh = 24 - hco3;
        const ratio = kind === 'pure' ? 1.1 + rand() * 0.5 : kind === 'hcl' ? 0.3 + rand() * 0.4 : 2.5 + rand() * 1.0;
        const ag = Math.round(12 + dh * ratio);
        const na = U.randInt(132, 142, rand);
        const cl = na - ag - hco3;
        return {
          inputs: { na, cl, hco3 },
          context: kind === 'alk' ? 'CAD en un paciente con vómitos incoercibles durante 3 días.' : 'Paciente con cetoacidosis diabética.',
          ask: 'Calcula el delta-delta (usa AG normal 12 y HCO₃⁻ normal 24).',
        };
      },
    },
    {
      id: 'deficit_agua',
      name: 'Déficit de agua libre',
      purpose: 'Estimar el agua que falta en la hipernatremia, para planificar su reposición gradual.',
      formula: 'Déficit (L) = ACT × (Na⁺ / 140 − 1); ACT = peso × fracción de agua',
      inputs: [
        { id: 'peso', label: 'Peso', unit: 'kg', example: 60 },
        { id: 'na', label: 'Na⁺ (corregido si hay hiperglucemia)', unit: 'mEq/L', example: 160 },
        { id: 'frac', label: 'Fracción de agua (0,6 varón joven; 0,5 mujer o varón mayor; 0,45 mujer mayor)', unit: '', example: 0.5 },
      ],
      unit: 'L',
      decimals: 1,
      tol: 0.3,
      tolText: '± 0,3',
      diff: 3,
      compute: (x) => x.peso * x.frac * (x.na / 140 - 1),
      substitute: (x) => 'ACT = ' + n(x.peso) + ' × ' + n(x.frac, 2) + ' = ' + n(x.peso * x.frac, 1) + ' L → Déficit = ' + n(x.peso * x.frac, 1) + ' × (' + n(x.na) + '/140 − 1) = ' + n(x.peso * x.frac * (x.na / 140 - 1), 1) + ' L',
      interpret: (r) => (r > 0 ? 'Déficit estimado de **' + n(r, 1) + ' L** de agua libre, sin contar las pérdidas que continúan.' : 'No hay déficit de agua libre (sodio ≤140).'),
      implication: () =>
        'Reponer de forma gradual: en la hipernatremia de más de 48 h, sin bajar el sodio más de ~10 mEq/L en 24 h. En el EHH, la prioridad inicial es el volumen con cristaloide isotónico; el agua libre se aporta después, vigilando el sodio.',
      pitfall: 'Olvidar sumar las pérdidas que continúan (diuresis osmótica) o corregir demasiado rápido.',
      pearl: 'Es una estimación: guía la reposición, pero lo que manda son los controles de sodio cada pocas horas.',
      generate(rand) {
        const frac = scenario(rand, [0.6, 0.5, 0.45]);
        const ctx = { 0.6: 'Varón de 35 años', 0.5: 'Varón de 80 años', 0.45: 'Mujer de 82 años' }[frac];
        const x = { peso: U.randInt(50, 90, rand), na: U.randInt(152, 170, rand), frac };
        return { inputs: x, context: ctx + ' con hipernatremia por falta de acceso al agua.', ask: 'Calcula el déficit de agua libre (L).' };
      },
    },
    {
      id: 'calcio_corregido',
      name: 'Calcio corregido por albúmina',
      purpose: 'Interpretar el calcio total cuando la albúmina es anormal.',
      formula: 'Ca corregido = Ca medido + 0,8 × (4,0 − albúmina)',
      inputs: [
        { id: 'ca', label: 'Calcio total', unit: 'mg/dL', example: 7.6 },
        { id: 'alb', label: 'Albúmina', unit: 'g/dL', example: 2.5 },
      ],
      unit: 'mg/dL',
      decimals: 1,
      tol: 0.2,
      tolText: '± 0,2',
      diff: 1,
      compute: (x) => x.ca + 0.8 * (4 - x.alb),
      substitute: (x) => 'Ca corregido = ' + n(x.ca, 1) + ' + 0,8 × (4,0 − ' + n(x.alb, 1) + ') = ' + n(x.ca + 0.8 * (4 - x.alb), 1),
      interpret: (r) => (r < 8.5 ? 'Calcio corregido **bajo** (' + n(r, 1) + ').' : r > 10.5 ? 'Calcio corregido **alto** (' + n(r, 1) + ').' : 'Calcio corregido normal (' + n(r, 1) + '): la hipocalcemia aparente se debía a la hipoalbuminemia.'),
      implication: (r) => (r < 8.5 ? 'Si hay síntomas (parestesias, tetania, QT largo), confirmar con calcio iónico y tratar.' : 'Si hay dudas (pacientes críticos, alteraciones ácido-base), mide el calcio iónico.'),
      pitfall: 'Tratar una «hipocalcemia» que solo refleja una albúmina baja.',
      pearl: 'La alcalosis aumenta la unión del calcio a la albúmina: el calcio **iónico** baja y pueden aparecer síntomas aunque el total sea normal.',
      generate(rand) {
        const x = { ca: U.randStep(6.8, 9.2, 0.1, rand), alb: U.randStep(1.8, 4.0, 0.1, rand) };
        return { inputs: x, context: 'Paciente hospitalizado con desnutrición.', ask: 'Calcula el calcio corregido.' };
      },
    },
  ]);
})(window.SolMed);
