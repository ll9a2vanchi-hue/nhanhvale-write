// Safe, disposable browser smoke: 750 topics, search, keyboard, IndexedDB shadow recovery.
// No real Supabase writes, user accounts, or production data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process');
const BASE='http://127.0.0.1:8123/';
const server=spawn(process.execPath,['tests/serve-with-headers.cjs','.','8123'],{stdio:['ignore','pipe','pipe']});
let stderr='';
server.stderr.on('data',d=>stderr+=d.toString());
async function boot(){
 await new Promise((res,rej)=>{
  const timeout=setTimeout(()=>rej(Error('Test server did not start '+stderr)),10000);
  server.stdout.on('data',d=>{if(d.toString().includes('up')){clearTimeout(timeout);res()}});
  server.once('error',e=>{clearTimeout(timeout);rej(e)});
 });
}
const seed=Array.from({length:750},(_,n)=>({
 id:'smoke-'+n,title:n===400?'Bài đặc biệt cần tìm':'Bài thường số '+n,
 tag:n%2===0?'Kiến thức':'Ghi chú',priority:'unclassified',
 status:'todo',content:'Nội dung mô phỏng cho kiểm thử',pinned:false,deleted:false,
 created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z'
}));
(async()=>{
 let browser;
 try{
  await boot();browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
  await ctx.route(/supabase\.co/,route=>route.abort());
  await ctx.addInitScript(rows=>{
   if(!localStorage.getItem('nv-write-v1'))localStorage.setItem('nv-write-v1',JSON.stringify({topics:rows,logs:{},settings:{},syncQueue:[]}));
  },seed);
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="topics"]').click();
  await page.locator('[data-topic-view="all"]').click();
  await page.locator('#search').fill('đặc biệt');
  await page.waitForFunction(()=>document.querySelectorAll('#nvTopicResults [data-open]').length===1);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'search','typing should not lose focus');
  assert.equal(await page.locator('#nvTopicMatchCount').textContent(),'1 chủ đề phù hợp');
  await page.locator('#nvTopicResults [data-open]').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('#body');
  assert.equal(await page.locator('#title').inputValue(),'Bài đặc biệt cần tìm','keyboard opens correct topic');

  await page.locator('#back').click();
  await page.locator('#settingsBtn').click();
  await page.locator('#setting-6 summary').click();
  await page.locator('#nvShadowCreate').click();
  await page.waitForFunction(()=>!document.querySelector('#nvShadowStatus')?.textContent?.includes('Bản dự phòng được giữ'),null,{timeout:15000});
  const shadowText=await page.locator('#nvShadowStatus').textContent();
  console.log('Shadow creation status:',shadowText);
  assert(shadowText.startsWith('✓'),'Shadow write failed: '+shadowText+'; page errors: '+errors.join('; '));
  const status=await page.evaluate(async()=>{
   const snap=await window.nvShadowVault.latest();
   return {count:JSON.parse(snap.json).topics.length,owner:snap.owner,records:(await window.nvShadowVault.list()).length};
  });
  assert.equal(status.count,750,'snapshot preserves all 750 topics');
  assert(status.records>=1&&status.records<=3,'rotating backup bounded');
  await page.evaluate(()=>localStorage.setItem('nv-write-v1','{broken-json'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#nvRecoverShadow');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#nvRecoverShadow').click()]);
  const data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(data.topics.length,750,'recovery exports full 750-topic snapshot');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nv-write-v1')),'{broken-json','recovery must not overwrite corrupted original');
  assert.deepEqual(errors,[],'no browser runtime exceptions');
  console.log('PASS: 750-topic mobile search, preserved focus, keyboard card, IndexedDB shadow and non-destructive corrupted-state export');
  await ctx.close();
 }catch(e){console.error(e.stack||e);process.exitCode=1}
 finally{if(browser)await browser.close();server.kill()}
})();
