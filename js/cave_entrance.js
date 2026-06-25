// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CAVE ENTRANCE — KVS-style flourishes
// Spec: wiki/spec/splash_cave_entrance.md
// Owns: glitch-scramble text effect, ambient sound toggle.
// Loaded BEFORE js/app.js so window.caveGlitch is available when
// app.js wires the login form's submit handler.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function () {
  // ── Glitch-scramble ───────────────────────────────────
  // Replaces el.textContent with a scrambled string, gradually
  // resolving to `target` over ~600ms. Letters lock in left-to-right.
  const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#________';
  const FRAME_MS = 50;
  const TOTAL_MS = 600;

  function pickGlitch() {
    return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
  }

  window.caveGlitch = function caveGlitch(el, target) {
    if (!el) return;
    if (el._glitchTimer) { clearInterval(el._glitchTimer); el._glitchTimer = null; }

    // Scramble only the LABEL text — preserve any icon/element children (e.g. an
    // SVG in "icon + Clan" buttons) by writing to the label text node, not
    // textContent (which would delete the icon). Falls back to textContent for
    // pure-text buttons (login, plan CTA).
    let textNode = null;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) { textNode = n; break; }
    }
    const write = textNode ? (s) => { textNode.nodeValue = s; }
                           : (s) => { el.textContent = s; };

    const frames = Math.ceil(TOTAL_MS / FRAME_MS);
    let frame = 0;
    el._glitchTimer = setInterval(() => {
      frame += 1;
      const progress = frame / frames;             // 0 → 1
      const chars = Array.from(target);             // code-point safe (keeps emoji whole)
      const lockCount = Math.floor(chars.length * progress);
      let out = '';
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (i < lockCount || ch === ' ' || ch === '{' || ch === '}') {
          out += ch;
        } else {
          out += pickGlitch();
        }
      }
      write(out);
      if (frame >= frames) {
        clearInterval(el._glitchTimer);
        el._glitchTimer = null;
        write(target);
      }
    }, FRAME_MS);
  };

  // ── Sound toggle (shared state across splash + app shell) ─────────────
  // Real audio file routed through an AnalyserNode so the logo can pulse
  // to the actual waveform. If the file fails to load, fall back to a
  // synthesised drone so audio still works.
  const AUDIO_URL = 'audio/cave_drone.mp3';
  const TARGET_VOLUME = 0.35;
  const PLAYBACK_RATE = 0.9;   // a touch slower than original
  const STORAGE_KEY = 'sc_sound_on';

  let audioCtx = null;
  let droneNodes = null;       // { source, gain, analyser } or synth fallback
  let cachedBuffer = null;     // decoded AudioBuffer, fetched once
  let pulseRAF = null;
  let lfoStartMs = null;       // for visual-only LFO when sound is off

  function setToggleState(on) {
    document.querySelectorAll('#caveSoundToggle, #appSoundToggle').forEach(btn => {
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const stateEl = btn.querySelector('span');
      if (stateEl) stateEl.textContent = on ? 'ON' : 'OFF';
    });
  }

  function ensureCtx() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  async function loadBuffer(ctx) {
    if (cachedBuffer) return cachedBuffer;
    const res = await fetch(AUDIO_URL);
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const arr = await res.arrayBuffer();
    cachedBuffer = await ctx.decodeAudioData(arr);
    return cachedBuffer;
  }

  async function startAudioFile() {
    const ctx = ensureCtx();
    let buffer;
    try {
      buffer = await loadBuffer(ctx);
    } catch (err) {
      console.warn('[cave] buffer load failed, falling back to synth', err && err.message);
      startSynth();
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;                      // sample-accurate — no seam click
    source.playbackRate.value = PLAYBACK_RATE;
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    gain.gain.value = 0;
    source.connect(analyser); analyser.connect(gain); gain.connect(ctx.destination);
    source.start(0);
    gain.gain.linearRampToValueAtTime(TARGET_VOLUME, ctx.currentTime + 1.2);
    droneNodes = { kind: 'file', source, gain, analyser };
    startPulseFromAudio();
  }

  function startSynth() {
    const ctx = ensureCtx();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    o1.type = 'sawtooth'; o1.frequency.value = 55;
    o2.type = 'sine';     o2.frequency.value = 82.41;
    filt.type = 'lowpass'; filt.frequency.value = 220; filt.Q.value = 4;
    gain.gain.value = 0;
    o1.connect(filt); o2.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    o1.start(); o2.start();
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.2);
    droneNodes = { kind: 'synth', o1, o2, filt, gain };
    startPulseLFO();
  }

  function startDrone() {
    if (droneNodes) return;
    startAudioFile();  // falls through to synth internally on fetch/decode failure
  }

  function stopDrone() {
    if (!droneNodes) return;
    const nodes = droneNodes;
    droneNodes = null;
    if (nodes.kind === 'file') {
      try { nodes.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4); } catch (_) {}
      setTimeout(() => { try { nodes.source.stop(); } catch (_) {} }, 500);
    } else if (nodes.kind === 'synth') {
      try { nodes.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4); } catch (_) {}
      setTimeout(() => {
        try { nodes.o1.stop(); nodes.o2.stop(); } catch (_) {}
      }, 500);
    }
    if (pulseRAF) { cancelAnimationFrame(pulseRAF); pulseRAF = null; }
    startPulseLFO(); // visual-only breathing when audio is off
  }

  // Drive --cave-pulse from a mix of slow LFO breath + audio RMS variation.
  // Drone loops have near-constant amplitude, so pure RMS would flatline.
  // We blend a 12s breathing cycle (most of the motion) with audio activity
  // (subtle modulation that locks visual to sound), then ease via low-pass.
  function startPulseFromAudio() {
    if (pulseRAF) cancelAnimationFrame(pulseRAF);
    const root = document.documentElement;
    const buf = new Uint8Array(droneNodes.analyser.fftSize);
    const startMs = performance.now();
    const periodMs = 12000;
    let smoothed = 0;
    function tick(now) {
      if (!droneNodes || droneNodes.kind !== 'file') return;
      droneNodes.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);                     // 0..~1
      const phase = ((now - startMs) % periodMs) / periodMs;
      const breath = (1 - Math.cos(phase * Math.PI * 2)) / 2;      // slow swell
      const target = breath * 0.7 + Math.min(1, rms) * 0.3;        // mix
      smoothed += (target - smoothed) * 0.08;                      // low-pass
      root.style.setProperty('--cave-pulse', smoothed.toFixed(3));
      pulseRAF = requestAnimationFrame(tick);
    }
    pulseRAF = requestAnimationFrame(tick);
  }

  // Visual-only slow breathing when audio is off (~12s cycle).
  function startPulseLFO() {
    if (pulseRAF) cancelAnimationFrame(pulseRAF);
    const root = document.documentElement;
    lfoStartMs = performance.now();
    const periodMs = 12000;
    function tick(now) {
      if (droneNodes && droneNodes.kind === 'file') return; // file-driven took over
      const phase = ((now - lfoStartMs) % periodMs) / periodMs;
      const pulse = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      root.style.setProperty('--cave-pulse', pulse.toFixed(3));
      pulseRAF = requestAnimationFrame(tick);
    }
    pulseRAF = requestAnimationFrame(tick);
  }

  function setSound(on) {
    setToggleState(on);
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (_) {}
    if (on) startDrone(); else stopDrone();
  }

  // Expose so any toggle in any view can drive shared state.
  window.caveSound = { set: setSound, toggle: () => setSound(!(droneNodes)) };

  // ── Inline-SVG mount + entrance animation ─────────────
  // Replace the splash <img> with the inlined <svg> so we can animate
  // each of the 172 ribbon paths independently. Then run a one-shot
  // swirl: paths start off-screen + spun, transition back to identity.
  async function mountInlineLogo() {
    const mount = document.getElementById('caveLogoMount');
    if (!mount) { console.warn('[cave] no #caveLogoMount'); return; }
    const img = mount.querySelector('img');
    if (!img) { console.warn('[cave] no <img> inside mount'); return; }
    const src = img.getAttribute('src');
    try {
      const res = await fetch(src);
      if (!res.ok) { console.warn('[cave] fetch SVG failed', res.status, src); return; }
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg') {
        console.warn('[cave] parsed root is not <svg>', svg && svg.nodeName);
        return;
      }
      svg.classList.add('cave-logo-svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'S0UNDCAV3');
      mount.replaceChild(svg, img);
      console.info('[cave] inlined SVG; path count =', svg.querySelectorAll('path').length);
      runEntranceAnimation(svg);
    } catch (e) {
      console.warn('[cave] mountInlineLogo error', e && e.message);
    }
  }

  function runEntranceAnimation(svg) {
    const paths = svg.querySelectorAll('path');
    paths.forEach((p, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 1200 + Math.random() * 600;    // far off-screen — long deliberate drift
      const spin  = (Math.random() - 0.5) * 720;   // ±2 full spins
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      p.style.transition = 'none';
      p.style.transform  = `translate(${tx}px, ${ty}px) rotate(${spin}deg)`;
      p.style.opacity    = '0';
      p.style.transitionDelay = `${i * 20}ms`;     // ~3.4s cascade across 172 paths
    });
    // Force a reflow so the start state is committed, then clear inline
    // transition override + transform → CSS transition kicks in.
    svg.getBoundingClientRect();
    requestAnimationFrame(() => {
      paths.forEach(p => {
        p.style.transition = '';
        p.style.transform  = '';
        p.style.opacity    = '1';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    mountInlineLogo();

    // Wire both toggles (splash + app shell) to shared state.
    ['caveSoundToggle', 'appSoundToggle'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => window.caveSound.toggle());
    });

    // Always start OFF on a fresh load — browsers block autoplay without a
    // user gesture, so persistence would be a lie. Visuals breathe via LFO
    // until the user clicks a toggle.
    startPulseLFO();

    // Browsers block audio until a user gesture, so the ambient drone never
    // reached anyone who didn't hunt for the {SOUND} toggle ("I can't hear the
    // Soundcave noise" — esp. on mobile, where the toggle is a small chip).
    // Kick it in on the FIRST tap/click anywhere — the entrance you'd expect —
    // unless the user has explicitly muted before. The toggle still mutes, and
    // a mute persists. Gesture-compliant (works on iOS); fires at most once.
    let _ambientPrimed = false;
    function primeAmbient() {
      if (_ambientPrimed) return;
      _ambientPrimed = true;
      let muted = false;
      try { muted = localStorage.getItem(STORAGE_KEY) === '0'; } catch (_) {}
      if (!muted && !droneNodes) { try { window.caveSound.set(true); } catch (_) {} }
    }
    window.addEventListener('pointerdown', primeAmbient, { once: true, passive: true });

    // Glitch every major CTA on hover, site-wide. Delegated on document so it
    // also covers buttons rendered dynamically (e.g. the plan-selector cards).
    // Add `.glitch-cta` to opt any other button in. Disabled buttons are skipped.
    // Action buttons site-wide use .btn-red (primary) / .btn-outline (secondary).
    // Glitch those + the login/plan CTAs + anything tagged .glitch-cta. Opt a
    // non-action button OUT with .no-glitch (e.g. CANCEL / ← BACK).
    const GLITCH_SELECTOR = '.cave-login-btn, .plan-cta, .btn-red:not(.no-glitch), .btn-outline:not(.no-glitch), .glitch-cta';
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest(GLITCH_SELECTOR);
      if (!t || t.disabled || t._glitchHover) return;
      t._glitchHover = true;                       // guard: don't restart on inner re-enter
      window.caveGlitch(t, (t.dataset.glitchText || t.textContent).trim());
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest && e.target.closest(GLITCH_SELECTOR);
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) t._glitchHover = false;
    });
  });
})();
