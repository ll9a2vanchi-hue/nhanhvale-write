/* Nhanhvale Write — independent notebook workspace. Never mutates legacy articles. */
(function(root){
'use strict';
const NAME='nv-write-notebooks-v1',STORE='books',COLORS=['#476d91','#668b77','#a77d58','#8573ae','#af6d76','#5b8193'];
const INKS={
 default:['Mặc định','#273447','#ecf1f7'],
 blue:['Xanh dương','#1d4ed8','#93c5fd'],
 green:['Xanh lá','#166534','#86efac'],
 red:['Đỏ','#b91c1c','#fca5a5'],
 purple:['Tím','#6d28d9','#d8b4fe'],
 amber:['Nâu cam','#92400e','#fcd34d']
};
const inkByColor=new Map();
for(const [name,[,light,dark]] of Object.entries(INKS)){
 for(const hex of [light,dark]){
  const rgb=hex.slice(1).match(/../g).map(channel=>parseInt(channel,16)).join(',');
  inkByColor.set(hex,name);
  inkByColor.set('rgb('+rgb+')',name);
 }
}
const kinds={writing:'Vở luyện viết',knowledge:'Vở kiến thức',free:'Vở tự do'};
const dateFormat=new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'});
const positions=new WeakMap();
const recentKey='nv-nb-recent';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>root.crypto?.randomUUID?.()||('nb-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const now=()=>new Date().toISOString();
const words=s=>(String(s||'').trim().match(/\S+/gu)||[]).length;
const short=s=>String(s||'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').slice(0,70)||'quyen-vo';
let db=null,books=[],ready=false,failed='',selected=null,sectionId=null,page=0,filter='',showArchived=false,showTrash=false;
let chooserOpen=false,creating=false;
let syncGeneration=0,lastSyncedGeneration=-1;
let syncMessage='Đăng nhập để đồng bộ vở giữa các thiết bị.';
const pending=new Map();
let view=localStorage.getItem('nv-nb-mode')==='flip'?'flip':'scroll',refresh=()=>{},baseText='',composing=false;
const button=(action,label,extra='')=>'<button type="button" data-nb="'+action+'" '+extra+'>'+label+'</button>';
function openDB(){return new Promise((res,rej)=>{if(!root.indexedDB)return rej(Error('Trình duyệt không hỗ trợ IndexedDB'));const req=indexedDB.open(NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error||Error('Không mở được dữ liệu quyển vở'));req.onblocked=()=>rej(Error('Hãy đóng các tab Write khác và thử tải lại'))})}
function getAll(){return new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function put(b){return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(structuredClone(b));t.oncomplete=()=>{syncGeneration++;res();};t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
let channel=null;try{channel=new BroadcastChannel('nv-write-notebooks')}catch{}
async function load(){try{db=await openDB();books=await getAll();ready=true;failed='';if(document.querySelector('.nv-book-ui'))refresh();renderContinue()}catch(e){failed=e.message||String(e);ready=true;if(document.querySelector('.nv-book-ui'))refresh()}}
function saveStatus(b){
 const entry=pending.get(b?.id);
 return entry?.failed?'Chưa lưu được':entry?'Đang lưu…':'✓ Đã lưu trên thiết bị';
}
function mark(label){
 const e=document.querySelector('#nvBookStatus');
 if(e)e.textContent=label;
 const retry=document.querySelector('[data-nb="retry-save"]');
 if(retry){
  const failed=pending.get(selected)?.failed;
  retry.hidden=!failed;
  if(failed)document.querySelector('.nv-book-focused [data-nb="focus-mode"]')?.click();
 }
}
async function persist(b,entry){
 clearTimeout(entry.timer);
 if(entry.writing)return;
 entry.writing=true;
 try{
  if(!db)throw Error('Bộ nhớ chưa sẵn sàng');
  await put(b);
  if(pending.get(b.id)===entry)pending.delete(b.id);
  channel?.postMessage({id:b.id});
 }catch{
  entry.writing=false;
  entry.failed=true;
 }
 if(selected===b.id)mark(saveStatus(b));
}
function save(b,{touch=true}={}){
 if(touch)b.updated_at=now();
 clearTimeout(pending.get(b.id)?.timer);
 const entry={timer:setTimeout(()=>persist(b,entry),450)};
 pending.set(b.id,entry);
 if(selected===b.id)mark(saveStatus(b));
}
function book(){return books.find(b=>b.id===selected&&!b.deleted)||null}
function lastPart(b){return b.parts.find(p=>p.id===b.lastPart)||b.parts[0]}
function section(){const b=book();return b?.parts.find(p=>p.id===sectionId)||b?.parts[0]||null}
function draftFlush(){
 clearTimeout(root.nvNotebookXPTimeout);
 const b=book(),s=section();
 if(s&&s.text!==baseText){
  if(b.kind==='writing')root.nvNotebookActivity?.(b.id,s.id,baseText,s.text,true);
  baseText=s.text;
 }
 for(const [id,entry] of pending){
  const changed=books.find(item=>item.id===id);
  if(changed&&!entry.failed)persist(changed,entry);
 }
}
function titleSuggestion(kind){
 const base=kinds[kind];
 const existing=new Set(books.map(b=>b.title.toLocaleLowerCase('vi')));
 let n=1;
 while(existing.has((base+' '+n).toLocaleLowerCase('vi')))n++;
 return base+' '+n;
}
function recentBook(){
 const active=books.filter(b=>!b.deleted&&!b.archived);
 const recent=localStorage.getItem(recentKey);
 return active.find(b=>b.id===recent)||active.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0];
}
function continueHTML(){
 const b=recentBook();
 if(!b)return '';
 return '<button type="button" id="nvBookContinue" class="nv-book-continue"><span><strong>Viết tiếp</strong><small>'+esc(b.title)+' · '+esc(lastPart(b)?.title||'Chưa đặt tên phần')+'</small></span><span aria-hidden="true">›</span></button>';
}
function renderContinue(){
 const mount=document.querySelector('#nvBookContinueMount');
 if(mount)mount.innerHTML=continueHTML();
}
function resume(go){
 const b=recentBook();
 go();
 if(b)openBook(b.id);
}
function newBookChooser(){
 if(!chooserOpen)return '';
 return '<div class="nv-book-choice-overlay" data-nb-overlay>'
  +'<section class="nv-book-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="nvBookChooseTitle" aria-describedby="nvBookChooseDesc">'
  +'<div class="nv-book-choice-handle" aria-hidden="true"></div>'
  +'<div class="nv-book-choice-head"><div><h3 id="nvBookChooseTitle">Tạo quyển vở</h3><p id="nvBookChooseDesc">Đặt tên và chọn loại vở.</p></div>'
  +button('cancel-new','×','class="nv-book-choice-close" aria-label="Đóng bảng chọn"')+'</div>'
  +'<form id="nvBookCreateForm"><label for="nvBookNewTitle">Tên vở</label><input id="nvBookNewTitle" maxlength="120" value="'+esc(titleSuggestion('writing'))+'">'
  +'<div class="nv-book-choice-list">'
  +button('choose-writing','<span class="nv-book-choice-symbol" aria-hidden="true">✎</span><span class="nv-book-choice-text"><strong>Vở luyện viết</strong><small>Viết mỗi ngày, tích lũy XP và duy trì chuỗi</small></span><span class="nv-book-choice-arrow" aria-hidden="true">›</span>','class="nv-book-choice-card is-writing" aria-pressed="true"')
  +button('choose-knowledge','<span class="nv-book-choice-symbol" aria-hidden="true">▤</span><span class="nv-book-choice-text"><strong>Vở kiến thức</strong><small>Ghi chép bài học, chia phần và chương</small></span><span class="nv-book-choice-arrow" aria-hidden="true">›</span>','class="nv-book-choice-card is-knowledge" aria-pressed="false"')
  +button('choose-free','<span class="nv-book-choice-symbol" aria-hidden="true">✧</span><span class="nv-book-choice-text"><strong>Vở tự do</strong><small>Nhật ký, ý tưởng và những điều muốn viết</small></span><span class="nv-book-choice-arrow" aria-hidden="true">›</span>','class="nv-book-choice-card is-free" aria-pressed="false"')
  +'</div><button class="nv-book-primary nv-book-create-submit" type="submit">Tạo và viết</button></form></section></div>';
}
function notebookCovers(){
 const query=filter.toLocaleLowerCase('vi').trim();
 const arr=books.filter(b=>!!b.deleted===showTrash&&(showTrash||!!b.archived===showArchived)&&
  (!query||(b.title+' '+b.parts.map(s=>s.title+' '+s.text).join(' ')).toLocaleLowerCase('vi').includes(query)))
  .sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||String(b.updated_at).localeCompare(String(a.updated_at)));
 if(!arr.length){
  const message=query?'Không tìm thấy quyển vở phù hợp.':showTrash?'Thùng rác trống.':showArchived?'Chưa có vở lưu trữ.':'Tạo quyển vở đầu tiên để bắt đầu viết.';
  return '<div class="nv-book-empty">'+message+'</div>';
 }
 return arr.map(b=>{
  const date=new Date(b.updated_at);
  const updated=Number.isFinite(date.getTime())?dateFormat.format(date):'';
  const part=lastPart(b)?.title||'Chưa đặt tên phần';
  const cover=COLORS.includes(b.cover)?b.cover:COLORS[0];
  const coverClass='class="nv-book-cover" style="--cover:'+cover+'"';
  const coverStart=showTrash?'<div '+coverClass+'>':'<button type="button" '+coverClass+
   ' data-nb="open" data-id="'+esc(b.id)+'" aria-label="Mở quyển '+esc(b.title)+'">';
  return '<article class="nv-book-tile">'+coverStart+
   '<span class="nv-book-cover-title">'+esc(b.title)+'</span>'+
   (b.pinned?'<span class="nv-book-cover-pin">Đã ghim</span>':'')+
   (showTrash?'</div>':'</button>')+
   '<button type="button" class="nv-book-cover-menu" data-nb="menu" data-id="'+esc(b.id)+
   '" aria-label="Tùy chọn vở '+esc(b.title)+'">⋯</button>'+
   '<div class="nv-book-tile-meta"><strong>'+esc(part)+'</strong>'+
   (updated?'<small>'+esc(updated)+'</small>':'')+'</div></article>';
 }).join('');
}
function catalog(){
 return '<div class="nv-book-ui">'+
  '<div class="nv-book-header"><h2>Quyển vở</h2>'+button('new','+ Tạo vở','class="nv-book-main"')+'</div>'+
  '<div class="nv-book-controls"><input id="nvBookSearch" type="search" autocomplete="off" placeholder="Tìm tên vở, phần hoặc nội dung…" value="'+esc(filter)+'" aria-label="Tìm quyển vở">'+
  '<div class="nv-book-filters">'+button('active','Đang dùng','aria-pressed="'+(!showArchived&&!showTrash)+'"')+
  button('archive-list','Lưu trữ','aria-pressed="'+(showArchived&&!showTrash)+'"')+
  button('trash-list','Thùng rác','aria-pressed="'+showTrash+'"')+'</div></div>'+
  '<div class="nv-book-grid" id="nvBookResults">'+notebookCovers()+'</div>'+newBookChooser()+
  '<div class="nv-book-help"><span id="nvBookCloudStatus" role="status">'+esc(syncMessage)+'</span>'+button('export-all','Sao lưu vở','class="nv-book-link"')+
  button('import-all','Nhập bản sao lưu','class="nv-book-link"')+
  '<input hidden type="file" id="nvBookImport" accept=".json,application/json"></div></div>';
}
function sanitizeNotebookRich(markup){
 const holder=document.createElement('template');holder.innerHTML=String(markup||'');
 const accepted=new Set(['BR','DIV','P','SPAN','B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','HR','FONT']);
 const banned=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','TEXTAREA','BUTTON','IMG','VIDEO','AUDIO','LINK','META']);
 const walk=node=>{
  for(const child of [...node.childNodes]){
   if(child.nodeType===8){child.remove();continue}
   if(child.nodeType!==1)continue;
   if(banned.has(child.tagName)){child.remove();continue}
   walk(child);
   if(!accepted.has(child.tagName)){child.replaceWith(...child.childNodes);continue}
   const ink=child.getAttribute('data-nv-ink');
   const border=child.getAttribute('data-nv-border');
   const rawColor=child.style.color||child.getAttribute('color')||'';
   const color=Object.hasOwn(INKS,ink)?ink:inkByColor.get(rawColor.toLowerCase().replaceAll(' ',''));
   for(const attr of [...child.attributes])child.removeAttribute(attr.name);
   if(color)child.setAttribute('data-nv-ink',color);
   if(Object.hasOwn(INKS,border))child.setAttribute('data-nv-border',border);
  }
 };
 walk(holder.content);return holder.innerHTML;
}
function notebookRich(part){return part.richHtml?sanitizeNotebookRich(part.richHtml):esc(part.text||'').replace(/\n/g,'<br>')}
function sectionDialogs(b,s){
 return '<dialog id="nvBookContents" class="nv-book-dialog" aria-labelledby="nvBookContentsTitle">'+
  '<div class="nv-book-choice-head"><h3 id="nvBookContentsTitle">Mục lục</h3>'+button('close-dialog','×','aria-label="Đóng mục lục"')+'</div>'+
  '<ol class="nv-book-part-list">'+b.parts.map(p=>'<li>'+button('select-part',esc(p.title||'Chưa đặt tên phần'),
   'data-id="'+esc(p.id)+'"'+(p.id===s.id?' aria-current="true"':''))+'</li>').join('')+'</ol>'+
  button('add-part','+ Thêm phần','class="nv-book-primary"')+'</dialog>'+
  '<dialog id="nvBookPartDialog" class="nv-book-dialog" aria-labelledby="nvBookPartDialogTitle">'+
  '<div class="nv-book-choice-head"><h3 id="nvBookPartDialogTitle">Thêm phần</h3>'+button('close-dialog','×','aria-label="Đóng thêm phần"')+'</div>'+
  '<form id="nvBookPartForm"><label for="nvBookPartName">Tên phần</label>'+
  '<input id="nvBookPartName" maxlength="120" value="Phần '+(b.parts.length+1)+'" required autofocus>'+
  '<button type="submit" class="nv-book-primary">Tạo và viết</button></form></dialog>';
}
function palette(type){
 return Object.entries(INKS).map(([name,[label]])=>
  '<button type="button" data-nb-'+type+'="'+name+'" data-nv-swatch="'+name+'" aria-label="'+
  (type==='ink'?'Màu chữ ':'Viền ')+label+'"></button>').join('');
}
function formatPalette(){
 return '<div id="nvBookPalette" class="nv-book-palette" hidden>'+
  '<div class="nv-book-palette-group" role="group" aria-label="Màu chữ"><strong>Màu chữ</strong>'+
  '<div>'+palette('ink')+'</div></div>'+
  '<div class="nv-book-palette-group" role="group" aria-label="Tô viền"><strong>Tô viền</strong>'+
  '<div>'+palette('border')+'<button type="button" data-nb-border="none" aria-label="Bỏ viền">×</button></div></div>'+
  '<p class="nv-book-palette-hint" role="status"></p></div>';
}
function writer(){
 const b=book();if(!b)return catalog();
 const s=section();if(!s)return catalog();
 const totalWords=b.parts.reduce((n,p)=>n+words(p.text),0);
 const paper=['#ffffff','#fffdf7','#f6f8ff','#f2faf5','#fcf5ff'].includes(b.paperColor)?b.paperColor:'#ffffff';
 const kindLabel=b.kind==='writing'?'Luyện viết · XP':b.kind==='knowledge'?'Kiến thức':'Tự do';
 return '<div class="nv-book-ui nv-book-writing write-screen">'
  +'<div class="nv-book-top write-toolbar">'
  +button('back','←','class="tool-btn nv-book-back" title="Quay lại thư viện" aria-label="Quay lại thư viện"')
  +'<span class="nv-book-save write-save" id="nvBookStatus" role="status">'+saveStatus(b)+'</span>'
  +button('retry-save','Thử lại','class="nv-book-link"'+(pending.get(b.id)?.failed?'':' hidden'))
  +'<span class="nv-book-top-count" id="nvBookTopWords">'+totalWords.toLocaleString('vi-VN')+' chữ</span>'
  +button('paper','◐','class="tool-btn" title="Đổi màu nền viết" aria-label="Đổi màu nền viết"')
  +button('copy','⧉','class="tool-btn" title="Sao chép phần này" aria-label="Sao chép phần này"')
  +'<details class="write-menu nv-book-menu"><summary class="tool-btn" aria-label="Tùy chọn quyển vở">⋮</summary>'
  +'<div class="write-menu-panel">'
  +'<div class="write-menu-heading">'+esc(kindLabel)+' · '+b.parts.length+' phần</div>'
  +button('rename','✎ Sửa tên vở','class="btn secondary nv-book-menu-action"')
  +'<div class="write-menu-heading">Xuất nội dung</div>'
  +button('export','⇩ Xuất vở này (.txt)','class="btn outline nv-book-menu-action"')
  +button('export-md','Xuất Markdown','class="btn outline nv-book-menu-action"')
  +'<p class="hint">Mọi thay đổi được tự động lưu trên thiết bị.</p></div></details></div>'
  +'<div class="nv-book-write-options">'
  +button('contents','Mục lục','class="nv-book-outline" aria-haspopup="dialog" aria-controls="nvBookContents"')
  +button('add-part','+ Thêm phần','class="nv-book-primary" aria-haspopup="dialog"')
  +'<div class="nv-book-modes" role="group" aria-label="Chế độ viết">'
  +button('scroll','Cuộn',view==='scroll'?'class="active" aria-pressed="true"':'aria-pressed="false"')
  +button('flip','Lật trang',view==='flip'?'class="active" aria-pressed="true"':'aria-pressed="false"')
  +'</div></div>'
  +'<div class="nv-book-paper-popover" id="nvBookPaperPanel" hidden><span>Nền trang viết</span>'
  +['#ffffff','#fffdf7','#f6f8ff','#f2faf5','#fcf5ff'].map(c=>button('set-paper','<span class="nv-book-paper-swatch" style="--swatch:'+c+'"></span>','class="nv-book-paper-choice'+(paper===c?' active':'')+'" data-color="'+c+'" aria-label="Màu giấy '+c+'"')).join('')
  +'</div>'
  +'<div class="write-document nv-book-document" style="--paper:'+paper+'">'
  +'<div class="write-info-strip">'
  +'<div class="nv-book-title-row"><textarea id="nvBookTitle" class="editor-title nv-book-title" rows="1" maxlength="120" spellcheck="false" aria-label="Tên quyển vở, chạm để sửa" placeholder="Tên quyển vở…">'+esc(b.title)+'</textarea>'
  +button('rename','✎','class="nv-book-rename" title="Đổi tên vở" aria-label="Đổi tên vở"')+'</div>'
  +'<input id="nvBookPartTitle" class="nv-book-part-title" maxlength="120" aria-label="Tên phần hoặc chương" value="'+esc(s.title)+'" placeholder="Tên phần hoặc chương…">'
  +'</div>'
  +'<div id="nvBookBody" class="rich-editor nv-book-rich-editor'+(view==='flip'?' nv-book-flip-editor':'')+'" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" aria-label="Nội dung phần trong quyển vở" data-placeholder="Bắt đầu viết nội dung…">'+notebookRich(s)+'</div>'
  +'</div>'
  +'<div class="nv-book-dock"><div class="nv-book-pager"'+(view==='flip'?'':' hidden')+'>'+button('prev','‹ Trang trước','disabled')+'<span id="nvBookPageCount">1 / 1</span>'+button('next','Trang sau ›','disabled')+'</div>'
  +formatPalette()
  +'<div class="nv-book-format-dock" role="toolbar" aria-label="Định dạng khi viết">'
  +'<button type="button" data-nb-format="bold" title="In đậm" aria-label="In đậm"><b>B</b></button>'
  +'<button type="button" data-nb-format="italic" title="In nghiêng" aria-label="In nghiêng"><i>I</i></button>'
  +'<button type="button" data-nb-format="underline" title="Gạch chân" aria-label="Gạch chân"><u>U</u></button>'
  +'<button type="button" data-nb-format="insertUnorderedList" title="Danh sách dấu chấm" aria-label="Danh sách dấu chấm">☷</button>'
  +button('palette','<span aria-hidden="true">A</span>','class="nv-book-palette-toggle" title="Màu chữ và tô viền" aria-label="Màu chữ và tô viền" aria-expanded="false" aria-controls="nvBookPalette"')
  +'<span class="nv-book-dock-spacer"></span>'
  +button('focus-mode','˄','class="nv-book-focus-toggle" title="Thu gọn phần đầu" aria-label="Thu gọn phần đầu" aria-pressed="false"')
  +'<button type="button" data-nb-format="undo" title="Hoàn tác" aria-label="Hoàn tác">↶</button>'
  +'<button type="button" data-nb-format="redo" title="Làm lại" aria-label="Làm lại">↷</button>'
  +'</div></div>'+sectionDialogs(b,s)+'</div>';
}

function html(){if(!ready)return '<div class="nv-book-ui"><div class="card">Đang mở thư viện quyển vở…</div></div>';if(failed)return '<div class="nv-book-ui"><div class="card">⚠ '+esc(failed)+'. Chưa chỉnh sửa dữ liệu cũ.</div></div>';return selected?writer():catalog()}
function restoreBook(id){
 chooserOpen=false;
 rememberPosition(document.querySelector('#nvBookBody'));
 draftFlush();
 const b=books.find(book=>book.id===id&&!book.deleted);
 selected=b?.id||null;
 const part=b&&lastPart(b);
 sectionId=part?.id||null;
 baseText=part?.text||'';
 composing=false;
}
function openBook(id){
 restoreBook(id);
 if(selected){
  try{localStorage.setItem(recentKey,selected)}catch{}
 }
 refresh();
 window.scrollTo(0,0);
}
async function create(kind,title){
 if(!db||creating||!Object.hasOwn(kinds,kind))return;
 creating=true;
 const id=uid(),pid=uid();
 const b={id,title:title.trim().slice(0,120)||titleSuggestion(kind),kind,cover:COLORS[books.length%COLORS.length],pinned:false,archived:false,deleted:false,created_at:now(),updated_at:now(),lastPart:pid,parts:[{id:pid,title:'Trang đầu tiên',text:'',created_at:now(),updated_at:now()}]};
 try{
  await put(b); // Commit to IndexedDB before navigating; no ghost notebook on storage failure.
  books.unshift(b);
  channel?.postMessage({id:b.id,updated_at:b.updated_at});
  showTrash=false;showArchived=false;filter='';
  chooserOpen=false;
  openBook(id);
 }catch(e){alert('Chưa thể tạo vở: '+(e?.message||e)+'. Không có dữ liệu cũ nào bị thay đổi.')}
 finally{creating=false}
}
function download(name,data,mime){const u=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function exportBook(b,kind){const body=b.parts.map((s,i)=> (kind==='markdown'?'# '+s.title:'['+(i+1)+'] '+s.title)+'\n\n'+s.text).join('\n\n---\n\n');download(short(b.title)+(kind==='txt'?' - '+new Date().toLocaleDateString('sv-SE'):'')+(kind==='markdown'?'.md':'.txt'),(kind==='markdown'?'':'\uFEFF'+b.title+'\n\n')+body,kind==='markdown'?'text/markdown;charset=utf-8':'text/plain;charset=utf-8')}
function exportAll(){draftFlush();download('nhanhvale-write-quyen-vo-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({type:'nhanhvale-notebooks',version:1,books:exportData()},null,2),'application/json')}
function exportData(){return ready&&!failed?books.map(b=>structuredClone(b)):undefined}
async function importData(input){if(!Array.isArray(input))return 0;if(!db)throw Error('Bộ nhớ quyển vở chưa sẵn sàng');if(input.length>10000)throw Error('Quá nhiều quyển vở');let added=0;for(const x of input){if(!x||typeof x!=='object'||typeof x.id!=='string'||!Array.isArray(x.parts)||!x.parts.length||x.parts.length>10000||typeof x.title!=='string'||x.parts.some(p=>!p||typeof p.text!=='string'||typeof p.id!=='string'||typeof p.title!=='string'||p.text.length>2000000))throw Error('Bản sao lưu quyển vở không hợp lệ');const old=books.find(b=>b.id===x.id);if(old&&JSON.stringify(old)===JSON.stringify(x))continue;const b=structuredClone(x);if(old){b.id=uid();b.title=(b.title+' (bản nhập)').slice(0,120)}b.cover=COLORS.includes(b.cover)?b.cover:COLORS[0];b.created_at=b.created_at||now();b.updated_at=now();b.parts=b.parts.map(p=>({...p,id:p.id||uid()}));books.push(b);await put(b);added++}if(added){channel?.postMessage({reload:true});if(!selected)refresh()}return added}
async function handleImport(file){if(!file)return;try{const data=JSON.parse(await file.text());const b=Array.isArray(data)?data:Array.isArray(data.books)?data.books:data.notebooks;if(!Array.isArray(b))throw Error('Không tìm thấy dữ liệu quyển vở');if(!confirm('Nhập '+b.length+' quyển vở? Nội dung trùng nhưng khác sẽ được giữ thành bản sao.'))return;const n=await importData(b);alert('Đã nhập '+n+' quyển vở. Các bài viết cũ vẫn giữ nguyên.')}catch(e){alert('Không thể nhập: '+e.message)}}
function currentAnchor(body){
 const bounds=body.getBoundingClientRect();
 const viewport=root.visualViewport;
 const top=Math.max(bounds.top,viewport?.offsetTop||0);
 const bottom=Math.min(bounds.bottom,viewport?viewport.offsetTop+viewport.height:innerHeight);
 const sel=root.getSelection();
 if(sel?.rangeCount&&body.contains(sel.anchorNode)){
  const range=sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect=range.getBoundingClientRect();
  if(rect.left>=bounds.left&&rect.left<=bounds.right&&rect.top>=top&&rect.top<bottom)return range;
 }
 for(let y=top+4;y<bottom;y+=16){
  const x=bounds.left+4;
  const caret=document.caretPositionFromPoint?.(x,y);
  const range=caret?document.createRange():document.caretRangeFromPoint?.(x,y);
  if(caret){range.setStart(caret.offsetNode,caret.offset);range.collapse(true)}
  if(range&&body.contains(range.startContainer))return range;
 }
 return null;
}
function revealAnchor(body,range){
 if(!range)return;
 const rect=range.getBoundingClientRect(),bounds=body.getBoundingClientRect();
 if(view==='flip'){
  const width=body.clientWidth||1;
  body.scrollLeft=Math.max(0,Math.floor((rect.left-bounds.left+body.scrollLeft+1)/width))*width;
 }else{
  body.scrollTop+=rect.top-bounds.top-12;
 }
}
function rememberPosition(body){
 const part=section();
 if(!body||!part)return;
 const anchor=currentAnchor(body);
 if(!anchor)return;
 const prefix=document.createRange();
 prefix.selectNodeContents(body);
 prefix.setEnd(anchor.startContainer,anchor.startOffset);
 positions.set(part,{offset:prefix.toString().length});
}
function restorePosition(body){
 const position=positions.get(section());
 if(!position)return;
 const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);
 let offset=position.offset;
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  if(offset<=node.length){
   const anchor=document.createRange();
   anchor.setStart(node,offset);
   revealAnchor(body,anchor);
   return;
  }
  offset-=node.length;
 }
}
function offsetsOf(body,range){
 const prefix=document.createRange();
 prefix.selectNodeContents(body);
 prefix.setEnd(range.startContainer,range.startOffset);
 const start=prefix.toString().length;
 return [start,start+range.toString().length];
}
function selectOffsets(body,[start,end]){
 const range=document.createRange();
 const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);
 let at=0,started=false;
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const next=at+node.length;
  if(!started&&start<=next){range.setStart(node,start-at);started=true}
  if(started&&end<=next){
   range.setEnd(node,end-at);
   const selection=root.getSelection();
   selection.removeAllRanges();
   selection.addRange(range);
   return;
  }
  at=next;
 }
}
function applyBorder(body,range,color){
 const ancestor=range.commonAncestorContainer;
 const existing=(ancestor.nodeType===Node.ELEMENT_NODE?ancestor:ancestor.parentElement)?.closest('[data-nv-border]');
 if(existing&&body.contains(existing))range.selectNode(existing);
 if(range.collapsed||!range.toString().trim())return false;
 const offsets=offsetsOf(body,range);
 const content=document.createElement('div');
 content.append(range.cloneContents());
 content.querySelectorAll('[data-nv-border]').forEach(el=>el.removeAttribute('data-nv-border'));
 if(color!=='none'){
  const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);
  const textNodes=[];
  for(let node=walker.nextNode();node;node=walker.nextNode())if(node.data.trim())textNodes.push(node);
  for(const node of textNodes){
   const span=document.createElement('span');
   span.dataset.nvBorder=color;
   node.replaceWith(span);
   span.append(node);
  }
 }
 const selection=root.getSelection();
 selection.removeAllRanges();
 selection.addRange(range);
 if(!document.execCommand('insertHTML',false,content.innerHTML))return false;
 selectOffsets(body,offsets);
 return true;
}
function bind(rerender){refresh=rerender;const rootEl=document.querySelector('.nv-book-ui');if(!rootEl)return;
 rootEl.addEventListener('click',async e=>{const el=e.target.closest('button[data-nb]');if(!el)return;const action=el.dataset.nb,id=el.dataset.id;switch(action){
 case 'new':chooserOpen=true;refresh();document.querySelector('[data-nb="choose-writing"]')?.focus({preventScroll:true});return;
 case 'cancel-new':closeChooser();return;
 case 'choose-writing':case 'choose-knowledge':case 'choose-free':{
  const current=rootEl.querySelector('.nv-book-choice-card[aria-pressed="true"]');
  const title=rootEl.querySelector('#nvBookNewTitle');
  const suggestion=titleSuggestion(action.slice(7));
  if(!title.value.trim()||title.value===title.defaultValue)title.value=suggestion;
  title.defaultValue=suggestion;
  current.setAttribute('aria-pressed','false');
  el.setAttribute('aria-pressed','true');
  return;
 }
 case 'open':openBook(id);return;
 case 'back':
  if(root.history.state?.nvWriteView?.notebookId===selected)root.history.back();
  else{restoreBook(null);refresh()}
  return;
 case 'active':showTrash=false;showArchived=false;refresh();return;
 case 'archive-list':showTrash=false;showArchived=true;refresh();return;
 case 'trash-list':showTrash=true;showArchived=false;refresh();return;
 case 'scroll':case 'flip':{
  if(action===view||composing)return;
  const anchor=currentAnchor(body);
  view=action;
  localStorage.setItem('nv-nb-mode',view);
  body.classList.toggle('nv-book-flip-editor',view==='flip');
  rootEl.querySelector('.nv-book-pager').hidden=view!=='flip';
  for(const mode of rootEl.querySelectorAll('.nv-book-modes button')){
   const active=mode.dataset.nb===view;
   mode.classList.toggle('active',active);
   mode.setAttribute('aria-pressed',String(active));
  }
  body.scrollLeft=0;
  body.scrollTop=0;
  revealAnchor(body,anchor);
  paging();
  return;
 }
 case 'prev':case 'next':body.scrollTo({left:(page+(action==='next'?1:-1))*body.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;
 case 'palette':togglePalette();return;
 case 'focus-mode':setFocusMode(!rootEl.classList.contains('nv-book-focused'));return;
 case 'contents':showContents();return;
 case 'close-dialog':el.closest('dialog').close();return;
 case 'add-part':{
  rootEl.querySelector('#nvBookContents').close();
  rootEl.querySelector('#nvBookPartForm').reset();
  rootEl.querySelector('#nvBookPartDialog').showModal();
  rootEl.querySelector('#nvBookPartName').select();
  return;
 }
 case 'select-part':{
  el.closest('dialog').close();
  if(id===section()?.id)return;
  rememberPosition(body);
  draftFlush();
  const b=book();
  sectionId=id;
  b.lastPart=id;
  baseText=section()?.text||'';
  save(b,{touch:false});
  refresh();
  document.querySelector('[data-nb="contents"]')?.focus({preventScroll:true});
  return;
 }
 case 'retry-save':save(book(),{touch:false});return;
 case 'export-all':exportAll();return;
 case 'import-all':document.querySelector('#nvBookImport')?.click();return;
 case 'export':case 'export-md':{draftFlush();const b=book();if(!b)return;const type=action==='export-md'?'markdown':'txt';exportBook(b,type);return}
 case 'rename':{el.closest('details')?.removeAttribute('open');const title=rootEl.querySelector('#nvBookTitle');title?.focus();title?.select();return}
 case 'copy':{
  const b=book(),p=section();
  if(!b||!p)return;
  let message='Đã sao chép phần này';
  try{await navigator.clipboard.writeText(b.title+'\n\n'+p.title+'\n\n'+p.text);el.textContent='✓'}
  catch{message='Không thể sao chép';el.textContent='!'}
  el.setAttribute('aria-label',message);
  setTimeout(()=>{el.textContent='⧉';el.setAttribute('aria-label','Sao chép phần này')},1600);
  return;
 }
 case 'paper':{const panel=rootEl.querySelector('#nvBookPaperPanel');if(panel)panel.hidden=!panel.hidden;return}
 case 'set-paper':{const b=book(),paper=id||el.dataset.color;if(!b||!['#ffffff','#fffdf7','#f6f8ff','#f2faf5','#fcf5ff'].includes(paper))return;b.paperColor=paper;save(b);rootEl.querySelector('.nv-book-document')?.style.setProperty('--paper',paper);rootEl.querySelector('#nvBookPaperPanel').hidden=true;return}
 case 'menu':{const b=books.find(b=>b.id===id);if(!b)return;const choice=prompt('Tùy chọn: 1 Đổi tên · 2 Đổi màu · 3 Ghim/bỏ ghim · 4 Lưu trữ/khôi phục · 5 Nhân bản · 6 Chuyển vào thùng rác/khôi phục','1');if(!choice)return;switch(choice.trim()){case '1':{const n=prompt('Tên quyển vở',b.title);if(n&&n.trim())b.title=n.trim().slice(0,120);else return;break}case '2':b.cover=COLORS[(COLORS.indexOf(b.cover)+1)%COLORS.length];break;case '3':b.pinned=!b.pinned;break;case '4':b.archived=!b.archived;break;case '5':{const copy=structuredClone(b);copy.id=uid();copy.title=(b.title+' (bản sao)').slice(0,120);copy.created_at=now();copy.updated_at=now();copy.parts=copy.parts.map(s=>({...s,id:uid()}));copy.lastPart=copy.parts[0]?.id;await put(copy);books.push(copy);channel?.postMessage({id:copy.id});refresh();return}case '6':if(!b.deleted&&!confirm('Chuyển quyển vở vào thùng rác? Có thể khôi phục sau.'))return;b.deleted=!b.deleted;break;default:return}save(b);refresh();return}
 }});
 rootEl.addEventListener('click',e=>{if(e.target.matches('.nv-book-choice-overlay'))closeChooser()});
 const search=rootEl.querySelector('#nvBookSearch');
 const updateSearch=()=>{
  filter=search.value;
  rootEl.querySelector('#nvBookResults').innerHTML=notebookCovers();
 };
 search?.addEventListener('input',e=>{if(!e.isComposing)updateSearch()});
 search?.addEventListener('compositionend',updateSearch);
 rootEl.querySelector('#nvBookImport')?.addEventListener('change',e=>handleImport(e.target.files?.[0]));
 rootEl.querySelector('#nvBookCreateForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=e.submitter||rootEl.querySelector('.nv-book-create-submit');
  const kind=rootEl.querySelector('.nv-book-choice-card[aria-pressed="true"]').dataset.nb.slice(7);
  submit.disabled=true;
  try{await create(kind,rootEl.querySelector('#nvBookNewTitle').value)}
  finally{submit.disabled=false}
 });
 rootEl.querySelector('#nvBookPartForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const name=rootEl.querySelector('#nvBookPartName').value.trim();
  if(!name){rootEl.querySelector('#nvBookPartName').focus();return}
  rememberPosition(body);
  draftFlush();
  const b=book();
  const part={id:uid(),title:name.slice(0,120),text:'',created_at:now(),updated_at:now()};
  b.parts.push(part);
  sectionId=part.id;
  b.lastPart=part.id;
  baseText='';
  save(b);
  refresh();
  document.querySelector('#nvBookBody')?.focus();
 });
 function showContents(){
  const dialog=rootEl.querySelector('#nvBookContents');
  const current=dialog.querySelector('[aria-current="true"]');
  current.textContent=section().title||'Chưa đặt tên phần';
  dialog.showModal();
  current.focus();
 }
 const title=rootEl.querySelector('#nvBookTitle');
 if(title){
  const resize=()=>{title.style.height='auto';title.style.height=title.scrollHeight+'px'};
  resize();
  title.addEventListener('input',()=>{const b=book();if(!b)return;const next=title.value.slice(0,120);b.title=next;save(b);resize()});
  title.addEventListener('blur',()=>{const b=book();if(!b)return;if(!b.title.trim()){b.title='Quyển vở chưa đặt tên';title.value=b.title;save(b)}});
 }
 rootEl.querySelector('#nvBookPartTitle')?.addEventListener('input',e=>{const b=book(),p=section();if(!b||!p)return;p.title=e.target.value.slice(0,120);save(b)});
 const body=rootEl.querySelector('#nvBookBody');
 const palettePanel=rootEl.querySelector('#nvBookPalette');
 let paletteRange=null;
 function setFocusMode(active){
  if(!body||rootEl.classList.contains('nv-book-focused')===active)return;
  const anchor=view==='flip'?currentAnchor(body):null;
  const toggle=rootEl.querySelector('[data-nb="focus-mode"]');
  const label=active?'Hiện phần đầu':'Thu gọn phần đầu';
  rootEl.classList.toggle('nv-book-focused',active);
  toggle.textContent=active?'⌄':'˄';
  toggle.title=label;
  toggle.setAttribute('aria-label',label);
  toggle.setAttribute('aria-pressed',String(active));
  if(view==='flip'){revealAnchor(body,anchor);paging()}
 }
 function editorRange(){
  const selection=root.getSelection();
  if(selection?.rangeCount&&body.contains(selection.anchorNode)&&body.contains(selection.focusNode)){
   return selection.getRangeAt(0).cloneRange();
  }
  return null;
 }
 function togglePalette(force){
  if(!palettePanel)return;
  const open=force??palettePanel.hidden;
  if(open)paletteRange=editorRange();
  palettePanel.hidden=!open;
  rootEl.querySelector('[data-nb="palette"]').setAttribute('aria-expanded',String(open));
  if(open)palettePanel.querySelector('.nv-book-palette-hint').textContent='';
 }
 const paging=()=>{
  if(!body||view!=='flip')return;
  const width=body.clientWidth||1;
  const total=Math.max(1,Math.ceil((body.scrollWidth-1)/width));
  page=Math.max(0,Math.min(total-1,Math.round(body.scrollLeft/width)));
  rootEl.querySelector('[data-nb="prev"]').disabled=page<=0;
  rootEl.querySelector('[data-nb="next"]').disabled=page>=total-1;
  rootEl.querySelector('#nvBookPageCount').textContent=(page+1)+' / '+total;
 };
 if(body){
  let pasteIntent=false;
  body.addEventListener('click',()=>{setFocusMode(true);togglePalette(false)});
  body.addEventListener('input',()=>setFocusMode(true));
  rootEl.addEventListener('keydown',e=>{
   if(e.key!=='Escape'||e.defaultPrevented||e.target.closest('dialog'))return;
   if(!palettePanel.hidden){togglePalette(false);e.preventDefault()}
   else if(rootEl.classList.contains('nv-book-focused')){setFocusMode(false);e.preventDefault()}
  });
  rootEl.querySelector('[data-nb="palette"]').addEventListener('pointerdown',e=>e.preventDefault());
  palettePanel.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});
  palettePanel.addEventListener('click',e=>{
   const action=e.target.closest('button');
   if(!action)return;
   const range=paletteRange&&body.contains(paletteRange.commonAncestorContainer)?paletteRange:editorRange();
   const hint=palettePanel.querySelector('.nv-book-palette-hint');
   if(!range){
    hint.textContent='Chạm vào nội dung hoặc bôi đen chữ để định dạng.';
    return;
   }
   body.focus({preventScroll:true});
   const selection=root.getSelection();
   selection.removeAllRanges();
   selection.addRange(range);
   if(action.dataset.nbBorder){
    if(!applyBorder(body,range,action.dataset.nbBorder)){
     hint.textContent='Bôi đen đoạn muốn tô viền hoặc đặt con trỏ vào đoạn đã có viền.';
     return;
    }
   }else{
    const ink=INKS[action.dataset.nbInk];
    const dark=document.documentElement.dataset.theme==='dark';
    document.execCommand('foreColor',false,ink[dark?2:1]);
   }
   record({inputType:'format'});
   togglePalette(false);
  });
  const refreshCount=()=>{
   const b=book();if(!b)return;
   const countText=b.parts.reduce((n,p)=>n+words(p.text),0).toLocaleString('vi-VN')+' chữ';
   rootEl.querySelector('#nvBookTopWords').textContent=countText;
  };
  const record=e=>{
   const b=book(),p=section();if(!b||!p)return;
   const plain=body.innerText.replace(/\u00a0/g,' ').replace(/\r\n?/g,'\n');
   const previous=p.text;
   p.text=plain;p.richHtml=sanitizeNotebookRich(body.innerHTML);p.updated_at=now();
   const excluded=pasteIntent||/insertFromPaste|insertFromDrop|historyUndo|historyRedo/i.test(e.inputType||'');
   pasteIntent=false;
   if(excluded){if(b.kind==='writing')root.nvNotebookActivity?.(b.id,p.id,baseText,p.text,false);baseText=p.text}
   save(b);refreshCount();
   if(!composing&&b.kind==='writing'&&!excluded&&plain!==previous){
    clearTimeout(root.nvNotebookXPTimeout);
    root.nvNotebookXPTimeout=setTimeout(()=>{
     if(composing)return;
     root.nvNotebookActivity?.(b.id,p.id,baseText,p.text,true);
     baseText=p.text;
    },600);
   }
   if(view==='flip')requestAnimationFrame(paging);
  };
  body.addEventListener('compositionstart',()=>{composing=true});
  body.addEventListener('compositionend',()=>{composing=false;record({inputType:'insertCompositionText'})});
  body.addEventListener('paste',e=>{
   e.preventDefault();
   pasteIntent=true;
   document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));
  });
  body.addEventListener('drop',e=>{e.preventDefault()});
  body.addEventListener('input',record);
  body.addEventListener('blur',()=>{clearTimeout(root.nvNotebookXPTimeout);draftFlush()});
  rootEl.querySelectorAll('[data-nb-format]').forEach(btn=>{
   btn.addEventListener('pointerdown',e=>e.preventDefault());
   btn.addEventListener('click',()=>{
    body.focus({preventScroll:true});
    document.execCommand(btn.dataset.nbFormat,false,null);
    record({inputType:'format'});
   });
  });
  rootEl.querySelectorAll('.nv-book-modes button').forEach(btn=>{
   btn.addEventListener('pointerdown',e=>e.preventDefault());
  });
  body.addEventListener('scroll',paging,{passive:true});
  requestAnimationFrame(()=>{restorePosition(body);paging()});
  const observer='ResizeObserver'in root?new ResizeObserver(paging):null;
  observer?.observe(body);
  const viewport=root.visualViewport;
  const updateDock=()=>{
   const covered=viewport&&viewport.scale===1?Math.max(0,innerHeight-viewport.height-viewport.offsetTop):0;
   rootEl.style.setProperty('--nv-book-keyboard',covered+'px');
  };
  updateDock();
  viewport?.addEventListener('resize',updateDock);
  viewport?.addEventListener('scroll',updateDock);
  root.nvBookResizeCleanup=()=>{
   observer?.disconnect();
   viewport?.removeEventListener('resize',updateDock);
   viewport?.removeEventListener('scroll',updateDock);
  };

 }

}
function closeChooser(){
 chooserOpen=false;
 refresh();
 document.querySelector('[data-nb="new"]')?.focus({preventScroll:true});
}
function cleanup(){root.nvBookResizeCleanup?.();root.nvBookResizeCleanup=null}
function isEditing(){return !!selected}
function wordCount(){return books.filter(b=>!b.deleted&&!b.archived).reduce((n,b)=>n+(b.parts||[]).reduce((m,p)=>m+words(p.text),0),0)}
channel?.addEventListener('message',async()=>{if(!selected&&!chooserOpen&&!pending.size&&db){try{books=await getAll();if(document.querySelector('.nv-book-ui'))refresh();renderContinue()}catch{}}});
document.addEventListener('keydown',e=>{if(!chooserOpen)return;if(e.key==='Escape'){e.preventDefault();closeChooser();return}if(e.key==='Tab'){const items=[...document.querySelectorAll('.nv-book-choice-sheet :is(input,button):not([disabled])')];if(!items.length)return;const i=items.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();items[items.length-1].focus()}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0].focus()}}});
document.addEventListener('click',e=>{if(chooserOpen&&e.target.closest('#tabs [data-tab],#settingsBtn,#accountBtn'))chooserOpen=false},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)draftFlush()});
root.addEventListener('pagehide',()=>draftFlush());

const revisionKey=id=>'nv-write-notebook-revision:'+id;
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object'){
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 }
 return value;
}
async function revision(book){
 const {lastPart,...content}=book;
 const bytes=new TextEncoder().encode(JSON.stringify(canonical(content)));
 const hash=await root.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function updateSyncLabel(message){
 syncMessage=message;
 const label=document.querySelector('#nvBookCloudStatus');
 if(label)label.textContent=message;
}
function applyCloudBook(expected,remote,copy){
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction(STORE,'readwrite');
  const store=transaction.objectStore(STORE);
  const request=store.get(remote.id);
  let applied=false;
  request.onsuccess=()=>{
   if(selected===remote.id||pending.has(remote.id)||
      JSON.stringify(request.result)!==JSON.stringify(expected))return;
   if(copy)store.put(copy);
   store.put(remote);
   applied=true;
  };
  transaction.oncomplete=()=>resolve(applied);
  transaction.onabort=()=>reject(transaction.error);
 });
}
async function syncBooks(client,userId){
 await bookLoad;
 if(!db||failed)throw Error(failed||'Bộ nhớ quyển vở chưa sẵn sàng');
 const localBooks=new Map((await getAll()).map(book=>[book.id,book]));
 const remoteBooks=new Map();
 const table=()=>client.from('write_notebooks');
 for(let offset=0;;offset+=100){
  const {data,error}=await table().select('id,revision,book').eq('user_id',userId)
   .order('id').range(offset,offset+99);
  if(error)throw error;
  for(const row of data)remoteBooks.set(row.id,row);
  if(data.length<100)break;
 }
 let changed=false,waiting=false;
 const generation=syncGeneration;
 for(const id of new Set([...localBooks.keys(),...remoteBooks.keys()])){
  if(pending.has(id)){waiting=true;continue;}
  const local=localBooks.get(id),remote=remoteBooks.get(id);
  const key=revisionKey(id);
  const base=localStorage.getItem(key);
  const localRevision=local?await revision(local):null;
  if(remote&&remote.revision===localRevision){
   localStorage.setItem(key,localRevision);
   continue;
  }
  if(local&&(!remote||remote.revision===base)){
   const value={user_id:userId,id,revision:localRevision,book:local};
   const request=remote
    ?table().update(value).eq('user_id',userId).eq('id',id).eq('revision',base)
    :table().upsert(value,{onConflict:'user_id,id',ignoreDuplicates:true});
   const {data,error}=await request.select('revision');
   if(error)throw error;
   if(data.length)localStorage.setItem(key,localRevision);
   else waiting=true;
   continue;
  }
  if(selected===id){waiting=true;continue;}
  const incoming={...remote.book};
  if(local?.lastPart&&incoming.parts.some(part=>part.id===local.lastPart)){
   incoming.lastPart=local.lastPart;
  }
  const suffix=' (bản xung đột)';
  const copy=local&&localRevision!==base
   ?{...local,id:uid(),title:local.title.slice(0,120-suffix.length)+suffix,
     deleted:false,archived:false}
   :null;
  if(await applyCloudBook(local,incoming,copy)){
   const index=books.findIndex(book=>book.id===id);
   if(!pending.has(id)&&selected!==id){
    if(index<0)books.push(incoming);
    else books[index]=incoming;
   }
   if(copy&&!books.some(book=>book.id===copy.id))books.push(copy);
   localStorage.setItem(key,remote.revision);
   changed=true;
   if(copy)waiting=true;
  }else waiting=true;
 }
 if(changed){
  channel?.postMessage({reload:true});
  if(!selected&&!chooserOpen&&document.querySelector('.nv-book-ui'))refresh();
  renderContinue();
 }
 if(waiting&&generation===syncGeneration)syncGeneration++;
 if(!waiting)lastSyncedGeneration=generation;
 updateSyncLabel(waiting?'Còn thay đổi chờ đồng bộ.':'✓ Đã đồng bộ quyển vở');
}

root.nvNotebookUI={get whenReady(){return bookLoad;},bookCount:async()=>{await bookLoad;return db&&!failed?(await getAll()).length:0;},syncBooks,updateSyncLabel,needsSync:()=>syncGeneration!==lastSyncedGeneration,html,bind,isEditing,flush:draftFlush,exportData,importData,wordCount,continueHTML,resume,cleanup,restoreBook,editorId:()=>selected};
const bookLoad=load();
})(window);