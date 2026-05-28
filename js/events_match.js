// EVENTS — lineup matching review (local + SoundCloud candidates per name)
(function () {
  const E = window.scEvents;
  const { API, h, mount, mountInto, authedFetch, MONO_LABEL, topBar, state } = E;

  async function runMatchPipeline(names) {
    const matchesSlot = h('div', null, `Matching ${names.length} artist${names.length === 1 ? '' : 's'}…`);
    mount(h('div', null, [
      topBar('MATCH LINEUP — ' + state.draft.name, E.renderForm),
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
        class: 'btn-red', type: 'button', disabled: !allChosen,
        onClick: () => confirmAndSave(results, selections, confirmBtn),
      }, '{SAVE SUMMONS}');
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
        const r = await authedFetch(`${API}/api/artist-profiles/scrape`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: sel.payload.handle }),
        });
        const j = await r.json();
        if (!r.ok) { alert(`Scrape failed for ${sel.payload.handle}: ${j.error || r.status}`); btn.disabled = false; btn.textContent = '{SAVE SUMMONS}'; return; }
        apid = j.profile.id;
      } else if (sel.kind === 'manual') {
        const r = await authedFetch(`${API}/api/artist-profiles`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: results[i].name }),
        });
        const j = await r.json();
        if (!r.ok) { alert(`Manual stub failed for ${results[i].name}: ${j.error || r.status}`); btn.disabled = false; btn.textContent = '{SAVE SUMMONS}'; return; }
        apid = j.profile.id;
      }
      lineup.push({ artist_profile_id: apid, billing_position: i === 0 ? 'headliner' : 'support', billing_order: i });
    }
    await E.saveEvent(lineup);
  }

  E.runMatchPipeline = runMatchPipeline;
})();
