/* Utilidades de interfaz: creación de nodos, iconos, avisos y diálogos. */
(function (S) {
  'use strict';
  const U = S.util;

  /** h('div.card#id', {onclick, attrs…}, ...hijos) */
  function h(tag, props, ...kids) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
    const el = document.createElement(m[1] || 'div');
    const rest = m[2] || '';
    rest.replace(/([.#])([\w-]+)/g, (_, t, v) => {
      if (t === '.') el.classList.add(v);
      else el.id = v;
      return '';
    });
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
      kids.unshift(props);
      props = null;
    }
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k in el && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, kids);
    return el;
  }

  function append(el, kids) {
    for (const k of kids) {
      if (k === null || k === undefined || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }

  /** Nodo con marcado mínimo del contenido médico (**negrita**). */
  function rich(tag, text, props) {
    return h(tag, Object.assign({ html: U.rich(text) }, props || {}));
  }

  // Iconografía médica minimalista (trazos de 24 px).
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    case: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path d="M12 11v5M9.5 13.5h5"/>',
    steps: '<path d="M4 18h5v-5h5V8h6"/><circle cx="20" cy="8" r="1.4"/>',
    brain: '<path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3h1V4z"/><path d="M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3h-1V4z"/>',
    flask: '<path d="M9 3h6M10 3v6l-5.5 9.2A2 2 0 006.2 21h11.6a2 2 0 001.7-2.8L14 9V3"/><path d="M7.5 15h9"/>',
    ruler: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z"/><path d="M4 19a2 2 0 012-2h13"/>',
    exam: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    repeat: '<path d="M4 12a8 8 0 0114-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 01-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    map: '<path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2z"/><path d="M9 4v14M15 6v14"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    compare: '<path d="M7 4v16M17 4v16"/><path d="M3 8h8M13 16h8"/>',
    source: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 6.5l2 1.2M17.8 16.3l2 1.2M4.2 17.5l2-1.2M17.8 7.7l2-1.2"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    pearl: '<path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.6-.8z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/><path d="M8.5 11h2l1-2 1.5 4 1-2h1.5"/>',
    drop: '<path d="M12 3s6 6.4 6 11a6 6 0 01-12 0c0-4.6 6-11 6-11z"/>',
    cloud: '<path d="M7 18a4 4 0 01-.5-8A6 6 0 0118 9a4.5 4.5 0 01-.5 9z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5"/><path d="M5 4h14"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    shield: '<path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  };

  function icon(name, cls) {
    const span = document.createElement('span');
    span.innerHTML =
      '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    return span.firstChild;
  }

  let logoN = 0;
  function logo(size) {
    const gid = 'solg' + ++logoN;
    const span = document.createElement('span');
    span.innerHTML =
      '<svg class="brand-mark" width="' +
      (size || 30) +
      '" height="' +
      (size || 30) +
      '" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E57AAE"/><stop offset="1" stop-color="#8E5CCB"/></linearGradient></defs>' +
      '<rect x="2" y="2" width="60" height="60" rx="18" fill="url(#' + gid + ')"/>' +
      '<g stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none"><circle cx="32" cy="32" r="9"/>' +
      '<path d="M32 12v5M32 47v5M12 32h5M47 32h5M17.9 17.9l3.5 3.5M42.6 42.6l3.5 3.5M17.9 46.1l3.5-3.5M42.6 21.4l3.5-3.5"/></g>' +
      '<path d="M26 32h3l1.5-3 3 6 1.5-3h3" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    return span.firstChild;
  }

  // ---- Avisos ----
  let toastBox = null;
  function toast(msg, kind, ms) {
    if (!toastBox) {
      toastBox = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastBox);
    }
    const t = h('div.toast' + (kind ? '.' + kind : ''), msg);
    toastBox.appendChild(t);
    setTimeout(() => t.remove(), ms || 3800);
  }

  // ---- Diálogo de confirmación dentro de la página ----
  function dialog(opts) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const close = (v) => {
        back.remove();
        document.removeEventListener('keydown', onKey);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') close(null);
      };
      const buttons = (opts.buttons || [{ label: 'Aceptar', value: true, primary: true }]).map((b) =>
        h(
          'button.btn' + (b.primary ? '.btn-primary' : b.danger ? '.btn-danger' : ''),
          { type: 'button', onclick: () => close(b.value) },
          b.label,
        ),
      );
      const modal = h(
        'div.modal',
        { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Confirmación' },
        opts.title ? h('h2', opts.title) : null,
        opts.body ? (opts.body instanceof Node ? opts.body : h('p', opts.body)) : null,
        h('div.actions', buttons),
      );
      const back = h('div.modal-back', { onclick: (e) => e.target === back && close(null) }, modal);
      document.body.appendChild(back);
      document.addEventListener('keydown', onKey);
      const focusBtn = modal.querySelector('.btn-primary') || modal.querySelector('button');
      if (focusBtn) focusBtn.focus();
    });
  }

  function confirmDialog(title, body, okLabel, danger) {
    return dialog({
      title,
      body,
      buttons: [
        { label: 'Cancelar', value: false },
        { label: okLabel || 'Aceptar', value: true, primary: !danger, danger: !!danger },
      ],
    });
  }

  // ---- Piezas reutilizables ----
  function pageHead(title, sub, backTo) {
    return h(
      'header.page-head',
      backTo ? h('button.back', { type: 'button', onclick: () => S.ui.go(backTo) }, icon('back'), 'Volver') : null,
      h('h1', title),
      sub ? h('p', sub) : null,
    );
  }

  function masteryBar(m, n) {
    const lab = S.engine.masteryLabel(m, n);
    return h('div.bar.state-' + lab.id, { role: 'img', 'aria-label': 'Dominio ' + U.pct(m) + ' %' }, h('span', { style: { width: U.pct(m) + '%' } }));
  }

  function stateChip(m, n) {
    const lab = S.engine.masteryLabel(m, n);
    const cls = { new: '', weak: 'bad', progress: 'warn', good: 'violet', mastered: 'ok' }[lab.id];
    return h('span.chip' + (cls ? '.' + cls : ''), lab.label);
  }

  function seg(options, value, onChange, label) {
    const box = h('div.seg', { role: 'group', 'aria-label': label || '' });
    const render = (val) => {
      box.innerHTML = '';
      for (const o of options) {
        box.appendChild(
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': String(o.value === val),
              onclick: () => {
                render(o.value);
                onChange(o.value);
              },
            },
            o.label,
          ),
        );
      }
    };
    render(value);
    return box;
  }

  function checks(options, selected, onChange) {
    const sel = new Set(selected);
    const box = h('div.checklist');
    for (const o of options) {
      const b = h(
        'button.check',
        {
          type: 'button',
          'aria-pressed': String(sel.has(o.value)),
          onclick: () => {
            if (sel.has(o.value)) sel.delete(o.value);
            else sel.add(o.value);
            b.setAttribute('aria-pressed', String(sel.has(o.value)));
            onChange(Array.from(sel));
          },
        },
        o.label,
      );
      box.appendChild(b);
    }
    return box;
  }

  function labTable(labs, opts) {
    opts = opts || {};
    const R = S.registry;
    const rows = labs.map((l) => R.labRow(l));
    const t = h(
      'table.labs',
      h(
        'thead',
        h('tr', h('th', 'Parámetro'), h('th', 'Resultado'), opts.showRef === false ? null : h('th', 'Referencia'), opts.flagCell ? h('th', opts.flagHead || '') : null),
      ),
      h(
        'tbody',
        rows.map((r, i) =>
          h(
            'tr',
            h('td', r.name),
            h(
              'td.v',
              typeof r.value === 'number' ? U.num(r.value) : r.value,
              r.unit ? ' ' + r.unit : '',
              opts.showFlags ? [' ', h('span.flag.' + r.flag, { title: { H: 'Alto', L: 'Bajo', N: 'Normal' }[r.flag] }, { H: '↑', L: '↓', N: '·' }[r.flag])] : null,
            ),
            opts.showRef === false ? null : h('td.ref', r.ref ? r.ref + (r.unit && r.known ? ' ' + r.unit : '') : ''),
            opts.flagCell ? h('td.flagcell', opts.flagCell(r, i)) : null,
          ),
        ),
      ),
    );
    return h('div.labs-wrap', t);
  }

  function vitalsGrid(v) {
    const names = { PA: 'PA', FC: 'FC', FR: 'FR', T: 'Temp.', SatO2: 'SatO₂', GCS: 'Glasgow', peso: 'Peso', glucemia: 'Glucemia capilar' };
    return h(
      'div.vitals',
      Object.keys(v).map((k) => h('div.vital', h('div.k', names[k] || k), h('div.v', v[k]))),
    );
  }

  S.ui.h = h;
  S.ui.rich = rich;
  S.ui.icon = icon;
  S.ui.logo = logo;
  S.ui.toast = toast;
  S.ui.dialog = dialog;
  S.ui.confirm = confirmDialog;
  S.ui.pageHead = pageHead;
  S.ui.masteryBar = masteryBar;
  S.ui.stateChip = stateChip;
  S.ui.seg = seg;
  S.ui.checks = checks;
  S.ui.labTable = labTable;
  S.ui.vitalsGrid = vitalsGrid;
})(window.SolMed);
