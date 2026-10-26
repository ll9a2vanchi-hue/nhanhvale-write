// Settings modal
(()=>{const modal=document.getElementById('nvModalBackdrop'),trigger=document.getElementById('settingsBtn');
trigger.onclick=()=>{if(tab!=='settings'&&tab!=='account')window.nvPreviousTab=tab;tab='settings';current=null;render();window.scrollTo(0,0)};
const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');trigger.focus()};
document.getElementById('nvModalClose').onclick=close;
modal.addEventListener('click',e=>{if(e.target===modal)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
document.getElementById('nvOpenSettings').onclick=()=>{close();if(tab!=='settings'&&tab!=='account')window.nvPreviousTab=tab;tab='settings';current=null;render();window.scrollTo(0,0)};
})();

// v6.13 colour toggle (mobile dock)
(()=>{const K='nv-write-colors-open';const sync=p=>{const open=localStorage.getItem(K)==='1';p.classList.toggle('nv-colors-open',open);const b=p.querySelector('.nv-color-toggle');if(b)b.setAttribute('aria-expanded',String(open));requestAnimationFrame(()=>window.nvUpdateFormatDock?.())};
document.addEventListener('pointerdown',e=>{if(e.target.closest('.nv-color-toggle'))e.preventDefault()},true);
document.addEventListener('click',e=>{const b=e.target.closest('.nv-color-toggle');if(!b)return;e.preventDefault();localStorage.setItem(K,localStorage.getItem(K)==='1'?'0':'1');const p=b.closest('#formatPanel');if(p)sync(p)});
new MutationObserver(()=>{const p=document.getElementById('formatPanel');if(p&&!p.dataset.nvColors){p.dataset.nvColors='1';sync(p)}}).observe(document.body,{childList:true,subtree:true});
})();

// v6.11
(()=>{
// ---- 2. Writing-mode celebration toast (no confetti, never over the caret line) ----
const wt=document.createElement('div');wt.className='nv-write-toast';wt.setAttribute('role','status');wt.setAttribute('aria-live','polite');document.body.appendChild(wt);let wtTimer=0;
const caretRect=()=>{try{const s=getSelection();if(!s.rangeCount)return null;const r=s.getRangeAt(0).cloneRange();r.collapse(false);const rects=r.getClientRects();if(rects.length)return rects[rects.length-1];const n=s.focusNode&&(s.focusNode.nodeType===1?s.focusNode:s.focusNode.parentElement);return n?n.getBoundingClientRect():null}catch{return null}};
const hit=(a,b,m=6)=>a&&b&&!(a.bottom+m<b.top||a.top-m>b.bottom);
function placeWT(){const vv=window.visualViewport,vTop=vv?vv.offsetTop:0,vH=vv?vv.height:innerHeight;const h=wt.offsetHeight||36;const vis=r=>r&&r.height>=h&&r.bottom>vTop+4&&r.top<vTop+vH-4;
 // Sit on the top toolbar when it is on screen; otherwise just above the formatting dock (inside the visual viewport, so the
 // on-screen keyboard is respected), or at the top if that would cover the caret. Never overlaps the dock.
 const bar=document.querySelector('.write-toolbar')?.getBoundingClientRect();const dEl=document.querySelector('#writeCustomization:not([hidden])');const dock=dEl&&dEl.offsetHeight?dEl.getBoundingClientRect():null;
 const A=vTop+8,c=caretRect();const onDock=t=>dock&&hit({top:t,bottom:t+h},dock,4);
 let top;if(vis(bar)&&bar.top>=vTop-2&&!onDock(bar.top+(bar.height-h)/2))top=bar.top+(bar.height-h)/2;else{const limit=dock&&dock.top<vTop+vH?dock.top:vTop+vH;const B=limit-h-8;top=B>=A&&!(c&&hit({top:B,bottom:B+h},c))?B:A}
 if(onDock(top))top=A;wt.style.top=Math.round(top)+'px'}
window.nvWritingToast=(title,label)=>{wt.innerHTML='<span aria-hidden="true">✦</span><b></b><span></span>';wt.querySelector('b').textContent=title;wt.querySelectorAll('span')[1].textContent=label;placeWT();wt.classList.add('show');clearTimeout(wtTimer);wtTimer=setTimeout(()=>wt.classList.remove('show'),2600)};
document.addEventListener('input',e=>{if(wt.classList.contains('show')&&e.target?.id==='body')placeWT()},true);
const rePlaceWT=()=>{if(wt.classList.contains('show'))requestAnimationFrame(placeWT)};window.visualViewport?.addEventListener('resize',rePlaceWT);window.visualViewport?.addEventListener('scroll',rePlaceWT);addEventListener('scroll',rePlaceWT,{passive:true});addEventListener('resize',rePlaceWT);document.addEventListener('click',e=>{if(e.target.closest?.('#writeCustomization'))setTimeout(rePlaceWT,0)},true);
// ---- 3. 'Màu nền' panel closes on outside tap, Escape, typing ----
const openPaper=()=>document.querySelector('body > #backgroundPanel:not([hidden])');
const closePaper=()=>{const p=openPaper();if(p)p.hidden=true;return !!p};
document.addEventListener('pointerdown',e=>{const p=openPaper();if(!p)return;if(p.contains(e.target)||e.target.closest?.('#backgroundToggle'))return;p.hidden=true},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&closePaper()){e.stopPropagation();document.querySelector('#backgroundToggle')?.focus()}},true);
document.addEventListener('beforeinput',e=>{if(e.target?.id==='body')closePaper()},true);
document.addEventListener('input',e=>{if(e.target?.id==='body'||e.target?.id==='title')closePaper()},true);
document.addEventListener('compositionstart',e=>{if(e.target?.id==='body')closePaper()},true);
// ---- 5. Styled confirm, delete with undo, trash view ----
window.nvConfirm=({title,body,ok='Đồng ý',cancel='Hủy'})=>new Promise(res=>{const prev=document.activeElement;const bd=document.createElement('div');bd.className='nv-confirm-backdrop';bd.innerHTML='<div class="nv-confirm" role="alertdialog" aria-modal="true" aria-labelledby="nvConfirmT" aria-describedby="nvConfirmB"><h2 id="nvConfirmT"></h2><p id="nvConfirmB"></p><div class="nv-confirm-actions"><button type="button" class="nv-confirm-cancel"></button><button type="button" class="nv-confirm-ok"></button></div></div>';bd.querySelector('h2').textContent=title;bd.querySelector('p').textContent=body;const c=bd.querySelector('.nv-confirm-cancel'),o=bd.querySelector('.nv-confirm-ok');c.textContent=cancel;o.textContent=ok;const done=v=>{bd.remove();document.removeEventListener('keydown',key,true);try{prev?.focus?.({preventScroll:true})}catch{}res(v)};const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false)}else if(e.key==='Tab'){e.preventDefault();(document.activeElement===c?o:c).focus()}};c.onclick=()=>done(false);o.onclick=()=>done(true);bd.addEventListener('click',e=>{if(e.target===bd)done(false)});document.addEventListener('keydown',key,true);document.body.appendChild(bd);c.focus()});
const ut=document.createElement('div');ut.className='nv-undo-toast';ut.setAttribute('role','status');ut.setAttribute('aria-live','polite');ut.innerHTML='<span></span><button type="button" id="nvUndoDelete">Hoàn tác</button>';document.body.appendChild(ut);let utTimer=0,utTopic=null;
const hideUndo=()=>{ut.classList.remove('show','nv-say');utTopic=null;clearTimeout(utTimer)};window.nvHideUndo=()=>hideUndo();window.nvUndoTopic=()=>utTopic;const say=m=>{utTopic=null;ut.querySelector('span').textContent=m;ut.querySelector('button').hidden=true;ut.classList.add('show','nv-say');clearTimeout(utTimer);utTimer=setTimeout(hideUndo,2200)};window.nvSay=say;
window.nvRestoreTopic=t=>{if(!t)return;put(t,{deleted:false});if(navigator.onLine&&!window.nvSignedOut)setTimeout(()=>{try{sync()}catch{}},400)};
ut.querySelector('button').onclick=()=>{const t=utTopic;hideUndo();if(!t)return;window.nvRestoreTopic(t);current=t;render();say('Đã khôi phục bài viết')};
window.nvDeleteTopic=async t=>{if(document.querySelector('.nv-confirm-backdrop'))return;window.nvFlushEditor?.();const ok=await window.nvConfirm({title:'Chuyển bài vào thùng rác?',body:'“'+(t.title||'Bài viết')+'” sẽ được chuyển vào Thùng rác. Bạn có thể khôi phục lại bất cứ lúc nào trong mục Chủ đề.',ok:'Chuyển vào thùng rác',cancel:'Giữ lại'});if(!ok)return;put(t,{deleted:true});current=null;render();utTopic=t;ut.querySelector('button').hidden=false;ut.classList.remove('nv-say');ut.querySelector('span').textContent='Đã chuyển “'+(t.title||'Bài viết')+'” vào thùng rác';ut.classList.add('show');clearTimeout(utTimer);utTimer=setTimeout(hideUndo,10000)};
window.nvTrashOpen=false;
const baseTopics=topics;
const trashView=()=>{const arr=db.topics.filter(t=>t.deleted&&t.status!=='purged').sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));return `<div class="card"><div class="nv-trash-head"><button type="button" id="nvTrashBack" aria-label="Quay lại danh sách chủ đề">←</button><div><div class="title" style="margin:0">🗑 Thùng rác</div><span class="hint">${arr.length} bài đã xóa · khôi phục để dùng lại</span></div></div>${arr.length?'<button type="button" class="btn nv-danger-btn" id="nvEmptyTrash">Dọn sạch thùng rác</button>':''}</div>${arr.map(t=>`<div class="card nv-trash-item"><div><strong>${esc(t.title||'Bài viết')}</strong><span class="hint">${count(t.content).toLocaleString('vi-VN')} chữ · Xóa lúc ${esc(new Date(t.updated_at).toLocaleString('vi-VN'))}</span></div><div class="nv-trash-actions"><button type="button" class="btn" data-restore="${esc(t.id)}">↺ Khôi phục</button><button type="button" class="btn nv-danger-btn" data-purge="${esc(t.id)}" aria-label="Xóa vĩnh viễn “${esc(t.title||'Bài viết')}”">Xóa vĩnh viễn</button></div></div>`).join('')||'<div class="card hint">Thùng rác trống.</div>'}`};
topics=function(){if(window.nvTrashOpen)return trashView();const n=db.topics.filter(t=>t.deleted&&t.status!=='purged').length;return baseTopics()+(n?`<button type="button" class="nv-trash-link" id="nvOpenTrash">🗑 Thùng rác (${n})</button>`:'')};
document.addEventListener('click',e=>{const el=e.target.closest?.('#nvOpenTrash,#nvTrashBack,[data-restore],#nvFirstWrite,#tabs button');if(!el)return;
 if(el.matches('#tabs button')){window.nvTrashOpen=false;return}
 if(el.id==='nvOpenTrash'){window.nvTrashOpen=true;render();scrollTo(0,0);return}
 if(el.id==='nvTrashBack'){window.nvTrashOpen=false;render();return}
 if(el.id==='nvFirstWrite'){const t=add('Bài viết đầu tiên của tôi','Chưa phân loại');current=t;render();const ti=document.querySelector('#title');if(ti){ti.focus();ti.select()}return}
 const t=db.topics.find(x=>x.id===el.dataset.restore);if(t){window.nvRestoreTopic(t);if(utTopic===t)hideUndo();render();say('Đã khôi phục “'+(t.title||'Bài viết')+'”')}},true);
// Undo toast hides when a post is opened in the editor (keeps the writing surface clean)
})();

// v6.12
// v6.12.0 — several tabs of the app share one localStorage. Before every save we
// merge what other tabs wrote (by post id, newer edit wins, union of posts, nothing
// is ever dropped), and tabs tell each other when they saved.
(()=>{
 const TAB=uid();const readDisk=()=>{try{return JSON.parse(localStorage.getItem(KEY))}catch{return null}};
 const seen=new Map();const remember=topics=>{for(const t of topics||[])if(t&&t.id)seen.set(t.id,t.updated_at)};
 remember(readDisk()?.topics||db.topics);
 const replaceInPlace=(target,src)=>{for(const k of Object.keys(target))if(!(k in src))delete target[k];Object.assign(target,structuredClone(src))};
 const sameText=(a,b)=>(a.title||'')===(b.title||'')&&(a.content||'')===(b.content||'')&&(a.richHtml||a.contentHtml||'')===(b.richHtml||b.contentHtml||'')&&!!a.deleted===!!b.deleted;
 const time=x=>new Date(x||0).getTime()||0;
 let pendingConflicts=[],refreshOpen=false,listChanged=false;
 // Merge other tabs' data from localStorage into memory. Returns true if anything changed.
 let lastRaw=localStorage.getItem(KEY);
 window.nvMergeDisk=()=>{
  const raw=localStorage.getItem(KEY);if(raw===lastRaw)return false; // nobody else wrote since our last look
  let d=null;try{d=JSON.parse(raw)}catch{}lastRaw=raw;if(!d||!Array.isArray(d.topics))return false;
  const byId=new Map(db.topics.map(t=>[t.id,t]));let changed=false;
  const openT=window.nvEditorTopic||null,openDirty=!!window.nvEditorDirty?.();
  for(const dt of d.topics){
   if(!dt||typeof dt!=='object'||!dt.id)continue;const lt=byId.get(dt.id);
   if(!lt){db.topics.push(structuredClone(dt));seen.set(dt.id,dt.updated_at);changed=listChanged=true;continue}
   if(lt.updated_at===dt.updated_at){seen.set(dt.id,dt.updated_at);continue}
   const base=seen.get(dt.id),diskChanged=dt.updated_at!==base;
   const localChanged=lt.updated_at!==base||(lt===openT&&openDirty);
   if(!diskChanged)continue; // only this tab changed it: keep ours, it is written next
   if(!localChanged||sameText(lt,dt)){
    if(localChanged&&time(lt.updated_at)>time(dt.updated_at)){seen.set(dt.id,dt.updated_at);continue}
    replaceInPlace(lt,dt);seen.set(dt.id,dt.updated_at);changed=listChanged=true;if(lt===openT)refreshOpen=true;continue}
   // One tab deleted it while the other kept writing: writing wins (nothing lost; it can be deleted again).
   if(!!lt.deleted!==!!dt.deleted){if(lt.deleted&&!dt.deleted){replaceInPlace(lt,dt);changed=listChanged=true;if(lt===openT)refreshOpen=true}seen.set(dt.id,dt.updated_at);continue}
   // Both tabs edited the same post: keep this tab's text, save the other tab's text as a copy.
   const copyId='nv-tab-'+dt.id+'-'+time(dt.updated_at);
   if(!db.topics.some(t=>t.id===copyId)&&!d.topics.some(t=>t.id===copyId)){
    const now=new Date().toISOString();const copy={...structuredClone(dt),id:copyId,title:(dt.title||'Bài viết')+' (bản từ tab khác)',created_at:now,updated_at:now,pinned:false,deleted:false};
    db.topics.unshift(copy);queue(copy);seen.set(copyId,copy.updated_at);pendingConflicts.push({main:lt,copy});changed=listChanged=true}
   seen.set(dt.id,dt.updated_at);
  }
  // keep other tabs' unsynced queue entries
  if(Array.isArray(d.syncQueue)){const q=new Map(db.syncQueue.map(x=>[x.id,x]));for(const x of d.syncQueue){if(!x||!x.id)continue;const mine=q.get(x.id);if(!mine||time(x.updated_at)>time(mine.updated_at))q.set(x.id,x)}db.syncQueue=[...q.values()]}
  if(d.logs&&typeof d.logs==='object')for(const [day,n] of Object.entries(d.logs))if(typeof n==='number'&&n>(db.logs[day]||0))db.logs[day]=n;
  if(Array.isArray(d.categories)&&time(d.categoriesUpdatedAt)>time(db.categoriesUpdatedAt)){db.categories=d.categories;db.categoriesUpdatedAt=d.categoriesUpdatedAt}
  if(pendingConflicts.length)setTimeout(showConflicts,0);
  return changed};
 let bc=null;try{bc=new BroadcastChannel('nv-write-sync')}catch{}
 window.nvAfterSave=json=>{remember(db.topics);lastRaw=json;try{bc?.postMessage({type:'saved',from:TAB})}catch{}};
 const editingField=()=>{const a=document.activeElement;return !!a&&a!==document.body&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))};
 let timer=0;const onExternal=()=>{clearTimeout(timer);timer=setTimeout(()=>{
  // Unsaved typing in the open post goes in first, so the merge can see both versions.
  const openT=window.nvEditorTopic;if(openT&&window.nvEditorDirty?.()){const d=readDisk();const dt=d?.topics?.find?.(x=>x&&x.id===openT.id);if(dt&&dt.updated_at!==seen.get(openT.id))window.nvFlushEditor?.()}
  const conflictsBefore=pendingConflicts.length;const changed=window.nvMergeDisk();
  if(pendingConflicts.length>conflictsBefore)save();
  if(!changed)return;
  const openNow=window.nvEditorTopic;
  if(refreshOpen&&openNow&&current&&current.id===openNow.id){refreshOpen=false;if(!window.nvEditorDirty?.()){if(current.deleted){current=null}render();window.nvSay?.('Bài viết vừa được cập nhật từ tab khác')}}
  else if(listChanged&&!openNow&&!editingField()){listChanged=false;render()}
  else if(!openNow){renderMetrics?.()}
 },60)};
 bc?.addEventListener('message',e=>{if(e.data?.from!==TAB)onExternal()});
 window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null)onExternal()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&listChanged&&!window.nvEditorTopic){listChanged=false;render()}});
 let showing=false;async function showConflicts(){if(showing||!pendingConflicts.length)return;showing=true;const list=pendingConflicts.splice(0);try{
  const picks=await nvPickConflicts(list.map(x=>({a:x.main,b:x.copy})),{intro:'Bài này vừa được sửa ở một tab khác trong lúc bạn đang viết. Không mất chữ nào: bản ở tab kia đã được lưu thành bài “(bản từ tab khác)”. Chọn bản bạn muốn giữ làm bài chính.',a:'Ở tab này',b:'Ở tab khác',choices:[['1','Giữ bản tab này'],['2','Dùng bản tab khác'],['3','Giữ cả hai']]});
  if(!picks)return;picks.forEach((v,i)=>{if(v!=='2')return;const {main,copy}=list[i];window.nvFlushEditor?.();const keep={title:main.title,content:main.content,richHtml:main.richHtml??main.contentHtml??null,paperColor:main.paperColor};const take={title:String(copy.title).replace(/ \(bản từ tab khác\)$/,''),content:copy.content,richHtml:copy.richHtml??copy.contentHtml??null,paperColor:copy.paperColor};delete main.contentHtml;delete copy.contentHtml;Object.assign(main,take,{updated_at:new Date().toISOString()});queue(main);Object.assign(copy,keep,{title:(keep.title||'Bài viết')+' (bản tab này trước đó)',updated_at:new Date().toISOString()});queue(copy)});
  save();render()}finally{showing=false;if(pendingConflicts.length)showConflicts()}}
 // ---- Trash: permanent delete keeps a tiny tombstone so other devices remove it too
 const blank=t=>{const now=new Date().toISOString();for(const k of ['contentHtml','content_html','richHtml','paperColor','paper_color'])delete t[k];Object.assign(t,{title:'',content:'',richHtml:null,status:'purged',deleted:true,rating:null,pinned:false,tag:'Chưa phân loại',completed_at:null,last_reviewed:null,review_due_at:null,updated_at:now});queue(t);
  let touched=false;links=links.map(l=>!l.deleted&&(l.a===t.id||l.b===t.id)?(touched=true,{...l,deleted:true,updated_at:now}):l);if(touched)saveLinks?.()};
 const syncSoon=()=>{if(navigator.onLine&&!window.nvSignedOut)setTimeout(()=>{try{sync()}catch{}},400)};
 window.nvPurgeTopics=list=>{if(window.nvUndoTopic?.()&&list.includes(window.nvUndoTopic()))window.nvHideUndo?.();list.forEach(blank);save();syncSoon()};
 document.addEventListener('click',async e=>{const el=e.target.closest?.('[data-purge],#nvEmptyTrash');if(!el)return;e.preventDefault();e.stopPropagation();
  if(document.querySelector('.nv-confirm-backdrop'))return;
  if(el.id==='nvEmptyTrash'){const list=db.topics.filter(t=>t.deleted&&t.status!=='purged');if(!list.length)return;
   const ok=await window.nvConfirm({title:'Dọn sạch thùng rác?',body:'Xóa vĩnh viễn '+list.length+' bài trong Thùng rác, trên máy này và trên cloud. Không thể hoàn tác.',ok:'Xóa vĩnh viễn',cancel:'Giữ lại'});
   if(!ok)return;window.nvPurgeTopics(list);render();window.nvSay?.('Đã dọn sạch thùng rác');return}
  const t=db.topics.find(x=>x.id===el.dataset.purge);if(!t)return;
  const ok=await window.nvConfirm({title:'Xóa vĩnh viễn bài này?',body:'“'+(t.title||'Bài viết')+'” sẽ bị xóa hẳn trên máy này và trên cloud. Không thể hoàn tác.',ok:'Xóa vĩnh viễn',cancel:'Giữ lại'});
  if(!ok)return;window.nvPurgeTopics([t]);render();window.nvSay?.('Đã xóa vĩnh viễn')},true);
})();

// v6.13 multi-tab aux merge
/* v6.13: multi-tab merge-before-save + broadcast for links, review history and XP. Union by id; XP events are never lost or double counted. */
(()=>{
const KEYS={links:'nv-write-links-v1',reviews:'nv-write-review-history-v1',xp:'nv-write-xp-v1'};
const last={};for(const k in KEYS){try{last[k]=localStorage.getItem(KEYS[k])}catch{}}
const ts=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0};
const sum=a=>(a||[]).reduce((n,e)=>n+(+e.words||0),0);
if(xp.base==null)xp.base=Math.max(0,(xp.total||0)-sum(xp.events));xp.sent||=[];
function union(mine,disk,stamp){const m=new Map();for(const x of Array.isArray(disk)?disk:[])if(x&&typeof x.id==='string')m.set(x.id,x);for(const x of Array.isArray(mine)?mine:[]){if(!x||typeof x.id!=='string')continue;const d=m.get(x.id);if(!d)m.set(x.id,x);else{const a=stamp(x),b=stamp(d);if(a>b||a===b&&(!!x.deleted>=!!d.deleted))m.set(x.id,x)}}return [...m.values()]}
const linkStamp=l=>ts(l.updated_at);const revStamp=e=>ts(e.updated_at||e.at);
function mergeXPInto(target,d){if(!d||typeof d!=='object')return target;const sent=[...new Set([...(target.sent||[]),...(d.sent||[])])].slice(-1000);const sentSet=new Set(sent);const ev=new Map();for(const e of [...(d.events||[]),...(target.events||[])])if(e&&e.id&&!sentSet.has(e.id))ev.set(e.id,e);const dBase=d.base!=null?d.base:Math.max(0,(d.total||0)-sum(d.events));const high={...(d.high||{})};for(const[k,v]of Object.entries(target.high||{}))high[k]=Math.max(high[k]||0,v||0);let cloud=target.cloud||null;if(d.cloud&&(!cloud||d.cloud.user===cloud.user&&ts(d.cloud.wm)>ts(cloud.wm)))cloud=d.cloud;target.sent=sent;target.events=[...ev.values()];target.high=high;target.base=cloud?(cloud.total||0):Math.max(target.base||0,dBase||0);target.cloud=cloud;target.initialized=!!(target.initialized||d.initialized);target.total=target.base+sum(target.events);return target}
function read(k){let raw=null;try{raw=localStorage.getItem(KEYS[k])}catch{return {raw:null,val:null}}let val=null;try{val=JSON.parse(raw)}catch{}return {raw,val}}
function mergeAux(k){const {raw,val}=read(k);if(raw==null||raw===last[k])return false;if(k==='links')links=union(links,val,linkStamp);else if(k==='reviews')reviewHistory=union(reviewHistory,val,revStamp);else if(k==='xp')mergeXPInto(xp,val);last[k]=raw;return true}
let bc=null;try{bc=new BroadcastChannel('nv-write-aux')}catch{}
window.nvMergeAux=k=>{try{return mergeAux(k)}catch(e){console.warn('WRITE aux merge',k,e);return false}};
window.nvMergeXP=()=>window.nvMergeAux('xp');
window.nvAfterAux=(k,raw)=>{last[k]=raw;try{bc?.postMessage({k})}catch{}};
let tm=0;const pending=new Set();
function onExternal(k){pending.add(k);clearTimeout(tm);tm=setTimeout(()=>{const ks=[...pending];pending.clear();let changed=false;for(const x of ks)changed=window.nvMergeAux(x)||changed;if(!changed)return;try{refreshXP()}catch{}if(!current&&!document.querySelector('dialog[open]')){try{render()}catch(e){console.warn(e)}}},60)}
if(bc)bc.onmessage=e=>{if(e.data&&KEYS[e.data.k])onExternal(e.data.k)};
window.addEventListener('storage',e=>{for(const k in KEYS)if(e.key===KEYS[k])onExternal(k)});
})();
