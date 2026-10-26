// v6.13.0 e2e: Vietnamese IME (Telex) composition in the editor.
//   BASE=http://localhost:8010/ DEVICE="Pixel 7" node tests/e2e/ime.e2e.cjs
// Finding (c): the "ttiếng" double-compositionstart only happens when a script places the caret on the editor
// element itself at offset childNodes.length after a block child AND the page has content below the editor.
// It reproduces identically on a plain HTML page with zero JavaScript, so it is a Chromium/CDP
// Input.imeSetComposition artefact, not app code. Real clicks/keys/Enter never produce that caret position,
// and the app never sets the selection itself. This test locks in: realistic flows compose once and save
// the right text, the app makes no DOM/selection writes while composing, and app == no-JS page on the artefact case.
const {chromium,devices}=require('playwright');
const BASE=process.env.BASE||'http://localhost:8010/',DEVICE=process.env.DEVICE||'';
const results=[];const check=(name,ok,info)=>{results.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name+(info!==undefined?' '+JSON.stringify(info):''))};
const seed=()=>{if(!localStorage.getItem('nv-write-v1'))localStorage.setItem('nv-write-v1',JSON.stringify({topics:[{id:'ime',title:'IME',content:'abc',updated_at:new Date().toISOString(),created_at:new Date().toISOString(),status:'todo'}],logs:{},settings:{},syncQueue:[]}))};
const spy=()=>{window.__w=[];window.__cs=0;window.__composing=false;const S=Selection.prototype;for(const m of ['addRange','removeAllRanges','collapse','setBaseAndExtent','extend','selectAllChildren','collapseToEnd','collapseToStart'])
  {const o=S[m];S[m]=function(...a){if(window.__composing)__w.push('sel.'+m);return o.apply(this,a)}}
 const d=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{get(){return d.get.call(this)},set(v){if(window.__composing&&this.closest?.('#body'))__w.push('innerHTML');d.set.call(this,v)},configurable:true});
 const si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__composing&&k==='nv-write-v1')__w.push('save');return si.call(this,k,v)};
 document.addEventListener('compositionstart',()=>{__cs++;__composing=true},true);document.addEventListener('compositionend',()=>setTimeout(()=>{__composing=false}),true)};
const WORDS=[['t','ti','tiê','tiếng'],['V','Vi','Viê','Việt'],['đ','đe','đẹ','đẹp']];
async function compose(cdp,p,words){for(const steps of words){for(const c of steps)await cdp.send('Input.imeSetComposition',{text:c,selectionStart:c.length,selectionEnd:c.length});await cdp.send('Input.insertText',{text:steps[steps.length-1]});await cdp.send('Input.insertText',{text:' '})}await p.waitForTimeout(60)}
const bodyText=p=>p.evaluate(()=>document.querySelector('#body').innerText.replace(/\u00a0/g,' '));
(async()=>{const br=await chromium.launch();const opt=DEVICE?devices[DEVICE]:{viewport:{width:1280,height:800}};const errs=[];
 const open=async()=>{const ctx=await br.newContext(opt);await ctx.route(/supabase\.co/,r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.addInitScript(seed);await p.addInitScript(spy);
  await p.goto(BASE,{waitUntil:'networkidle'});await p.evaluate(()=>{current=db.topics.find(t=>t.id==='ime');render()});await p.waitForSelector('#body');return [ctx,p,await ctx.newCDPSession(p)]};
 const tap=async p=>{const b=await p.$('#body');if(DEVICE)await b.tap();else await b.click();await p.keyboard.press(DEVICE?'End':'Control+End');await p.evaluate(()=>{const el=document.querySelector('#body');const s=getSelection();if(!el.contains(s.anchorNode)){}})};
 for(const flow of ['click-end','after-typing','after-enter','empty-editor']){const [ctx,p,cdp]=await open();
  if(flow==='empty-editor'){await p.evaluate(()=>{document.querySelector('#body').innerHTML='';document.querySelector('#body').dispatchEvent(new Event('input',{bubbles:true}))})}
  await tap(p);if(flow==='after-typing')await p.keyboard.type(' xin chào');if(flow==='after-enter'){await p.keyboard.type(' đoạn');await p.keyboard.press('Enter')}
  await p.keyboard.type(flow==='empty-editor'?'':' ');const pre=await bodyText(p);await p.evaluate(()=>{__cs=0;__w=[]});
  await compose(cdp,p,WORDS);const post=await bodyText(p);const st=await p.evaluate(()=>({cs:__cs,w:__w}));
  check(`${flow}: text is pre + "tiếng Việt đẹp "`,post.replace(/\s+$/,'')===(pre+'tiếng Việt đẹp').replace(/\s+$/,'')||post.endsWith('tiếng Việt đẹp '),{tail:post.slice(-30)});
  check(`${flow}: exactly one compositionstart per word`,st.cs===3,st.cs);
  check(`${flow}: app made no DOM/selection/save writes during composition`,st.w.length===0,st.w);
  await p.waitForTimeout(1500);const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('nv-write-v1')).topics.find(t=>t.id==='ime').content);
  check(`${flow}: saved draft contains the composed words`,/tiếng Việt đẹp/.test(saved.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ')),saved.slice(-60));
  await p.evaluate(()=>localStorage.clear());await ctx.close()}
 // Telex without composition (UniKey/EVKey "send keys" mode): characters + backspaces
 {const [ctx,p]=await open();await tap(p);await p.keyboard.type(' ');const pre=await bodyText(p);
  for(const k of ['t','i','e','e'])await p.keyboard.type(k);await p.keyboard.press('Backspace');await p.keyboard.press('Backspace');await p.keyboard.insertText('ê');await p.keyboard.type('ng');await p.keyboard.type('s');for(let i=0;i<4;i++)await p.keyboard.press('Backspace');await p.keyboard.insertText('ếng');
  check('telex backspace mode: "tiếng"',(await bodyText(p))===pre+'tiếng',(await bodyText(p)).slice(-12));await p.evaluate(()=>localStorage.clear());await ctx.close()}
 // Artefact: synthetic caret on the editor element after a block child, with content below the editor.
 const synth=async(p,cdp)=>{await p.evaluate(()=>{const el=document.querySelector('#body');el.innerHTML='abc<div>đoạn 1</div><div>đoạn 2</div>';el.focus();const r=document.createRange();r.setStart(el,el.childNodes.length);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);window.__cs=0});
  for(const c of WORDS[0])await cdp.send('Input.imeSetComposition',{text:c,selectionStart:c.length,selectionEnd:c.length});await cdp.send('Input.insertText',{text:'tiếng'});await p.waitForTimeout(50);
  return p.evaluate(()=>({tail:document.querySelector('#body').innerText.slice(-8),cs:__cs}))};
 let app,pure;{const [ctx,p,cdp]=await open();app=await synth(p,cdp);await p.evaluate(()=>localStorage.clear());await ctx.close()}
 {const ctx=await br.newContext(opt);const p=await ctx.newPage();await p.addInitScript(()=>{window.__cs=0;document.addEventListener('compositionstart',()=>__cs++,true)});
  await p.setContent('<div id="body" contenteditable="true" style="white-space:pre-wrap"></div><p>'+'lorem ipsum '.repeat(2500)+'</p><script>document.addEventListener("compositionstart",()=>__cs++,true)</script>'.replace(/<script>.*<\/script>/,''));
  await p.evaluate(()=>{window.__cs=0;document.addEventListener('compositionstart',()=>__cs++,true)});pure=await synth(p,await ctx.newCDPSession(p));await ctx.close()}
 check('artefact: app behaves exactly like a no-JS contenteditable page on the synthetic element-caret case',app.tail===pure.tail&&app.cs===pure.cs,{app,pure});
 console.log('INFO synthetic element-caret result (Chromium/CDP):',JSON.stringify(pure));
 check('no page errors',errs.length===0,errs);
 const f=results.filter(r=>!r.ok).length;console.log(`${DEVICE||'desktop'}: ${results.length-f}/${results.length} passed`);await br.close();process.exit(f?1:0)})();
