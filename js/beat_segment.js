// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BEAT SEGMENT PICKER — upload a track, drag in/out handles on the waveform.
// Emits two values to makeBeatVideo: audio_start_seconds + duration_seconds.
//
// Architecture: Web Audio API decodes peaks into a <canvas>; two drag handles
// set _beatStart (left) and _beatEnd (right). Canvas redraws on each drag —
// bars outside the selection are dimmed (alpha 0.2), inside are bright.
// Preview plays from _beatStart to _beatEnd via a plain <audio> element.
// No audio library; no fixed clip length.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BEAT_PEAK_BUCKETS = 480;   // resolution-independent peak array
const BEAT_BAR_STEP = 3;         // px per bar (2px bar + 1px gap)

let _beatPeaks = null;           // Float32Array of 0..1 heights
let _beatDur = 0;                // track length, seconds
let _beatStart = 0;              // in-point, seconds
let _beatEnd = 0;                // out-point, seconds (= full duration after load)
let _beatAudioCtx = null;
let _beatObjUrl = null;
let _beatPreviewRAF = null;

function _beatCtx() {
  _beatAudioCtx = _beatAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
  return _beatAudioCtx;
}

function _beatFmt(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function beatSegmentInit(file) {
  const seg = document.getElementById('beatSegment');
  const errEl = document.getElementById('forgeBeatError');
  if (errEl) errEl.style.display = 'none';
  _beatStopPreview();
  if (!file) { if (seg) seg.style.display = 'none'; return; }

  const dropLabel = document.getElementById('forgeBeatFileName');
  if (dropLabel) dropLabel.textContent = file.name;

  try {
    const buf = await _beatCtx().decodeAudioData(await file.arrayBuffer());
    _beatDur = buf.duration;
    _beatStart = 0;
    _beatEnd = _beatDur;
    _beatPeaks = _beatComputePeaks(buf, BEAT_PEAK_BUCKETS);
    if (_beatObjUrl) URL.revokeObjectURL(_beatObjUrl);
    _beatObjUrl = URL.createObjectURL(file);
    const audio = document.getElementById('beatSegAudio');
    if (audio) audio.src = _beatObjUrl;
    if (seg) seg.style.display = 'block';
    requestAnimationFrame(() => { _beatDrawWave(); _beatLayout(); });
  } catch (e) {
    if (seg) seg.style.display = 'none';
    if (errEl) { errEl.textContent = `Couldn't read that audio (${e.message}). It'll still upload.`; errEl.style.display = 'block'; }
  }
}

function _beatComputePeaks(buf, buckets) {
  const data = buf.getChannelData(0);
  const per = Math.max(1, Math.floor(data.length / buckets));
  const peaks = new Float32Array(buckets);
  let max = 0.0001;
  for (let b = 0; b < buckets; b++) {
    let peak = 0;
    const start = b * per;
    for (let i = 0; i < per; i++) {
      const v = Math.abs(data[start + i] || 0);
      if (v > peak) peak = v;
    }
    peaks[b] = peak;
    if (peak > max) max = peak;
  }
  for (let b = 0; b < buckets; b++) peaks[b] /= max;
  return peaks;
}

function _beatDrawWave() {
  const canvas = document.getElementById('beatWave');
  const wrap = document.getElementById('beatWaveWrap');
  if (!canvas || !wrap || !_beatPeaks) return;
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ff4500';
  const bars = Math.floor(w / BEAT_BAR_STEP);
  const mid = h / 2;
  const selL = _beatDur > 0 ? (_beatStart / _beatDur) * bars : 0;
  const selR = _beatDur > 0 ? (_beatEnd / _beatDur) * bars : bars;
  ctx.fillStyle = accent;
  for (let i = 0; i < bars; i++) {
    const peak = _beatPeaks[Math.floor((i / bars) * _beatPeaks.length)] || 0;
    const barH = Math.max(2, peak * (h - 6));
    ctx.globalAlpha = (i >= selL && i <= selR) ? 1 : 0.18;
    ctx.fillRect(i * BEAT_BAR_STEP, mid - barH / 2, 2, barH);
  }
  ctx.globalAlpha = 1;
}

function _beatLayout() {
  const wrap = document.getElementById('beatWaveWrap');
  const hl = document.getElementById('beatHandleL');
  const hr = document.getElementById('beatHandleR');
  const reg = document.getElementById('beatRegion');
  const time = document.getElementById('beatSegTime');
  if (!wrap || !hl || !hr || !_beatDur) return;
  const w = wrap.clientWidth;
  const lPx = Math.max(0, (_beatStart / _beatDur) * w);
  const rPx = Math.min(w, (_beatEnd / _beatDur) * w);
  hl.style.left = lPx + 'px';
  hr.style.left = rPx + 'px';
  if (reg) { reg.style.left = lPx + 'px'; reg.style.width = (rPx - lPx) + 'px'; }
  const dur = _beatEnd - _beatStart;
  const loopEl = document.getElementById('forgeBeatLoop');
  const hintEl = document.getElementById('beatLoopHint');
  if (hintEl) {
    hintEl.textContent = (loopEl && loopEl.checked && dur > 0)
      ? `→ loops to 1:30`
      : '';
  }
  if (time) time.textContent = `${_beatFmt(_beatStart)} – ${_beatFmt(_beatEnd)}  (${_beatFmt(dur)})`;
  _beatDrawWave();
}

// ── Left handle drags the in-point ──────────────────────────
function _beatPointerDownL(e) {
  const wrap = document.getElementById('beatWaveWrap');
  if (!wrap || !_beatDur) return;
  e.preventDefault();
  _beatStopPreview();
  const rect = wrap.getBoundingClientRect();
  const w = wrap.clientWidth;
  const onMove = (ev) => {
    const x = ev.clientX - rect.left;
    _beatStart = Math.max(0, Math.min(_beatEnd - 0.5, (x / w) * _beatDur));
    _beatLayout();
  };
  const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ── Right handle drags the out-point ────────────────────────
function _beatPointerDownR(e) {
  const wrap = document.getElementById('beatWaveWrap');
  if (!wrap || !_beatDur) return;
  e.preventDefault();
  _beatStopPreview();
  const rect = wrap.getBoundingClientRect();
  const w = wrap.clientWidth;
  const onMove = (ev) => {
    const x = ev.clientX - rect.left;
    _beatEnd = Math.max(_beatStart + 0.5, Math.min(_beatDur, (x / w) * _beatDur));
    _beatLayout();
  };
  const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ── Preview: audition from in-point to out-point ─────────────
function beatSegmentPreview() {
  const audio = document.getElementById('beatSegAudio');
  const btn = document.getElementById('beatSegPlay');
  if (!audio || !_beatObjUrl) return;
  if (!audio.paused) { _beatStopPreview(); return; }
  audio.currentTime = _beatStart;
  audio.play().then(() => {
    if (btn) btn.textContent = '▮▮';
    const head = document.getElementById('beatSegPlayhead');
    const wrap = document.getElementById('beatWaveWrap');
    if (head) head.style.display = 'block';
    const tick = () => {
      if (audio.paused) return;
      if (audio.currentTime >= _beatEnd) { _beatStopPreview(); return; }
      if (head && wrap) head.style.left = ((audio.currentTime / _beatDur) * wrap.clientWidth) + 'px';
      _beatPreviewRAF = requestAnimationFrame(tick);
    };
    _beatPreviewRAF = requestAnimationFrame(tick);
  }).catch(() => {});
}

function _beatStopPreview() {
  const audio = document.getElementById('beatSegAudio');
  const btn = document.getElementById('beatSegPlay');
  const head = document.getElementById('beatSegPlayhead');
  if (_beatPreviewRAF) { cancelAnimationFrame(_beatPreviewRAF); _beatPreviewRAF = null; }
  if (audio && !audio.paused) audio.pause();
  if (btn) btn.textContent = '▶';
  if (head) head.style.display = 'none';
}

// Values read by makeBeatVideo.
function beatSegmentStart() {
  return Math.round(_beatStart * 100) / 100;
}
function beatSegmentDuration() {
  return Math.max(0.5, Math.round((_beatEnd - _beatStart) * 100) / 100);
}

function beatSegmentReset() {
  _beatStopPreview();
  _beatPeaks = null; _beatDur = 0; _beatStart = 0; _beatEnd = 0;
  if (_beatObjUrl) { URL.revokeObjectURL(_beatObjUrl); _beatObjUrl = null; }
  const audio = document.getElementById('beatSegAudio'); if (audio) audio.removeAttribute('src');
  const seg = document.getElementById('beatSegment'); if (seg) seg.style.display = 'none';
  const file = document.getElementById('forgeBeatFile'); if (file) file.value = '';
  const dropLabel = document.getElementById('forgeBeatFileName'); if (dropLabel) dropLabel.textContent = 'Add audio';
}

document.addEventListener('DOMContentLoaded', () => {
  const hl = document.getElementById('beatHandleL');
  const hr = document.getElementById('beatHandleR');
  if (hl) hl.addEventListener('pointerdown', _beatPointerDownL);
  if (hr) hr.addEventListener('pointerdown', _beatPointerDownR);
  const loopEl = document.getElementById('forgeBeatLoop');
  if (loopEl) loopEl.addEventListener('change', () => _beatLayout());
  let rt = null;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (_beatPeaks) { _beatDrawWave(); _beatLayout(); } }, 120);
  });
});
