// Prueba de extremo a extremo en Chromium (Playwright).
//   node tests/e2e.mjs [carpeta-de-capturas]
// Recorre el flujo completo en PC y móvil, claro y oscuro, persistencia,
// respaldo, simulacro con tiempo agotado, modo sin conexión y el paquete de
// archivo único.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const { chromium } = playwright;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'solmed-shots-'));
fs.mkdirSync(SHOTS, { recursive: true });

// ---------- servidor estático ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('no');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://localhost:' + server.address().port + '/index.html';

// ---------- mini ejecutor ----------
const results = [];
async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log('✅ ' + name);
  } catch (e) {
    results.push({ name, ok: false, err: String(e && e.stack ? e.stack : e) });
    console.log('❌ ' + name + '\n   ' + String(e && e.message ? e.message : e).split('\n')[0]);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'aserción fallida');
}

const IGNORED = /fonts\.(googleapis|gstatic)\.com|ERR_CERT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/;
function watch(page, bag) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED.test(m.text())) bag.push(m.text());
  });
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => {
    if (!IGNORED.test(r.url() + ' ' + (r.failure() || {}).errorText)) bag.push('requestfailed: ' + r.url());
  });
}

const go = async (page, route) => {
  await page.evaluate((r) => (location.hash = '#/' + r), route);
  await page.waitForTimeout(120);
};

/** Responde el paso visible de una sesión como lo haría un estudiante
 *  (a veces bien, a veces mal). Devuelve false cuando la sesión terminó. */
async function answerStep(page, opts = {}) {
  // Espera a que la vista de la sesión esté dibujada (la navegación por
  // hash es asíncrona).
  await page.waitForFunction(() => (document.querySelector('.runner-head') && document.querySelector('.view .card .qmeta')) || /Sesión terminada/.test(document.querySelector('main').innerText));
  if (await page.locator('text=Sesión terminada').count()) return false;
  const opts$ = page.locator('.options .opt:not([disabled])');
  if (await opts$.count()) {
    // Antes de responder no debe verse ninguna solución.
    assert((await page.locator('.opt.correct, .fb').count()) === 0, 'la respuesta se muestra antes de responder');
    const n = await opts$.count();
    await opts$.nth(opts.wrong ? n - 1 : 0).click();
    if (opts.guess) await page.locator('.confidence button', { hasText: 'Adiviné' }).click();
    await page.locator('.actions .btn-primary', { hasText: 'Responder' }).click();
    await page.locator('.fb').first().waitFor();
    for (const t of ['Tu respuesta', 'Respuesta correcta', 'Por qué la correcta es correcta']) assert(await page.locator('.fb', { hasText: t }).count(), 'falta «' + t + '» en la retroalimentación');
    await page.locator('.actions .btn-primary').last().click();
    return true;
  }
  if (await page.locator('textarea.input:not([disabled])').count()) {
    await page.locator('textarea.input').fill('Hay acidosis con cetonas; pediría gasometría, potasio y β-hidroxibutirato; líquidos primero.');
    await page.locator('.btn-primary', { hasText: 'Comparar' }).click();
    await page.locator('text=Razonamiento esperado').waitFor();
    await page.locator('.btn-primary', { hasText: 'Guardar y continuar' }).click();
    return true;
  }
  if (await page.locator('.flagpick').count() && (await page.locator('.flagpick button:not([disabled])').count())) {
    const groups = page.locator('.flagpick');
    const n = await groups.count();
    for (let i = 0; i < n; i++) await groups.nth(i).locator('button').nth(1).click();
    await page.locator('.btn-primary', { hasText: 'Comprobar' }).click();
    await page.locator('text=valores bien clasificados').waitFor();
    await page.locator('.actions .btn-primary', { hasText: 'Continuar' }).click();
    return true;
  }
  if (await page.locator('input.input.mono:not([disabled])').count()) {
    await page.locator('input.input.mono').fill('12');
    await page.locator('.btn-primary', { hasText: 'Comprobar' }).click();
    await page.locator('.fb').first().waitFor();
    await page.locator('.actions .btn-primary', { hasText: 'Continuar' }).click();
    return true;
  }
  if (await page.locator('.btn-primary', { hasText: 'Mostrar respuesta' }).count()) {
    await page.locator('.btn-primary', { hasText: 'Mostrar respuesta' }).click();
    await page.locator('button', { hasText: 'Dudé' }).click();
    return true;
  }
  const cont = page.locator('.actions .btn-primary', { hasText: /Continuar|Finalizar caso/ });
  if (await cont.count()) {
    await cont.first().click();
    return true;
  }
  throw new Error('paso no reconocido: ' + (await page.locator('main').innerText()).slice(0, 200));
}

async function runSession(page, max, opts) {
  let steps = 0;
  while (steps < max) {
    const more = await answerStep(page, opts);
    if (!more) return steps;
    steps++;
  }
  throw new Error('la sesión no terminó en ' + max + ' pasos');
}

const browser = await chromium.launch();

// ================= Escritorio =================
const desk = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await desk.newPage();
const errors = [];
watch(page, errors);

await check('Inicio carga con el nombre Sol MED y «Estudiar ahora»', async () => {
  await page.goto(BASE);
  await page.locator('#study-now').waitFor();
  assert((await page.title()).includes('Sol MED'));
  assert(await page.locator('.sidenav').isVisible(), 'barra lateral visible en escritorio');
  await page.screenshot({ path: path.join(SHOTS, 'desk-home.png') });
});

await check('Estudiar ahora: sesión completa con retroalimentación y resumen', async () => {
  await page.locator('#study-now').click();
  await page.locator('.runner-head').waitFor();
  await page.screenshot({ path: path.join(SHOTS, 'desk-question.png') });
  const n = await runSession(page, 80, { wrong: true });
  assert(n >= 10, 'pocos pasos: ' + n);
  await page.locator('text=Sesión terminada').waitFor();
  assert(await page.locator('button', { hasText: 'Practicar mis errores' }).count(), 'falta «Practicar mis errores»');
  await page.screenshot({ path: path.join(SHOTS, 'desk-summary.png'), fullPage: true });
});

await check('Los errores aparecen en Mis puntos débiles y se pueden practicar con otras preguntas', async () => {
  await go(page, 'debiles');
  await page.locator('button', { hasText: 'Practicar mis puntos débiles' }).waitFor();
  assert((await page.locator('.topic-row').count()) > 0, 'sin conceptos débiles');
  await page.locator('button', { hasText: 'Practicar mis puntos débiles' }).click();
  await page.locator('.runner-head').waitFor();
  await runSession(page, 80, {});
});

await check('Selección múltiple con acierto adivinado: se marca como parcial', async () => {
  await go(page, 'modo/mcq');
  await page.locator('button', { hasText: 'Empezar' }).click();
  await page.locator('.options .opt').first().waitFor();
  await page.locator('.options .opt').first().click();
  await page.locator('.confidence button', { hasText: 'Adiviné' }).click();
  await page.locator('.btn-primary', { hasText: 'Responder' }).click();
  await page.locator('.fb').first().waitFor();
  const txt = await page.locator('.verdict').first().innerText();
  assert(/adivinada|Incorrecta/.test(txt), 'veredicto inesperado: ' + txt);
  await page.locator('.icon-btn[aria-label="Salir de la sesión"]').click();
  await page.locator('.modal .btn-primary', { hasText: 'Salir' }).click();
});

for (const [mode, label] of [
  ['case', 'Casos clínicos'],
  ['progressive', 'Casos progresivos'],
  ['reasoning', 'Razonamiento clínico'],
  ['lab', 'Interpretar laboratorio'],
]) {
  await check('Modo ' + label + ' funciona de principio a fin', async () => {
    await go(page, 'modo/' + mode);
    await page.locator('.seg button', { hasText: /^5$/ }).click();
    await page.locator('button', { hasText: 'Empezar' }).click();
    await page.locator('.runner-head').waitFor();
    await page.screenshot({ path: path.join(SHOTS, 'desk-' + mode + '.png') });
    const n = await runSession(page, 90, { wrong: mode === 'progressive' });
    assert(n >= 3, 'demasiado corto');
  });
}

await check('Interpretar laboratorio: los valores no se marcan antes de responder', async () => {
  await go(page, 'modo/lab');
  await page.locator('button', { hasText: 'Laboratorio sorpresa' }).last().click();
  await page.locator('.flagpick').first().waitFor();
  assert((await page.locator('.labs .flag').count()) === 0, 'hay marcas de alto/bajo antes de responder');
  assert((await page.locator('.labs td.ref').count()) === 0, 'se muestran los rangos antes de responder');
  await runSession(page, 40, {});
});

await check('Cálculos: validación de entrada y explicación fórmula → implicación', async () => {
  await go(page, 'calculo/anion_gap');
  await page.locator('#ci-na').fill('132');
  await page.locator('#ci-cl').fill('96');
  await page.locator('#ci-hco3').fill('9');
  await page.locator('text=AG = 132 − (96 + 9) = 27').waitFor();
  await page.locator('button', { hasText: 'Practicar 5 ejercicios' }).click();
  await page.locator('.runner-head').waitFor();
  await page.locator('input.input.mono').fill('abc');
  await page.locator('.btn-primary', { hasText: 'Comprobar' }).click();
  await page.locator('.toast', { hasText: 'Escribe un número' }).waitFor();
  await page.locator('input.input.mono').fill('10,5');
  await page.locator('.btn-primary', { hasText: 'Comprobar' }).click();
  for (const t of ['Fórmula', 'Sustitución', 'Resultado', 'Interpretación', 'Implicación clínica']) await page.locator('.fb-sec h4', { hasText: t }).first().waitFor();
  await page.locator('.actions .btn-primary', { hasText: 'Continuar' }).click();
  await runSession(page, 20, {});
});

await check('Valores normales: ficha completa y entrenamiento (6 modos)', async () => {
  await go(page, 'valor/k');
  for (const t of ['Rango de referencia', 'Elevado', 'Disminuido', 'Umbrales que no hay que confundir', 'Perla de examen']) await page.locator('text=' + t).first().waitFor();
  await go(page, 'valores-entrenar');
  for (const t of ['Tarjetas', 'Normal o alterado', 'Alto o bajo', 'Completa el valor', 'Valor crítico', 'Mezcla adaptativa']) {
    await go(page, 'valores-entrenar');
    await page.locator('.seg button', { hasText: /^5$/ }).click();
    await page.locator('.tile', { hasText: t }).click();
    await page.locator('.runner-head').waitFor();
    await runSession(page, 30, {});
  }
});

await check('Comparaciones: tabla y práctica vinculada', async () => {
  await go(page, 'comparacion/cad-ehh');
  await page.locator('table.cmp-table').waitFor();
  await page.locator('text=El dato que inclina').waitFor();
  await page.locator('button', { hasText: 'Practicar esta comparación' }).click();
  await runSession(page, 40, {});
});

await check('Simulacro: resumen previo, navegación, marcado, cambio de respuesta y confirmación', async () => {
  await go(page, 'simulacro');
  await page.locator('.seg button', { hasText: /^10$/ }).click();
  await page.locator('text=Antes de empezar').waitFor();
  const summary = await page.locator('.kpis').first().innerText();
  assert(summary.includes('10') && summary.includes('10:40'), 'tiempo proporcional esperado 10:40, resumen: ' + summary);
  await page.locator('button', { hasText: 'Comenzar simulacro' }).click();
  await page.locator('.timer').waitFor();
  assert((await page.locator('.timer').innerText()).startsWith('Tiempo restante'), 'temporizador visible');
  await page.locator('.options .opt').first().click();
  assert((await page.locator('.fb, .opt.correct').count()) === 0, 'el simulacro no muestra soluciones');
  await page.locator('.options .opt').nth(1).click(); // cambiar respuesta
  assert((await page.locator('.opt[aria-pressed="true"]').count()) === 1);
  await page.locator('button', { hasText: 'Revisar después' }).click();
  await page.locator('button', { hasText: 'Siguiente' }).click();
  await page.locator('button', { hasText: 'Anterior' }).click();
  assert((await page.locator('.opt[aria-pressed="true"]').count()) === 1, 'la respuesta se conserva');
  await page.locator('button', { hasText: 'Mostrar' }).click();
  await page.locator('.qnav button.flagged').waitFor();
  await page.locator('.qnav button').nth(4).click();
  await page.locator('text=Pregunta 5/').waitFor();
  await page.screenshot({ path: path.join(SHOTS, 'desk-exam.png'), fullPage: true });
  await page.locator('button', { hasText: 'Entregar simulacro' }).click();
  await page.locator('.modal', { hasText: 'Respondidas 1/' }).waitFor();
  await page.locator('.modal', { hasText: 'Pendientes 9' }).waitFor();
  await page.locator('.modal button', { hasText: 'Seguir respondiendo' }).click();
});

await check('Recargar a mitad del simulacro conserva respuestas y tiempo; al agotarse se entrega solo', async () => {
  const deadline = await page.evaluate(() => SolMed.ui.state.exam.deadline);
  await page.reload();
  // Al recargar en el simulacro, continúa solo, con el mismo reloj.
  await page.locator('.timer').waitFor();
  await page.locator('text=Respondidas 1/10').waitFor();
  assert((await page.evaluate(() => SolMed.ui.state.exam.deadline)) === deadline, 'el reloj se reinició');
  // Y desde el inicio también se ofrece continuar.
  await go(page, 'inicio');
  await page.locator('#resume-btn').click();
  await page.locator('.timer').waitFor();
  // Adelanta el reloj del examen: faltan 2 segundos.
  await page.evaluate(() => {
    SolMed.ui.state.exam.deadline = Date.now() + 2000;
  });
  await page.locator('text=Resultados').first().waitFor({ timeout: 8000 });
  await page.locator('text=Entregado automáticamente al agotarse el tiempo.').waitFor();
  const kpis = await page.locator('.kpis').innerText();
  assert(/9\s*Sin responder/.test(kpis), 'debería haber 9 sin responder: ' + kpis);
  await page.screenshot({ path: path.join(SHOTS, 'desk-results.png'), fullPage: true });
  await page.locator('button', { hasText: 'Revisar preguntas' }).click();
  await page.locator('.fb').first().waitFor();
  await page.locator('text=Tiempo:').first().waitFor();
  await page.locator('.qnav button').nth(3).click();
  await page.locator('text=Sin responder por tiempo agotado.').waitFor();
});

await check('Contra reloj: una pregunta por vez, veredicto breve y resultados', async () => {
  await go(page, 'contrarreloj');
  await page.locator('.seg button', { hasText: /^5$/ }).click();
  await page.locator('.seg button', { hasText: 'Intensivo' }).click();
  await page.locator('button', { hasText: 'Empezar' }).click();
  for (let i = 0; i < 5; i++) {
    await page.locator('.options .opt').first().click();
    await page.locator('.verdict').waitFor();
    await page.locator('.actions .btn-primary').click();
  }
  await page.locator('.modal .btn-primary').click();
  await page.locator('text=Resultados').first().waitFor();
});

await check('Repaso, mapa de dominio, estadísticas e historial muestran datos reales', async () => {
  await go(page, 'dominio');
  await page.locator('details.card').first().waitFor();
  await go(page, 'estadisticas');
  assert((await page.locator('svg.chart').count()) >= 2, 'faltan gráficos');
  await page.locator('text=Tipos de error').waitFor();
  await page.screenshot({ path: path.join(SHOTS, 'desk-stats.png'), fullPage: true });
  await go(page, 'historial');
  assert((await page.locator('.topic-row').count()) >= 2, 'faltan simulacros en el historial');
  await go(page, 'repaso');
  await page.locator('h1', { hasText: 'Repaso recomendado' }).waitFor();
});

await check('Fichas de temas y fuentes médicas', async () => {
  await go(page, 'tema/hsa');
  await page.locator('summary', { hasText: 'Complicaciones y su secuencia temporal' }).waitFor();
  await go(page, 'fuentes');
  await page.locator('text=AHA/ASA 2023').first().waitFor();
  await page.locator('text=Transparencia').waitFor();
});

await check('Continuar donde lo dejaste (sesión) tras recargar', async () => {
  await go(page, 'modo/mcq');
  await page.locator('button', { hasText: 'Empezar' }).click();
  await answerStep(page, {});
  await answerStep(page, {});
  await page.reload();
  // La sesión continúa en la misma posición tras recargar…
  await page.locator('.runner-head', { hasText: '3/' }).waitFor();
  // …y desde el inicio aparece «Continuar donde lo dejaste».
  await go(page, 'inicio');
  const txt = await page.locator('.resume-card').innerText();
  assert(txt.includes('Completados 2 de'), 'posición no conservada: ' + txt);
  await page.locator('#resume-btn').click();
  await page.locator('.runner-head', { hasText: '3/' }).waitFor();
  await page.locator('.icon-btn[aria-label="Salir de la sesión"]').click();
  await page.locator('.modal .btn-primary', { hasText: 'Salir' }).click();
});

let attemptsBefore = 0;
await check('Tema oscuro y preferencia guardada tras recargar', async () => {
  await go(page, 'ajustes');
  await page.locator('.seg button', { hasText: 'Oscuro' }).click();
  assert((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark');
  await page.reload();
  await page.waitForTimeout(300);
  assert((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', 'no se conservó el tema');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(bg !== 'rgb(251, 247, 252)', 'el fondo no cambió en oscuro');
  await go(page, 'inicio');
  await page.screenshot({ path: path.join(SHOTS, 'desk-dark.png') });
  attemptsBefore = await page.evaluate(() => SolMed.store.get().attempts.length);
});

let backupPath = null;
await check('Exportar respaldo descarga un JSON sin contraseñas', async () => {
  await go(page, 'ajustes');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('button', { hasText: 'Exportar respaldo' }).click()]);
  backupPath = path.join(SHOTS, 'respaldo.json');
  await dl.saveAs(backupPath);
  const obj = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert(obj.kind === 'solmed-backup' && obj.data.attempts.length === attemptsBefore, 'respaldo incompleto');
  assert(!/password|contraseñ/i.test(JSON.stringify(obj.data)), 'el respaldo contiene credenciales');
  await page.locator('text=Último respaldo exportado').waitFor();
});

await check('Estado del sistema y estado honesto de funciones', async () => {
  await page.locator('text=Estado del sistema').waitFor();
  await page.locator('text=Validación del contenido').waitFor();
  const v = await page.locator('.status-list').innerText();
  assert(v.includes('Sin errores'), 'validación: ' + v);
  await page.locator('text=Implementado y probado').waitFor();
  await page.locator('text=Preparado para después').waitFor();
});

await check('Sin errores de consola en escritorio', async () => {
  assert(errors.length === 0, errors.join('\n'));
});

// ================= Importar en otro dispositivo =================
await check('Importar respaldo en un navegador nuevo (combinar)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '#/ajustes');
  await p.locator('button', { hasText: 'Importar respaldo' }).waitFor();
  await p.locator('#import-file').setInputFiles(backupPath);
  await p.locator('.modal', { hasText: 'Importar respaldo' }).waitFor();
  await p.locator('.modal button', { hasText: 'Combinar' }).click();
  await p.waitForTimeout(300);
  const n = await p.evaluate(() => SolMed.store.get().attempts.length);
  assert(n === attemptsBefore, 'importados ' + n + ' de ' + attemptsBefore);
  await p.setInputFiles('#import-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hola":1}') });
  await p.locator('.toast', { hasText: 'no es un respaldo de Sol MED' }).waitFor();
  await ctx.close();
});

// ================= Móvil =================
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
const mp = await mob.newPage();
const merrors = [];
watch(mp, merrors);

await check('Móvil: barra inferior, botones táctiles y sin desplazamiento horizontal', async () => {
  await mp.goto(BASE);
  await mp.locator('#study-now').waitFor();
  assert(await mp.locator('.bottomnav').isVisible(), 'falta la barra inferior');
  const h = await mp.locator('#study-now').boundingBox();
  assert(h.height >= 48, 'botón principal pequeño');
  await mp.screenshot({ path: path.join(SHOTS, 'mob-home-dark.png'), fullPage: true });
  for (const r of ['inicio', 'estudiar', 'valores', 'valor/glucosa', 'calculo/delta_delta', 'comparacion/hsa-cefaleas', 'simulacro', 'progreso', 'dominio', 'estadisticas', 'fuentes', 'ajustes', 'tema/cad', 'mas']) {
    await go(mp, r);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 1, 'desplazamiento horizontal en ' + r + ' (' + over + ' px)');
  }
});

await check('Móvil: sesión de estudio completa y laboratorio legible', async () => {
  await go(mp, 'modo/lab');
  await mp.locator('.seg button', { hasText: /^5$/ }).click();
  await mp.locator('button', { hasText: 'Empezar' }).click();
  await mp.locator('.flagpick').first().waitFor();
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(over <= 1, 'la tabla de laboratorio desborda (' + over + ' px)');
  await mp.screenshot({ path: path.join(SHOTS, 'mob-lab.png'), fullPage: true });
  await runSession(mp, 60, {});
  await mp.locator('#study-now').count();
});

await check('Móvil: simulacro con temporizador discreto', async () => {
  await go(mp, 'simulacro');
  await mp.locator('.seg button', { hasText: 'Casos clínicos' }).click();
  await mp.locator('.seg button', { hasText: /^2 casos$/ }).click();
  await mp.locator('button', { hasText: 'Comenzar simulacro' }).click();
  await mp.locator('.timer').waitFor();
  await mp.screenshot({ path: path.join(SHOTS, 'mob-exam.png'), fullPage: true });
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(over <= 1, 'desborde en simulacro');
});

await check('Sin errores de consola en móvil', async () => {
  assert(merrors.length === 0, merrors.join('\n'));
});

// ================= PWA y sin conexión =================
await check('PWA: service worker activo y la app abre sin conexión', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await p.reload();
  await p.waitForTimeout(500);
  const manifest = await p.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
  assert(manifest.name.startsWith('Sol MED') && manifest.icons.some((i) => i.purpose === 'maskable'), 'manifiesto incompleto');
  await ctx.setOffline(true);
  await p.reload();
  await p.locator('#study-now').waitFor({ timeout: 5000 });
  await p.locator('#study-now').click();
  await p.locator('.runner-head').waitFor();
  await ctx.setOffline(false);
  await ctx.close();
});

// ================= Paquete de archivo único =================
await check('Paquete de archivo único (file://) funciona sin servidor', async () => {
  const bundle = path.join(ROOT, 'dist/sol-med.html');
  assert(fs.existsSync(bundle), 'ejecuta primero node tools/build.mjs');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const bag = [];
  watch(p, bag);
  await p.goto('file://' + bundle);
  await p.locator('#study-now').click();
  await runSession(p, 80, {});
  const n = await p.evaluate(() => SolMed.store.get().attempts.length);
  assert(n > 5, 'no se registraron respuestas');
  assert(bag.length === 0, bag.join('\n'));
  await ctx.close();
});

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' comprobaciones superadas. Capturas: ' + SHOTS);
if (failed.length) {
  for (const f of failed) console.log('\n--- ' + f.name + '\n' + f.err);
  process.exit(1);
}
