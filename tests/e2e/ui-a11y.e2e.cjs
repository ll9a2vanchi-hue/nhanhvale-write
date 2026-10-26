// v6.13.0 e2e: UI/a11y audit — axe colour-contrast (light+dark, home+editor), text >=12px, 44px touch targets on mobile,
// writing mode hides the XP card + duplicate word count, mobile dock colour rows stay on screen, visible focus ring, Vietnamese labels.
//   BASE=http://localhost:8010/ AXE_DIR=node_modules/axe-core DEVICE="iPhone 13" [SHOTS=/path/prefix] node tests/e2e/ui-a11y.e2e.cjs
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const BASE=process.env.BASE||'http://localhost:8010/',DEVICE=process.env.DEVICE||'';const mobile=!!DEVICE;
const AXE=fs.readFileSync(path.join(process.env.AXE_DIR||path.dirname(require.resolve('axe-core')),'axe.min.js'),'utf8');
const results=[];const check=(name,ok,info)=>{results.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name+(!ok&&info!==undefined?' '+JSON.stringify(info):''))};
const seed=()=>{const now=Date.now();return Array.from({length:6},(_,i)=>({id:'s'+i,title:'Bài mẫu số '+i,tag:'Chưa phân loại',status:i%3?'draft':'todo',rating:0,content:('Câu văn mẫu cho bài '+i+'. ').repeat(30),pinned:i===0,created_at:new Date(now-i*864e5).toISOString(),updated_at:new Date(now-i*36e5).toISOString(),last_written:new Date(now-i*36e5).toISOString(),review_count:0,deleted:false,priority:['urgent_important','urgent','important','not_important','unclassified','unclassified'][i]}))};
const name=e=>e;
(async()=>{const br=await chromium.launch();const opt=DEVICE?devices[DEVICE]:{viewport:{width:1280,height:800}};const errs=[];const dev=(DEVICE||'desktop').replace(/ /g,'');
 for(const theme of ['light','dark']){const ctx=await br.newContext(opt);await ctx.route(/supabase\.co|esm\.sh/,r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([t,th])=>{if(!localStorage.getItem('nv-write-v1'))localStorage.setItem('nv-write-v1',JSON.stringify({topics:t,logs:{},settings:{theme:th},syncQueue:[]}))},[seed(),theme]);
  await p.goto(BASE,{waitUntil:'networkidle'});await p.waitForTimeout(400);
  const probe=async where=>{await p.addScriptTag({content:AXE});const tag=`${theme} ${where}`;
   const ax=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:['color-contrast']});return r.violations.flatMap(v=>v.nodes.map(n=>n.target.join(' ')))});
   check(`${tag}: 0 axe colour-contrast violations`,ax.length===0,ax.slice(0,8));
   const small=await p.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!n.textContent.trim())continue;const e=n.parentElement;const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||+cs.opacity===0)continue;if(parseFloat(cs.fontSize)<12)o.push((e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'))+' '+cs.fontSize)}return [...new Set(o)]});
   check(`${tag}: no visible text below 12px`,small.length===0,small.slice(0,8));
   if(mobile){const touch=await p.evaluate(()=>{const o=[];for(const e of document.querySelectorAll('button,a[href],summary,[role=button],input[type=checkbox],input[type=color],select,label.switch')){const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')continue;if(r.width<44||r.height<44)o.push((e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'))+' '+Math.round(r.width)+'x'+Math.round(r.height))}return [...new Set(o)]});
    check(`${tag}: touch targets >=44px`,touch.length===0,touch.slice(0,8))}
   const ov=await p.evaluate(()=>{const o=[];for(const e of document.querySelectorAll('.format-colors,[class*=dock]'))if(e.scrollWidth>e.clientWidth+1)o.push(e.className+' '+e.scrollWidth+'>'+e.clientWidth);for(const e of document.querySelectorAll('#formatPanel button')){const r=e.getBoundingClientRect();if(!r.width)continue;if(r.right>innerWidth+0.5||r.bottom>innerHeight+0.5||r.left<-0.5)o.push('offscreen '+(e.getAttribute('aria-label')||e.textContent))}if(document.documentElement.scrollWidth>innerWidth)o.push('page horizontal overflow');return o});
   check(`${tag}: no dock overflow / offscreen format buttons`,ov.length===0,ov);
   if(process.env.SHOTS)await p.screenshot({path:`${process.env.SHOTS}-${dev}-${theme}-${where}.png`})};
  await probe('home');
  if(theme==='light'){const lab=await p.evaluate(()=>{const t=document.body.innerText;return {streak:/Chuỗi ngày/.test(t)||!!document.querySelector('[aria-label*="Chuỗi ngày"]'),xp:/Điểm XP|điểm XP/.test(t),noEnStreak:!/\bStreak\b/.test(t)}});
   check('labels: Chuỗi ngày + Điểm XP shown, no English "Streak"',lab.streak&&lab.xp&&lab.noEnStreak,lab);
   if(!mobile){await p.keyboard.press('Tab');await p.keyboard.press('Tab');const ring=await p.evaluate(()=>{const e=document.activeElement;const cs=getComputedStyle(e);return {el:e.tagName+'#'+e.id,style:cs.outlineStyle,w:parseFloat(cs.outlineWidth)}});
    check('keyboard focus shows a visible outline (>=2px)',ring.style!=='none'&&ring.w>=2,ring)}}
  await p.evaluate(()=>{current=db.topics[0];render()});await p.waitForSelector('#body');await p.waitForTimeout(400);await probe('editor');
  if(theme==='light'){const L=await p.evaluate(()=>({copy:document.querySelector('#copy')?.getAttribute('aria-label')||document.querySelector('#copy')?.title,tx:!!document.querySelector('[aria-label="Xóa định dạng"]'),hl:/Tô sáng/.test(document.querySelector('#writeCustomization')?.innerHTML||''),toggle:!!document.querySelector('.nv-color-toggle[aria-expanded]')}));
   check('labels: Sao chép / Tô sáng / Xóa định dạng / colour toggle',/Sao chép/.test(L.copy||'')&&L.tx&&L.hl&&L.toggle,L)}
  const wm=await p.evaluate(()=>({xp:(()=>{const e=document.querySelector('.nv-xp');return !!(e&&e.getBoundingClientRect().height)})(),wc:(()=>{const e=document.querySelector('#wordCount');return !!(e&&e.getBoundingClientRect().height)})(),tb:!!document.querySelector('#toolbarWordCount')?.getBoundingClientRect().height}));
  check(`${theme} editor: XP card hidden, single word count (toolbar only)`,!wm.xp&&!wm.wc&&wm.tb,wm);
  if(mobile){await p.click('.nv-color-toggle');await p.waitForTimeout(250);check(`${theme} editor: colour toggle expands`,await p.evaluate(()=>document.querySelector('.nv-color-toggle').getAttribute('aria-expanded')==='true'));await probe('editor-colors');await p.click('.nv-color-toggle')}
  await p.evaluate(()=>localStorage.clear());await ctx.close()}
 check('no page errors',errs.length===0,errs);
 const f=results.filter(r=>!r.ok).length;console.log(`${DEVICE||'desktop'}: ${results.length-f}/${results.length} passed`);await br.close();process.exit(f?1:0)})();
