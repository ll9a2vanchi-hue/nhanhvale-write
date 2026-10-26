// v6.13.0 e2e: multi-tab merge-before-save + broadcast for links, review history and XP (signed out and signed in).
//   BASE=http://localhost:8010/ DEVICE="iPhone 13" node tests/e2e/multitab-aux.e2e.cjs
const {chromium,devices}=require('playwright');const {createFake,UID,session,SESSION_KEY}=require('./fake-supabase.cjs');
const BASE=process.env.BASE||'http://localhost:8010/',DEVICE=process.env.DEVICE||'';
const results=[];const check=(name,ok,info)=>{results.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name+(info!==undefined?' '+JSON.stringify(info):''))};
const disk=(p,k)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),k);
(async()=>{const br=await chromium.launch();const opt=DEVICE?devices[DEVICE]:{viewport:{width:1280,height:800}};const errs=[];
 {const ctx=await br.newContext(opt);await ctx.route(/supabase\.co/,r=>r.abort());
  const A=await ctx.newPage(),B=await ctx.newPage();for(const p of [A,B])p.on('pageerror',e=>errs.push(e.message));
  await A.goto(BASE,{waitUntil:'networkidle'});await B.goto(BASE,{waitUntil:'networkidle'});
  const now=()=>new Date().toISOString();
  // links: both tabs add without seeing each other first
  await A.evaluate(n=>{links.push({id:'la',a:'x',b:'y',type:'related',deleted:false,updated_at:n});saveLinks()},now());
  await B.evaluate(n=>{links.push({id:'lb',a:'y',b:'z',type:'related',deleted:false,updated_at:n});saveLinks()},now());
  await A.waitForTimeout(300);
  let d=await disk(A,'nv-write-links-v1');check('links: both tabs\' links on disk',d.some(l=>l.id==='la')&&d.some(l=>l.id==='lb'),d.map(l=>l.id));
  check('links: tab A memory got B\'s link via broadcast',await A.evaluate(()=>links.some(l=>l.id==='lb')));
  // tombstone in A, then B saves with an older copy in memory
  await B.evaluate(()=>{window.__noMerge=true});
  await A.evaluate(()=>{const l=links.find(x=>x.id==='la');l.deleted=true;l.updated_at=new Date(Date.now()+1000).toISOString();saveLinks()});
  await B.evaluate(()=>{links.push({id:'lc',a:'z',b:'w',type:'related',deleted:false,updated_at:new Date().toISOString()});saveLinks()});await A.waitForTimeout(300);
  d=await disk(B,'nv-write-links-v1');check('links: tombstone from A survives B\'s save, B\'s new link kept',d.find(l=>l.id==='la')?.deleted===true&&d.some(l=>l.id==='lc')&&new Set(d.map(l=>l.id)).size===d.length,d.map(l=>l.id+(l.deleted?'×':'')));
  // review history
  await A.evaluate(()=>{reviewHistory.push({id:'ra',topic_id:'x',at:new Date().toISOString(),grade:'good',previous:{},deleted:false,updated_at:new Date().toISOString()});saveReviewHistory()});
  await B.evaluate(()=>{reviewHistory.push({id:'rb',topic_id:'y',at:new Date().toISOString(),grade:'hard',previous:{},deleted:false,updated_at:new Date().toISOString()});saveReviewHistory()});await A.waitForTimeout(300);
  d=await disk(A,'nv-write-review-history-v1');check('review history: union of both tabs',d.some(e=>e.id==='ra')&&d.some(e=>e.id==='rb')&&d.length===2,d.map(e=>e.id));
  check('review history: tab A memory updated',await A.evaluate(()=>reviewHistory.length===2));
  // XP: interleaved earning in both tabs
  const earn=(p,id,words)=>p.evaluate(([id,w])=>{earnXP({id},'', 'chữ '.repeat(w),true)},[id,words]);
  const t0=await A.evaluate(()=>xp.total);
  await earn(A,'pa',5);await earn(B,'pb',7);await earn(A,'pc',3);await A.waitForTimeout(300);
  const xd=await disk(A,'nv-write-xp-v1');const xa=await A.evaluate(()=>({t:xp.total,n:xp.events.length})),xb=await B.evaluate(()=>({t:xp.total,n:xp.events.length}));
  check('XP: no event lost across tabs (3 events on disk)',xd.events.length===3&&new Set(xd.events.map(e=>e.id)).size===3,xd.events);
  check('XP: total = start + 15 in both tabs and on disk',xd.total===t0+15&&xa.t===t0+15&&xb.t===t0+15,{t0,disk:xd.total,a:xa,b:xb});
  await ctx.close()}
 // signed in: two tabs earn XP, each tab syncs; cloud must have each event exactly once and totals must match
 {const fake=createFake();fake.seed('write_xp_events',[{id:'baseline:'+UID,user_id:UID,words:100,created_at:'2026-10-01T00:00:00.000001+00:00'}]);
  const ctx=await br.newContext(opt);await ctx.route(/supabase\.co/,fake.handler);
  await ctx.addInitScript(([k,v,u])=>{if(!localStorage.getItem('__seeded')){localStorage.setItem(k,v);localStorage.setItem('nv-write-owner-v1',u);localStorage.setItem('__seeded','1')}},[SESSION_KEY,session,UID]);
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(BASE,{waitUntil:'networkidle'});
  const idle=p=>p.waitForFunction(()=>!syncing,null,{timeout:15000});await idle(A);
  const B=await ctx.newPage();B.on('pageerror',e=>errs.push(e.message));await B.goto(BASE,{waitUntil:'networkidle'});await idle(B);
  const earn=(p,id,w)=>p.evaluate(([id,w])=>{earnXP({id},'','chữ '.repeat(w),true)},[id,w]);
  await earn(A,'qa',10);await earn(B,'qb',20);await A.waitForTimeout(200);
  await A.evaluate(()=>sync());await A.waitForTimeout(100);await idle(A);
  await earn(B,'qc',5);await B.evaluate(()=>sync());await B.waitForTimeout(100);await idle(B);
  await A.evaluate(()=>sync());await A.waitForTimeout(100);await idle(A);await A.waitForTimeout(300);
  const rows=fake.all('write_xp_events');const sum=rows.reduce((n,e)=>n+e.words,0);
  const ta=await A.evaluate(()=>xp.total),tb=await B.evaluate(()=>xp.total);
  check('signed-in XP: 1 baseline + 3 events in cloud, no duplicates',rows.length===4&&new Set(rows.map(r=>r.id)).size===4,rows.map(r=>r.id+':'+r.words));
  check('signed-in XP: both tabs total = cloud sum (135)',sum===135&&ta===135&&tb===135,{sum,ta,tb});
  await A.evaluate(()=>localStorage.clear());await ctx.close()}
 check('no page errors',!errs.length,errs);
 await br.close();const fail=results.filter(r=>!r.ok).length;console.log(fail?'MULTITAB-AUX FAIL '+fail:'MULTITAB-AUX PASS '+results.length+(DEVICE?' ('+DEVICE+')':' (desktop)'));process.exit(fail?1:0)})();
