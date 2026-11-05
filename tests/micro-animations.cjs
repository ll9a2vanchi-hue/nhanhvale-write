// v6.17.0 regression: motion is opt-out and never changes editor geometry.
const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('js/app.js','utf8'),css=fs.readFileSync('css/app.css','utf8'),fx=fs.readFileSync('js/icons-fx.js','utf8');
for(const name of ['nv-streak-ignite','nv-streak-count-pop','nv-streak-sparkle','nv-save-confirm','nv-save-pending','nv-completion-draw','nv-topic-enter','nv-xp-level-up','nv-tool-more','nv-tool-colors'])assert(app.includes(name)||css.includes(name),name+' exists');
assert(app.includes("next.total>prev.total&&nvMotionEnabled()"),'XP only increases on earned progress');
assert(app.includes('!previous.goalMet||previous.day!==day'),'streak only on new goal');
assert(app.includes('if(enteringTopic){document.body.scrollTop=0'),'scroll-to-top fix retained');
assert(app.includes('if(completed&&nvMotionEnabled())'),'completion only on finish');
assert(app.includes('if(savedChange&&!dirty&&nvMotionEnabled())'),'save feedback after success');
assert(css.includes('prefers-reduced-motion:reduce'),'reduced motion');
assert(css.includes('data-nv-motion=off'),'user preference');
assert(fx.includes("document.documentElement.dataset.nvMotion=fx.motion?'on':'off'"),'FX toggle');
const animations=css.slice(css.indexOf('/* ==== v6.17.0:'));
assert(!/min-height\s*:|height\s*:\s*(?:100|calc)|scrollTop\s*=|overflow-y\s*:/.test(animations),'does not change layout');
console.log('PASS: six animation areas, save safety, system/user motion controls');
