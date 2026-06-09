// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPIRITS — avatar (reusable character/face reference set) manager
// ─────────────────────────────────────────────────────
// A "spirit" = a named set of reference images for a recurring character,
// mascot, or specific artist. Summoning one into a generation passes its
// references to the image model (and routes Artist Bio to Nano Banana Pro) so
// the same face/character stays consistent across flyers — the fix for
// "uploaded a photo, got nothing like them".
//
// Backend: avatars_api.py (table `avatars`, bucket `avatar_refs`). Owner-scoped.
// This modal is launched from the Forge "Spirit" selector's ⚙ button. After any
// create/delete it calls loadSpirits() (firepit.js) to refresh that select.
// Reuses the .trail-modal-overlay shell for styling.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function () {
  const apiBase = () =>
    (typeof forgeApiUrl !== 'undefined' && forgeApiUrl) ||
    localStorage.getItem('sc_api_url') || 'http://localhost:8000';

  // Cave-style line-art bin, matching the stash/clan icon set.
  const TRASH = '<svg class="icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4 H13.5"/><path d="M5.75 4 V2.5 H10.25 V4"/><path d="M3.75 4 L4.5 13.5 H11.5 L12.25 4"/><path d="M6.5 6.5 V11 M9.5 6.5 V11"/></svg>';

  let _list = [];
  let _busy = false;

  window.openSpirits = async function () {
    const ov = document.getElementById('spiritsOverlay');
    if (!ov) return;
    ov.classList.add('open');
    await refresh();
  };
  window.closeSpirits = function () {
    const ov = document.getElementById('spiritsOverlay');
    if (ov) ov.classList.remove('open');
  };

  async function refresh() {
    const body = document.getElementById('spiritsBody');
    if (!body) return;
    body.innerHTML = '<div class="spirits-loading">Summoning…</div>';
    try {
      const r = await scAuth.authedFetch(`${apiBase()}/api/avatars`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      _list = j.avatars || [];
    } catch (e) {
      body.innerHTML =
        `<div class="spirits-error">Couldn't load spirits (${esc(String(e.message || e))}).<br>Is the API running and the avatars table migrated?</div>` +
        formHTML();
      wireForm();
      return;
    }
    render();
  }

  function spiritCardHTML(s) {
    const n = (s.reference_image_urls || []).length;
    const thumb = s.preview_url
      ? `<img src="${esc(s.preview_url)}" alt="">`
      : '<span class="spirit-noimg">🔮</span>';
    return `<div class="spirit-card">
      <div class="spirit-card-thumb">${thumb}</div>
      <div class="spirit-card-body">
        <div class="spirit-card-name">${esc(s.name)}</div>
        <div class="spirit-card-meta">${n} reference${n === 1 ? '' : 's'}</div>
      </div>
      <button class="action-btn spirit-del" data-id="${esc(s.id)}" title="Banish spirit">${TRASH}</button>
    </div>`;
  }

  function formHTML() {
    return `<div class="spirits-form">
      <div class="section-label">SUMMON A SPIRIT</div>
      <input class="input" id="spiritName" placeholder="Name — the artist, or a mascot" maxlength="64">
      <textarea class="input" id="spiritDesc" rows="2" placeholder="Describe them — look, vibe (helps the model)"></textarea>
      <label class="forge-label spirits-files-label">Reference images — the face/character to keep consistent</label>
      <input type="file" id="spiritFiles" accept="image/png,image/jpeg,image/webp" multiple>
      <div class="spirits-form-msg" id="spiritMsg" aria-live="polite"></div>
      <button class="btn-red" id="spiritSummonBtn" type="button">{SUMMON SPIRIT}</button>
    </div>`;
  }

  function render() {
    const body = document.getElementById('spiritsBody');
    if (!body) return;
    const list = _list.length
      ? `<div class="spirits-grid">${_list.map(spiritCardHTML).join('')}</div>`
      : `<div class="spirits-empty">No spirits summoned yet.<br>Create one below to keep a face or character consistent across generations.</div>`;
    body.innerHTML = list + formHTML();
    wireDeletes();
    wireForm();
  }

  function wireDeletes() {
    document.querySelectorAll('#spiritsBody .spirit-del').forEach(btn => {
      btn.addEventListener('click', () => banish(btn.dataset.id));
    });
  }
  function wireForm() {
    const btn = document.getElementById('spiritSummonBtn');
    if (btn) btn.addEventListener('click', summon);
  }

  async function summon() {
    if (_busy) return;
    const name = (document.getElementById('spiritName')?.value || '').trim();
    const desc = (document.getElementById('spiritDesc')?.value || '').trim();
    const files = document.getElementById('spiritFiles')?.files;
    const msg = document.getElementById('spiritMsg');
    const setMsg = (t, err) => { if (msg) { msg.textContent = t; msg.classList.toggle('err', !!err); } };

    if (name.length < 2) { setMsg('Give the spirit a name (≥2 chars).', true); return; }
    if (!files || !files.length) { setMsg('Add at least one reference image.', true); return; }

    _busy = true; setMsg('Summoning…', false);
    try {
      const fd = new FormData();
      fd.append('name', name);
      if (desc) fd.append('description', desc);
      for (const f of files) fd.append('files', f);
      const r = await scAuth.authedFetch(`${apiBase()}/api/avatars`, { method: 'POST', body: fd });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`); }
      _busy = false;
      if (typeof loadSpirits === 'function') await loadSpirits();   // refresh the Forge select
      await refresh();
    } catch (e) {
      _busy = false;
      setMsg(`Couldn't summon: ${e.message || e}`, true);
    }
  }

  async function banish(id) {
    const s = _list.find(x => x.id === id);
    if (!window.confirm(`Banish "${s ? s.name : 'this spirit'}"? This can't be undone.`)) return;
    try {
      const r = await scAuth.authedFetch(`${apiBase()}/api/avatars/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (typeof loadSpirits === 'function') await loadSpirits();
      await refresh();
    } catch (e) {
      window.alert(`Banish failed: ${e.message || e}`);
    }
  }
})();
