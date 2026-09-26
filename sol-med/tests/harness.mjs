// Carga el núcleo y el contenido de Sol MED en un contexto de Node (sin DOM)
// para pruebas unitarias. Lee el orden de los scripts de index.html.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
}

export function loadSolMed({ includeUi = false, claude = null } = {}) {
  const storage = new Map();
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    performance: { now: () => Date.now() },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    navigator: { onLine: true },
    addEventListener() {},
    document: { addEventListener() {}, visibilityState: 'visible' },
  };
  if (claude) ctx.claude = claude;
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const src of scriptList()) {
    if (!includeUi && src.startsWith('js/ui/')) continue;
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    vm.runInContext(code, ctx, { filename: src });
  }
  return ctx.SolMed;
}
