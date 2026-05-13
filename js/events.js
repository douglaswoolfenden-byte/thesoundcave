// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENTS — Phase 2 list + new + match-review flow
// Spec: wiki/spec/phase_2_3_pivot.md
// API:  events_api.py, artist_profiles_api.py
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function () {
  const API = (typeof localStorage !== 'undefined' && localStorage.getItem('sc_api_url')) || 'http://localhost:8000';
  const root = () => document.getElementById('eventsRoot');
  let draft = null;

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
    const r = root();
    r.replaceChildren(node);
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

  // ── shared styling tokens (inline to stay self-contained) ─
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

  // ── FLYER DROP ZONE ───────────────────────────────────
  function renderDropZone() {
    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: { display: 'none' } });
    const status = h('div', { style: { fontSize: '11px', color: 'var(--muted)', marginTop: '6px' } }, '');
    const zone = h('div', {
      class: 'card',
      style: {
        marginBottom: '18px', padding: '20px 24px', textAlign: 'center',
        borderStyle: 'dashed', cursor: 'pointer',
      },
    }, [
      h('div', { style: { ...MONO_LABEL, marginBottom: '6px' } }, 'DROP A FLYER · AUTO-EXTRACT EVENT'),
      h('div', { style: { fontSize: '11px', color: 'var(--secondary)' } },
        'PNG / JPG / WEBP, up to 10MB. Or click to pick a file.'),
      status,
      fileInput,
    ]);
    zone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFlyer(fileInput.files[0], status, zone); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--red)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.borderColor = '';
      const f = e.dataTransfer.files[0];
      if (f) handleFlyer(f, status, zone);
    });
    return zone;
  }

  async function handleFlyer(file, statusEl, zoneEl) {
    statusEl.textContent = `Uploading ${file.name}… running vision extraction (10-20s)…`;
    zoneEl.style.pointerEvents = 'none';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await authedFetch(`${API}/api/events/extract-flyer`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) { statusEl.textContent = `Extraction failed: ${j.error || r.status}`; zoneEl.style.pointerEvents = ''; return; }
      const ex = j.extracted || {};
      draft = {
        name: ex.name || '',
        event_date: localDateTimeValue(ex.event_date),
        venue_name: ex.venue_name || '',
        venue_city: ex.venue_city || '',
        ticketing_url: ex.ticketing_url || '',
        voice_preset: 'professional',
        lineup_names: (ex.lineup || []).join('\n'),
        flyer_image_url: j.flyer_image_url,
      };
      renderForm();
    } catch (e) {
      statusEl.textContent = `Extraction failed: ${e.message}`;
      zoneEl.style.pointerEvents = '';
    }
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

  // ── LIST view ─────────────────────────────────────────
  async function renderList() {
    const newBtn = h('button', { type: 'button', class: 'btn-red', onClick: startNew }, '{NEW EVENT}');
    const headerRow = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' } }, [
      h('h2', { style: { ...MONO_HEAD, margin: 0 } }, 'EVENTS'),
      newBtn,
    ]);
    const dropZone = renderDropZone();
    const listSlot = h('div', null, 'Loading…');
    mount(h('div', null, [headerRow, dropZone, listSlot]));

    try {
      const r = await authedFetch(`${API}/api/events`);
      if (r.status === 401) { mountInto(listSlot, emptyCard('Sign in to view your events.')); return; }
      const j = await r.json();
      const events = j.events || [];
      const countEl = document.getElementById('eventsCount');
      if (countEl) countEl.textContent = events.length ? events.length : '';
      if (!events.length) { mountInto(listSlot, emptyCard('No events yet. Tap {NEW EVENT} to create your first.')); return; }
      mountInto(listSlot, renderEventCards(events));
    } catch (e) {
      mountInto(listSlot, emptyCard('Could not load events. Is the API running?'));
    }
  }

  function renderEventCards(events) {
    const now = new Date();
    const upcoming = events.filter(e => new Date(e.event_date) >= now);
    const past = events.filter(e => new Date(e.event_date) < now);

    const section = (label, list) => list.length ? h('div', { style: { marginBottom: '20px' } }, [
      h('div', { style: { ...MONO_LABEL, marginBottom: '8px' } }, label),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '12px' } },
        list.map(eventCard)),
    ]) : null;

    return [section('UPCOMING', upcoming), section('PAST', past)].filter(Boolean);
  }

  function eventCard(e) {
    return h('div', {
      class: 'card',
      style: { cursor: 'pointer' },
      onClick: () => window.openEvent(e.id),
    }, [
      h('div', { style: { ...MONO_LABEL, marginBottom: '6px' } }, e.status || 'draft'),
      h('div', { style: { fontSize: '15px', fontWeight: '600', marginBottom: '6px' } }, e.name),
      h('div', { style: { fontSize: '11px', color: 'var(--secondary)', marginBottom: '4px' } }, fmtDate(e.event_date)),
      e.venue_name ? h('div', { style: { fontSize: '11px', color: 'var(--muted)' } },
        e.venue_name + (e.venue_city ? ' · ' + e.venue_city : '')) : null,
    ]);
  }

  // ── NEW form ──────────────────────────────────────────
  function startNew() {
    draft = { name: '', event_date: '', venue_name: '', venue_city: '', ticketing_url: '', voice_preset: 'professional', lineup_names: '' };
    renderForm();
  }

  function field(label, inputEl) {
    return h('label', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
      h('span', { style: MONO_LABEL }, label),
      inputEl,
    ]);
  }

  function renderForm(error) {
    const inputs = {
      name:          h('input', { class: 'input', name: 'name', required: true, placeholder: 'e.g. Subterrain 003' }),
      event_date:    h('input', { class: 'input', type: 'datetime-local', name: 'event_date', required: true }),
      venue_name:    h('input', { class: 'input', name: 'venue_name', placeholder: 'e.g. The Cause' }),
      venue_city:    h('input', { class: 'input', name: 'venue_city', placeholder: 'London' }),
      ticketing_url: h('input', { class: 'input', type: 'url', name: 'ticketing_url', placeholder: 'https://...' }),
      voice_preset:  h('select', { class: 'input', name: 'voice_preset' }, [
        h('option', { value: 'professional' }, 'Professional — clean, restrained'),
        h('option', { value: 'underground' }, 'Underground — cryptic, scene-literate'),
        h('option', { value: 'high_energy' }, 'High energy — club, urgent'),
        h('option', { value: 'intimate' }, 'Intimate — warm, community'),
      ]),
      lineup_names:  h('textarea', { class: 'input', name: 'lineup_names', rows: 5, placeholder: 'LØSERWARE\nHatsumi Chan\n…' }),
    };
    inputs.name.value = draft.name;
    inputs.event_date.value = draft.event_date;
    inputs.venue_name.value = draft.venue_name;
    inputs.venue_city.value = draft.venue_city;
    inputs.ticketing_url.value = draft.ticketing_url;
    inputs.voice_preset.value = draft.voice_preset;
    inputs.lineup_names.value = draft.lineup_names;

    const form = h('form', {
      class: 'card',
      style: { display: 'flex', flexDirection: 'column', gap: '14px' },
      onSubmit: (e) => { e.preventDefault(); onFormSubmit(inputs); },
    }, [
      field('NAME', inputs.name),
      field('DATE & TIME', inputs.event_date),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' } }, [
        field('VENUE', inputs.venue_name),
        field('CITY', inputs.venue_city),
      ]),
      field('TICKETING LINK', inputs.ticketing_url),
      field('VOICE PRESET', inputs.voice_preset),
      field('LINEUP (ONE NAME PER LINE)', inputs.lineup_names),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
        h('button', { class: 'btn-red', type: 'submit' }, '{MATCH LINEUP →}'),
      ]),
    ]);

    mount(h('div', null, [
      topBar('NEW EVENT', renderList),
      error ? h('div', { class: 'card', style: { borderColor: 'var(--red)', color: 'var(--red)', marginBottom: '12px' } }, error) : null,
      form,
    ]));
  }

  function onFormSubmit(inputs) {
    draft = {
      name: inputs.name.value.trim(),
      event_date: inputs.event_date.value,
      venue_name: inputs.venue_name.value.trim(),
      venue_city: inputs.venue_city.value.trim(),
      ticketing_url: inputs.ticketing_url.value.trim(),
      voice_preset: inputs.voice_preset.value || 'professional',
      lineup_names: inputs.lineup_names.value,
    };
    if (!draft.name || !draft.event_date) { renderForm('Name and date are required.'); return; }
    const names = draft.lineup_names.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) { saveEvent([]); return; }
    runMatchPipeline(names);
  }

  // ── MATCH REVIEW view ─────────────────────────────────
  async function runMatchPipeline(names) {
    const matchesSlot = h('div', null, `Matching ${names.length} artist${names.length === 1 ? '' : 's'}…`);
    mount(h('div', null, [
      topBar('MATCH LINEUP — ' + draft.name, renderForm),
      matchesSlot,
    ]));

    const results = await Promise.all(names.map(async name => {
      try {
        const r = await authedFetch(`${API}/api/artist-profiles/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        return await r.json();
      } catch (e) { return { name, local: [], soundcloud: [], error: String(e) }; }
    }));

    const selections = results.map(r => {
      if (r.local && r.local.length === 1) return { kind: 'local', payload: r.local[0] };
      return { kind: null, payload: null };
    });

    function renderMatches() {
      const allChosen = selections.every(s => s.kind);
      const confirmBtn = h('button', {
        class: 'btn-red',
        type: 'button',
        disabled: !allChosen,
        onClick: () => confirmAndSave(results, selections, confirmBtn),
      }, '{SAVE EVENT}');

      const blocks = results.map((r, idx) => renderRow(r, idx, selections, renderMatches));
      mountInto(matchesSlot, [
        ...blocks,
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' } }, confirmBtn),
      ]);
    }
    renderMatches();
  }

  function pickerCard(label, picked, body, onPick) {
    return h('div', {
      class: 'card',
      style: { borderColor: picked ? 'var(--red)' : 'var(--border)', cursor: 'pointer', padding: '10px 12px' },
      onClick: onPick,
    }, [
      h('div', {
        style: {
          fontFamily: 'var(--font-mono)', fontSize: '9px',
          color: picked ? 'var(--red)' : 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', marginBottom: '4px',
        },
      }, label + (picked ? ' · SELECTED' : '')),
      body,
    ]);
  }

  function profileLine(name, sub) {
    return h('div', null, [
      h('div', { style: { fontSize: '13px', fontWeight: '600' } }, name),
      h('div', { style: { fontSize: '10px', color: 'var(--muted)' } }, sub),
    ]);
  }

  function renderRow(r, idx, selections, redraw) {
    const sel = selections[idx];
    const pick = (kind, payload) => { selections[idx] = { kind, payload }; redraw(); };
    const cards = [];

    (r.local || []).forEach(p => {
      const picked = sel.kind === 'local' && sel.payload && sel.payload.id === p.id;
      const body = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        p.hero_image_url ? h('img', { src: p.hero_image_url, style: { width: '36px', height: '36px', borderRadius: '2px', objectFit: 'cover' } }) : null,
        profileLine(p.display_name, `${p.soundcloud_handle || ''} · ${(p.follower_count_soundcloud || 0).toLocaleString()} followers`),
      ]);
      cards.push(pickerCard('LOCAL PROFILE', picked, body, () => pick('local', p)));
    });

    (r.soundcloud || []).forEach(c => {
      const picked = sel.kind === 'sc' && sel.payload && sel.payload.soundcloud_id === c.soundcloud_id;
      const right = h('div', { style: { flex: 1 } }, [
        h('div', { style: { fontSize: '13px', fontWeight: '600' } }, c.username || ''),
        h('div', { style: { fontSize: '10px', color: 'var(--muted)' } },
          `${c.handle || ''} · ${(c.followers_count || 0).toLocaleString()} followers${c.city ? ' · ' + c.city : ''}`),
        c.top_track ? h('div', { style: { fontSize: '10px', color: 'var(--secondary)', marginTop: '2px' } }, '▶ ' + c.top_track.title) : null,
      ]);
      const body = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        c.avatar_url ? h('img', { src: c.avatar_url, style: { width: '36px', height: '36px', borderRadius: '2px', objectFit: 'cover' } }) : null,
        right,
      ]);
      cards.push(pickerCard('SOUNDCLOUD', picked, body, () => pick('sc', c)));
    });

    cards.push(pickerCard('CREATE MANUAL STUB', sel.kind === 'manual',
      h('div', { style: { fontSize: '11px', color: 'var(--secondary)' } }, `No SoundCloud — create a name-only stub for "${r.name}".`),
      () => pick('manual', null)));

    cards.push(pickerCard('SKIP', sel.kind === 'skip',
      h('div', { style: { fontSize: '11px', color: 'var(--muted)' } }, `Drop "${r.name}" from the lineup.`),
      () => pick('skip', null)));

    return h('div', { style: { marginBottom: '18px' } }, [
      h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', marginBottom: '8px' } }, r.name),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '10px' } }, cards),
    ]);
  }

  async function confirmAndSave(results, selections, btn) {
    btn.disabled = true; btn.textContent = '{SAVING…}';
    const lineup = [];
    for (let i = 0; i < selections.length; i++) {
      const sel = selections[i];
      if (sel.kind === 'skip') continue;
      let apid = null;
      if (sel.kind === 'local') apid = sel.payload.id;
      else if (sel.kind === 'sc') {
        const handle = sel.payload.handle;
        const r = await authedFetch(`${API}/api/artist-profiles/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle }),
        });
        const j = await r.json();
        if (!r.ok) { alert(`Scrape failed for ${handle}: ${j.error || r.status}`); btn.disabled = false; btn.textContent = '{SAVE EVENT}'; return; }
        apid = j.profile.id;
      } else if (sel.kind === 'manual') {
        const r = await authedFetch(`${API}/api/artist-profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: results[i].name }),
        });
        const j = await r.json();
        if (!r.ok) { alert(`Manual stub failed for ${results[i].name}: ${j.error || r.status}`); btn.disabled = false; btn.textContent = '{SAVE EVENT}'; return; }
        apid = j.profile.id;
      }
      lineup.push({ artist_profile_id: apid, billing_position: i === 0 ? 'headliner' : 'support', billing_order: i });
    }
    await saveEvent(lineup);
  }

  async function saveEvent(lineup) {
    const payload = {
      name: draft.name,
      event_date: new Date(draft.event_date).toISOString(),
      venue_name: draft.venue_name || null,
      venue_city: draft.venue_city || null,
      ticketing_url: draft.ticketing_url || null,
      flyer_image_url: draft.flyer_image_url || null,
      voice_preset: draft.voice_preset,
      lineup,
    };
    try {
      const r = await authedFetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { renderForm(j.error || `Save failed (${r.status})`); return; }
      draft = null;
      window.openEvent(j.event.id);
    } catch (e) {
      renderForm(`Save failed: ${e.message}`);
    }
  }

  // ── EVENT DETAIL view (stub; richer view lands Day 5) ─
  window.openEvent = async function (id) {
    mount(h('div', { class: 'card' }, 'Loading event…'));
    try {
      const r = await authedFetch(`${API}/api/events/${id}`);
      const j = await r.json();
      if (!r.ok) { mount(h('div', { class: 'card' }, j.error || 'Not found')); return; }
      const e = j.event;
      const lineupCards = (e.lineup || []).map(s => {
        const p = s.artist_profiles || {};
        return h('div', { class: 'card', style: { padding: '10px 12px' } }, [
          h('div', { style: { ...MONO_LABEL, fontSize: '9px', marginBottom: '4px' } }, s.billing_position),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
            p.hero_image_url ? h('img', { src: p.hero_image_url, style: { width: '32px', height: '32px', borderRadius: '2px', objectFit: 'cover' } }) : null,
            h('div', null, [
              h('div', { style: { fontSize: '13px', fontWeight: '600' } }, p.display_name || s.artist_profile_id),
              p.soundcloud_handle ? h('div', { style: { fontSize: '10px', color: 'var(--muted)' } },
                `${p.soundcloud_handle} · ${(p.follower_count_soundcloud || 0).toLocaleString()} followers`) : null,
            ]),
          ]),
        ]);
      });
      mount(h('div', null, [
        topBar(e.name, renderList),
        h('div', { class: 'card', style: { marginBottom: '14px' } }, [
          h('div', { style: { ...MONO_LABEL, marginBottom: '4px' } }, `${e.status} · ${e.voice_preset}`),
          h('div', { style: { fontSize: '13px', marginBottom: '6px' } }, fmtDate(e.event_date)),
          e.venue_name ? h('div', { style: { fontSize: '12px', color: 'var(--secondary)' } },
            e.venue_name + (e.venue_city ? ' · ' + e.venue_city : '')) : null,
          e.ticketing_url ? h('div', { style: { fontSize: '11px', marginTop: '6px' } }, [
            h('a', { href: e.ticketing_url, target: '_blank', style: { color: 'var(--red)' } }, 'Tickets ↗'),
          ]) : null,
        ]),
        h('div', { style: { ...MONO_LABEL, marginBottom: '8px' } }, 'LINEUP'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '10px', marginBottom: '18px' } },
          lineupCards.length ? lineupCards : h('div', { style: { color: 'var(--muted)', fontSize: '12px' } }, 'No lineup linked yet.')),
        h('div', { class: 'card', style: { textAlign: 'center', padding: '32px 24px' } }, [
          h('div', { style: { fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' } }, 'Campaign generation arrives in Phase 3.'),
          h('button', { class: 'btn-red', type: 'button', disabled: true }, '{GENERATE CAMPAIGN}'),
        ]),
      ]));
    } catch (e) {
      mount(h('div', { class: 'card' }, 'Could not load event.'));
    }
  };

  window.renderEvents = renderList;
})();
