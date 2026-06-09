// EVENTS — single-event detail view + campaign timeline
(function () {
  const E = window.scEvents;
  const { API, h, mount, authedFetch, fmtDate, MONO_LABEL, MONO_HEAD } = E;

  window.openEvent = async function (id) {
    mount(h('div', { class: 'card' }, 'Loading gathering…'));
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
      mount(h('div', { class: 'card' }, 'Could not load gathering.'));
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

    const metaCard = h('div', { class: 'card', style: { flex: 1, marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }, [
      h('div', { style: { ...MONO_LABEL, marginBottom: '4px' } }, `${e.status} · ${e.voice_preset}`),
      h('div', { style: { fontSize: '13px', marginBottom: '6px' } }, fmtDate(e.event_date)),
      e.venue_name ? h('div', { style: { fontSize: '12px', color: 'var(--secondary)' } },
        e.venue_name + (e.venue_city ? ' · ' + e.venue_city : '')) : null,
      e.ticketing_url ? h('div', { style: { fontSize: '11px', marginTop: '6px' } }, [
        h('a', { href: e.ticketing_url, target: '_blank', style: { color: 'var(--red)' } }, 'Tickets ↗'),
      ]) : null,
    ]);

    const flyerThumb = e.flyer_image_url
      ? h('img', { src: e.flyer_image_url, style: { width: '160px', height: '200px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 } })
      : h('div', { style: { width: '160px', height: '200px', background: 'var(--elevated)', border: '1px dashed var(--border)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...MONO_LABEL, fontSize: '9px', textAlign: 'center', padding: '0 8px' } }, 'NO MEDIA YET — ADD VIA {EDIT}');

    const genFlyerBtn = h('button', {
      type: 'button', class: 'btn-outline',
      style: { fontSize: '10px', padding: '6px 10px' },
      onClick: (ev) => triggerGenerateFlyer(e.id, ev.target),
    }, e.flyer_image_url ? '{REGEN FROM REFERENCE}' : '{GENERATE MASTER MEDIA}');

    const mediaCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 } }, [
      flyerThumb,
      genFlyerBtn,
    ]);

    mount(h('div', null, [
      topRow,
      h('div', { style: { display: 'flex', gap: '14px', marginBottom: '18px', alignItems: 'stretch' } }, [
        mediaCol,
        metaCard,
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
          'No campaign yet. Generation runs your gathering through Claude per post type (15–30s).'),
        h('button', {
          class: 'btn-red', type: 'button',
          onClick: (ev) => triggerGenerate(event.id, ev.target, false),
        }, '{GENERATE CAMPAIGN}'),
      ]);
    }
    const heading = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' } }, [
      h('div', { style: MONO_LABEL }, `CAMPAIGN · ${campaign.status}${posts.length ? ' · ' + posts.length + ' posts' : ''}`),
      h('div', { style: { display: 'flex', gap: '8px' } }, [
        h('button', {
          class: 'btn-outline', type: 'button',
          onClick: (ev) => triggerPushToStash(campaign.id, ev.target),
        }, '{PUSH TO STASH}'),
        h('button', {
          class: 'btn-outline', type: 'button',
          onClick: (ev) => triggerGenerate(event.id, ev.target, true),
        }, '{REGENERATE}'),
      ]),
    ]);
    if (campaign.generation_error) {
      return h('div', null, [
        heading,
        h('div', { class: 'card', style: { borderColor: 'var(--red)', color: 'var(--red)', marginBottom: '10px', fontSize: '11px' } }, campaign.generation_error),
        renderTimeline(posts, event.id),
      ]);
    }
    return h('div', null, [heading, renderTimeline(posts, event.id)]);
  }

  function renderTimeline(posts, eventId) {
    if (!posts.length) return h('div', { class: 'card', style: { color: 'var(--muted)', fontSize: '12px' } }, 'No posts in this campaign.');
    // Stamp eventId on each post so postCard can trigger a re-fetch on modal save
    const stamped = posts.map(p => ({ ...p, _eventId: eventId }));
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, stamped.map(postCard));
  }

  function postCard(p) {
    const selectedVariant = (p.copy_variants || []).find(v => v.id === p.selected_copy_variant_id) || (p.copy_variants || [])[0];
    const preview = selectedVariant ? selectedVariant.text : (p.generation_error ? '⚠ ' + p.generation_error : '(no copy yet)');
    const eventIdForReload = (p._eventId);
    const imageUrl = p.selected_image_url || (p.image_asset_urls || [])[0];

    const textBlock = h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 } }, [
      h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' } }, [
        h('div', { style: { ...MONO_LABEL, color: 'var(--red)' } }, p.post_type.replace(/_/g, ' ')),
        h('div', { style: { ...MONO_LABEL, fontSize: '9px' } }, fmtDate(p.scheduled_for)),
      ]),
      h('div', { style: { fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: selectedVariant ? 'var(--body)' : 'var(--muted)' } }, preview),
      h('div', { style: { fontSize: '10px', color: 'var(--muted)' } },
        (p.copy_variants || []).length > 1 ? `${p.copy_variants.length} variants · click to edit` : 'click to edit'),
    ]);

    const thumb = imageUrl
      ? h('img', { src: imageUrl, style: { width: '88px', height: '110px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 } })
      : null;

    return h('div', {
      class: 'card',
      style: { padding: '12px 14px', cursor: 'pointer' },
      onClick: () => {
        if (typeof E.openPostEditor === 'function') {
          E.openPostEditor(p, () => { if (eventIdForReload) window.openEvent(eventIdForReload); });
        }
      },
    }, [
      h('div', { style: { display: 'flex', gap: '14px', alignItems: 'stretch' } }, [thumb, textBlock]),
    ]);
  }

  async function triggerPushToStash(campaignId, buttonEl) {
    const original = buttonEl.textContent;
    buttonEl.disabled = true; buttonEl.textContent = '{PUSHING…}';
    try {
      const r = await authedFetch(`${API}/api/campaigns/${campaignId}/push-to-stash`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { alert(j.error || `Push failed (${r.status})`); buttonEl.disabled = false; buttonEl.textContent = original; return; }
      buttonEl.textContent = `{PUSHED ${j.pushed}}`;
      setTimeout(() => { buttonEl.disabled = false; buttonEl.textContent = original; }, 2500);
    } catch (e) {
      alert(`Push failed: ${e.message}`);
      buttonEl.disabled = false; buttonEl.textContent = original;
    }
  }

  async function triggerGenerateFlyer(eventId, buttonEl) {
    const original = buttonEl.textContent;
    buttonEl.disabled = true; buttonEl.textContent = '{GENERATING… ~10s}';
    try {
      const r = await authedFetch(`${API}/api/events/${eventId}/generate-flyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || `Generation failed (${r.status})`); buttonEl.disabled = false; buttonEl.textContent = original; return; }
      window.openEvent(eventId);
    } catch (e) {
      alert(`Generation failed: ${e.message}`);
      buttonEl.disabled = false; buttonEl.textContent = original;
    }
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
