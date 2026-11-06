/* Backup validation and monotonic data merges. Browser- and Node-compatible. */
(function(root){
 'use strict';
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const num=x=>Number.isFinite(Number(x))&&Number(x)>=0;
 const pos=x=>num(x)?Number(x):0;
 const id=x=>typeof x==='string'&&/^[\w.:\-]{1,200}$/.test(x);
 function validateBackup(d){
  if(!obj(d)||!Array.isArray(d.topics))throw Error('File không đúng định dạng Nhanhvale Write.');
  if(d.topics.length>50000)throw Error('Số bài trong file quá lớn.');
  const seen=new Set();
  for(const t of d.topics){
   if(!obj(t)||!id(t.id)||typeof t.title!=='string'||t.title.length>2000||t.content!=null&&typeof t.content!=='string'||seen.has(t.id))throw Error('File có bài viết sai định dạng hoặc trùng mã.');
   seen.add(t.id);
  }
  if(d.logs!==undefined){
   if(!obj(d.logs))throw Error('Nhật ký viết không hợp lệ.');
   for(const [date,v] of Object.entries(d.logs))if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!num(v))throw Error('Nhật ký ngày viết không hợp lệ.');
  }
  if(d.categories!==undefined&&(!Array.isArray(d.categories)||d.categories.some(x=>typeof x!=='string')))throw Error('Danh mục không hợp lệ.');
  if(d.reviewHistory!==undefined&&(!Array.isArray(d.reviewHistory)||d.reviewHistory.some(x=>!obj(x)||!id(x.id)||!id(x.topic_id))))throw Error('Nhật ký ôn tập không hợp lệ.');
  if(d.links!==undefined&&(!Array.isArray(d.links)||d.links.some(x=>!obj(x)||!id(x.id))))throw Error('Dữ liệu liên kết không hợp lệ.');
  if(d.xp!==undefined&&(!obj(d.xp)||!num(d.xp.total??0)||d.xp.events!==undefined&&(!Array.isArray(d.xp.events)||d.xp.events.some(x=>!obj(x)||!id(x.id)||!num(x.words)))||d.xp.high!==undefined&&!obj(d.xp.high)))throw Error('Dữ liệu XP không hợp lệ.');
  return d;
 }
 function mergeDailyLogs(a,b){
  const result={...(obj(a)?a:{})};
  if(obj(b))for(const [date,v] of Object.entries(b))if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&num(v))result[date]=Math.max(pos(result[date]),pos(v));
  return result;
 }
 function mergeXP(a,b){
  if(!obj(b))return a;
  a=obj(a)?a:{};
  if(a.cloud?.user&&b.cloud?.user&&a.cloud.user!==b.cloud.user)throw Error('XP từ hai tài khoản khác nhau. Đã dừng để bảo vệ dữ liệu.');
  const events=new Map();
  for(const e of [...(Array.isArray(a.events)?a.events:[]),...(Array.isArray(b.events)?b.events:[])])if(e&&id(e.id)&&num(e.words))events.set(e.id,{...e,words:pos(e.words)});
  const high={...(obj(a.high)?a.high:{})};
  for(const [k,v] of Object.entries(obj(b.high)?b.high:{}))if(num(v))high[k]=Math.max(pos(high[k]),pos(v));
  const sent=[...new Set([...(Array.isArray(a.sent)?a.sent:[]),...(Array.isArray(b.sent)?b.sent:[])].filter(id))].slice(-1000);
  const eventSum=es=>es.reduce((n,e)=>n+pos(e.words),0);
  const pending=[...events.values()];
  const base=Math.max(pos(a.base),pos(b.base),pos(a.total)-eventSum(a.events||[]),pos(b.total)-eventSum(b.events||[]));
  return {...a,events:pending,high,sent,base,total:Math.max(pos(a.total),pos(b.total),base+eventSum(pending)),cloud:a.cloud||b.cloud||null,initialized:true,expanded:!!a.expanded};
 }
 const validLocalState=d=>obj(d)&&Array.isArray(d.topics)&&d.topics.every(t=>obj(t)&&id(t.id)&&typeof t.title==='string')&&(d.logs===undefined||obj(d.logs))&&(d.settings===undefined||obj(d.settings));
 const api={validateBackup,mergeDailyLogs,mergeXP,validLocalState};
 root.nvDataSafety=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
