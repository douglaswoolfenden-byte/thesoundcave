// EVENTS — new + edit form (POST /api/events or PATCH /api/events/<id>)
(function () {
  const E = window.scEvents;
  const { API, h, mount, authedFetch, MONO_LABEL, topBar, field, state } = E;

  function startNew() {
    state.draft = {
      name: '', event_date: '', venue_name: '', venue_city: '',
      ticketing_url: '', voice_preset: 'professional', lineup_names: '',
      editing_id: null,
    };
    renderForm();
  }

  async function startEdit(eventId) {
    mount(h('div', { class: 'card' }, 'Loading…'));
    try {
      const r = await authedFetch(`${API}/api/events/${eventId}`);
      const j = await r.json();
      if (!r.ok) { mount(h('div', { class: 'card' }, j.error || 'Not found')); return; }
      const e = j.event;
      state.draft = {
        name: e.name || '',
        event_date: E.localDateTimeValue(e.event_date),
        venue_name: e.venue_name || '',
        venue_city: e.venue_city || '',
        ticketing_url: e.ticketing_url || '',
        voice_preset: e.voice_preset || 'professional',
        lineup_names: '',  // lineup edit is its own UX, deferred
        editing_id: eventId,
      };
      renderForm();
    } catch (err) {
      mount(h('div', { class: 'card' }, 'Could not load gathering for editing.'));
    }
  }

  function renderForm(error) {
    const draft = state.draft;
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
      draft.editing_id ? renderFlyerField(draft) : null,
      draft.editing_id ? renderBrandReferencesField() : null,
      draft.editing_id ? null : field('LINEUP (ONE NAME PER LINE)', inputs.lineup_names),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
        h('button', { class: 'btn-red', type: 'submit' }, draft.editing_id ? '{SAVE CHANGES}' : '{MATCH LINEUP →}'),
      ]),
    ]);

    mount(h('div', null, [
      topBar(draft.editing_id ? 'EDIT GATHERING' : 'NEW GATHERING',
        draft.editing_id ? (() => window.openEvent(draft.editing_id)) : E.renderList),
      error ? h('div', { class: 'card', style: { borderColor: 'var(--red)', color: 'var(--red)', marginBottom: '12px' } }, error) : null,
      form,
    ]));
  }

  function onFormSubmit(inputs) {
    const editingId = state.draft.editing_id;
    state.draft = {
      name: inputs.name.value.trim(),
      event_date: inputs.event_date.value,
      venue_name: inputs.venue_name.value.trim(),
      venue_city: inputs.venue_city.value.trim(),
      ticketing_url: inputs.ticketing_url.value.trim(),
      voice_preset: inputs.voice_preset.value || 'professional',
      lineup_names: inputs.lineup_names.value,
      editing_id: editingId,
      flyer_image_url: state.draft.flyer_image_url || null,
    };
    if (!state.draft.name || !state.draft.event_date) { renderForm('Name and date are required.'); return; }
    if (editingId) { savePatch(editingId); return; }
    const names = state.draft.lineup_names.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) { saveEvent([]); return; }
    E.runMatchPipeline(names);
  }

  async function saveEvent(lineup) {
    const draft = state.draft;
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { renderForm(j.error || `Save failed (${r.status})`); return; }
      state.draft = null;
      window.openEvent(j.event.id);
    } catch (e) {
      renderForm(`Save failed: ${e.message}`);
    }
  }

  async function savePatch(eventId) {
    const draft = state.draft;
    const payload = {
      name: draft.name,
      event_date: new Date(draft.event_date).toISOString(),
      venue_name: draft.venue_name || null,
      venue_city: draft.venue_city || null,
      ticketing_url: draft.ticketing_url || null,
      voice_preset: draft.voice_preset,
    };
    try {
      const r = await authedFetch(`${API}/api/events/${eventId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { renderForm(j.error || `Save failed (${r.status})`); return; }
      state.draft = null;
      window.openEvent(eventId);
    } catch (e) {
      renderForm(`Save failed: ${e.message}`);
    }
  }

  function renderFlyerField(draft) {
    const currentUrl = draft.flyer_image_url || null;
    const status = h('div', { style: { fontSize: '10px', color: 'var(--muted)', marginTop: '6px' } }, '');
    const thumb = currentUrl
      ? h('img', { src: currentUrl, style: { width: '120px', height: '150px', objectFit: 'cover', borderRadius: '2px' } })
      : h('div', {
          style: { width: '120px', height: '150px', background: 'var(--elevated)', border: '1px dashed var(--border)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--muted)', textAlign: 'center', padding: '0 8px' },
        }, 'NO MEDIA YET');

    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: { display: 'none' } });
    const btn = h('button', { type: 'button', class: 'btn-outline' }, currentUrl ? '{REPLACE MEDIA}' : '{UPLOAD MEDIA}');
    btn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      btn.disabled = true; stashBtn.disabled = true; btn.textContent = '{UPLOADING…}';
      status.textContent = '';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const r = await E.authedFetch(`${API}/api/events/${draft.editing_id}/flyer`, { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) { status.textContent = j.error || `Upload failed (${r.status})`; btn.disabled = false; stashBtn.disabled = false; btn.textContent = currentUrl ? '{REPLACE MEDIA}' : '{UPLOAD MEDIA}'; return; }
        state.draft.flyer_image_url = j.flyer_image_url;
        renderForm();
      } catch (e) {
        status.textContent = `Upload failed: ${e.message}`;
        btn.disabled = false; stashBtn.disabled = false; btn.textContent = currentUrl ? '{REPLACE MEDIA}' : '{UPLOAD MEDIA}';
      }
    });

    const stashBtn = h('button', { type: 'button', class: 'forge-stash-btn', style: { display: 'block', width: '100%', marginTop: '4px', padding: '8px 12px' } }, '↓ FROM STASH — use existing artwork');
    stashBtn.addEventListener('click', () => {
      if (typeof openStashPicker !== 'function') { status.textContent = 'Stash picker not available.'; return; }
      openStashPicker(async item => {
        btn.disabled = true; stashBtn.disabled = true;
        status.textContent = 'Loading from Stash…';
        try {
          const pr = await E.authedFetch(`${API}/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}`);
          const pj = await pr.json().catch(() => ({}));
          if (!pr.ok || !pj.data) throw new Error(pj.error || `proxy ${pr.status}`);
          const res = await fetch(pj.data);
          const blob = await res.blob();
          const fd = new FormData();
          fd.append('file', blob, 'stash-image.jpg');
          const r = await E.authedFetch(`${API}/api/events/${draft.editing_id}/flyer`, { method: 'POST', body: fd });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || `Upload failed (${r.status})`);
          state.draft.flyer_image_url = j.flyer_image_url;
          renderForm();
        } catch (e) {
          status.textContent = `Failed: ${e.message}`;
          btn.disabled = false; stashBtn.disabled = false;
        }
      });
    });

    return h('label', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
      h('span', { style: E.MONO_LABEL }, 'MEDIA'),
      h('div', { style: { display: 'flex', gap: '14px', alignItems: 'flex-start' } }, [
        thumb,
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
          btn,
          stashBtn,
          fileInput,
          h('div', { style: { fontSize: '10px', color: 'var(--muted)' } }, 'PNG / JPG / WEBP, up to 10MB. Inspires generated post imagery — your brand language carries across all posts.'),
          status,
        ]),
      ]),
    ]);
  }

  // ── Brand references library ────────────────────────────
  // Manages the user's PRIMARY brand kit references. For v0.6 we expose
  // this on the event edit form because it's where Doug needs them while
  // setting up a campaign. Proper per-kit UI lands in the Brands tab in v0.7.
  let _primaryKit = null;

  function renderBrandReferencesField() {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    const labelRow = h('span', { style: E.MONO_LABEL }, 'BRAND REFERENCES · STYLE DNA ACROSS ALL GATHERINGS');
    const body = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, 'Loading kit…');
    const helper = h('div', { style: { fontSize: '10px', color: 'var(--muted)' } },
      'Upload past flyers / promotional pieces to anchor your visual style. Each new gathering campaign pulls from these.');
    wrap.appendChild(labelRow);
    wrap.appendChild(body);
    wrap.appendChild(helper);
    loadPrimaryKitInto(body, helper);
    return wrap;
  }

  async function loadPrimaryKitInto(body, helper) {
    try {
      const r = await E.authedFetch(`${API}/api/brand_kits`);
      const j = (await r.json()) || {};
      const list = Array.isArray(j) ? j : (j.kits || []);
      _primaryKit = list.find(k => k.is_primary) || list[0] || null;
      if (!_primaryKit) {
        body.replaceChildren(h('div', { style: { fontSize: '11px', color: 'var(--muted)' } },
          'No brand kit yet. Create one from the BRANDS tab first.'));
        return;
      }
      paintReferences(body, helper);
    } catch (e) {
      body.replaceChildren(h('div', { style: { fontSize: '11px', color: 'var(--red)' } }, `Could not load brand kit: ${e.message}`));
    }
  }

  function paintReferences(body, helper) {
    const refs = _primaryKit.reference_image_urls || [];
    const tiles = refs.map(url => h('div', {
      style: { position: 'relative', width: '88px', height: '88px', borderRadius: '2px', overflow: 'hidden' },
    }, [
      h('img', { src: url, style: { width: '100%', height: '100%', objectFit: 'cover' } }),
      h('button', {
        type: 'button',
        style: { position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: '10px' },
        onClick: () => removeReference(url, body, helper),
      }, '✕'),
    ]));

    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, style: { display: 'none' } });
    const plusTile = h('div', {
      style: { width: '88px', height: '88px', border: '1px dashed var(--border)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', color: 'var(--muted)' },
      onClick: () => fileInput.click(),
    }, '+');
    fileInput.addEventListener('change', () => uploadReferences(fileInput.files, body, helper));

    body.replaceChildren(...tiles, plusTile, fileInput);
    helper.textContent = refs.length
      ? `${refs.length} reference${refs.length === 1 ? '' : 's'} in "${_primaryKit.name}" kit. Each new campaign pulls from these.`
      : `No references yet in "${_primaryKit.name}" kit. Upload past flyers to anchor your visual style.`;
  }

  async function uploadReferences(files, body, helper) {
    if (!files || !files.length || !_primaryKit) return;
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    helper.textContent = `Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`;
    try {
      const r = await E.authedFetch(`${API}/api/brand_kits/${_primaryKit.id}/references`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) { helper.textContent = `Upload failed: ${j.error || r.status}`; return; }
      _primaryKit.reference_image_urls = j.reference_image_urls;
      paintReferences(body, helper);
      if ((j.skipped || []).length) {
        helper.textContent += ` · skipped ${j.skipped.length} (${j.skipped[0].reason})`;
      }
    } catch (e) {
      helper.textContent = `Upload failed: ${e.message}`;
    }
  }

  async function removeReference(url, body, helper) {
    if (!_primaryKit) return;
    try {
      const r = await E.authedFetch(`${API}/api/brand_kits/${_primaryKit.id}/references`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const j = await r.json();
      if (!r.ok) { helper.textContent = `Remove failed: ${j.error || r.status}`; return; }
      _primaryKit.reference_image_urls = j.reference_image_urls;
      paintReferences(body, helper);
    } catch (e) {
      helper.textContent = `Remove failed: ${e.message}`;
    }
  }

  E.startNew = startNew;
  E.startEdit = startEdit;
  E.renderForm = renderForm;
  E.saveEvent = saveEvent;
  window.editEvent = startEdit;
})();
