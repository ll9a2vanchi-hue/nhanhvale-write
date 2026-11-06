/* Independent, non-authoritative rotating IndexedDB backup.
   Never restores data automatically, never deletes primary localStorage or cloud records. */
(function(root){
 'use strict';
 const NAME='nv-write-shadow-v1',STORE='snapshots',MAX=3,DELAY=2500;
 let dbPromise=null,pending=null,timer=null,tail=Promise.resolve(),lastHash='';
 const getOwner=()=>{try{return root.localStorage?.getItem('nv-write-owner-v1')||'local'}catch{return 'local'}};
 function open(){
  if(!root.indexedDB)return Promise.reject(Error('IndexedDB không được hỗ trợ trên thiết bị này'));
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   let req;try{req=root.indexedDB.open(NAME,1)}catch(e){reject(e);return}
   req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};
   req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();dbPromise=null};resolve(db)};
   req.onerror=()=>reject(req.error||Error('Không mở được bản sao lưu nội bộ'));
   req.onblocked=()=>reject(Error('Cơ sở dữ liệu sao lưu đang bị khóa ở tab khác'));
  }).catch(e=>{dbPromise=null;throw e});
  return dbPromise;
 }
 async function records(owner=getOwner()){
  const db=await open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();
   req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.owner===owner).sort((a,b)=>b.createdAt-a.createdAt));
   req.onerror=()=>reject(req.error||Error('Không đọc được bản sao lưu'));
   tx.onabort=()=>reject(tx.error||Error('Lỗi đọc bản sao lưu'));
  });
 }
 async function persist(provider,owner){
  const json=typeof provider==='function'?provider():provider;
  if(typeof json!=='string'||!json)throw Error('Bản sao lưu trống');
  const parsed=JSON.parse(json);
  root.nvDataSafety?.validateBackup(parsed);
  const signature=owner+'|'+json;
  // In-memory signature only; do not create identical entries during repeated UI rerenders.
  if(signature===lastHash)return null;
  const db=await open(),now=Date.now(),id=owner+'|'+now+'|'+Math.random().toString(36).slice(2,8);
  const row={id,owner,createdAt:now,size:json.length*2,json};
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(row);
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error||Error('Không ghi được bản sao lưu'));
   tx.onabort=()=>reject(tx.error||Error('Không ghi được bản sao lưu'));
  });
  lastHash=signature;
  const existing=await records(owner);
  if(existing.length>MAX)await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
   for(const old of existing.slice(MAX))store.delete(old.id);
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error||Error('Không dọn được bản sao cũ'));
   tx.onabort=()=>reject(tx.error||Error('Không dọn được bản sao cũ'));
  });
  return row;
 }
 function writeNow(provider,owner=getOwner()){
  if(timer!==null){clearTimeout(timer);timer=null;pending=null}
  const next=tail.then(()=>persist(provider,owner));
  tail=next.catch(e=>{console.warn('WRITE shadow backup failed:',e)});
  return next;
 }
 function schedule(provider){
  if(typeof provider!=='function')return;
  const owner=getOwner();pending={provider,owner};
  if(timer!==null)clearTimeout(timer);
  timer=setTimeout(()=>{
   timer=null;const work=pending;pending=null;
   if(work)writeNow(work.provider,work.owner).catch(()=>{});
  },DELAY);
 }
 async function latest(){return (await records())[0]||null}
 root.nvShadowVault={schedule,writeNow,latest,list:records,supported:()=>!!root.indexedDB};
 if(typeof module!=='undefined'&&module.exports)module.exports={create:()=>root.nvShadowVault};
})(typeof window!=='undefined'?window:globalThis);
