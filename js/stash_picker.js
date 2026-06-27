// STASH PICKER — reusable modal for picking an image from the Stash
// openStashPicker(onPick) renders a grid of Stash items that have imageUrls.
// onPick is called with the selected stash item; modal closes on pick.
// Works from any tab — fetches stash on demand if it hasn't loaded yet.
(function () {
  let _overlay = null;
  let _currentCallback = null;

  async function openStashPicker(onPick) {
    _currentCallback = onPick;
    _ensureOverlay();
    _overlay.classList.add('open');

    // If stash hasn't been loaded yet (e.g. called from Gatherings tab),
    // load it now before rendering the grid.
    const lib = (typeof getContentLibrary === 'function') ? getContentLibrary() : [];
    if (!lib.length && typeof loadStash === 'function') {
      _renderLoading();
      try { await loadStash(); } catch (e) { /* non-fatal — show empty state */ }
    }
    _render();
  }

  function _close() {
    if (_overlay) _overlay.classList.remove('open');
    _currentCallback = null;
  }

  function _ensureOverlay() {
    if (_overlay) return;
    _overlay = document.createElement('div');
    _overlay.className = 'stash-picker-overlay';
    _overlay.addEventListener('click', e => { if (e.target === _overlay) _close(); });
    document.body.appendChild(_overlay);
  }

  function _renderLoading() {
    _overlay.replaceChildren();
    const modal = document.createElement('div');
    modal.className = 'stash-picker-modal';
    const head = _buildHead();
    const loading = document.createElement('div');
    loading.className = 'stash-picker-empty';
    loading.textContent = 'Loading Stash…';
    modal.appendChild(head);
    modal.appendChild(loading);
    _overlay.appendChild(modal);
  }

  function _buildHead() {
    const head = document.createElement('div');
    head.className = 'stash-picker-head';
    const title = document.createElement('span');
    title.textContent = 'FROM STASH';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'stash-picker-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', _close);
    head.appendChild(title);
    head.appendChild(closeBtn);
    return head;
  }

  function _render() {
    const lib = (typeof getContentLibrary === 'function') ? getContentLibrary() : [];
    const items = lib.filter(i => i.imageUrl);
    _overlay.replaceChildren();

    const modal = document.createElement('div');
    modal.className = 'stash-picker-modal';
    modal.appendChild(_buildHead());

    const grid = document.createElement('div');
    grid.className = 'stash-picker-grid';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'stash-picker-empty';
      empty.textContent = 'No artwork in Stash yet — save something to the Stash first.';
      grid.appendChild(empty);
    } else {
      items.forEach(item => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'stash-picker-cell';
        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.alt = item.type || 'Stash item';
        img.loading = 'lazy';
        cell.appendChild(img);
        cell.addEventListener('click', () => {
          _close();
          if (_currentCallback) _currentCallback(item);
        });
        grid.appendChild(cell);
      });
    }

    modal.appendChild(grid);
    _overlay.appendChild(modal);
  }

  window.openStashPicker = openStashPicker;
})();
