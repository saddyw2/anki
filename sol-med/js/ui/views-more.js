/* Fuentes médicas y Configuración (tema, cuenta, respaldo, estado del
 * sistema y estado honesto de las funciones). */
(function (S) {
  'use strict';
  const U = S.util;
  const R = S.registry;
  const { h, icon, rich } = S.ui;

  // ---------- Fuentes médicas ----------
  const VERIFY = {
    verificada: { label: 'Recomendación verificada', cls: 'ok' },
    referencia: { label: 'Obra de referencia', cls: 'violet' },
    pendiente: { label: 'Cotejo pendiente', cls: 'warn' },
  };

  S.views.fuentes = function (root) {
    const topics = R.topics;
    const srcCard = (s) =>
      h(
        'div.card.tight.stack',
        h('div.row-between', h('strong', s.title), s.verify ? h('span.chip.' + VERIFY[s.verify].cls, VERIFY[s.verify].label) : null),
        h('div.small.muted', [s.authors, s.edition, s.year].filter(Boolean).join(' · ')),
        s.note ? rich('p.small', s.note) : null,
        s.reviewed ? h('div.tiny.muted', 'Revisión en Sol MED: ' + U.fmtDate(s.reviewed)) : null,
      );
    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead(
          'Fuentes médicas',
          'Fuente principal, edición, fuentes complementarias y fecha de revisión por tema. Las preguntas son originales; no se reproducen fragmentos de libros ni de bancos de preguntas.',
        ),
        h(
          'div.callout.warn',
          rich(
            'p',
            '**Transparencia:** en esta versión no hubo acceso directo al texto de Harrison. El contenido se redactó con conocimiento médico general concordante con Harrison (22.ª ed., 2025) y se contrastaron con búsquedas los puntos que cambiaron en guías recientes (ADA 2024, AHA/ASA 2023). Si subes tus capítulos de Harrison, se puede cotejar tema por tema.',
          ),
        ),
        topics
          .filter((t) => t.sources.length)
          .map((t) =>
            h(
              'section.stack',
              h('div.row-between', h('h2', t.name), t.reviewed ? h('span.small.muted', 'Revisado ' + U.fmtDate(t.reviewed)) : null),
              t.sources.map((id) => R.sources[id]).filter(Boolean).map(srcCard),
            ),
          ),
        h('section.stack', h('h2', 'Todas las fuentes'), Object.values(R.sources).map(srcCard)),
      ),
    );
  };

  // ---------- Configuración ----------
  const FEATURES = [
    ['ok', 'Arquitectura modular: contenido separado del núcleo (Especialidad → Tema → Subtema → Concepto → Ítem)'],
    ['ok', 'Selección múltiple, casos clínicos, casos progresivos con ramas, razonamiento clínico, interpretar laboratorio'],
    ['ok', 'Valores normales con fichas y 6 modos de entrenamiento'],
    ['ok', 'Cálculos clínicos con datos nuevos en cada ejercicio'],
    ['ok', 'Retroalimentación estructurada y clasificación de errores'],
    ['ok', 'Motor adaptativo: repetición espaciada por concepto, dificultad por tema, «Estudiar ahora»'],
    ['ok', 'Mis puntos débiles, Repaso recomendado, Mapa de dominio, Estadísticas'],
    ['ok', 'Simulacro con temporizador, navegador, marcado, entrega automática, resultados y revisión'],
    ['ok', 'Contra reloj (5/10/20/30/personalizado; relajado, estándar, intensivo)'],
    ['ok', 'Modo claro/oscuro, diseño móvil, continuar donde lo dejaste'],
    ['ok', 'Exportar e importar respaldo (combinar o reemplazar)'],
    ['partial', 'Razonamiento abierto: se corrige con autoevaluación asistida por palabras clave, no con un corrector automático'],
    ['partial', 'PWA: manifiesto, iconos y service worker listos; instalable solo cuando se aloja por HTTPS (no dentro de claude.ai)'],
    ['partial', 'Cuenta y sincronización: dentro de claude.ai usan tu cuenta de Claude; la versión local no tiene cuenta propia'],
    ['later', 'Cuenta propia de Sol MED con correo/contraseña, recuperación y passkeys (requiere elegir un servicio de autenticación)'],
    ['later', 'Cotejo directo con los capítulos de Harrison (requiere acceso al texto)'],
    ['no', 'Casos progresivos generados dinámicamente por IA: el banco es fijo y verificado'],
  ];
  const FEAT_ICON = { ok: ['check', 'var(--ok)', 'Implementado y probado'], partial: ['alert', 'var(--warn)', 'Parcial'], later: ['clock', 'var(--violet)', 'Preparado para después'], no: ['x', 'var(--muted)', 'No disponible'] };

  async function doExport() {
    const data = JSON.stringify(S.store.exportBackup(), null, 1);
    const filename = 'sol-med-respaldo-' + U.dayKey(Date.now()) + '.json';
    const c = window.claude;
    if (c && typeof c.use === 'function') {
      try {
        const dl = await c.use('downloads');
        if (dl) {
          await dl.save({ filename, data });
          S.store.setMeta('lastBackup', Date.now());
          S.ui.toast('Respaldo guardado.');
          S.ui.go('ajustes');
          return;
        }
      } catch (e) {
        if (e && e.code === 'declined') return;
        if (e && e.code === 'rate_limited') return S.ui.toast('Ya hay una descarga pendiente de confirmar.', 'warn');
      }
    }
    try {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      S.store.setMeta('lastBackup', Date.now());
      S.ui.toast('Respaldo descargado: ' + filename);
      S.ui.go('ajustes');
    } catch (e) {
      S.ui.toast('No se pudo descargar. Usa «Copiar respaldo».', 'bad');
    }
  }

  async function doCopy() {
    const data = JSON.stringify(S.store.exportBackup());
    try {
      await navigator.clipboard.writeText(data);
      S.store.setMeta('lastBackup', Date.now());
      S.ui.toast('Respaldo copiado al portapapeles. Pégalo en una nota segura.');
    } catch (e) {
      const ta = h('textarea.input', { readonly: true, rows: 6 }, data);
      S.ui.dialog({ title: 'Copia este texto', body: h('div.stack', h('p.small', 'El navegador no permitió copiar automáticamente. Selecciona todo y cópialo.'), ta), buttons: [{ label: 'Cerrar', value: true, primary: true }] });
      setTimeout(() => ta.select(), 50);
    }
  }

  async function doImport(file) {
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch (e) {
      return S.ui.toast('El archivo no es un JSON válido.', 'bad');
    }
    const check = S.store.inspectBackup(obj);
    if (!check.ok) return S.ui.toast(check.reason, 'bad', 6000);
    const choice = await S.ui.dialog({
      title: 'Importar respaldo',
      body: h(
        'div.stack',
        h('p', 'Respaldo de Sol MED ' + check.version + ' del ' + U.fmtDateTime(check.exportedAt) + '.'),
        h('p', check.attempts + ' respuestas · ' + check.exams + ' simulacros.'),
        h('p.small.muted', '«Combinar» une el respaldo con tu progreso actual sin borrar nada. «Reemplazar» sustituye todo el progreso de este dispositivo.'),
      ),
      buttons: [
        { label: 'Cancelar', value: null },
        { label: 'Reemplazar', value: 'replace', danger: true },
        { label: 'Combinar', value: 'merge', primary: true },
      ],
    });
    if (!choice) return;
    if (choice === 'replace') {
      const sure = await S.ui.confirm('¿Reemplazar todo el progreso?', 'Se perderá el progreso actual de este dispositivo que no esté en el respaldo.', 'Reemplazar', true);
      if (!sure) return;
    }
    const r = S.store.importBackup(obj, choice);
    S.ui.toast(choice === 'merge' ? 'Importado: ' + r.added + ' respuestas nuevas.' : 'Progreso reemplazado.');
    S.ui.applyTheme();
    S.ui.go('ajustes');
  }

  S.views.ajustes = function (root) {
    const st = S.store.get();
    const prefs = st.prefs;
    const sync = S.sync.info();
    const storage = S.store.status();
    const problems = R.problems;
    const inArtifact = !!(window.claude && window.claude.use);
    const pwa = S.ui.pwa || {};

    const fileInput = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      id: 'import-file',
      onchange: () => {
        if (fileInput.files[0]) doImport(fileInput.files[0]);
        fileInput.value = '';
      },
    });

    const account = h(
      'div.card.stack',
      h('h3', 'Cuenta y sincronización'),
      sync.adapter === 'claude'
        ? h(
            'div.stack',
            h('div.row', h('span.sync-dot.' + sync.status), h('strong', sync.status === 'ok' ? 'Sincronizado con tu cuenta de Claude' : sync.status === 'offline' ? 'Sin conexión: se sincronizará al volver' : sync.status === 'connecting' ? 'Conectando…' : 'Error de sincronización')),
            rich(
              'p.small',
              'Sol MED está abierto como Artifact privado de claude.ai. Tu cuenta de Claude protege el acceso (inicio de sesión, recuperación de contraseña y passkeys los gestiona claude.ai) y tu progreso se guarda en un espacio privado de tu cuenta, invisible para cualquier otra persona. Ábrelo desde el PC o desde Android con la misma cuenta y verás el mismo progreso.',
            ),
            sync.lastError ? h('div.callout.warn.small', sync.lastError) : null,
            h('button.btn.btn-soft', { type: 'button', disabled: sync.busy, onclick: () => S.sync.syncNow().then(() => S.ui.go('ajustes')) }, icon('repeat'), 'Sincronizar ahora'),
          )
        : h(
            'div.stack',
            h('div.row', h('span.sync-dot.local'), h('strong', 'Versión local')),
            rich(
              'p.small',
              'El progreso se guarda solo en este navegador. Para usarlo en otro dispositivo, exporta un respaldo e impórtalo allí, o abre Sol MED desde su enlace privado de claude.ai, que sincroniza con tu cuenta.',
            ),
            sync.lastError ? h('p.tiny.muted', 'Detalle: ' + sync.lastError) : null,
          ),
    );

    const statusRows = [
      ['Versión de la aplicación', 'Sol MED ' + S.version],
      ['Revisión médica del contenido', U.fmtDate(S.medicalReview)],
      ['Almacenamiento local', storage.ok ? 'Disponible · ' + Math.round(storage.bytes / 1024) + ' KB' : 'No disponible: ' + storage.error],
      ['Respuestas registradas', String(storage.attempts)],
      ['Simulacros guardados', String(storage.exams)],
      ['Sincronización', sync.adapter === 'claude' ? 'Cuenta de Claude' : 'Sin sincronización (local)'],
      ['Última sincronización', st.meta.lastSync ? U.fmtDateTime(st.meta.lastSync) : '—'],
      ['Último respaldo exportado', st.meta.lastBackup ? U.fmtDateTime(st.meta.lastBackup) : 'Nunca'],
      ['Funciones sin conexión', pwa.registered ? 'Activas (service worker)' : inArtifact ? 'La app funciona sin red una vez abierta; los cambios se sincronizan al volver' : pwa.reason || 'No activas'],
      ['Contenido', R.items.length + ' ejercicios · ' + R.values.length + ' valores · ' + R.calcs.length + ' cálculos · ' + R.comparisons.length + ' comparaciones'],
      ['Validación del contenido', problems.errors.length ? problems.errors.length + ' errores' : 'Sin errores' + (problems.warnings.length ? ' · ' + problems.warnings.length + ' avisos' : '')],
    ];

    root.appendChild(
      h(
        'div.stack-lg.fade-in',
        S.ui.pageHead('Configuración'),
        h(
          'div.card.stack',
          h('h3', 'Apariencia y estudio'),
          h('div.label', 'Tema'),
          S.ui.seg(
            [
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
              { value: 'system', label: 'Según el sistema' },
            ],
            prefs.theme,
            (v) => {
              S.store.setPref('theme', v);
              S.ui.applyTheme();
            },
            'Tema',
          ),
          h('div.label', 'Ejercicios por sesión de «Estudiar ahora»'),
          S.ui.seg([6, 10, 15, 20].map((n) => ({ value: n, label: String(n) })), prefs.sessionSize, (v) => S.store.setPref('sessionSize', v), 'Tamaño de sesión'),
          h('div.label', 'Animaciones'),
          S.ui.seg(
            [
              { value: false, label: 'Suaves' },
              { value: true, label: 'Reducidas' },
            ],
            !!prefs.reduceMotion,
            (v) => {
              S.store.setPref('reduceMotion', v);
              S.ui.applyTheme();
            },
            'Animaciones',
          ),
        ),
        account,
        h(
          'div.card.stack',
          h('h3', 'Copia de seguridad'),
          h('p.small', 'Incluye progreso, historial, puntos débiles, repetición, estadísticas, simulacros y preferencias. Nunca incluye contraseñas (Sol MED no las guarda).'),
          h(
            'div.row',
            h('button.btn.btn-primary', { type: 'button', onclick: doExport }, icon('download'), 'Exportar respaldo'),
            h('button.btn', { type: 'button', onclick: () => fileInput.click() }, icon('upload'), 'Importar respaldo'),
            h('button.btn.btn-ghost', { type: 'button', onclick: doCopy }, 'Copiar respaldo'),
          ),
          fileInput,
        ),
        h('div.card.stack', h('h3', 'Estado del sistema'), h('div.status-list', statusRows.map(([k, v]) => [h('div.small', k), h('div.small.v', v)]))),
        h(
          'div.card.stack',
          h('h3', 'Estado de las funciones'),
          h('div.legend', Object.values(FEAT_ICON).map(([ic, c, l]) => h('span.row', { style: { gap: '4px', color: c } }, icon(ic), h('span', { style: { color: 'var(--ink-2)' } }, l)))),
          h(
            'div',
            FEATURES.map(([k, t]) => h('div.feat', h('span', { style: { color: FEAT_ICON[k][1] }, title: FEAT_ICON[k][2] }, icon(FEAT_ICON[k][0])), h('span', t))),
          ),
        ),
        h(
          'div.card.stack',
          h('h3', 'Privacidad'),
          h('p.small', 'Sin publicidad, sin rastreadores y sin analítica. Solo se guarda lo necesario para tu estudio: tus respuestas, simulacros y preferencias.'),
        ),
        h(
          'div.card.stack',
          h('h3', 'Borrar progreso'),
          h('p.small', 'Elimina respuestas y simulacros de este dispositivo. Exporta antes un respaldo si quieres conservarlos.'),
          h(
            'button.btn.btn-danger',
            {
              type: 'button',
              onclick: async () => {
                const ok = await S.ui.confirm('¿Borrar todo el progreso?', 'Esta acción no se puede deshacer en este dispositivo.', 'Borrar', true);
                if (!ok) return;
                S.store.reset();
                S.ui.toast('Progreso borrado.');
                S.ui.go('inicio');
              },
            },
            'Borrar progreso',
          ),
          sync.adapter === 'claude' ? h('p.tiny.muted', 'Con la sincronización activa, las respuestas ya guardadas en tu cuenta volverán a descargarse.') : null,
        ),
      ),
    );
  };
})(window.SolMed);
