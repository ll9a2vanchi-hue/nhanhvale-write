// Fast, skippable selection animation. The editor has already rendered underneath.
(() => {
  try {
    if (localStorage.getItem('nv-write-selection-fx-v1') !== '1') {
      localStorage.setItem('nv-write-sound', 'off');
      localStorage.setItem('nv-write-selection-fx-v1', '1');
    }
  } catch {}
  let layer = null, timer = 0;
  function close() {
    clearTimeout(timer);
    layer?.remove(); layer = null;
    document.removeEventListener('pointerdown', onPointer, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('popstate', close);
  }
  // The next touch still reaches its destination, rather than being swallowed.
  function onPointer(event) {
    if (!event.target.closest?.('.nv-pick-skip')) close();
  }
  function onKey(event) {
    if (event.key === 'Escape' || !(event.ctrlKey || event.metaKey || event.altKey)) close();
  }
  function onVisibility() { if (document.hidden) close(); }
  window.nvRandomTransition = (mode, title) => {
    close();
    let fx = {};
    try { fx = JSON.parse(localStorage.getItem('nv-write-fx') || '{}') || {}; } catch {}
    if (fx.vibrate !== false && navigator.vibrate) {
      try { navigator.vibrate(18); } catch {}
    }
    if (fx.motion === false || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const review = mode === 'review', el = document.createElement('div');
    el.className = 'nv-pick-overlay ' + (review ? 'nv-pick-review' : 'nv-pick-write');
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.innerHTML = `<div class="nv-pick-scene" aria-hidden="true">
      <div class="nv-pick-card a"></div><div class="nv-pick-card b"></div><div class="nv-pick-card c"></div>
      <div class="nv-pick-book"><div class="nv-pick-left"></div><div class="nv-pick-right"></div>
        <div class="nv-pick-page p1"></div><div class="nv-pick-page p2"></div><div class="nv-pick-page p3"></div></div>
    </div><div class="nv-pick-label"><span></span><strong></strong><small></small></div>
    <button type="button" class="nv-pick-skip">Bỏ qua</button>`;
    el.querySelector('.nv-pick-label span').textContent = review ? 'Lật trang ký ức' : 'Xáo trộn thẻ bài';
    el.querySelector('.nv-pick-label strong').textContent = String(title || 'Bài viết');
    el.querySelector('.nv-pick-label small').textContent = review ? 'Bài ôn tập đã sẵn sàng' : 'Chủ đề viết đã sẵn sàng';
    el.querySelector('.nv-pick-skip').addEventListener('click', event => { event.stopPropagation(); close(); });
    layer = el; document.body.appendChild(el);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('popstate', close);
    timer = setTimeout(close, review ? 870 : 790);
  };
})();
