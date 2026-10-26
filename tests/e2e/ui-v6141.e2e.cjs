// v6.14.1 e2e: goal toast never overlaps the editor dock (normal / colours open / keyboard / keyboard+colours),
// dock is one row on <400px with >=44px targets, clear-format accessible name, axe colour-contrast on dark settings/links/conflict/awards.
//   BASE=http://localhost:8010/ AXE_DIR=node_modules/axe-core DEVICE="iPhone 13" node tests/e2e/ui-v6141.e2e.cjs
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const BASE=process.env.BASE||'http://localhost:8010/',DEVICE=process.env.DEVICE||'';const opt=DEVICE?devices[DEVICE]:{viewport:{width:1280,height:800}};
const AXE=fs.readFileSync(path.join(process.env.AXE_DIR||path.dirname(require.resolve('axe-core')),'axe.min.js'),'utf8');
const results=[];const check=(n,ok,info)=>{results.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(!ok&&info!==undefined?' '+JSON.stringify(info):''))};
const iso=d=>new Date(d).toISOString(),NOW=Date.now();
const seed=th=>({db:{topics:[0,1,2,3].map(i=>({id:'s'+i,title:'Bài mẫu '+i,tag:'Kỹ năng',status:i%2?'draft':'todo',content:('Câu văn mẫu '+i+' có dấu ắ ằ ơ. ').repeat(30),created_at:iso(NOW-i*864e5),updated_at:iso(NOW-i*36e5),deleted:false})),logs:{},settings:{theme:th},syncQueue:[],categories:['Chưa phân loại','Kỹ năng']},links:[{id:'l1',a:'s1',b:'s2',type:'related',deleted:false,updated_at:iso(NOW)}]});
(async()=>{const br=await chromium.launch();const errs=[];
 for(const th of ['light','dark']){const ctx=await br.newContext(opt);await ctx.route(/supabase\.co|esm\.sh/,r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.dismiss());
  await p.addInitScript(S=>{if(!localStorage.getItem('nv-write-v1')){localStorage.setItem('nv-write-v1',JSON.stringify(S.db));localStorage.setItem('nv-write-links-v1',JSON.stringify(S.links))}},seed(th));
  await p.goto(BASE,{waitUntil:'networkidle'});await p.evaluate(AXE);
  const axe=async w=>{const v=await p.evaluate(async()=>(await axe.run(document,{runOnly:['color-contrast','label-content-name-mismatch','button-name']})).violations.flatMap(v=>v.nodes.map(n=>v.id+' '+n.target.join(' '))));check(`${th} ${w}: 0 axe violations`,!v.length,v.slice(0,6))};
  await p.click('[data-tab=awards]');await p.waitForTimeout(200);await axe('awards');
  await p.click('#settingsBtn');await p.waitForTimeout(250);await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await axe('settings');
  await p.goto(BASE,{waitUntil:'networkidle'});await p.evaluate(AXE);
  p.evaluate(()=>nvPickConflicts([{a:db.topics[1],b:{...db.topics[1],content:'Bản cloud.'}}],{intro:'So sánh.',a:'Trên thiết bị',b:'Trên cloud',choices:[['1','Giữ bản máy'],['2','Giữ bản cloud']]})).catch(()=>{});await p.waitForSelector('.nv-conflict-dialog');await axe('conflict dialog');await p.click('[data-choice=cancel]');
  await p.evaluate(()=>{current=db.topics.find(t=>t.id==='s1');render()});await p.waitForSelector('#body');await p.evaluate(()=>document.querySelector('.related-open')?.scrollIntoView({block:'center'}));await p.waitForTimeout(200);await axe('editor + related links');
  const cf=await p.evaluate(()=>{const b=document.querySelector('.nv-clear-format');return {label:b.getAttribute('aria-label'),title:b.title,text:b.textContent.trim()}});check(`${th}: clear-format label/title/text match`,cf.label==='Xóa định dạng'&&cf.title===cf.label&&cf.text===cf.label,cf);
  if(DEVICE){await p.evaluate(()=>scrollTo(0,0));await p.click('#body');await p.waitForTimeout(200);
   const dock=()=>p.evaluate(()=>{const d=document.querySelector('#writeCustomization');const tops=new Set([...d.querySelectorAll('.format-button,.nv-color-toggle')].filter(b=>b.offsetParent).map(b=>Math.round(b.getBoundingClientRect().top)));const small=[...d.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(r=>r.width<44||r.height<44).length;const r=d.getBoundingClientRect();return {rows:tops.size,h:Math.round(r.height),small,bottom:Math.round(r.bottom),vh:Math.round(visualViewport.height)}});
   const d0=await dock();check(`${th}: dock one row, >=44px targets`,d0.rows===1&&d0.small===0&&d0.h<=72,d0);
   const ovl=async w=>{await p.evaluate(()=>nvWritingToast('Đã đạt mục tiêu hôm nay!',''));await p.waitForTimeout(250);const o=await p.evaluate(()=>{const a=document.querySelector('.nv-write-toast').getBoundingClientRect(),b=document.querySelector('#writeCustomization').getBoundingClientRect(),vt=visualViewport.offsetTop,vh=visualViewport.height;return {ovl:Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)),inView:a.top>=vt-1&&a.bottom<=vt+vh+1}});check(`${th} ${w}: goal toast clear of dock and on screen`,o.ovl===0&&o.inView,o);await p.waitForTimeout(2700)};
   await ovl('normal');await p.evaluate(()=>scrollTo(0,0));await ovl('scrolled to top');
   await p.click('.nv-color-toggle');await p.waitForTimeout(500);await ovl('colours open');await p.click('.nv-color-toggle');
   await p.setViewportSize({width:opt.viewport.width,height:Math.round(opt.viewport.height*.55)});await p.click('#body');await p.waitForTimeout(250);
   const dk=await dock();check(`${th} keyboard: dock one row, on screen`,dk.rows===1&&dk.bottom<=dk.vh+1,dk);await ovl('keyboard open');
   await p.click('.nv-color-toggle');await p.waitForTimeout(500);await ovl('keyboard + colours open')}
  await ctx.close()}
 check('no page errors',!errs.length,errs.slice(0,4));await br.close();const f=results.filter(x=>!x).length;console.log(`UI-V6141 ${f?'FAIL':'PASS'} ${results.length-f}/${results.length} (${DEVICE||'desktop'})`);process.exit(f?1:0)})();
