# Sol MED — Registro de continuidad

Documento para retomar el proyecto en futuras sesiones sin reconstruir ni
reinterpretar nada. Actualízalo al cerrar cada versión.

## 1. Identidad y versión

- **Nombre:** Sol MED — Centro personal de entrenamiento clínico (conservar en interfaz, archivos y ampliaciones).
- **Versión:** 1.0.0 (V1 funcional) · esquema de datos `schema: 1`.
- **Revisión médica del contenido:** 2026‑09‑26.
- **Ubicación del código:** carpeta `sol-med/` del repositorio `saddyw2/anki`, rama `claude/sol-med-w88ynn`. Es un proyecto independiente de Anki: puede moverse tal cual a un repositorio propio (`sol-med`).
- **Publicación:** Artifact privado de claude.ai creado a partir de `dist/sol-med-artifact.html`. Para actualizarlo, se vuelve a publicar ese archivo en la misma URL del Artifact.

## 2. Arquitectura y tecnologías

- **Aplicación web estática, sin framework ni dependencias en tiempo de ejecución.** HTML + CSS + JavaScript con scripts clásicos (no módulos ES), para que funcione igual desde un servidor, desde `file://` y empaquetada en un solo HTML.
- Espacio de nombres global `window.SolMed`: `util`, `registry`, `store`, `engine`, `gen`, `sync`, `ui`, `views`.
- **Contenido separado de la lógica.** Los archivos de `content/` solo llaman a `SolMed.registry.add*()`. El núcleo no conoce ningún tema.
- **Progreso con registro de intentos.** Se guarda una lista de intentos que solo crece; repetición espaciada, dominio, puntos débiles y dificultad se **recalculan** a partir de ella (`engine.derive`). Así la fusión entre dispositivos o respaldos es segura: se unen intentos por id.
- Enrutado por hash (`#/inicio`, `#/tema/cad`…), vistas en `js/ui/views-*.js`.
- Gráficos SVG propios (`js/ui/charts.js`), sin librerías.
- Tipografías de Google Fonts (Sora, Manrope, IBM Plex Mono) con alternativas del sistema si no cargan.
- Herramientas: Node 18+ para `tools/build.mjs` y `tests/unit.mjs`; Playwright + Chromium para `tests/e2e.mjs`.

## 3. Estructura de carpetas

```
sol-med/
  index.html            orden de carga: núcleo → contenido → store/engine/gen/sync → interfaz
  css/solmed.css        tokens de color (claro/oscuro), componentes
  js/core/namespace.js  versión, esquema, fecha de revisión médica
  js/core/util.js       utilidades puras
  js/core/registry.js   registro y validación del contenido
  js/core/store.js      almacenamiento local, fusión, respaldo, borrado
  js/core/engine.js     motor adaptativo, selección, simulacro, estadísticas
  js/core/gen.js        ejercicios generados de cálculos y valores
  js/core/sync.js       sincronización con la cuenta de Claude (Artifact)
  js/ui/dom.js          creación de nodos, iconos, avisos, diálogos
  js/ui/charts.js       línea, columnas y anillo en SVG
  js/ui/runner.js       ejecutor de sesiones y retroalimentación
  js/ui/views-*.js      pantallas
  js/ui/app.js          arranque, navegación, tema, PWA
  content/taxonomia.js  especialidades, áreas, tipos de error, categorías
  content/fuentes.js    fuentes médicas
  content/valores/*.js  fichas de valores por categoría
  content/calculos.js   cálculos clínicos
  content/comparaciones.js
  content/temas/*.js    un archivo por tema
  tools/build.mjs       genera dist/sol-med.html y dist/sol-med-artifact.html
  tests/unit.mjs        19 pruebas unitarias
  tests/e2e.mjs         29 comprobaciones en navegador
  sw.js, manifest.webmanifest, icons/
```

## 4. Esquema del contenido médico

Jerarquía: **Especialidad → Área → Tema → Subtema → Concepto → Ítem**.

```js
SolMed.registry.addTopic({
  id: 'cad', name: 'Cetoacidosis diabética', short: 'CAD',
  specialty: 'medicina-interna', area: 'endocrinologia', group: 'Diabetes',
  reviewed: '2026-09-26', sources: ['ada2024', 'harrison22'],
  summary: '…',
  subtopics: [{ id: 'dx', name: 'Clínica y diagnóstico' }, …],
  concepts: [{ id: 'criterios', name: 'Criterios diagnósticos (2024)', sub: 'dx' }, …],
  sheet: [{ title: 'Definición', body: ['párrafo', ['viñeta', 'viñeta']] }, …],
  items: [ … ],
});
```

- Los conceptos se nombran `tema.concepto` (`cad.criterios`). Un ítem puede citar conceptos de otro módulo con su id completo (`calculos.winter`).
- **Tipos de ítem** (todos se normalizan a «cabecera + pasos»):
  - `mcq`: `{ stem, options: [{ t, why, err?, next? }], answer, explain[], key[], altered[], trap, pearl, remember }`.
  - `case`: cabecera (`patient`, `vignette`, `vitals`, `exam`, `labs`, `imaging`) + `questions: [mcq…]`.
  - `progressive`: `stages: [{ id, title, text, vitals?, labs?, tone?, q?: mcq, goto?, end? }]`. Las opciones pueden llevar `next: 'idEtapa'` para ramificar; `goto` fija la etapa siguiente por defecto.
  - `reasoning`: `prompts: [{ q, expected, points: [{ t, kw: [palabras clave] }], pearl? }]`.
  - `lab`: `context`, `labs`, `steps: [{ kind: 'flags' } | { kind: 'mcq', … } | { kind: 'calc', calc, inputs, ask }]`.
- Campos comunes: `id`, `type`, `sub`, `concepts`, `diff` (1–3), `cat` (categoría de análisis), `err` (tipo de error por defecto), `compare` (ids de comparaciones).
- **Laboratorio:** `{ p: 'idValor', v: número }` usa la ficha del valor (unidad, rango, alto/bajo). Para parámetros sin ficha o cualitativos: `{ name, v | text, unit, ref, flag: 'H'|'L'|'N' }`.
- **Valores:** `addValues({ id, name, desc }, [{ id, name, abbr, unit, low, high, oneSided?, decimals, ref, represents, up: {meaning, causes, action}, down: {…}, importance, changes, topics, pearl, thresholds: [{ kind: normal|diagnostico|terapeutico|critico|meta, value, note }], critical?: mcq, fill?: [{ ask, answer, tol, unit, explain }], gen?: { min, max, step, nmin, nmax }, sources }])`.
- **Cálculos:** `addCalcs([{ id, name, purpose, formula, inputs: [{ id, label, unit, example }], unit, decimals, tol, compute(x), substitute(x), interpret(r, x), implication(r, x), generate(rand) → { inputs, context, ask }, pitfall, pearl }])`.
- **Comparaciones:** `addComparisons([{ id, title, subtitle, topics, columns, rows: [[rasgo, celdaA, celdaB…]], decisive, pitfalls, sources }])`.
- **Fuentes:** `addSources([{ id, short, title, authors, edition, year, verify: verificada|referencia|pendiente, reviewed, note }])`.
- `registry.finalize()` crea los módulos transversales «Valores» y «Cálculos» (con un concepto por valor o cálculo) y **valida** todo el contenido. Los errores aparecen en Configuración → Estado del sistema y en `npm test`.

## 5. Contenido incluido (V1)

| Tema | Selección múltiple | Casos | Progresivos | Razonamiento | Laboratorio | Conceptos |
| --- | --- | --- | --- | --- | --- | --- |
| Cetoacidosis diabética | 12 | 2 | 1 | 1 | 2 | 21 |
| Estado hiperglucémico hiperosmolar | 10 | 1 | 1 | 1 | 1 | 15 |
| Hipotiroidismo (con coma mixedematoso) | 10 | 1 | 1 | 1 | 1 | 13 |
| Hipertiroidismo y tirotoxicosis (con tormenta) | 11 | 2 | 1 | 1 | 1 | 17 |
| Hemorragia subaracnoidea | 10 | 2 | 1 | 1 | 1 | 18 |
| **Total** | **53** | **8** (19 preguntas) | **5** (ramificados) | **5** | **6** | 84 + 45 transversales |

- Fichas de tema con las secciones pedidas (definición, epidemiología, etiología, fisiopatología, clínica, presentaciones atípicas, criterios, diferencial, laboratorio, interpretación, gravedad, tratamiento y secuencia, monitorización y metas, situaciones especiales, complicaciones, errores frecuentes, pronóstico, perlas).
- **36 valores normales** en 6 categorías: metabolismo y cetonas, electrolitos, función renal, gasometría y ácido-base, tiroides, neurología/HSA.
- **9 cálculos**: anion gap, AG corregido por albúmina, sodio corregido, osmolalidad total, osmolalidad efectiva, fórmula de Winter, delta-delta, déficit de agua libre, calcio corregido.
- **9 comparaciones**: CAD vs EHH; hipertiroidismo vs tirotoxicosis; Graves vs otras causas; tiroiditis vs Graves; hipotiroidismo primario vs central; coma mixedematoso vs tormenta; tormenta vs tirotoxicosis descompensada; HSA vs otras cefaleas en trueno; complicaciones de la HSA.

### Fuentes y estado de verificación

- **Harrison 22.ª ed. (2025):** fuente principal declarada, **no consultada directamente** en esta versión (no hubo acceso al texto). No se atribuyen citas ni cifras concretas a Harrison. Pendiente: cotejar cada tema con su capítulo si se aporta el texto.
- **Verificadas mediante búsqueda (2026‑09‑26):** consenso ADA/EASD/JBDS/AACE/DTS 2024 (criterios CAD/EHH, resolución, potasio <3,5, bicarbonato si pH <7,0, dextrosa con glucosa <250, líquidos 500–1000 mL/h las primeras 2–4 h, insulina SC en CAD leve-moderada, solapamiento de 1–2 h); guía AHA/ASA 2023 de HSA (aneurisma en <24 h, nimodipino, euvolemia, no hipervolemia profiláctica, sin meta de PA basada en evidencia, profilaxis anticonvulsiva no rutinaria y evitar fenitoína, antifibrinolíticos sin beneficio funcional, DVE en hidrocefalia); ATA 2016 (PTU 500–1000 mg de carga, hidrocortisona 300 mg/día, yodo tras la tionamida).
- **Referencias estándar no recotejadas en esta sesión:** ADA 2009 (gravedad clásica), JBDS (metas de descenso osmolar), ATA 2014 (hipotiroidismo), Perry et al. (TC <6 h, regla de Ottawa), fórmulas ácido-base.

## 6. Funciones

✅ **Implementado y probado** (pruebas automáticas + recorrido en navegador)
- Arquitectura modular con validación de contenido.
- Modos: selección múltiple, casos clínicos, casos progresivos con ramas, razonamiento clínico (autoevaluación asistida), interpretar laboratorio (sin marcar alteraciones hasta responder; rangos ocultos), laboratorio sorpresa.
- Retroalimentación: tu respuesta, correcta, veredicto, razonamiento paso a paso, datos clave, valores alterados, por qué la correcta, por qué las demás no, error de razonamiento, perla, qué recordar, tipo de error.
- Confianza por respuesta (seguro / dudoso / adiviné): el acierto adivinado cuenta la mitad y no demuestra dominio.
- Valores normales: fichas completas (umbral normal ≠ diagnóstico ≠ terapéutico ≠ crítico) y 6 modos de entrenamiento (tarjetas, normal o alterado, alto o bajo, completa el valor, valor crítico, mezcla adaptativa).
- Cálculos con datos nuevos en cada ejercicio y calculadora libre; fórmula → sustitución → resultado → interpretación → implicación.
- Motor adaptativo: repetición espaciada por concepto, dificultad por tema (empieza en 2), «Estudiar ahora», Mis puntos débiles (agrupados por tipo de error), Repaso recomendado, Practicar mis errores con preguntas distintas.
- Mapa de dominio (tema, subtema y categoría) y estadísticas (evolución, volumen, rendimiento por tema, fortalezas, errores recurrentes, tipos de error, tiempo, retención, simulacros, tabla de datos).
- Simulacro: selección múltiple, casos o mixto; cantidad, temas, dificultad; tiempo recomendado (30 preguntas = 32 min; 5 min por caso), personalizado o sin tiempo; resumen previo; temporizador discreto con avisos (25 %, 5 min, último minuto); entrega automática a 00:00 («Sin responder por tiempo agotado»); navegación, cambio de respuesta, marcado, navegador de preguntas con estados; confirmación con pendientes; resultados con análisis por tema, subtema, tipo, dificultad y manejo del tiempo; revisión posterior.
- Contra reloj (5/10/20/30/personalizado; relajado 90 s, estándar 64 s, intensivo 45 s por pregunta).
- Continuar donde lo dejaste (sesiones y simulacros; el reloj del simulacro sigue corriendo).
- Modo claro/oscuro con preferencia guardada; diseño móvil real (barra inferior, botones ≥48 px, tablas de laboratorio adaptadas, sin desplazamiento horizontal).
- Exportar e importar respaldo (combinar o reemplazar), sin credenciales.
- Estado del sistema y lista honesta de funciones en Configuración.
- Paquete de archivo único que funciona sin servidor.
- PWA: manifiesto, iconos (incluido maskable) y service worker; modo sin conexión probado en `localhost`.

⚠️ **Parcial**
- **Razonamiento abierto:** se corrige con autoevaluación asistida por palabras clave, no con un corrector semántico.
- **PWA instalable:** lista, pero solo se instala cuando la carpeta se aloja por HTTPS. Dentro de claude.ai no hay service worker ni instalación.
- **Cuenta y sincronización:** dentro de claude.ai se usan la cuenta de Claude y la base de datos privada del Artifact. La lógica se probó con una base de datos simulada; la primera sincronización real se verifica al abrirlo en claude.ai. La versión local no tiene cuenta propia.

⏳ **Preparado para después**
- Cuenta propia de Sol MED (correo, contraseña, recuperación, passkeys) independiente de claude.ai: requiere elegir un proveedor (por ejemplo Supabase o Firebase) → **decisión del usuario** (servicio externo, posible coste y privacidad). `sync.js` ya abstrae el almacenamiento remoto: bastaría un adaptador nuevo con `pull()` y `push()`.
- Cotejo capítulo por capítulo con Harrison 22.ª ed.

❌ **No disponible**
- Casos generados dinámicamente por IA (el banco es fijo y verificado). Un Artifact puede declarar la capacidad `sample` si en el futuro se quiere un tutor conversacional; se paga por uso de la persona que lo mira.

## 7. Motor adaptativo (parámetros en `engine.js`, objeto `P`)

- **Aprobado:** puntuación ≥0,6 (un acierto adivinado vale 0,5).
- **Fallo:** el concepto vuelve a estar pendiente a los 10 min, con facilidad −0,2; nunca se repite el mismo ítem en <20 h si hay alternativas y se prefiere un ítem distinto del fallado.
- **Acierto con el concepto pendiente:** intervalo 1 día → 3 días → intervalo × facilidad (inicio 2,3; 1,3–2,8). Confianza baja ×0,6; confianza alta +0,05 de facilidad; nivel 3 correcto ×1,1. Un acierto antes de tiempo no alarga el intervalo.
- **Dominio del concepto:** precisión reciente ponderada (decaimiento 0,8, peso por dificultad 0,8/1/1,25) × (0,55 + 0,45 × evidencia, con evidencia completa desde 4 intentos) + retención (hasta +0,08) + variedad de formatos (+0,03); penalización por fallos repetidos (×0,92 o ×0,85) y por repaso muy atrasado (×0,9); si el último intento falló, máximo 0,55. El dominio del tema es la media de sus conceptos (los no practicados cuentan 0).
- **Dificultad por tema:** empieza en 2; con ≥5 intentos recientes, sube si el acierto es ≥80 % (y al menos 3 de esos intentos son de su nivel) y baja si es ≤40 %.
- **«Estudiar ahora»:** hasta 35 % repasos pendientes, hasta 25 % puntos débiles, 1 verificación de retención de algo dominado, 1 caso, 1 laboratorio, 1 cálculo y el resto conceptos nuevos o práctica.

## 8. Datos, autenticación, sincronización y respaldo

- **Local:** `localStorage['solmed.v1']` = `{ schema, deviceId, attempts[], exams[], prefs, prefsAt, resume, resumeAt, resetAt, meta }`. Todas las lecturas y escrituras están protegidas; si el almacenamiento falla, se muestra en el Estado del sistema.
- **Autenticación:** Sol MED no guarda contraseñas. Dentro de claude.ai, el acceso lo protege la cuenta de Claude (Artifact privado; inicio de sesión, recuperación y passkeys los gestiona claude.ai). Las rutas no se «ocultan»: sin sesión no hay acceso al Artifact.
- **Sincronización (Artifact):** capacidades `db` + `user`. Documentos en el espacio privado `data/users/<id>/`:
  - `profile` → `{ prefs, prefsAt, resume, resumeAt, resetAt, updatedAt }` (el más reciente gana).
  - `profile/log/<dispositivo>-<n>` → hasta 500 intentos por documento; cada dispositivo escribe solo los suyos (no hay escrituras cruzadas).
  - `profile/exams/<id>` → un simulacro por documento.
  - Al abrir y al volver a la pestaña: descarga → fusión → subida. «Borrar progreso» usa `resetAt` y se propaga.
- **Respaldo:** JSON `{ app, kind: 'solmed-backup', version, schema, exportedAt, data }`. Importar combina (por defecto) o reemplaza.
- **Privacidad:** sin publicidad, rastreadores ni analítica.

## 9. Decisiones técnicas importantes

1. Scripts clásicos en lugar de módulos, para que funcione con `file://` y empaquetado.
2. Progreso como registro de intentos del que se deriva todo el estado: fusión segura y motor ajustable sin migraciones.
3. Contenido como datos JS (no JSON) para poder incluir funciones en los cálculos y validar al cargar.
4. Sincronización por dispositivo en fragmentos para respetar el límite de 256 KiB por documento y evitar conflictos.
5. Sin librerías de gráficos: una serie por gráfico, un eje, colores del tema.

## 10. Limitaciones y errores conocidos

- El banco es pequeño a propósito (calidad > cantidad): con filtros muy estrechos (un tema + nivel 3) el simulacro avisa de que hay menos preguntas.
- La autoevaluación del razonamiento depende de la honestidad de quien responde.
- Los rangos de referencia son orientativos (adultos); pueden no coincidir con tu laboratorio.
- Al reanudar una sesión se retoma desde el principio del ejercicio en curso (no desde un paso intermedio de un caso).
- La primera sincronización real con la base de datos de claude.ai no pudo probarse fuera de claude.ai.
- Sin errores conocidos pendientes tras las 19 pruebas unitarias y las 29 comprobaciones en navegador.

## 11. Cómo ampliar sin romper la arquitectura

**Nuevo tema** (ej. «Agrega insuficiencia suprarrenal»):
1. Crea `content/temas/insuficiencia-suprarrenal.js` copiando la forma de `hipotiroidismo.js` (`addTopic`).
2. Añade `<script src="content/temas/insuficiencia-suprarrenal.js"></script>` en `index.html`, en el bloque de contenido.
3. Añade la ruta a `ASSETS` en `sw.js` y sube `VERSION` (la prueba unitaria lo comprueba).
4. `npm test` (valida el contenido) → `npm run build` → publica `dist/sol-med-artifact.html` en la misma URL del Artifact.
   Aparece automáticamente en preguntas, repaso, estadísticas, mapa de dominio, simulacro y fichas.

**Nuevo subtema:** añade `{ id, name }` a `subtopics` del tema y usa `sub: 'id'` en conceptos e ítems.

**Nueva especialidad** (ej. Cardiología, Pediatría): añade la especialidad y sus áreas en `content/taxonomia.js` (`specialties`) y crea sus temas con `specialty: 'cardiologia'`, `area: '…'`.

**Nueva pregunta:** añade un objeto `type: 'mcq'` a `items` del tema, con `id` único en el tema, `concepts` existentes, 4–5 opciones con `why` en cada una, `answer`, `explain`, `pearl`. `npm test` rechaza respuestas fuera de rango, opciones repetidas, conceptos inexistentes y explicaciones ausentes.

**Nuevo caso clínico:** `type: 'case'` con la cabecera clínica y `questions`. Para uno progresivo, `type: 'progressive'` con `stages`; las ramas con `next` y `goto` (la prueba comprueba que no haya etapas inalcanzables ni bucles).

**Nuevo valor normal:** añade la ficha a la categoría adecuada en `content/valores/*.js` (o crea una categoría nueva con `addValues`). Con `low`/`high` numéricos obtiene automáticamente los modos «alto o bajo» y «normal o alterado»; con `fill` y `critical`, los modos «completa el valor» y «valor crítico».

**Nuevo cálculo:** añade el objeto a `content/calculos.js` con `compute`, `generate`, `substitute`, `interpret` e `implication`. Añade una aserción con un valor conocido en `tests/unit.mjs`.

**Nueva fuente:** añádela en `content/fuentes.js` con un `id` y cítala en `sources` del tema, valor o comparación.

## 12. Mejoras recomendadas y próximos pasos

1. Cotejar el contenido con los capítulos de Harrison 22.ª ed. (si se aportan) y marcar las fuentes como verificadas.
2. Ampliar el banco de preguntas por tema hasta ~25, empezando por los conceptos con menos ítems (el mapa de dominio lo muestra).
3. Siguiente bloque sugerido: insuficiencia suprarrenal (encaja con el coma mixedematoso y el hipotiroidismo central), hipoglucemia e hiponatremia.
4. Decidir si se quiere una cuenta propia fuera de claude.ai y un alojamiento HTTPS para instalar la PWA (GitHub Pages sería público: requiere aprobación).
5. Guardar el paso intermedio de los casos para reanudar dentro de un caso.
6. Opcional: tutor conversacional con la capacidad `sample` del Artifact para comentar el razonamiento abierto.
