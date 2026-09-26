/* Arranque, navegación, tema y estructura de la interfaz. */
(function (S) {
  'use strict';
  const { h, icon } = S.ui;

  S.ui.state = { session: null, exam: null, params: [] };

  // ---------- Estado derivado (cacheado) ----------
  let derivedCache = null;
  S.ui.derived = function (force) {
    if (force || !derivedCache || Date.now() - derivedCache.now > 30000) {
      derivedCache = S.engine.derive(S.store.get().attempts, Date.now());
    }
    return derivedCache;
  };

  // ---------- Rutas ----------
  const NAV = [
    { group: 'Estudiar' },
    { route: 'inicio', label: 'Inicio', icon: 'home', tab: true },
    { route: 'estudiar', label: 'Estudiar', icon: 'spark', tab: true },
    { route: 'temas', label: 'Temas', icon: 'book' },
    { route: 'valores', label: 'Valores normales', icon: 'flask', tab: true, tabLabel: 'Valores' },
    { route: 'calculos', label: 'Cálculos clínicos', icon: 'ruler' },
    { route: 'comparaciones', label: 'Comparaciones', icon: 'compare' },
    { route: 'simulacro', label: 'Simulacro', icon: 'exam' },
    { route: 'contrarreloj', label: 'Contra reloj', icon: 'clock' },
    { group: 'Mi progreso' },
    { route: 'progreso', label: 'Resumen', icon: 'chart', tab: true, tabLabel: 'Progreso' },
    { route: 'repaso', label: 'Repaso recomendado', icon: 'repeat' },
    { route: 'debiles', label: 'Mis puntos débiles', icon: 'target' },
    { route: 'dominio', label: 'Mapa de dominio', icon: 'map' },
    { route: 'estadisticas', label: 'Estadísticas', icon: 'chart' },
    { group: 'Sol MED' },
    { route: 'fuentes', label: 'Fuentes médicas', icon: 'source' },
    { route: 'ajustes', label: 'Configuración', icon: 'gear' },
    { route: 'mas', label: 'Más', icon: 'more', tab: true, hideSide: true },
  ];

  // Qué pestaña se ilumina para cada ruta.
  const TAB_OF = {
    inicio: 'inicio',
    estudiar: 'estudiar',
    modo: 'estudiar',
    temas: 'estudiar',
    tema: 'estudiar',
    calculos: 'estudiar',
    calculo: 'estudiar',
    comparaciones: 'estudiar',
    comparacion: 'estudiar',
    simulacro: 'estudiar',
    'simulacro-run': 'estudiar',
    'simulacro-resultado': 'progreso',
    'simulacro-revision': 'progreso',
    contrarreloj: 'estudiar',
    sesion: 'estudiar',
    valores: 'valores',
    valor: 'valores',
    'valores-entrenar': 'valores',
    progreso: 'progreso',
    repaso: 'progreso',
    debiles: 'progreso',
    dominio: 'progreso',
    estadisticas: 'progreso',
    historial: 'progreso',
    mas: 'mas',
    fuentes: 'mas',
    ajustes: 'mas',
  };

  let mainEl = null;
  let sideEl = null;
  let tabsEl = null;
  let syncEl = null;
  let current = '';

  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    return { route: parts[0] || 'inicio', params: parts.slice(1) };
  }

  S.ui.go = function (route) {
    const target = '#/' + route;
    if (location.hash === target) render();
    else location.hash = target;
  };

  function render() {
    const { route, params } = parseHash();
    S.ui.state.params = params;
    const view = S.views[route];
    current = route;
    updateNav(route);
    S.ui.charts.tip(false);
    mainEl.innerHTML = '';
    const root = h('div.view');
    mainEl.appendChild(root);
    try {
      if (view) view(root, params);
      else S.views.inicio(root, []);
    } catch (e) {
      console.error(e);
      root.innerHTML = '';
      root.appendChild(
        h(
          'div.card.stack',
          h('h2', 'Algo falló al mostrar esta pantalla'),
          h('p', 'Tu progreso está a salvo. Vuelve al inicio e inténtalo de nuevo. Si se repite, el detalle técnico está abajo.'),
          h('pre.small.mono', { style: { whiteSpace: 'pre-wrap' } }, String(e && e.stack ? e.stack : e)),
          h('button.btn.btn-primary', { type: 'button', onclick: () => S.ui.go('inicio') }, 'Ir al inicio'),
        ),
      );
    }
    if (route !== 'sesion' && route !== 'simulacro-run') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function updateNav(route) {
    const tab = TAB_OF[route] || 'inicio';
    for (const b of tabsEl.querySelectorAll('[data-route]')) {
      if (b.dataset.route === tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    for (const b of sideEl.querySelectorAll('[data-route]')) {
      if (b.dataset.route === route || (route === 'tema' && b.dataset.route === 'temas') || (route === 'valor' && b.dataset.route === 'valores'))
        b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  }

  // ---------- Tema claro / oscuro ----------
  function applyTheme() {
    const p = S.store.get().prefs;
    const root = document.documentElement;
    if (p.theme === 'light' || p.theme === 'dark') root.setAttribute('data-theme', p.theme);
    else if (root.getAttribute('data-theme') && root.dataset.solmedTheme) root.removeAttribute('data-theme');
    root.dataset.solmedTheme = p.theme;
    root.classList.toggle('reduce-motion', !!p.reduceMotion);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark() ? '#15101b' : '#C2447F');
  }
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  S.ui.applyTheme = applyTheme;
  S.ui.isDark = isDark;

  function toggleTheme() {
    S.store.setPref('theme', isDark() ? 'light' : 'dark');
    applyTheme();
    drawThemeBtn();
  }
  let themeBtn = null;
  function drawThemeBtn() {
    if (!themeBtn) return;
    themeBtn.innerHTML = '';
    themeBtn.appendChild(icon(isDark() ? 'sun' : 'moon'));
    themeBtn.setAttribute('aria-label', isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    themeBtn.title = themeBtn.getAttribute('aria-label');
  }

  // ---------- Estructura ----------
  function layout() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const brand = () =>
      h('button.brand', { type: 'button', onclick: () => S.ui.go('inicio'), 'aria-label': 'Sol MED, inicio' }, S.ui.logo(30), h('span.brand-name', 'Sol ', h('b', 'MED')));

    sideEl = h('nav.sidenav', { 'aria-label': 'Secciones' }, brand());
    for (const n of NAV) {
      if (n.group) sideEl.appendChild(h('div.group-label', n.group));
      else if (!n.hideSide)
        sideEl.appendChild(h('button.sidelink', { type: 'button', 'data-route': n.route, onclick: () => S.ui.go(n.route) }, icon(n.icon), n.label));
    }

    themeBtn = h('button.icon-btn', { type: 'button', onclick: toggleTheme });
    drawThemeBtn();
    syncEl = h('button.icon-btn', { type: 'button', onclick: () => S.ui.go('ajustes'), 'aria-label': 'Estado de sincronización' });
    drawSync(S.sync.info());

    const topbar = h('header.topbar', brand(), h('div.spacer'), syncEl, themeBtn);
    mainEl = h('main.main#main', { tabindex: '-1' });
    tabsEl = h(
      'nav.bottomnav',
      { 'aria-label': 'Navegación principal' },
      NAV.filter((n) => n.tab).map((n) => h('button.navbtn', { type: 'button', 'data-route': n.route, onclick: () => S.ui.go(n.route) }, icon(n.icon), n.tabLabel || n.label)),
    );
    app.append(sideEl, h('div.appcol', topbar, mainEl), tabsEl);
  }

  function drawSync(info) {
    if (!syncEl) return;
    const cls = info.adapter === 'claude' ? info.status : 'local';
    syncEl.innerHTML = '';
    syncEl.appendChild(icon('cloud'));
    const dot = h('span.sync-dot.' + cls, { style: { position: 'absolute', marginLeft: '18px', marginTop: '-16px' } });
    syncEl.style.position = 'relative';
    syncEl.appendChild(dot);
    const label =
      info.adapter === 'claude'
        ? info.status === 'ok'
          ? 'Sincronizado con tu cuenta'
          : info.status === 'connecting'
            ? 'Conectando…'
            : info.status === 'offline'
              ? 'Sin conexión: se sincronizará al volver'
              : 'Error de sincronización'
        : 'Progreso guardado en este dispositivo';
    syncEl.title = label;
    syncEl.setAttribute('aria-label', label);
  }

  // ---------- PWA ----------
  function registerSW() {
    const inArtifact = !!(window.claude && window.claude.use);
    const isHttp = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    S.ui.pwa = { supported: 'serviceWorker' in navigator, registered: false, reason: '' };
    if (inArtifact) S.ui.pwa.reason = 'Dentro de claude.ai el modo sin conexión lo gestiona el navegador; la instalación como app requiere alojar la versión PWA.';
    else if (!isHttp) S.ui.pwa.reason = 'Abierto como archivo local: la instalación y el modo sin conexión requieren servirlo por HTTPS.';
    else if (!('serviceWorker' in navigator)) S.ui.pwa.reason = 'Este navegador no admite service workers.';
    else if (document.querySelector('meta[name="solmed-bundle"]')) S.ui.pwa.reason = 'Versión de archivo único: sin service worker.';
    else {
      navigator.serviceWorker
        .register('sw.js')
        .then(() => {
          S.ui.pwa.registered = true;
        })
        .catch((e) => {
          S.ui.pwa.reason = 'No se pudo registrar el service worker: ' + e.message;
        });
    }
  }

  // ---------- Arranque ----------
  function boot() {
    S.store.load();
    const problems = S.registry.finalize();
    if (problems.errors.length) console.error('Sol MED: errores de contenido', problems.errors);
    applyTheme();
    layout();
    S.store.on(() => {
      derivedCache = null;
    });
    S.sync.onChange((info) => {
      drawSync(info);
      if (info.status === 'ok' && current === 'ajustes') render();
    });
    window.addEventListener('hashchange', render);
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onMq = () => {
        applyTheme();
        drawThemeBtn();
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
    }
    render();
    registerSW();
    // La sincronización arranca después de dibujar: la app funciona sin ella.
    S.sync.init().then(() => {
      derivedCache = null;
      if (current === 'inicio') render();
    });
    window.addEventListener('pagehide', () => S.store.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') S.store.flush();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.SolMed);
