// Minimal in-memory PostgREST + GoTrue fake for Playwright (page/context.route). No real network or DB.
// Supports select, eq/gt/gte/in filters, upsert (on_conflict, ignore-duplicates), maybeSingle, the
// write_topics stale-write trigger, server-side created_at for write_xp_events, and request/row/byte counters.
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const UID='00000000-0000-4000-8000-000000000001';
const user={id:UID,aud:'authenticated',role:'authenticated',email:'t@example.com',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:UID,exp:4102444800,role:'authenticated',aud:'authenticated',email:'t@example.com'})+'.sig';
const session=JSON.stringify({access_token:jwt,refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:4102444800,user});
const KEYS={write_topics:['id'],write_review_events:['id'],write_topic_links:['id'],write_xp_events:['id'],write_categories:['user_id'],write_daily_logs:['user_id','day']};
let tick=0;const serverNow=()=>new Date(Date.now()+(tick++%1000)/1000).toISOString().replace('Z','')+'123+00:00';
function createFake(){
 const db={};for(const t in KEYS)db[t]=new Map();
 const stats={requests:0,byTable:{},rowsDown:0,rowsUp:0,bytesDown:0,bytesUp:0,log:[]};
 const reset=()=>{Object.assign(stats,{requests:0,byTable:{},rowsDown:0,rowsUp:0,bytesDown:0,bytesUp:0,log:[]})};
 const keyOf=(t,r)=>KEYS[t].map(k=>r[k]).join('|');
 const unq=v=>v.replace(/^"|"$/g,'');
 const cmp=(a,b)=>{const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?x-y:String(a).localeCompare(String(b))};
 function filter(rows,params){for(const [k,v] of params){if(['select','on_conflict','order','limit','columns'].includes(k))continue;const m=/^(eq|gt|gte|lt|lte|in|is)\.(.*)$/.exec(v);if(!m)continue;const [_,op,val]=m;rows=rows.filter(r=>{const x=r[k];if(op==='eq')return String(x)===val;if(op==='gt')return x!=null&&cmp(x,val)>0;if(op==='gte')return x!=null&&cmp(x,val)>=0;if(op==='lt')return cmp(x,val)<0;if(op==='lte')return cmp(x,val)<=0;if(op==='in')return val.replace(/^\(|\)$/g,'').split(',').map(unq).includes(String(x));if(op==='is')return val==='null'?x==null:true;return true})}return rows}
 function project(rows,sel){if(!sel||sel==='*')return rows;const cols=sel.split(',').map(s=>s.trim());return rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]===undefined?null:r[c]])))}
 async function handler(route){const req=route.request(),u=new URL(req.url());
  if(u.pathname.startsWith('/auth/v1/')){stats.requests++;stats.log.push('AUTH '+u.pathname);const body=JSON.stringify(u.pathname==='/auth/v1/user'?user:{});stats.bytesDown+=body.length;return route.fulfill({status:200,contentType:'application/json',body})}
  if(!u.pathname.startsWith('/rest/v1/'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  const t=u.pathname.split('/').pop();const tab=db[t]||(db[t]=new Map());const params=[...u.searchParams.entries()];stats.requests++;const bt=stats.byTable[t]||(stats.byTable[t]={requests:0,rowsDown:0,rowsUp:0,bytesDown:0,bytesUp:0});bt.requests++;
  const method=req.method();
  if(method==='GET'||method==='HEAD'){let rows=filter([...tab.values()],params);rows=project(rows,u.searchParams.get('select'));const single=/vnd\.pgrst\.object/.test(req.headers()['accept']||'');let body;let status=200;if(single){if(rows.length>1){status=406;body=JSON.stringify({message:'multiple rows'})}else if(!rows.length){status=406;body=JSON.stringify({code:'PGRST116',message:'0 rows',details:'The result contains 0 rows'})}else body=JSON.stringify(rows[0])}else body=JSON.stringify(rows);stats.rowsDown+=rows.length;stats.bytesDown+=body.length;bt.rowsDown+=rows.length;bt.bytesDown+=body.length;stats.log.push(`GET ${t}?${u.search.slice(1,140)} -> ${rows.length} rows ${body.length}B`);return route.fulfill({status,contentType:'application/json',body})}
  const raw=req.postData()||'[]';stats.bytesUp+=raw.length;bt.bytesUp+=raw.length;const bodyJ=JSON.parse(raw);const rows=Array.isArray(bodyJ)?bodyJ:[bodyJ];stats.rowsUp+=rows.length;bt.rowsUp+=rows.length;stats.log.push(`${method} ${t} <- ${rows.length} rows ${raw.length}B`);
  const ignore=/ignore-duplicates/.test(req.headers()['prefer']||'');
  for(const r0 of rows){const r={...r0};const k=keyOf(t,r);const old=tab.get(k);if(t==='write_topics'&&old&&!(Date.parse(r.updated_at)>Date.parse(old.updated_at)))return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'Stale write rejected'})});if(old&&ignore)continue;if(t==='write_xp_events'&&!old)r.created_at=serverNow();if(['write_review_events','write_topic_links','write_categories'].includes(t)&&!r.updated_at)r.updated_at=serverNow();tab.set(k,old?{...old,...r}:r)}
  return route.fulfill({status:201,contentType:'application/json',body:''})}
 const seed=(t,rows)=>{for(const r of rows)db[t].set(keyOf(t,r),{...r})};
 const all=t=>[...db[t].values()];
 const snapshot=()=>JSON.parse(JSON.stringify({requests:stats.requests,rowsDown:stats.rowsDown,rowsUp:stats.rowsUp,bytesDown:stats.bytesDown,bytesUp:stats.bytesUp,byTable:stats.byTable,log:stats.log}));
 return {db,stats,reset,handler,seed,all,snapshot};
}
module.exports={createFake,UID,user,session,jwt,SESSION_KEY:'sb-aiqqnssdnzjelpcyzlqp-auth-token'};
