/* Nhanhvale Write — independent notebook workspace. Never mutates legacy articles. */
(function(root){
'use strict';
const NAME='nv-write-notebooks-v1',STORE='books',COLORS=['#476d91','#668b77','#a77d58','#8573ae','#af6d76','#5b8193'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>root.crypto?.randomUUID?.()||('nb-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const now=()=>new Date().toISOString();
const words=s=>(String(s||'').trim().match(/\S+/gu)||[]).length;
const short=s=>String(s||'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').slice(0,70)||'quyen-vo';
let db=null,books=[],ready=false,failed='',selected=null,sectionId=null,page=0,pageSpan=null,filter='',showArchived=false,showTrash=false;
let chooserOpen=false,creating=false;
let view=localStorage.getItem('nv-nb-mode')==='flip'?'flip':'scroll',navigate=()=>{},refresh=()=>{},timer=0,baseText='',dirty=false,composing=false;
const button=(action,label,extra='')=>'<button type="button" data-nb="'+action+'" '+extra+'>'+label+'</button>';
function openDB(){return new Promise((res,rej)=>{if(!root.indexedDB)return rej(Error('Trình duyệt không hỗ trợ IndexedDB'));const req=indexedDB.open(NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error||Error('Không mở được dữ liệu quyển vở'));req.onblocked=()=>rej(Error('Hãy đóng các tab Write khác và thử tải lại'))})}
function getAll(){return new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function put(b){return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(structuredClone(b));t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
let channel=null;try{channel=new BroadcastChannel('nv-write-notebooks')}catch{}
async function load(){try{db=await openDB();books=await getAll();ready=true;failed='';if(document.querySelector('.nv-book-ui'))refresh()}catch(e){failed=e.message||String(e);ready=true;if(document.querySelector('.nv-book-ui'))refresh()}}
function mark(label){const e=document.querySelector('#nvBookStatus');if(e)e.textContent=label}
async function persist(b){try{if(!db)throw Error('Bộ nhớ chưa sẵn sàng');await put(b);dirty=false;mark('✓ Đã lưu trên thiết bị');channel?.postMessage({id:b.id,updated_at:b.updated_at})}catch(e){dirty=true;mark('⚠ Chưa lưu được');alert('Quyển vở chưa lưu được: '+e.message+'. Giữ trang đang mở và xuất bản sao lưu trước khi thoát.')}}
function save(b){b.updated_at=now();dirty=true;mark('Đang lưu…');clearTimeout(timer);timer=setTimeout(()=>persist(b),450)}
function book(){return books.find(b=>b.id===selected&&!b.deleted)||null}
function section(){const b=book();return b?.parts?.find(p=>p.id===sectionId)||b?.parts?.[0]||null}
function draftFlush(){clearTimeout(root.nvNotebookXPTimeout);if(!selected)return;const b=book(),s=section();if(!b||!s)return;clearTimeout(timer);timer=0;if(s.text!==baseText){if(b.kind==='writing')root.nvNotebookActivity?.(b.id,s.id,baseText,s.text,true);baseText=s.text}if(dirty)persist(b)}
function switcher(which){return '<div class="nv-book-switcher" aria-label="Khu vực viết">'+button('goto-topics','Chủ đề')+' '+button('goto-notebooks','Quyển vở')+'</div>'.replace('data-nb="goto-'+which+'"','data-nb="goto-'+which+'" class="active" aria-current="page"')}
function pagesOf(text){
 const s=String(text||'');if(!s)return [{start:0,end:0}];
 const cap=Math.max(380,Math.min(1050,Math.round((root.innerHeight||800)*0.95)));
 const list=[];let i=0;while(i<s.length){let end=Math.min(i+cap,s.length);if(end<s.length){let split=s.lastIndexOf('\n',end);if(split<=i+cap*0.5)split=s.lastIndexOf(' ',end);if(split>i+cap*.55)end=split+1;}if(end<=i)end=Math.min(s.length,i+cap);list.push({start:i,end});i=end}return list;
}
function newBookChooser(){
 if(!chooserOpen)return '';
 return '<div class="nv-book-choice-overlay" data-nb-overlay>'
  +'<section class="nv-book-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="nvBookChooseTitle" aria-describedby="nvBookChooseDesc">'
  +'<div class="nv-book-choice-handle" aria-hidden="true"></div>'
  +'<div class="nv-book-choice-head"><div><h3 id="nvBookChooseTitle">Tạo quyển vở</h3><p id="nvBookChooseDesc">Chọn loại vở để bắt đầu viết ngay</p></div>'
  +button('cancel-new','×','class="nv-book-choice-close" aria-label="Đóng bảng chọn"')+'</div>'
  +'<div class="nv-book-choice-list">'
  +button('choose-writing','<span class="nv-book-choice-symbol" aria-hidden="true">✎</span><span class="nv-book-choice-text"><strong>Vở luyện viết</strong><small>Viết mỗi ngày, tích lũy XP và duy trì chuỗi</small></span><span class="nv-book-choice-arrow" aria-hidden="true">›</span>','class="nv-book-choice-card is-writing"')
  +button('choose-knowledge','<span class="nv-book-choice-symbol" aria-hidden="true">▤</span><span class="nv-book-choice-text"><strong>Vở kiến thức</strong><small>Ghi chép bài học, chia phần và chương</small></span><span class="nv-book-choice-arrow" aria-hidden="true">›</span>','class="nv-book-choice-card is-knowledge"')
  +button('choose-free','<span class="nv-book-choice-symbol" aria-hidden="true">✧</span><span class="nv-book-choice-text"><strong>Vở tự do</strong><small>Nhật ký, ý tưởng và những điều muốn viết</small></span><span class="nv-book-choice-arrow" aria-hidden="true">›</span>','class="nv-book-choice-card is-free"')
  +'</div><p class="nv-book-choice-foot">Vở được đặt tên tự động. Bạn có thể đổi tên sau.</p></section></div>';
}
function catalog(){
 const arr=books.filter(b=>!!b.deleted===showTrash&&(showTrash||!!b.archived===showArchived)&&(!filter||(b.title+' '+(b.parts||[]).map(s=>s.title+' '+s.text).join(' ')).toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi')))).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||String(b.updated_at).localeCompare(String(a.updated_at)));
 const cards=arr.map(b=>'<article class="nv-book-card" data-book="'+esc(b.id)+'"><button type="button" class="nv-book-cover" data-nb="open" data-id="'+esc(b.id)+'" style="--cover:'+(COLORS.includes(b.cover)?b.cover:COLORS[0])+'" aria-label="Mở quyển '+esc(b.title)+'"><span class="nv-book-spine"></span><span class="nv-book-glyph" aria-hidden="true">✎</span><strong>'+esc(b.title)+'</strong></button><div class="nv-book-card-foot"><span>'+(b.parts||[]).length+' phần · '+(b.parts||[]).reduce((n,p)=>n+words(p.text),0)+' chữ</span><button type="button" data-nb="menu" data-id="'+esc(b.id)+'" aria-label="Tùy chọn vở '+esc(b.title)+'">⋯</button></div></article>').join('');
 return '<div class="nv-book-ui">'+switcher('notebooks')+'<div class="nv-book-header"><div><h2>Thư viện quyển vở</h2><p>Viết liền mạch, đọc như một cuốn sách.</p></div>'+button('new','+ Tạo vở','class="nv-book-main"')+'</div><div class="nv-book-controls"><input id="nvBookSearch" type="search" autocomplete="off" placeholder="Tìm quyển vở hoặc nội dung…" value="'+esc(filter)+'" aria-label="Tìm quyển vở"><div class="nv-book-filters">'+button('active','Đang dùng',!showArchived&&!showTrash?'class="active"':'')+button('archive-list','Lưu trữ',showArchived&&!showTrash?'class="active"':'')+button('trash-list','Thùng rác',showTrash?'class="active"':'')+'</div></div>'+(cards?'<div class="nv-book-grid">'+cards+'</div>':'<div class="nv-book-empty">Chưa có quyển vở nào ở đây. Tạo quyển đầu tiên để bắt đầu viết.</div>')+newBookChooser()+'<div class="nv-book-help">Dữ liệu quyển vở được lưu riêng trên thiết bị này. '+button('export-all','Sao lưu tất cả vở','class="nv-book-link"')+' · '+button('import-all','Nhập bản sao lưu','class="nv-book-link"')+'<input hidden type="file" id="nvBookImport" accept=".json,application/json"></div></div>';
}
function writer(){
 const b=book();if(!b)return catalog();
 const s=section();if(!s)return catalog();
 const pieces=pagesOf(s.text);page=Math.max(0,Math.min(page,pieces.length-1));pageSpan=pieces[page];
 const contents=view==='flip'?s.text.slice(pageSpan.start,pageSpan.end):s.text;
 const wordCount=b.parts.reduce((n,p)=>n+words(p.text),0);
 return '<div class="nv-book-ui nv-book-writing"><div class="nv-book-top">'+button('back','‹','class="nv-book-back" aria-label="Quay lại thư viện"')+'<div class="nv-book-top-title"><strong>'+esc(b.title)+'</strong><small id="nvBookStatus">✓ Đã lưu trên thiết bị</small></div>'+button('export','⇩','title="Xuất quyển vở" aria-label="Xuất quyển vở"')+'</div><div class="nv-book-editor-controls"><select id="nvBookPart" aria-label="Chọn phần trong vở">'+b.parts.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===s.id?' selected':'')+'>'+esc(p.title||'Không có tiêu đề')+'</option>').join('')+'</select>'+button('add-part','+ Phần','title="Thêm phần mới"')+'<div class="nv-book-modes">'+button('scroll','Cuộn',view==='scroll'?'class="active" aria-pressed="true"':'aria-pressed="false"')+button('flip','Lật trang',view==='flip'?'class="active" aria-pressed="true"':'aria-pressed="false"')+'</div></div><div class="nv-book-sheet"><div class="nv-book-page-meta"><span>NHANHVALE WRITE</span><span>'+ (view==='flip'?'Trang '+(page+1)+'/'+pieces.length:'Viết liên tục')+'</span></div><input id="nvBookPartTitle" aria-label="Tiêu đề phần" value="'+esc(s.title)+'" placeholder="Tên phần / chương…"><textarea id="nvBookBody" spellcheck="true" aria-label="Nội dung quyển vở" placeholder="Bắt đầu viết ở đây…">'+esc(contents)+'</textarea></div>'+(view==='flip'?'<div class="nv-book-pager">'+button('prev','‹ Trang trước',page===0?'disabled':'')+'<span>'+(page+1)+' / '+pieces.length+'</span>'+button('next','Trang sau ›',page===pieces.length-1?'disabled':'')+'</div>':'')+'<div class="nv-book-editor-footer"><span id="nvBookWords">'+wordCount.toLocaleString('vi-VN')+' chữ · '+b.parts.length+' phần</span><span>'+(b.kind==='writing'?'Luyện viết · tính XP cho chữ mới':'Ghi chép · không tính XP')+'</span></div></div>';
}
function html(){document.body.classList.toggle('nv-book-chooser-open',chooserOpen&&!selected);if(!ready)return '<div class="nv-book-ui"><div class="card">Đang mở thư viện quyển vở…</div></div>';if(failed)return '<div class="nv-book-ui"><div class="card">⚠ '+esc(failed)+'. Chưa chỉnh sửa dữ liệu cũ.</div></div>';return selected?writer():catalog()}
function openBook(id){chooserOpen=false;document.body.classList.remove('nv-book-chooser-open');draftFlush();selected=id;const b=book();if(!b){selected=null;refresh();return}sectionId=b.lastPart||b.parts[0]?.id;page=0;baseText=section()?.text||'';refresh();window.scrollTo(0,0)}
async function create(kind){
 if(!db||creating||!['writing','knowledge','free'].includes(kind))return;
 creating=true;
 const names={writing:'Vở luyện viết',knowledge:'Vở kiến thức',free:'Vở tự do'};
 const titleBase=names[kind];
 const existing=new Set(books.map(b=>String(b.title||'').toLocaleLowerCase('vi')));
 let n=1;while(existing.has((titleBase+' '+n).toLocaleLowerCase('vi')))n++;
 const id=uid(),pid=uid();
 const b={id,title:titleBase+' '+n,kind,cover:COLORS[books.length%COLORS.length],pinned:false,archived:false,deleted:false,created_at:now(),updated_at:now(),lastPart:pid,parts:[{id:pid,title:'Trang đầu tiên',text:'',created_at:now(),updated_at:now()}]};
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
function exportBook(b,kind){const body=b.parts.map((s,i)=> (kind==='markdown'?'# '+s.title:'['+(i+1)+'] '+s.title)+'\n\n'+s.text).join('\n\n---\n\n');download(short(b.title)+(kind==='markdown'?'.md':'.txt'),(kind==='markdown'?'':'\uFEFF'+b.title+'\n\n')+body,kind==='markdown'?'text/markdown;charset=utf-8':'text/plain;charset=utf-8')}
function exportAll(){draftFlush();download('nhanhvale-write-quyen-vo-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({type:'nhanhvale-notebooks',version:1,books:exportData()},null,2),'application/json')}
function exportData(){return ready&&!failed?books.map(b=>structuredClone(b)):undefined}
async function importData(input){if(!Array.isArray(input))return 0;if(!db)throw Error('Bộ nhớ quyển vở chưa sẵn sàng');if(input.length>10000)throw Error('Quá nhiều quyển vở');let added=0;for(const x of input){if(!x||typeof x!=='object'||typeof x.id!=='string'||!Array.isArray(x.parts)||!x.parts.length||x.parts.length>10000||typeof x.title!=='string'||x.parts.some(p=>!p||typeof p.text!=='string'||typeof p.id!=='string'||typeof p.title!=='string'||p.text.length>2000000))throw Error('Bản sao lưu quyển vở không hợp lệ');const old=books.find(b=>b.id===x.id);if(old&&JSON.stringify(old)===JSON.stringify(x))continue;const b=structuredClone(x);if(old){b.id=uid();b.title=(b.title+' (bản nhập)').slice(0,120)}b.cover=COLORS.includes(b.cover)?b.cover:COLORS[0];b.created_at=b.created_at||now();b.updated_at=now();b.parts=b.parts.map(p=>({...p,id:p.id||uid()}));books.push(b);await put(b);added++}if(added){channel?.postMessage({reload:true});if(!selected)refresh()}return added}
async function handleImport(file){if(!file)return;try{const data=JSON.parse(await file.text());const b=Array.isArray(data)?data:Array.isArray(data.books)?data.books:data.notebooks;if(!Array.isArray(b))throw Error('Không tìm thấy dữ liệu quyển vở');if(!confirm('Nhập '+b.length+' quyển vở? Nội dung trùng nhưng khác sẽ được giữ thành bản sao.'))return;const n=await importData(b);alert('Đã nhập '+n+' quyển vở. Các bài viết cũ vẫn giữ nguyên.')}catch(e){alert('Không thể nhập: '+e.message)}}
function bind(nav,rerender){navigate=nav;refresh=rerender;const rootEl=document.querySelector('.nv-book-ui');if(!rootEl)return;
 rootEl.addEventListener('click',async e=>{const el=e.target.closest('button[data-nb]');if(!el)return;const action=el.dataset.nb,id=el.dataset.id;switch(action){
 case 'goto-topics':draftFlush();selected=null;navigate('topics');return;
 case 'goto-notebooks':draftFlush();selected=null;navigate('notebooks');return;
 case 'new':chooserOpen=true;refresh();document.querySelector('[data-nb="choose-writing"]')?.focus({preventScroll:true});return;
 case 'cancel-new':chooserOpen=false;refresh();return;
 case 'choose-writing':case 'choose-knowledge':case 'choose-free':await create(action.slice('choose-'.length));return;
 case 'open':openBook(id);return;
 case 'back':draftFlush();selected=null;page=0;refresh();return;
 case 'active':showTrash=false;showArchived=false;refresh();return;
 case 'archive-list':showTrash=false;showArchived=true;refresh();return;
 case 'trash-list':showTrash=true;showArchived=false;refresh();return;
 case 'scroll':case 'flip':draftFlush();view=action;localStorage.setItem('nv-nb-mode',view);page=0;refresh();return;
 case 'prev':case 'next':draftFlush();page+=action==='next'?1:-1;refresh();return;
 case 'add-part':{draftFlush();const b=book(),name=prompt('Tên phần mới:','Phần '+(b.parts.length+1));if(name===null||!name.trim())return;const p={id:uid(),title:name.trim().slice(0,120),text:'',created_at:now(),updated_at:now()};b.parts.push(p);sectionId=p.id;b.lastPart=p.id;baseText='';page=0;save(b);refresh();return}
 case 'export-all':exportAll();return;
 case 'import-all':document.querySelector('#nvBookImport')?.click();return;
 case 'export':{const b=book();if(!b)return;const type=confirm('Xuất dạng Markdown? Chọn Hủy để xuất TXT.')?'markdown':'txt';exportBook(b,type);return}
 case 'menu':{const b=books.find(b=>b.id===id);if(!b)return;const choice=prompt('Tùy chọn: 1 Đổi tên · 2 Đổi màu · 3 Ghim/bỏ ghim · 4 Lưu trữ/khôi phục · 5 Nhân bản · 6 Chuyển vào thùng rác/khôi phục','1');if(!choice)return;switch(choice.trim()){case '1':{const n=prompt('Tên quyển vở',b.title);if(n&&n.trim())b.title=n.trim().slice(0,120);else return;break}case '2':b.cover=COLORS[(COLORS.indexOf(b.cover)+1)%COLORS.length];break;case '3':b.pinned=!b.pinned;break;case '4':b.archived=!b.archived;break;case '5':{const copy=structuredClone(b);copy.id=uid();copy.title=(b.title+' (bản sao)').slice(0,120);copy.created_at=now();copy.updated_at=now();copy.parts=copy.parts.map(s=>({...s,id:uid()}));copy.lastPart=copy.parts[0]?.id;books.push(copy);await persist(copy);refresh();return}case '6':if(!b.deleted&&!confirm('Chuyển quyển vở vào thùng rác? Có thể khôi phục sau.'))return;b.deleted=!b.deleted;break;default:return}save(b);refresh();return}
 }});
 rootEl.addEventListener('click',e=>{if(e.target.matches('.nv-book-choice-overlay')){chooserOpen=false;refresh()}});
 rootEl.querySelector('#nvBookSearch')?.addEventListener('input',e=>{filter=e.target.value;const pos=e.target.selectionStart;refresh();const newEl=document.querySelector('#nvBookSearch');if(newEl){newEl.focus();newEl.setSelectionRange(pos,pos)}});
 rootEl.querySelector('#nvBookImport')?.addEventListener('change',e=>handleImport(e.target.files?.[0]));
 const sel=rootEl.querySelector('#nvBookPart');sel?.addEventListener('change',e=>{draftFlush();sectionId=e.target.value;book().lastPart=sectionId;save(book());baseText=section()?.text||'';page=0;refresh()});
 rootEl.querySelector('#nvBookPartTitle')?.addEventListener('change',e=>{const b=book(),s=section();if(!b||!s)return;s.title=e.target.value.trim().slice(0,120)||'Không có tiêu đề';save(b)});
 const area=rootEl.querySelector('#nvBookBody');if(area){
  if(view==='scroll'){area.style.height='auto';area.style.height=Math.max(area.scrollHeight,Math.floor(innerHeight*.67))+'px'}
  area.addEventListener('compositionstart',()=>composing=true);
  area.addEventListener('compositionend',()=>{composing=false;draftFlush()});
  area.addEventListener('input',e=>{
   const b=book(),s=section();if(!b||!s)return;
   const before=s.text,insert=e.target.value;
   s.text=view==='flip'?before.slice(0,pageSpan.start)+insert+before.slice(pageSpan.end):insert;
   if(view==='flip')pageSpan.end=pageSpan.start+insert.length;
   const paste=/insertFromPaste|insertFromDrop|historyUndo|historyRedo/i.test(e.inputType||'');
   if(paste){if(b.kind==='writing'){root.nvNotebookActivity?.(b.id,s.id,baseText,s.text,false)}baseText=s.text}
   s.updated_at=now();save(b);
   const total=b.parts.reduce((n,p)=>n+words(p.text),0);
   const w=document.querySelector('#nvBookWords');if(w)w.textContent=total.toLocaleString('vi-VN')+' chữ · '+b.parts.length+' phần';
   if(view==='scroll'){area.style.height='auto';area.style.height=Math.max(area.scrollHeight,Math.floor(innerHeight*.67))+'px'}
   else {const pg=pagesOf(s.text),next=rootEl.querySelector('[data-nb="next"]'),label=rootEl.querySelector('.nv-book-pager span');if(next)next.disabled=page>=pg.length-1;if(label)label.textContent=(page+1)+' / '+pg.length;}
   if(!composing&&b.kind==='writing'&&!paste){clearTimeout(root.nvNotebookXPTimeout);root.nvNotebookXPTimeout=setTimeout(()=>{if(!composing){root.nvNotebookActivity?.(b.id,s.id,baseText,s.text,true);baseText=s.text}},600)}
  });
  area.addEventListener('blur',()=>{clearTimeout(root.nvNotebookXPTimeout);draftFlush()});
 }
}
function isEditing(){return !!selected}
function wordCount(){return books.filter(b=>!b.deleted&&!b.archived).reduce((n,b)=>n+(b.parts||[]).reduce((m,p)=>m+words(p.text),0),0)}
channel?.addEventListener('message',async()=>{if(!selected&&!dirty&&db){try{books=await getAll();if(document.querySelector('.nv-book-ui'))refresh()}catch{}}});
document.addEventListener('keydown',e=>{if(chooserOpen&&e.key==='Escape'){e.preventDefault();chooserOpen=false;refresh()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)draftFlush()});
root.addEventListener('pagehide',()=>draftFlush());
root.nvNotebookUI={html,bind,switcher,isEditing,flush:draftFlush,exportData,importData,wordCount};
load();
})(window);