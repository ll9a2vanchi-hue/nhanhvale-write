const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('index.html','utf8');
let next=1,timers=new Map(),reads=0,saves=0,awards=[];
const el={innerHTML:'<div>ban đầu</div>',innerText:'ban đầu',listeners:{},addEventListener(k,f){(this.listeners[k]??=[]).push(f)}};
const topic={content:'ban đầu',richHtml:el.innerHTML};
const context={window:{},setTimeout:f=>{let id=next++;timers.set(id,f);return id},clearTimeout:id=>timers.delete(id),safeRich:x=>{reads++;return x},earnXP:(t,b,a,eligible)=>awards.push(eligible),put:(t,p)=>{saves++;Object.assign(t,p)},count:s=>s.split(/\s+/).length,autoStatus:()=> 'draft',$:()=>null};
vm.createContext(context);
vm.runInContext(src.slice(src.indexOf('function bindEditorDraft('),src.indexOf("\ndocument.addEventListener('visibilitychange'")),context);
context.bindEditorDraft(el,topic);
const fire=(k,e={})=>el.listeners[k]?.forEach(f=>f(e));
const tick=()=>{const current=[...timers.values()];timers.clear();current.forEach(f=>f())};
el.innerText+=' mới';el.innerHTML+='<div>mới</div>';fire('input',{inputType:'insertText'});
assert.equal(reads,0);assert.equal(saves,0);
fire('compositionstart');tick();assert.equal(reads,0);
fire('input',{inputType:'insertCompositionText',isComposing:true});tick();assert.equal(reads,0);
fire('compositionend');tick();assert.equal(saves,1);assert.equal(awards[0],true);
context.window.nvFlushEditor();assert.equal(reads,1,'unchanged draft must not be reparsed');
el.innerText+=' gõ tiếp';el.innerHTML+='<div>gõ tiếp</div>';fire('input',{inputType:'insertText'});
context.window.nvEditorCleanup();tick();assert.equal(saves,2);assert.equal(topic.content,el.innerText);
context.bindEditorDraft(el,topic); // use the new session callback directly through the window
context.window.nvFlushEditor();assert.equal(saves,2);
// Viewport geometry: exercise the actual production callback with frame ordering.
let frames=[],scrolls=[];const rich={isConnected:true,contains:()=>true,addEventListener(){}};
const custom={isConnected:true,offsetHeight:54,style:{setProperty(k,v){if(k==='top')this.top=parseFloat(v)},removeProperty(){}},getBoundingClientRect(){return {top:this.style.top}}};
const win={visualViewport:{offsetTop:0,height:400,addEventListener(){},removeEventListener(){}},matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},scrollBy:o=>scrolls.push(o.top)};
const ctx={window:win,rich,custom,document:{activeElement:rich,querySelector:()=>({getBoundingClientRect:()=>({bottom:60})})},requestAnimationFrame:f=>{frames.push(f);return frames.length},cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},getSelection:()=>({isCollapsed:true,rangeCount:1,focusNode:{},getRangeAt:()=>({cloneRange:()=>({getClientRects:()=>[{top:380,bottom:412,height:32}]})})}),Node:{ELEMENT_NODE:1}};
vm.createContext(ctx);const a=src.indexOf('let dockFrame=0,caretFrame=0');const b=src.indexOf('// Keep the selected text selected',a);vm.runInContext(src.slice(a,b)+'\nviewportResize();',ctx);while(frames.length)frames.shift()();
assert.equal(custom.style.top,346);assert.deepEqual(scrolls,[82]);
// Writing mode: <body> is the scroll container (html+body overflow:auto), so the
// correction must scroll body, not the window (window.scrollBy is a no-op there).
{const docEl={};const body={scrollTop:0,scrollHeight:2000,clientHeight:400,parentElement:docEl};let frames2=[],scrolls2=[];
const rich2={...rich,parentElement:body};const win2={...win,scrollBy:o=>scrolls2.push(o.top)};
const ctx2={...ctx,window:win2,rich:rich2,custom:{...custom,style:{setProperty(k,v){if(k==='top')this.top=parseFloat(v)},removeProperty(){}},getBoundingClientRect(){return {top:this.style.top}}},document:{...ctx.document,activeElement:rich2,documentElement:docEl},getComputedStyle:e=>({overflowY:e===body?'auto':'visible'}),requestAnimationFrame:f=>{frames2.push(f);return frames2.length}};
ctx2.custom.offsetHeight=54;vm.createContext(ctx2);vm.runInContext(src.slice(a,b)+'\nviewportResize();',ctx2);while(frames2.length)frames2.shift()();
assert.equal(body.scrollTop,82,'caret correction must scroll the body scroll container');assert.deepEqual(scrolls2,[],'window must not be scrolled when body absorbs the delta');}
assert(src.includes("closest('[contenteditable],textarea,input')"));assert(src.includes("NodeFilter.FILTER_REJECT:NodeFilter.FILTER_SKIP"));
console.log('PASS: deferred serialization, IME composition, idle save, dirty-only flush, immediate navigation flush, cancelled timers, caret/dock correction (82px, body scroller), editor observer exclusion');
// v6.10.0 — storage slimming keeps data and derives the sync/backup field.
{const a=src.indexOf('function nvSlimTopic(');const b=src.indexOf("const KEY='nv-write-v1'",a);const m={};vm.createContext(m);vm.runInContext(src.slice(a,b)+';this.slim=nvSlimTopic;this.full=nvFullTopic;',m);
const same={id:'a',content:'x',richHtml:'<b>x</b>',contentHtml:'<b>x</b>',content_html:'<b>x</b>'};m.slim(same);
assert.deepEqual(Object.keys(same).sort(),['content','id','richHtml'],'identical copies are dropped');assert.equal(m.full(same).contentHtml,'<b>x</b>','sync/backup still gets contentHtml');assert.equal(same.contentHtml,undefined,'full() must not mutate the stored record');
const diff={id:'b',richHtml:'<i>r</i>',contentHtml:'<i>c</i>'};m.slim(diff);assert.equal(diff.contentHtml,'<i>c</i>','differing legacy copy is never dropped');assert.equal(m.full(diff).contentHtml,'<i>c</i>');
const noRich={id:'c',contentHtml:'<b>only</b>'};m.slim(noRich);assert.equal(noRich.contentHtml,'<b>only</b>','record without richHtml is untouched');
const plain={id:'d',content:'p'};assert.deepEqual(m.slim(plain),{id:'d',content:'p'});assert.equal(m.full(plain).contentHtml,undefined);}
// Saves and sync use the slim/full helpers; sync is no longer skipped when local storage is full.
assert(src.includes('db.topics.forEach(nvSlimTopic);const nvJson=JSON.stringify(db);localStorage.setItem(KEY,nvJson)'),'save() slims before writing');
assert(src.includes('(nvFullTopic(local)))'),'sync payload derives content_html');
assert(src.includes('async function nvSyncInner(){if(syncing||!navigator.onLine)return;')&&src.includes('function sync(){if(syncing||!navigator.onLine)return Promise.resolve();'),'sync must still run when storage is full');
assert(!src.includes('contentHtml:html}'),'editor must not write a duplicate HTML copy');
// Sanitizer parses in an inert document and sanitizes children of unwrapped tags.
assert(src.includes("const safeRich=html=>{const box=new DOMParser().parseFromString("),'safeRich must use an inert DOMParser document');
assert(src.includes('if(!allowed.has(child.tagName)){walk(child);child.replaceWith'),'unwrapped tags must have their children sanitized');
// Quick add re-renders so new topics and counters appear without reload.
{const q=src.slice(src.indexOf("on('#add','click'"),src.indexOf("on('#quickPriority'"));assert(/render\(\)/.test(q),'quick add must call render()')}
// Memoized word count returns the same results as the plain counter.
{const a=src.indexOf('count=(()=>');const c={};vm.createContext(c);vm.runInContext('this.count='+src.slice(a+6,src.indexOf('})();',a)+5),c);for(const s of ['', '  a  b ','Tiếng Việt có dấu','x\ny\tz',null,undefined,'Tiếng Việt có dấu'])assert.equal(c.count(s),(String(s||'').trim().match(/\S+/gu)||[]).length)}
console.log('PASS: v6.10.0 storage slimming/migration, sync when storage full, inert sanitizer, quick-add render, memoized count');
