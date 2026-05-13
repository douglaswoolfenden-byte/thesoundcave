// EVENTS — single-event detail view + campaign timeline
(function () {
  const E = window.scEvents;
  const { API, h, mount, authedFetch, fmtDate, MONO_LABEL, MONO_HEAD } = E;

  window.openEvent = async function (id) {
    mount(h('div', { class: 'card' }, 'Loading event…'));
    try {
      const [evResp, campResp] = await Promise.all([
        authedFetch(`${API}/api/events/${id}`),
        authedFetch(`${API}/api/events/${id}/campaign`),
      ]);
      const evJson = await evResp.json();
      if (!evResp.ok) { mount(h('div', { class: 'card' }, evJson.error || 'Not found')); return; }
      const campJson = campResp.ok ? await campResp.json() : { campaign: null, posts: [] };
      renderEventDetail(evJson.event, campJson.campaign, campJson.posts);
    } catch (e) {
      mount(h('div', { class: 'card' }, 'Could not load event.'));
    }
  };

  function renderEventDetail(e, campaign, posts) {
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

    const topRow = h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' } }, [
      h('button', { type: 'button', class: 'btn-outline', onClick: E.renderList }, '← BACK'),
      h('h2', { style: { ...MONO_HEAD, margin: 0, flex: 1 } }, e.name),
      h('button', { type: 'button', class: 'btn-outline', onClick: () => E.startEdit(e.id) }, '{EDIT}'),
    ]);

    mount(h('div', null, [
      topRow,
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
      renderCampaignSection(e, campaign, posts),
    ]));
  }

  function renderCampaignSection(event, campaign, posts) {
    if (!campaign) {
      return h('div', { class: 'card', style: { textAlign: 'center', padding: '32px 24px' } }, [
        h('div', { style: { fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' } },
          'No campaign yet. Generation runs your event through Claude per post type (15–30s).'),
        h('button', {
          class: 'btn-red', type: 'button',
          onClick: (ev) => triggerGenerate(event.id, ev.target, false),
        }, '{GENERATE CAMPAIGN}'),
      ]);
    }
    const heading = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } }, [
      h('div', { style: MONO_LABEL }, `CAMPAIGN · ${campaign.status}${posts.length ? ' · ' + posts.length + ' posts' : ''}`),
      h('button', {
        class: 'btn-outline', type: 'button',
        onClick: (ev) => triggerGenerate(event.id, ev.target, true),
      }, '{REGENERATE}'),
    ]);
    if (campaign.generation_error) {
      return h('div', null, [
        heading,
        h('div', { class: 'card', style: { borderColor: 'var(--red)', color: 'var(--red)', marginBottom: '10px', fontSize: '11px' } }, campaign.generation_error),
        renderTimeline(posts),
      ]);
    }
    return h('div', null, [heading, renderTimeline(posts)]);
  }

  function renderTimeline(posts) {
    if (!posts.length) return h('div', { class: 'card', style: { color: 'var(--muted)', fontSize: '12px' } }, 'No posts in this campaign.');
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, posts.map(postCard));
  }

  function postCard(p) {
    const selectedVariant = (p.copy_variants || []).find(v => v.id === p.selected_copy_variant_id) || (p.copy_variants || [])[0];
    const preview = selectedVariant ? selectedVariant.text : (p.generation_error ? '⚠ ' + p.generation_error : '(no copy yet)');
    return h('div', { class: 'card', style: { padding: '12px 14px' } }, [
      h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' } }, [
        h('div', { style: { ...MONO_LABEL, color: 'var(--red)' } }, p.post_type.replace(/_/g, ' ')),
        h('div', { style: { ...MONO_LABEL, fontSize: '9px' } }, fmtDate(p.scheduled_for)),
      ]),
      h('div', { style: { fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: selectedVariant ? 'var(--body)' : 'var(--muted)' } }, preview),
      (p.copy_variants || []).length > 1 ? h('div', { style: { fontSize: '10px', color: 'var(--muted)', marginTop: '6px' } }, `${p.copy_variants.length} variants`) : null,
    ]);
  }

  async function triggerGenerate(eventId, buttonEl, regenerate) {
    if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = '{GENERATING… ~30s}'; }
    try {
      const r = await authedFetch(`${API}/api/events/${eventId}/generate-campaign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || `Generation failed (${r.status})`); if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = regenerate ? '{REGENERATE}' : '{GENERATE CAMPAIGN}'; } return; }
      window.openEvent(eventId);
    } catch (e) {
      alert(`Generation failed: ${e.message}`);
      if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = regenerate ? '{REGENERATE}' : '{GENERATE CAMPAIGN}'; }
    }
  }
})();
