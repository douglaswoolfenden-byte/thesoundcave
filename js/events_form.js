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
      mount(h('div', { class: 'card' }, 'Could not load event for editing.'));
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
      draft.editing_id ? null : field('LINEUP (ONE NAME PER LINE)', inputs.lineup_names),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
        h('button', { class: 'btn-red', type: 'submit' }, draft.editing_id ? '{SAVE CHANGES}' : '{MATCH LINEUP →}'),
      ]),
    ]);

    mount(h('div', null, [
      topBar(draft.editing_id ? 'EDIT EVENT' : 'NEW EVENT',
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

  E.startNew = startNew;
  E.startEdit = startEdit;
  E.renderForm = renderForm;
  E.saveEvent = saveEvent;
  window.editEvent = startEdit;
})();
