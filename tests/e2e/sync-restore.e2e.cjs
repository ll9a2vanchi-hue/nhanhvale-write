// Playwright e2e (optional, needs `npm i playwright`): serve the repo, then BASE=http://localhost:8000/ node tests/e2e/sync-restore.e2e.cjs
// Supabase is fully mocked via page.route — no real network or DB access.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8002/';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const UID='00000000-0000-4000-8000-000000000001';
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:UID,exp:4102444800,role:'authenticated',aud:'authenticated',email:'t@example.com'})+'.sig';
const user={id:UID,aud:'authenticated',role:'authenticated',email:'t@example.com',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
(async()=>{const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:1280,height:800}});const writes=[];const cloud=new Map();
await ctx.route(/supabase\.co/,async r=>{const req=r.request(),u=new URL(req.url());
 if(u.pathname==='/auth/v1/user')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
 if(u.pathname.startsWith('/rest/v1/')){const table=u.pathname.split('/').pop();if(req.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(table==='write_topics'?[...cloud.values()]:[])});
  const body=req.postDataJSON();const rows=Array.isArray(body)?body:[body];writes.push({table,method:req.method(),rows:rows.map(x=>({id:x.id,deleted:x.deleted,updated_at:x.updated_at}))});if(table==='write_topics')rows.forEach(x=>cloud.set(x.id,x));return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify(rows)})}
 return r.fulfill({status:200,contentType:'application/json',body:'{}'})});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(([k,v])=>{if(!localStorage.getItem('__seeded')){localStorage.setItem(k,v);localStorage.setItem('__seeded','1')}},['sb-aiqqnssdnzjelpcyzlqp-auth-token',JSON.stringify({access_token:jwt,refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:4102444800,user})]);
await p.goto(BASE,{waitUntil:'networkidle'});
await p.fill('#quick','Bài thử đồng bộ');await p.click('#add');await p.waitForTimeout(1200);
const doSync=async()=>{await p.evaluate(()=>sync());await p.waitForFunction(()=>!syncing,null,{timeout:15000})};
await doSync();const id=await p.evaluate(()=>db.topics[0].id);const label1=await p.$eval('#syncLabel',e=>e.textContent);
await p.click('[data-open]');await p.waitForSelector('#body');await p.evaluate(()=>{document.querySelector('.write-menu').open=true;document.querySelector('#delete').click()});await p.click('.nv-confirm-ok');await p.waitForTimeout(200);await doSync();
const afterDelete=cloud.get(id)?.deleted;
await p.click('[data-tab=topics]');await p.click('#nvOpenTrash');await p.click('[data-restore]');await p.waitForTimeout(800);await doSync();
const afterRestore=cloud.get(id)?.deleted;const local=await p.evaluate(i=>({deleted:db.topics.find(t=>t.id===i).deleted,queue:db.syncQueue.length,label:document.querySelector('#syncLabel').textContent,signedOut:window.nvSignedOut}),id);
const topicWrites=writes.filter(w=>w.table==='write_topics').map(w=>w.rows.find(r=>r.id===id)).filter(Boolean);
const res={label1,afterDelete,afterRestore,local,topicWrites,errs};console.log(JSON.stringify(res,null,1));
const pass=afterDelete===true&&afterRestore===false&&local.deleted===false&&local.queue===0&&!/⚠/.test(local.label)&&topicWrites.length>=3;console.log(pass?'SYNC-RESTORE PASS':'SYNC-RESTORE FAIL');
await p.evaluate(()=>localStorage.clear());await br.close();process.exit(pass?0:1)})();
