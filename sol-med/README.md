# Sol MED — Centro personal de entrenamiento clínico

Aplicación web personal para entrenar **razonamiento clínico** en Medicina
Interna: preguntas, casos clínicos (también progresivos), razonamiento
abierto, interpretación de laboratorio, valores normales, cálculos
clínicos, comparaciones de alto rendimiento, simulacros cronometrados y un
motor adaptativo con repetición espaciada.

> Versión 1.0.0 · revisión médica del contenido: 26‑09‑2026.
> Registro completo para continuar el proyecto: [CONTINUIDAD.md](CONTINUIDAD.md).

## Cómo usarla

| Forma | Cómo | Progreso |
| --- | --- | --- |
| **Artifact privado en claude.ai** (recomendado) | Abre el enlace privado de Sol MED en el PC o en Android con tu cuenta de Claude. | Se sincroniza con tu cuenta (espacio privado) |
| **Archivo único** | Abre `dist/sol-med.html` con doble clic (PC). | Solo en ese navegador; muévelo con Exportar/Importar respaldo |
| **PWA instalable** | Aloja esta carpeta en un servidor HTTPS (por ejemplo GitHub Pages) y ábrela en Chrome para Android → «Instalar app». | En el dispositivo, con modo sin conexión |
| **Desarrollo local** | `npm start` y abre `http://localhost:8080` | En el navegador |

No requiere instalar dependencias para funcionar. Las pruebas en navegador
usan Playwright.

## Comandos

```bash
npm run build   # genera dist/sol-med.html y dist/sol-med-artifact.html
npm test        # pruebas unitarias (contenido, cálculos, motor, respaldo, sincronización)
npm run e2e     # prueba completa en Chromium: PC, móvil, claro/oscuro, PWA, archivo único
```

## Estructura

```
index.html              carga los scripts en orden (núcleo → contenido → motor → interfaz)
css/solmed.css          identidad visual rosa/lila, modo claro y oscuro
js/core/                lógica sin contenido médico
  registry.js           registro de especialidades, temas, ítems, valores, cálculos
  store.js              progreso local (registro de intentos), respaldo
  engine.js             repetición espaciada, dominio, puntos débiles, selección, simulacro
  gen.js                ejercicios generados (cálculos y valores)
  sync.js               sincronización con la cuenta de Claude
js/ui/                  interfaz (vistas y ejecutor de preguntas)
content/                contenido médico (separado de la lógica)
  taxonomia.js, fuentes.js, calculos.js, comparaciones.js
  valores/*.js          fichas de valores normales por categoría
  temas/*.js            un archivo por tema
tools/build.mjs         empaquetador de archivo único
tests/                  pruebas unitarias y de extremo a extremo
sw.js, manifest.webmanifest, icons/   PWA
```

## Aviso

Sol MED es una herramienta de estudio personal. No sustituye el juicio
clínico ni las guías locales. Los rangos de laboratorio son orientativos y
varían según el laboratorio, el método, las unidades y la población.
