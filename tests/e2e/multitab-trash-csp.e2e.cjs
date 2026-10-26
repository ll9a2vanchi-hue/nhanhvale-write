// v6.12.0 Playwright e2e: multi-tab merge, same-post edits in two tabs, permanent delete + empty trash, CSP, labels.
// Serve the repo WITH the vercel.json headers (node tests/serve-with-headers.cjs . 8010), then:
//   BASE=http://localhost:8010/ DEVICE="Pixel 7" node tests/e2e/multitab-trash-csp.e2e.cjs
// Supabase is fully mocked via page.route — no real network or DB access. supabase-js is the vendored /vendor bundle (checks CSP allows it).
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const BASE=process.env.BASE||'http://localhost:8010/',DEVICE=process.env.DEVICE||'';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const UID='00000000-0000-4000-8000-000000000001';
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:UID,exp:4102444800,role:'authenticated',aud:'authenticated',email:'t@example.com'})+'.sig';
const user={id:UID,aud:'authenticated',role:'authenticated',email:'t@example.com',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const results=[];const check=(name,ok,info)=>{results.push({name,ok:!!ok,info});console.log((ok?'PASS ':'FAIL ')+name+(info!==undefined?' '+JSON.stringify(info):''))};
const titles=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('nv-write-v1')).topics.map(t=>t.title));
(async()=>{const br=await chromium.launch();const opt=DEVICE?devices[DEVICE]:{viewport:{width:1280,height:800}};
 const csp=[],errs=[];const watch=p=>{p.on('console',m=>{if(/Content Security Policy|Refused to/i.test(m.text()))csp.push(m.text().slice(0,200))});p.on('pageerror',e=>errs.push(e.message));p.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>console.log('Refused to (CSP) '+e.violatedDirective+' '+e.blockedURI)))};
 // ---------- 1+2: two tabs, signed out ----------
 {const ctx=await br.newContext(opt);await ctx.route(/supabase\.co/,r=>r.abort());
  const A=await ctx.newPage();watch(A);const resp=await A.goto(BASE,{waitUntil:'networkidle'});const B=await ctx.newPage();watch(B);await B.goto(BASE,{waitUntil:'networkidle'});
  const h=resp.headers();check('headers: CSP + frame + nosniff + referrer',/frame-ancestors 'none'/.test(h['content-security-policy']||'')&&h['x-frame-options']==='DENY'&&h['x-content-type-options']==='nosniff'&&h['referrer-policy']==='strict-origin-when-cross-origin');
  await A.fill('#quick','Bài từ tab A');await A.click('#add');await A.waitForTimeout(400);
  await B.fill('#quick','Bài từ tab B');await B.click('#add');await B.waitForTimeout(400);
  let t=await titles(A);check('add in A, add in B: both survive on disk',t.includes('Bài từ tab A')&&t.includes('Bài từ tab B'),t);
  await A.waitForTimeout(300);check('tab A list shows B\'s post without reload',await A.evaluate(()=>document.body.innerText.includes('Bài từ tab B')));
  // same post open in both tabs, edited one after the other
  const id=await A.evaluate(()=>db.topics.find(x=>x.title==='Bài từ tab A').id);
  const open=async p=>{await p.evaluate(i=>{current=db.topics.find(x=>x.id===i);render()},id);await p.waitForSelector('#body')};
  await open(A);await open(B);
  await A.click('#body');await A.keyboard.type('Đoạn A. ',{delay:4});await A.waitForTimeout(1300);
  check('idle tab B editor reloads A\'s text',(await B.$eval('#body',e=>e.innerText)).includes('Đoạn A.'));
  await B.click('#body');await B.keyboard.press('End');await B.keyboard.type('Đoạn B. ',{delay:4});await B.waitForTimeout(1300);
  check('tab A editor reloads B\'s text',(await A.$eval('#body',e=>e.innerText)).includes('Đoạn B.'));
  await A.click('#body');await A.keyboard.press('End');await A.keyboard.type('Thêm A.',{delay:4});await A.waitForTimeout(1300);
  const C=await ctx.newPage();await C.goto(BASE,{waitUntil:'networkidle'});
  const final=await C.evaluate(i=>db.topics.find(x=>x.id===i).content,id);check('sequential edits in 2 tabs: nothing lost',/Đoạn A\./.test(final)&&/Đoạn B\./.test(final)&&/Thêm A\./.test(final),final);await C.close();
  // concurrent: A is mid-typing (unsaved) when B saves the same post
  await A.click('#body');await A.keyboard.press('End');await A.keyboard.type(' Đang gõ dở ở A',{delay:2});
  await B.evaluate(i=>{const x=db.topics.find(t=>t.id===i);window.nvEditorCleanup?.();put(x,{content:'Bản B ghi đè',richHtml:'<div>Bản B ghi đè</div>'})},id);
  await A.waitForSelector('.nv-conflict-overlay',{timeout:5000}).catch(()=>{});
  const dlg=await A.evaluate(()=>{const o=document.querySelector('.nv-conflict-overlay');return o&&{a:o.querySelector('#nvLocalPreview').textContent,b:o.querySelector('#nvCloudPreview').textContent,btns:[...o.querySelectorAll('button')].map(b=>b.textContent)}});
  check('concurrent edit shows conflict dialog in A',!!dlg,dlg);
  check('conflict preview uses real newlines (no literal \\n)',dlg&&dlg.a.includes('\n\n')&&!dlg.a.includes('\\n'));
  t=await titles(A);check('other tab\'s text kept as copy before any choice',t.some(x=>/\(bản từ tab khác\)$/.test(x)),t);
  await A.click('.nv-conflict-overlay [data-choice="2"]');await A.waitForTimeout(500);
  const after=await A.evaluate(i=>{const m=db.topics.find(t=>t.id===i);const c=db.topics.filter(t=>/^nv-tab-/.test(t.id));return {main:m.content,copies:c.map(x=>x.title+': '+x.content)}},id);
  check('"Dùng bản tab khác": main = B, A\'s typing kept in copy',after.main==='Bản B ghi đè'&&after.copies.some(x=>x.includes('Đang gõ dở ở A')),after);
  // trash state across tabs: delete in A, B sees it in trash
  await A.evaluate(i=>{current=null;render();put(db.topics.find(t=>t.id===i),{deleted:true})},id);await B.evaluate(()=>{current=null;render()});await B.waitForTimeout(300);
  check('delete in A is respected in B',await B.evaluate(i=>db.topics.find(t=>t.id===i).deleted===true,id));
  await A.evaluate(()=>localStorage.clear());await ctx.close();}
 // ---------- 3: trash permanent delete with fake Supabase ----------
 {const ctx=await br.newContext(opt);const cloud=new Map(),writes=[];
  const handler=async r=>{const req=r.request(),u=new URL(req.url());
   if(u.pathname==='/auth/v1/user')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
   if(u.pathname.startsWith('/rest/v1/')){const table=u.pathname.split('/').pop();if(req.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(table==='write_topics'?[...cloud.values()]:[])});
    const body=req.postDataJSON();const rows=Array.isArray(body)?body:[body];writes.push({table,rows});if(table==='write_topics')rows.forEach(x=>cloud.set(x.id,x));return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify(rows)})}
   return r.fulfill({status:200,contentType:'application/json',body:'{}'})};ctx._route=handler;await ctx.route(/supabase\.co/,handler);
  const p=await ctx.newPage();watch(p);
  await p.addInitScript(([k,v])=>{if(!localStorage.getItem('__seeded')){localStorage.setItem(k,v);localStorage.setItem('__seeded','1')}},['sb-aiqqnssdnzjelpcyzlqp-auth-token',JSON.stringify({access_token:jwt,refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:4102444800,user})]);
  await p.goto(BASE,{waitUntil:'networkidle'});
  const doSync=async()=>{await p.waitForFunction(()=>!syncing,null,{timeout:15000});await p.evaluate(()=>sync());await p.waitForFunction(()=>!syncing,null,{timeout:15000})};
  for(const n of ['Bí mật 1','Bí mật 2','Bí mật 3']){await p.fill('#quick',n);await p.click('#add');await p.waitForTimeout(200)}
  await p.evaluate(()=>db.topics.forEach(t=>put(t,{content:'nội dung riêng tư '+t.title,richHtml:'<div>nội dung riêng tư</div>'})));
  await doSync();check('CSP allows vendored supabase-js (sync reached fake cloud)',cloud.size===3,cloud.size);
  const ids=await p.evaluate(()=>db.topics.map(t=>t.id));
  await p.evaluate(()=>{const c=db.topics.slice(0,3);c.forEach(t=>put(t,{deleted:true}));render()});await doSync();
  await p.click('[data-tab=topics]');await p.click('#nvOpenTrash');
  const purgeId=await p.$eval('[data-purge]',e=>e.dataset.purge);const oldTrash=structuredClone(cloud.get(purgeId));await p.click(`[data-purge="${purgeId}"]`);
  check('permanent delete asks in-app confirm',await p.isVisible('.nv-confirm-backdrop'));await p.click('.nv-confirm-ok');await p.waitForTimeout(300);
  check('purged post gone from trash list',!(await p.$(`[data-restore="${purgeId}"]`))&&(await p.$$('[data-restore]')).length===2);
  await doSync();const row=cloud.get(purgeId);check('cloud row wiped (tombstone: deleted, status purged, no text)',row&&row.deleted===true&&row.status==='purged'&&row.title===''&&row.content===''&&!row.content_html,row&&{status:row.status,title:row.title,content:row.content});
  await p.click('#nvEmptyTrash');await p.click('.nv-confirm-ok');await p.waitForTimeout(300);
  check('Dọn sạch thùng rác empties the list',await p.evaluate(()=>!document.querySelector('[data-restore]')&&!document.querySelector('#nvOpenTrash')));
  await doSync();check('all 3 rows wiped in cloud',ids.slice(0,3).every(i=>cloud.get(i)?.status==='purged'&&cloud.get(i).content===''));
  const local=await p.evaluate(()=>({sizes:db.topics.map(t=>JSON.stringify(t).length),queue:db.syncQueue.length,label:document.querySelector('#syncLabel').textContent}));
  check('local tombstones are tiny and queue is empty',local.sizes.every(n=>n<600)&&local.queue===0&&!/⚠/.test(local.label),local);
  // a second device that still has the post in its trash (old copy) must not resurrect it
  {const mark=writes.length;const p2=await ctx.browser().newContext(opt);await p2.route(/supabase\.co/,(r)=>ctx._route(r));
   const q=await p2.newPage();watch(q);const old={...oldTrash,paperColor:oldTrash.paper_color,richHtml:oldTrash.content_html};
   await q.addInitScript(([tok,dbs,uid])=>{if(!localStorage.getItem('__seeded')){localStorage.setItem('sb-aiqqnssdnzjelpcyzlqp-auth-token',tok);localStorage.setItem('nv-write-v1',dbs);localStorage.setItem('nv-write-owner-v1',uid);localStorage.setItem('__seeded','1')}},[JSON.stringify({access_token:jwt,refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:4102444800,user}),JSON.stringify({topics:[old],logs:{},settings:{},syncQueue:[]}),UID]);
   await q.goto(BASE,{waitUntil:'networkidle'});await q.waitForFunction(()=>!syncing,null,{timeout:15000});await q.evaluate(()=>sync());await q.waitForFunction(()=>!syncing,null,{timeout:15000});
   const d2=await q.evaluate(i=>{const t=db.topics.find(x=>x.id===i);return {status:t.status,content:t.content,title:t.title}},purgeId);
   const re=writes.slice(mark).flatMap(w=>w.rows).filter(r=>r.id===purgeId&&r.status!=='purged');
   check('2nd device with old trash copy gets the tombstone, no resurrection',d2.status==='purged'&&d2.content===''&&re.length===0&&cloud.get(purgeId).status==='purged',d2);
   await q.evaluate(()=>localStorage.clear());await p2.close()}
  // never-synced post purged -> nothing uploaded
  const before=writes.length;await p.evaluate(()=>{window.nvSignedOut=true});const lid=await p.evaluate(()=>{const t=add('Chưa đồng bộ');put(t,{deleted:true});window.nvPurgeTopics([t]);return t.id});await p.evaluate(()=>{window.nvSignedOut=false});await doSync();
  check('never-synced purged post is not uploaded',!cloud.has(lid));
  // labels (axe)
  await p.click('[data-tab=home]');await p.fill('#quick','nhãn');await p.click('#add');await p.waitForTimeout(200);await p.click('[data-open]');await p.waitForSelector('#body');
  await p.addScriptTag({path:path.join(process.env.AXE_DIR||path.join(__dirname,'../../node_modules/axe-core'),'axe.min.js')}).catch(async()=>{await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')})});
  const v=await p.evaluate(async()=>(await axe.run(document,{runOnly:['aria-input-field-name','aria-prohibited-attr','label-content-name-mismatch','page-has-heading-one']})).violations.map(x=>x.id));
  check('axe: editor name, save label, Tx label, page heading',v.length===0,v);
  await p.evaluate(()=>localStorage.clear());await ctx.close();}
 check('no CSP violations in console',csp.length===0,csp.slice(0,5));check('no page errors',errs.length===0,errs.slice(0,5));
 const failed=results.filter(r=>!r.ok);console.log(`MULTITAB-TRASH-CSP ${failed.length?'FAIL':'PASS'} ${results.length-failed.length}/${results.length} (${DEVICE||'desktop 1280x800'})`);
 await br.close();process.exit(failed.length?1:0)})();
