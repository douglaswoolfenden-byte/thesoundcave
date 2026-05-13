// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENTS — shared helpers + namespace
// Loaded FIRST so events_list / events_form / events_match / events_detail
// can read from `window.scEvents`. No build system — plain script tags.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function () {
  const API = (typeof localStorage !== 'undefined' && localStorage.getItem('sc_api_url')) || 'http://localhost:8000';
  const root = () => document.getElementById('eventsRoot');

  // ── tiny DOM builder ──────────────────────────────────
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'onClick') el.addEventListener('click', v);
        else if (k === 'onSubmit') el.addEventListener('submit', v);
        else if (k === 'onInput') el.addEventListener('input', v);
        else if (k === 'class') el.className = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    appendKids(el, children);
    return el;
  }

  function appendKids(el, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
      if (c == null || c === false) continue;
      if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
      else if (Array.isArray(c)) appendKids(el, c);
      else el.appendChild(c);
    }
  }

  function mount(node) {
    root().replaceChildren(node);
  }

  function mountInto(container, nodes) {
    container.replaceChildren();
    appendKids(container, nodes);
  }

  async function authedFetch(url, opts = {}) {
    if (!window.scAuth) return fetch(url, opts);
    return window.scAuth.authedFetch(url, opts);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return iso; }
  }

  function localDateTimeValue(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (_) { return ''; }
  }

  // ── shared styling tokens ──────────────────────────────
  const MONO_LABEL = { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--muted)' };
  const MONO_HEAD  = { fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' };

  function topBar(title, backFn) {
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' } }, [
      backFn ? h('button', { type: 'button', class: 'btn-outline', onClick: backFn }, '← BACK') : null,
      h('h2', { style: { ...MONO_HEAD, margin: 0 } }, title),
    ]);
  }

  function emptyCard(msg) {
    return h('div', { class: 'card', style: { textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' } }, msg);
  }

  function field(label, inputEl) {
    return h('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
      h('span', { style: MONO_LABEL }, label),
      inputEl,
    ]);
  }

  // Mutable shared state across the events modules (draft form, current view, etc.)
  const state = { draft: null };

  window.scEvents = {
    API, root, h, mount, mountInto, authedFetch,
    fmtDate, localDateTimeValue,
    MONO_LABEL, MONO_HEAD,
    topBar, emptyCard, field,
    state,
  };
})();
