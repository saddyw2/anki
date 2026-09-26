/* Sol MED — espacio de nombres global.
 * Se usan scripts clásicos (no módulos ES) para que la app funcione igual
 * desde un servidor, desde un archivo local (file://) o empaquetada en un
 * único HTML (tools/build.mjs). */
(function (root) {
  'use strict';
  root.SolMed = {
    name: 'Sol MED',
    version: '1.0.0',
    schema: 1,
    medicalReview: '2026-09-26',
    core: {},
    ui: {},
    views: {},
  };
})(typeof window !== 'undefined' ? window : globalThis);
