// Disposable browser test for independent notebooks, dual modes, backup and legacy data.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const BASE='http://127.0.0.1:8157/';
const server=spawn(process.execPath,['tests/serve-with-headers.cjs','.','8157'],{stdio:['ignore','pipe','pipe']});
(async()=>{
 let browser;
 try{
  await new Promise((resolve,reject)=>{let t=setTimeout(()=>reject(Error('Server start timeout')),10000);server.stdout.on('data',d=>{if(d.toString().includes('up')){clearTimeout(t);resolve()}});server.once('error',reject)});
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
  await ctx.route(/supabase\.co/,r=>r.abort());
  await ctx.addInitScript(()=>{
   localStorage.setItem('nv-write-v1',JSON.stringify({topics:[{id:'legacy-1',title:'Bài viết cũ',content:'Nội dung cũ giữ nguyên',tag:'Chưa phân loại',status:'draft',created_at:'2026-11-20T00:00:00Z',updated_at:'2026-11-20T00:00:00Z',deleted:false}],logs:{},settings:{},syncQueue:[]}));
  });
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="topics"]').click();
  assert.equal(await page.locator('#nvTopicResults [data-open]').count(),1,'legacy topic remains visible');
  await page.locator('[data-nb="goto-notebooks"]').click();
  await page.waitForSelector('[data-nb="new"]');
  const dialogs=['Nhật ký mới','1'];
  page.on('dialog',async d=>{const response=dialogs.shift();await d.accept(response)});
  await page.locator('[data-nb="new"]').click();
  await page.waitForSelector('#nvBookBody');
  assert.equal(await page.locator('[data-nb="scroll"]').getAttribute('aria-pressed'),'true','continuous mode is default');
  await page.locator('#nvBookBody').fill('Tôi viết mỗi ngày để ghi lại những ý tưởng mới và học hỏi.');
  await page.locator('#nvBookBody').evaluate(el=>el.blur());
  await page.waitForTimeout(800);
  const result=await page.evaluate(()=>({article:JSON.parse(localStorage.getItem('nv-write-v1')).topics[0],xp:JSON.parse(localStorage.getItem('nv-write-xp-v1')).total,books:window.nvNotebookUI.exportData()}));
  assert.equal(result.article.content,'Nội dung cũ giữ nguyên','legacy content unchanged');
  assert.equal(result.books.length,1,'one notebook saved in IndexedDB');
  assert.equal(result.books[0].parts[0].text,'Tôi viết mỗi ngày để ghi lại những ý tưởng mới và học hỏi.');
  assert(result.xp>0,'new words in writing-type notebook gain XP');
  await page.locator('[data-nb="flip"]').click();
  assert.equal(await page.locator('[data-nb="flip"]').getAttribute('aria-pressed'),'true','flip mode selected');
  assert((await page.locator('#nvBookBody').inputValue()).includes('Tôi viết mỗi ngày'),'same content in flip mode');
  await page.locator('[data-nb="scroll"]').click();
  assert((await page.locator('#nvBookBody').inputValue()).includes('Tôi viết mỗi ngày'),'same content when switching back');
  await page.locator('[data-nb="back"]').click();
  await page.waitForTimeout(550);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="topics"]').click();
  await page.locator('[data-nb="goto-notebooks"]').click();
  await page.waitForTimeout(1000);
  const diag=await page.evaluate(async()=>{
    const open=await new Promise((resolve,reject)=>{const q=indexedDB.open('nv-write-notebooks-v1',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
    const saved=await new Promise((resolve,reject)=>{const q=open.transaction('books','readonly').objectStore('books').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
    return {saved:saved.map(x=>({id:x.id,title:x.title,deleted:x.deleted,archived:x.archived})),memory:window.nvNotebookUI.exportData(),rendered:document.querySelector('#content')?.innerText.slice(0,700),tab:(document.querySelector('#tabs .active')?.textContent)};
  });
  console.log('NOTEBOOK PERSISTENCE AFTER RELOAD:',JSON.stringify(diag));
  assert.equal(await page.locator('[data-nb="open"]').count(),1,'Notebook should be visible after reload '+JSON.stringify(diag));
  await page.locator('[data-nb="open"]').first().click();
  assert((await page.locator('#nvBookBody').inputValue()).includes('Tôi viết mỗi ngày'),'notebook survives page reload');
  const snapshot=await page.evaluate(()=>({legacy:JSON.parse(localStorage.getItem('nv-write-v1')).topics,notebooks:window.nvNotebookUI.exportData()}));
  assert.equal(snapshot.legacy.length,1);
  assert.equal(snapshot.notebooks.length,1);
  assert.deepEqual(errors,[],'no browser errors');
  console.log('PASS: notebooks open, save, flip, reload, XP and legacy isolation');
  await ctx.close();
 }catch(e){console.error(e.stack||e);process.exitCode=1}
 finally{await browser?.close();server.kill()}
})();