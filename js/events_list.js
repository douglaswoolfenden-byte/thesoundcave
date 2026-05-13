// EVENTS — list view + flyer drop zone
(function () {
  const E = window.scEvents;
  const { API, h, mount, mountInto, authedFetch, fmtDate, MONO_LABEL, MONO_HEAD, emptyCard } = E;

  async function renderList() {
    const newBtn = h('button', { type: 'button', class: 'btn-red', onClick: E.startNew }, '{NEW EVENT}');
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
      E.state.draft = {
        name: ex.name || '',
        event_date: E.localDateTimeValue(ex.event_date),
        venue_name: ex.venue_name || '',
        venue_city: ex.venue_city || '',
        ticketing_url: ex.ticketing_url || '',
        voice_preset: 'professional',
        lineup_names: (ex.lineup || []).join('\n'),
        flyer_image_url: j.flyer_image_url,
        editing_id: null,
      };
      E.renderForm();
    } catch (e) {
      statusEl.textContent = `Extraction failed: ${e.message}`;
      zoneEl.style.pointerEvents = '';
    }
  }

  E.renderList = renderList;
  window.renderEvents = renderList;
})();
