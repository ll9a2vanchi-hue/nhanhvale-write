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

// Both random actions must exclude a topic opted out of review (even an unfinished one).
const vm=require('node:vm');
const randomFrom=app.indexOf('function random(reviewMode)'),randomTo=app.indexOf('function resizeTitle(',randomFrom);
assert(randomFrom>=0&&randomTo>randomFrom,'random handler present');
const topics=[
 {id:'skip-write',title:'Bài ẩn khi viết',status:'draft',rating:'ok',no_review:true},
 {id:'write',title:'Bài viết hợp lệ',status:'draft',rating:'ok',no_review:false},
 {id:'skip-review',title:'Bài ẩn khi ôn',status:'done',rating:'ok',no_review:true},
 {id:'review',title:'Bài ôn hợp lệ',status:'done',rating:'ok',no_review:false},
 {id:'not-rated',title:'Bài chưa đánh giá',status:'draft',rating:'none',no_review:false}
];
const alerts=[],transition=[];
const ctx={current:null,active:()=>topics,autoStatus:t=>t.status,isDue:()=>true,
 render:()=>{},alert:msg=>alerts.push(msg),Math:{random:()=>0,floor:Math.floor},
 window:{nvRandomTransition:(mode,title)=>transition.push([mode,title])}};
vm.createContext(ctx);
vm.runInContext(app.slice(randomFrom,randomTo),ctx);
ctx.random(false);
assert.equal(ctx.current.id,'write','Viết ngẫu nhiên must exclude no_review');
ctx.random(true);
assert.equal(ctx.current.id,'review','Ôn ngẫu nhiên must exclude no_review');
topics.forEach(t=>t.no_review=true);
ctx.current=null;
ctx.random(false);
assert.equal(ctx.current,null,'all excluded writing topics must not be selected');
assert.equal(alerts.length,1,'empty random pool shows a message');
assert.equal(transition.length,2,'no transition should run when nothing is eligible');
assert(app.includes('put(t,{no_review:skip})'),'checkbox saves the choice');
console.log('PASS: random writing and review transitions');
