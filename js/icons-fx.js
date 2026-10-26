// Icons, sound, toasts
(()=>{
const paths={
pen:'<path d="m12 19 7-7 3 3-7 7-4 1 1-4ZM18 13l3 3M4 6h10M4 11h7M4 16h5"/>',
flame:'<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-6 0 3-2 4-2 4 0-5-3-8-5-10 0 5-4 7-4 12 0 4 3 7 7 7Z"/>',
book:'<path d="M4 5c3-1 5-1 8 1 3-2 5-2 8-1v14c-3-1-5-1-8 1-3-2-5-2-8-1V5ZM12 6v14"/>',
settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
shuffle:'<path d="m17 3 4 4-4 4M3 7h4c6 0 5 10 11 10h3m-4-4 4 4-4 4M3 17h4c2 0 3-1 4-3m2-4c1-2 2-3 5-3h3"/>',
repeat:'<path d="M20 7h-13a4 4 0 0 0-4 4m1-4 3-3 3 3M4 17h13a4 4 0 0 0 4-4m-1 4-3 3-3-3"/>',
pin:'<path d="m16 3 5 5-3 1-3 5-3 1-3-3-5 9 2-10-3-3 1-3 5-3 1-3Z"/>',
check:'<path d="m4 12 5 5L20 6"/>',
copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
back:'<path d="m14 5-7 7 7 7M7 12h14"/>',
plus:'<path d="M12 4v16M4 12h16"/>',
medal:'<circle cx="12" cy="15" r="5"/><path d="m7 2 5 8 5-8M7 2h10"/>',
circle:'<circle cx="12" cy="12" r="9"/>',
half:'<path d="M12 3a9 9 0 1 0 0 18V3Z"/><circle cx="12" cy="12" r="9"/>',
arrow:'<path d="m9 5 7 7-7 7"/>'
};
const map={'✍':'pen','🔥':'flame','📚':'book','⚙':'settings','🎲':'shuffle','🔁':'repeat','📌':'pin','✓':'check','⧉':'copy','←':'back','◐':'half','○':'circle','›':'arrow'};
const svg=name=>'<svg class="nv-icon" viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
function icons(root){
 if(!root)return;
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(node){
  if(node.nodeType===Node.ELEMENT_NODE)return node.matches('[contenteditable],textarea,input,option,script,style,svg')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_SKIP;
  return NodeFilter.FILTER_ACCEPT;
 }});
 const nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
 for(const n of nodes){
  if(!n.parentElement||['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].includes(n.parentElement.tagName))continue;
  const val=n.nodeValue;
  if(!/[✍🔥📚⚙🎲🔁📌✓⧉←◐○›]/u.test(val))continue;
  const fragment=document.createDocumentFragment();
  for(const part of val.split(/([✍🔥📚⚙🎲🔁📌✓⧉←◐○›])/u)){
   if(Object.hasOwn(map,part)){const icon=document.createElement('span');icon.innerHTML=svg(map[part]);fragment.append(...icon.childNodes)}
   else fragment.append(document.createTextNode(part));
  }
  n.replaceWith(fragment);
 }
}
let enabled=localStorage.getItem('nv-write-sound')==='on';window.nvQuickSuccessSound=()=>beep('success');
let ctx;
function beep(type='tap'){
 if(!enabled)return;
 try{
  ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();
  if(ctx.state==='suspended')ctx.resume();
  const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(type==='success'?740:440,now);
  if(type==='success')osc.frequency.exponentialRampToValueAtTime(990,now+.09);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
  osc.connect(gain).connect(ctx.destination);osc.start(now);osc.stop(now+.15);
 }catch(e){}
}
const sound=document.createElement('button');sound.className='nv-sound';sound.type='button';sound.setAttribute('aria-label','Bật hoặc tắt âm thanh');
const update=()=>{sound.textContent=enabled?'♪ Bật':'♪ Tắt';sound.title='Âm thanh thao tác: '+(enabled?'bật':'tắt')};
update();sound.onclick=()=>{enabled=!enabled;localStorage.setItem('nv-write-sound',enabled?'on':'off');update();beep('success')};
document.querySelector('#nvControls')?.appendChild(sound);
const toast=document.createElement('div');toast.className='nv-toast';toast.setAttribute('role','status');document.body.appendChild(toast);
let timer;function notify(t){toast.textContent=t;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),1600)}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');
 if(!b||b===sound)return;
 beep(/add|reviewed|copy|saveSettings/.test(b.id)?'success':'tap');
 if(b.id==='add')setTimeout(()=>notify('Đã thêm chủ đề'),50);
 if(b.id==='reviewed')setTimeout(()=>notify('Đã ghi nhận ôn tập'),50);
 if(b.id==='pin')setTimeout(()=>notify('Đã cập nhật ghim'),50);
},true);
const obs=new MutationObserver(records=>{
 if(records.every(r=>(r.target.nodeType===Node.ELEMENT_NODE?r.target:r.target.parentElement)?.closest('[contenteditable],textarea,input')))return;
 obs.disconnect();icons(document.querySelector('#content'));icons(document.querySelector('#metrics'));icons(document.querySelector('header'));obs.observe(document.querySelector('main'),{childList:true,subtree:true})});
icons(document.body);obs.observe(document.querySelector('main'),{childList:true,subtree:true});
})();

// Effects, celebrations, awards
(()=>{
const prefs=JSON.parse(localStorage.getItem('nv-write-fx')||'{}');let fx={motion:prefs.motion!==false,vibrate:prefs.vibrate!==false,ceremony:prefs.ceremony!==false};
const bar=document.createElement('div');bar.className='nv-effects';bar.setAttribute('aria-label','Tùy chọn hiệu ứng');document.querySelector('#nvControls')?.appendChild(bar);
function controls(){bar.innerHTML=[['motion','Hiệu ứng'],['vibrate','Rung'],['ceremony','Chúc mừng']].map(([k,label])=>`<button type="button" data-fx="${k}" aria-pressed="${fx[k]}">${label}: ${fx[k]?'Bật':'Tắt'}</button>`).join('')}
bar.onclick=e=>{const k=e.target.closest('[data-fx]')?.dataset.fx;if(!k)return;fx[k]=!fx[k];localStorage.setItem('nv-write-fx',JSON.stringify(fx));controls()};controls();
const popup=document.createElement('div');popup.className='nv-celebrate';popup.setAttribute('role','status');popup.setAttribute('aria-live','polite');document.body.appendChild(popup);let close;
function vibrate(){if(fx.vibrate&&navigator.vibrate)try{navigator.vibrate([35,35,65])}catch{}}
function confetti(){if(!fx.motion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<18;i++){let el=document.createElement('i');el.className='nv-spark';el.style.left=(45+Math.random()*10)+'vw';el.style.top='24vh';el.style.background=['#d1a756','#597b9c','#8ba88a'][i%3];el.style.setProperty('--dx',(Math.random()*280-140)+'px');el.style.setProperty('--dy',(Math.random()*250+45)+'px');document.body.appendChild(el);setTimeout(()=>el.remove(),1000)}}
window.nvCelebrate=(type,label)=>{vibrate();if(!fx.ceremony)return;if(document.body.classList.contains('writing-mode')&&window.nvWritingToast){window.nvWritingToast(type==='award'?'Huy hiệu mới!':type==='streak'?'Đã đạt mục tiêu hôm nay!':'Hoàn thành bài viết!',type==='streak'?'':label||'');return}popup.innerHTML='<div class="symbol">✦</div><strong></strong><span></span>';popup.querySelector('strong').textContent=type==='award'?'Huy hiệu mới!':type==='streak'?'Duy trì chuỗi ngày viết!':'Hoàn thành bài viết!';popup.querySelector('span').textContent=label||'Một bước tiến mới trong hành trình viết.';popup.classList.add('show');confetti();clearTimeout(close);close=setTimeout(()=>popup.classList.remove('show'),2400)};
function awardKeys(){try{const d=JSON.parse(localStorage.getItem('nv-write-v1')||'{}');const active=(d.topics||[]).filter(t=>!t.deleted);const done=active.filter(t=>t.status==='done').length;const words=active.reduce((n,t)=>n+(t.content?.trim().match(/\S+/gu)||[]).length,0);return [...[1,10,50,100,500].filter(n=>done>=n).map(n=>'b'+n),...[1000,10000,100000,1000000].filter(n=>words>=n).map(n=>'w'+n)]}catch{return []}}
let known=new Set(JSON.parse(localStorage.getItem('nv-write-earned')||'null')||awardKeys());localStorage.setItem('nv-write-earned',JSON.stringify([...known]));
window.nvCheckAwards=()=>{const keys=awardKeys();const newly=keys.filter(k=>!known.has(k));known=new Set(keys);localStorage.setItem('nv-write-earned',JSON.stringify(keys));if(newly.length)window.nvCelebrate('award',newly.map(k=>k.startsWith('b')?k.slice(1)+' bài hoàn thành':Number(k.slice(1)).toLocaleString('vi')+' chữ').join(' · '))};
let streakNotified=localStorage.getItem('nv-write-streak-day')||'';
const watch=()=>{try{const d=JSON.parse(localStorage.getItem('nv-write-v1')||'{}');const day=new Date().toLocaleDateString('en-CA');if((d.logs?.[day]||0)>=(d.settings?.minWords||50)&&streakNotified!==day){streakNotified=day;localStorage.setItem('nv-write-streak-day',day);window.nvCelebrate('streak','Đã đạt mục tiêu viết hôm nay!')}}catch{}};
const old=window.nvCheckAwards;window.nvCheckAwards=()=>{old();watch()};
})();
