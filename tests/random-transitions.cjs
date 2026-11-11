// v6.22: transitions are visual-only, skippable and compatible with accessibility preferences.
const fs=require('node:fs'),assert=require('node:assert/strict'),read=p=>fs.readFileSync(p,'utf8');
const app=read('js/app.js'),js=read('js/random-transitions.js'),html=read('index.html'),css=read('css/app.css'),sw=read('sw.js');
assert(app.includes("window.nvRandomTransition?.(reviewMode?'review':'write',current.title)"),'random buttons');
assert(app.includes("if(tab==='review')window.nvRandomTransition?.('review',t.title)"),'review list');
assert(html.includes('js/random-transitions.js')&&html.indexOf('js/random-transitions.js')<html.indexOf('js/icons-fx.js'),'load order');
assert(sw.includes("'/js/random-transitions.js'"),'offline');
assert(js.includes("localStorage.setItem('nv-write-sound', 'off')"),'sound off');
assert(js.includes("document.addEventListener('pointerdown', onPointer, true)"),'touch skip');
assert(js.includes("document.addEventListener('keydown', onKey, true)"),'keyboard skip');
assert(js.includes("el.querySelector('.nv-pick-label strong').textContent"),'escape titles');
assert(js.includes("fx.vibrate !== false")&&js.includes("fx.motion === false")&&js.includes("prefers-reduced-motion: reduce"),'preferences');
assert(js.includes('setTimeout(close, review ? 870 : 790)'), 'bounded timing');
assert(css.includes('@keyframes nvPickShuffleA')&&css.includes('@keyframes nvPickPage'),'both animations');
console.log('PASS: random writing and review transitions');
