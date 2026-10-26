// v6.13.0 e2e: incremental sync against a fake Supabase that counts requests, rows and bytes.
//   node tests/serve-with-headers.cjs . 8010 & BASE=http://localhost:8010/ node tests/e2e/incremental-sync.e2e.cjs
// MEASURE_ONLY=1 prints the numbers without asserting (used to measure the old build).
const {chromium,devices}=require('playwright');const {createFake,UID,session,SESSION_KEY}=require('./fake-supabase.cjs');
const BASE=process.env.BASE||'http://localhost:8010/',DEVICE=process.env.DEVICE||'',MEASURE=!!process.env.MEASURE_ONLY;
const results=[];const check=(name,ok,info)=>{results.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name+(info!==undefined?' '+JSON.stringify(info):''))};
const iso=(d)=>new Date(Date.UTC(2026,9,1)+d*60000).toISOString();
(async()=>{const fake=createFake();const N=40;
 fake.seed('write_topics',Array.from({length:N},(_,i)=>({id:'t'+i,user_id:UID,title:'Bài '+i,tag:'Chưa phân loại',status:'draft',rating:0,content:('Nội dung bài '+i+'. ').repeat(150),pinned:false,created_at:iso(i),updated_at:iso(i),completed_at:null,last_reviewed:null,last_written:iso(i),review_count:0,deleted:false,paper_color:null,content_html:null,priority:'unclassified',review_due_at:null})));
 fake.seed('write_review_events',Array.from({length:30},(_,i)=>({id:'r'+i,user_id:UID,topic_id:'t'+(i%N),at:iso(i),grade:'good',previous:{},deleted:false,updated_at:iso(i)})));
 fake.seed('write_topic_links',Array.from({length:20},(_,i)=>({id:'l'+i,user_id:UID,a:'t'+i,b:'t'+(i+1),type:'related',deleted:false,updated_at:iso(i)})));
 fake.seed('write_daily_logs',Array.from({length:10},(_,i)=>({user_id:UID,day:'2026-10-'+String(i+10).padStart(2,'0'),words:100+i})));
 fake.seed('write_xp_events',[{id:'baseline:'+UID,user_id:UID,words:1000,created_at:'2026-10-01T00:00:00.000001+00:00'},...Array.from({length:200},(_,i)=>({id:'x'+i,user_id:UID,words:5,created_at:'2026-10-02T00:00:'+String(i%60).padStart(2,'0')+'.'+String(i).padStart(6,'0')+'+00:00'}))]);
 fake.seed('write_categories',[{user_id:UID,names:['Chưa phân loại'],updated_at:iso(0)}]);
 const br=await chromium.launch();const ctx=await br.newContext(DEVICE?devices[DEVICE]:{viewport:{width:1280,height:800}});await ctx.route(/supabase\.co/,fake.handler);
 await ctx.addInitScript(([k,v,u])=>{if(!localStorage.getItem('__seeded')){localStorage.setItem(k,v);localStorage.setItem('nv-write-owner-v1',u);localStorage.setItem('__seeded','1')}},[SESSION_KEY,session,UID]);
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const idle=async()=>{await p.waitForTimeout(150);await p.waitForFunction(()=>!syncing,null,{timeout:15000})};
 const doSync=async()=>{await p.evaluate(()=>sync());await idle()};
 const label=()=>p.$eval('#syncLabel',e=>e.textContent);
 const out={};const take=k=>{const s=fake.snapshot();out[k]={requests:s.requests,rowsDown:s.rowsDown,rowsUp:s.rowsUp,bytesDown:s.bytesDown,bytesUp:s.bytesUp,byTable:s.byTable};fake.reset();return s};
 await p.goto(BASE,{waitUntil:'networkidle'});await p.waitForFunction(()=>db.topics.length>=40,null,{timeout:15000});await idle();await p.waitForTimeout(500);await idle();
 const s1=take('sync1_first_full');if(process.env.LOG)console.log(s1.log.join('\n'));
 check('first sync pulls all topics',s1.byTable.write_topics?.rowsDown>=N,s1.byTable.write_topics);
 await doSync();const s2=take('sync2_no_changes');
 // local edit of one post + one review, then sync
 await p.evaluate(()=>{const t=db.topics.find(x=>x.id==='t3');put(t,{content:t.content+' Thêm một câu mới để đồng bộ.'})});await p.waitForTimeout(300);
 await doSync();const s3=take('sync3_one_local_edit');
 await doSync();const s4=take('sync4_after_edit_no_changes');
 // another device edits one post + adds an xp event in the cloud
 const rt=fake.db.write_topics.get('t7');fake.db.write_topics.set('t7',{...rt,content:'Sửa từ máy khác',updated_at:new Date().toISOString()});
 fake.db.write_xp_events.set('other1',{id:'other1',user_id:UID,words:7,created_at:new Date(Date.now()+5000).toISOString().replace('Z','')+'999+00:00'});
 await doSync();const s5=take('sync5_remote_edit');
 const local=await p.evaluate(()=>({t7:db.topics.find(x=>x.id==='t7').content,t3:db.topics.find(x=>x.id==='t3').content,xp:xp.total,events:xp.events.length,queue:db.syncQueue.length,pending:window.nvHasPending?.(),label:document.querySelector('#syncLabel').textContent}));
 const cloudXp=fake.all('write_xp_events');const cloudSum=cloudXp.reduce((n,e)=>n+e.words,0);const ids=cloudXp.map(e=>e.id);
 // full-pull fallback: drop the watermark state
 await p.evaluate(()=>localStorage.removeItem('nv-write-sync-state-v1'));await doSync();const s6=take('sync6_full_fallback');
 const after=await p.evaluate(()=>({xp:xp.total,label:document.querySelector('#syncLabel').textContent,queue:db.syncQueue.length}));
 console.log(JSON.stringify(out,null,0));
 console.log('SUMMARY');for(const [k,v] of Object.entries(out))console.log(k.padEnd(30),'req',String(v.requests).padStart(3),'rowsDown',String(v.rowsDown).padStart(4),'rowsUp',String(v.rowsUp).padStart(4),'bytesDown',String(v.bytesDown).padStart(7),'bytesUp',String(v.bytesUp).padStart(7));
 if(!MEASURE){
  const tt=k=>out[k].byTable.write_topics||{rowsDown:0,rowsUp:0};
  check('no-change sync downloads 0 topic rows',tt('sync2_no_changes').rowsDown===0,tt('sync2_no_changes'));
  check('no-change sync uploads nothing',out.sync2_no_changes.rowsUp===0,out.sync2_no_changes.rowsUp);
  check('no-change sync: XP table pulled once',(out.sync2_no_changes.byTable.write_xp_events?.requests||0)<=1,out.sync2_no_changes.byTable.write_xp_events);
  check('one local edit uploads exactly 1 topic row',tt('sync3_one_local_edit').rowsUp===1,tt('sync3_one_local_edit'));
  check('one local edit: only changed log day uploaded',(out.sync3_one_local_edit.byTable.write_daily_logs?.rowsUp||0)<=1,out.sync3_one_local_edit.byTable.write_daily_logs);
  check('one local edit: XP pulled once',(out.sync3_one_local_edit.byTable.write_xp_events?.requests||0)<=2&&(out.sync3_one_local_edit.byTable.write_xp_events?.rowsDown||0)<=4,out.sync3_one_local_edit.byTable.write_xp_events);
  check('sync after edit re-downloads at most the edited row',tt('sync4_after_edit_no_changes').rowsDown<=1&&out.sync4_after_edit_no_changes.rowsUp===0,tt('sync4_after_edit_no_changes'));
  check('remote edit: exactly 1 topic row downloaded and applied',tt('sync5_remote_edit').rowsDown===1&&local.t7==='Sửa từ máy khác',tt('sync5_remote_edit'));
  check('second sync bytes << first sync bytes',out.sync2_no_changes.bytesDown*10<out.sync1_first_full.bytesDown,[out.sync1_first_full.bytesDown,out.sync2_no_changes.bytesDown]);
  check('local edit kept',/Thêm một câu mới/.test(local.t3));
  check('XP total equals cloud sum (no loss, no double count)',local.xp===cloudSum&&local.events===0,{local:local.xp,cloudSum});
  check('no duplicate XP ids in cloud',new Set(ids).size===ids.length);
  check('nothing pending after sync',local.queue===0&&local.pending===false,local);
  check('full fallback: no re-upload, XP unchanged',out.sync6_full_fallback.byTable.write_topics?.rowsUp===undefined||out.sync6_full_fallback.byTable.write_topics.rowsUp===0,out.sync6_full_fallback.byTable.write_topics);
  check('full fallback XP total still equals cloud sum',after.xp===cloudSum,after);
  check('no sync error label',!/⚠/.test(local.label+after.label),[local.label,after.label]);
  check('no page errors',!errs.length,errs);
 }
 await p.evaluate(()=>localStorage.clear());await br.close();const fail=results.filter(r=>!r.ok).length;console.log(MEASURE?'MEASURED':fail?'INCREMENTAL FAIL '+fail:'INCREMENTAL PASS '+results.length);process.exit(fail?1:0)})();
