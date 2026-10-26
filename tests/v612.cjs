// v6.12.0 static checks (no dependencies): node tests/v612.cjs
const fs=require('fs'),assert=require('assert');
const src=require('./_src.cjs'),sw=fs.readFileSync('sw.js','utf8'),vc=JSON.parse(fs.readFileSync('vercel.json','utf8'));
assert.deepEqual([...src.matchAll(/NV_VERSION\s*=\s*'([^']+)'/g)].map(m=>m[1]),['6.14.0']);assert(/nv-write-v42/.test(sw));
// 1. multi-tab: save merges first, then notifies; tabs listen on BroadcastChannel + storage
assert(src.includes("const save=()=>{try{try{window.nvMergeDisk?.()}"),'save merges other tabs first');
assert(src.includes("new BroadcastChannel('nv-write-sync')")&&src.includes("window.addEventListener('storage'"));
assert(src.includes('window.nvEditorDirty=()=>dirty||composing||!!timer'),'editor exposes dirty state');
// 2. trash
assert(src.includes('data-purge=')&&src.includes('id="nvEmptyTrash"')&&src.includes("status:'purged',deleted:true"));
assert(src.includes("if(!r&&local.status==='purged'&&(ss.full||pushedAt===undefined))continue;"),'never-synced tombstones are not uploaded');
// 3. headers
const h=Object.fromEntries(vc.headers.find(x=>x.source==='/(.*)').headers.map(x=>[x.key,x.value]));const csp=h['Content-Security-Policy'];
for(const d of ["script-src 'self';","connect-src 'self' https://*.supabase.co wss://*.supabase.co","img-src 'self' data: blob:","frame-ancestors 'none'","object-src 'none'","worker-src 'self'","manifest-src 'self'"])assert(csp.includes(d),d);
assert.equal(h['X-Frame-Options'],'DENY');assert.equal(h['X-Content-Type-Options'],'nosniff');assert.equal(h['Referrer-Policy'],'strict-origin-when-cross-origin');assert(h['Permissions-Policy']);
assert(!/ on[a-z]+="/.test(src),'no inline event-handler attributes');
// 4. conflict dialog
assert(!src.includes("'\\\\n\\\\n'"),'no literal \\n\\n in previews');assert(src.includes("version:window.NV_VERSION,")&&!src.includes("version:'6.8.3'"));
assert(src.includes('function nvPickConflicts(')&&src.includes('await nvPickConflicts(snapshot.conflicts'));
// 6. labels
assert(src.includes('aria-multiline="true" aria-label="Nội dung bài viết"'));assert(src.includes('id="saveLabel" title="Tự động lưu" role="img" aria-label="Tự động lưu"'));
assert(src.includes('aria-label="Xóa định dạng" title="Xóa định dạng"'));assert(/<body><h1 class="nv-sr-only">/.test(src));
console.log('PASS: v6.13.0 version/SW v42, multi-tab merge wiring, trash purge + tombstone, vercel.json headers, conflict dialog newlines/version, a11y labels');
