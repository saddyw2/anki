// Empaqueta Sol MED en un único HTML (sin dependencias).
//
//   node tools/build.mjs
//
// Genera:
//   dist/sol-med.html           documento completo: se abre con doble clic
//                               (PC) o se aloja en cualquier servidor.
//   dist/sol-med-artifact.html  fragmento para publicar como Artifact de
//                               claude.ai (la plataforma añade <html>, <head>
//                               y <body>).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const css = read('css/solmed.css');
const fonts = (html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/) || [])[1];
const iconSvg = read('icons/icon.svg').replace(/\s+/g, ' ').trim();
const iconHref = 'data:image/svg+xml,' + encodeURIComponent(iconSvg);

// Evita que un "</script>" dentro del código cierre la etiqueta.
const safe = (code) => code.replace(/<\/script/gi, '<\\/script');
const js = scripts.map((s) => '/* ' + s + ' */\n' + read(s)).join('\n;\n');

const head = [
  '<title>Sol MED</title>',
  '<meta name="solmed-bundle" content="1">',
  fonts ? '<link rel="preconnect" href="https://fonts.googleapis.com">' : '',
  fonts ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' : '',
  fonts ? '<link rel="stylesheet" href="' + fonts + '">' : '',
  '<style>\n' + css + '\n</style>',
]
  .filter(Boolean)
  .join('\n');

const body = '<div id="app" class="app"><noscript>Sol MED necesita JavaScript activado.</noscript></div>\n<script>\n' + safe(js) + '\n</script>';

const full = [
  '<!doctype html>',
  '<html lang="es">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<meta name="theme-color" content="#C2447F">',
  '<link rel="icon" href="' + iconHref + '">',
  head,
  '</head>',
  '<body>',
  body,
  '</body>',
  '</html>',
  '',
].join('\n');

// El Artifact recibe el contenido sin <html>/<head>/<body>; el <title> y el
// <style> van al principio.
const fragment = head + '\n' + body + '\n';

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/sol-med.html'), full);
fs.writeFileSync(path.join(ROOT, 'dist/sol-med-artifact.html'), fragment);
const kb = (s) => Math.round(Buffer.byteLength(s) / 1024) + ' KB';
console.log('dist/sol-med.html          ' + kb(full));
console.log('dist/sol-med-artifact.html ' + kb(fragment));
