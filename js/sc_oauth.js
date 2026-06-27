// SoundCloud per-user OAuth — Reflection tab UI + post-login onboarding nudge.
// Spec: wiki/spec/soundcloud_user_oauth.md

(function initScOauth() {
  const connectBtn    = document.getElementById('reflectionConnectSc');
  const disconnectBtn = document.getElementById('reflectionDisconnectSc');
  const statusEl      = document.getElementById('reflectionScStatus');
  const msgEl         = document.getElementById('reflectionScMsg');
  if (!connectBtn) return;

  function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = `reflection-sc-msg${type ? ' ' + type : ''}`;
    msgEl.hidden = !text;
  }

  function setConnected(username) {
    statusEl.textContent = `@${username}`;
    statusEl.className = 'reflection-sc-status connected';
    connectBtn.hidden = true;
    disconnectBtn.hidden = false;
  }

  function setDisconnected() {
    statusEl.textContent = '—';
    statusEl.className = 'reflection-sc-status';
    connectBtn.hidden = false;
    disconnectBtn.hidden = true;
  }

  async function refreshScStatus() {
    try {
      const apiBase = typeof scApiBase === 'function' ? scApiBase() : '';
      if (!apiBase) return;
      const r = await scAuth.authedFetch(`${apiBase}/api/auth/soundcloud/status`);
      if (!r.ok) { setDisconnected(); return; }
      const j = await r.json();
      j.connected ? setConnected(j.sc_username) : setDisconnected();
    } catch { setDisconnected(); }
  }
  window.refreshScStatus = refreshScStatus;

  connectBtn.addEventListener('click', async () => {
    showMsg('Opening SoundCloud…', '');
    connectBtn.disabled = true;
    try {
      const apiBase = typeof scApiBase === 'function' ? scApiBase() : '';
      const r = await scAuth.authedFetch(`${apiBase}/api/auth/soundcloud/connect`);
      const j = await r.json();
      if (j.url) {
        window.location.href = j.url;
      } else {
        showMsg('Could not generate SoundCloud link.', 'error');
        connectBtn.disabled = false;
      }
    } catch (e) {
      showMsg(`Error: ${e.message}`, 'error');
      connectBtn.disabled = false;
    }
  });

  disconnectBtn.addEventListener('click', async () => {
    disconnectBtn.disabled = true;
    try {
      const apiBase = typeof scApiBase === 'function' ? scApiBase() : '';
      await scAuth.authedFetch(`${apiBase}/api/auth/soundcloud/disconnect`, { method: 'DELETE' });
      setDisconnected();
      showMsg('SoundCloud disconnected.', '');
      localStorage.removeItem('sc_liked_tracks');
    } catch (e) {
      showMsg(`Error: ${e.message}`, 'error');
    } finally {
      disconnectBtn.disabled = false;
    }
  });

  // Handle redirect-back params from the OAuth callback (?sc_connected=1 / ?sc_error=...)
  function handleCallbackParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('sc_connected')) {
      // Strip param from URL without reloading
      const clean = window.location.pathname + window.location.hash;
      history.replaceState(null, '', clean);
      // Switch to Reflection tab and show success
      if (typeof switchTab === 'function') switchTab('reflection');
      showMsg('SoundCloud connected!', 'success');
      refreshScStatus();
      // Clear the onboarding nudge since they acted on it
      localStorage.setItem('sc_oauth_nudge_shown', '1');
    } else if (params.has('sc_error')) {
      const errCode = params.get('sc_error');
      const clean = window.location.pathname + window.location.hash;
      history.replaceState(null, '', clean);
      if (typeof switchTab === 'function') switchTab('reflection');
      showMsg(`Connection failed: ${errCode}. Please try again.`, 'error');
    }
  }

  // One-time nudge banner after first login — directs user to connect SC.
  function maybeShowNudge() {
    if (localStorage.getItem('sc_oauth_nudge_shown')) return;
    const existing = document.getElementById('scOauthNudge');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'scOauthNudge';
    banner.className = 'sc-oauth-nudge';

    const msg = document.createElement('span');
    msg.textContent = 'Connect your SoundCloud for personalised liked-track insights in artist profiles.';

    const ctaBtn = document.createElement('button');
    ctaBtn.className = 'sc-nudge-cta';
    ctaBtn.type = 'button';
    ctaBtn.textContent = 'Connect now';
    ctaBtn.addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('sc_oauth_nudge_shown', '1');
      if (typeof switchTab === 'function') switchTab('reflection');
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'sc-nudge-dismiss';
    dismissBtn.type = 'button';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.textContent = '✕';
    dismissBtn.addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('sc_oauth_nudge_shown', '1');
    });

    banner.appendChild(msg);
    banner.appendChild(ctaBtn);
    banner.appendChild(dismissBtn);
    document.body.appendChild(banner);
  }

  scAuth.ready.then(async () => {
    if (await scAuth.session()) {
      handleCallbackParams();
      refreshScStatus();
      // Only nudge if not yet connected
      setTimeout(async () => {
        const apiBase = typeof scApiBase === 'function' ? scApiBase() : '';
        try {
          const r = await scAuth.authedFetch(`${apiBase}/api/auth/soundcloud/status`);
          const j = await r.json();
          if (!j.connected) maybeShowNudge();
        } catch {}
      }, 2000);
    }
    scAuth.onChange((event) => {
      if (event === 'SIGNED_IN') {
        handleCallbackParams();
        refreshScStatus();
      }
    });
  }).catch(() => {});
})();
