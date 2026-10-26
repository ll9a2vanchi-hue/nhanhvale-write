// v6.13.0 static checks (no dependencies): node tests/v613.cjs
const fs=require('fs'),assert=require('assert');const src=require('./_src.cjs'),sw=fs.readFileSync(__dirname+'/../sw.js','utf8');
assert.deepEqual([...src.matchAll(/NV_VERSION\s*=\s*'([^']+)'/g)].map(m=>m[1]),['6.14.1']);assert(/nv-write-v43/.test(sw));
// (a) incremental sync wiring
assert(src.includes("const NV_SS='nv-write-sync-state-v1'"),'sync state key');
assert(/tq=tq\.gt\('updated_at',ss\.topics\.wm\)/.test(src),'topics incremental filter');
assert(/rq=rq\.gt\('updated_at',ss\.reviews\.wm\)/.test(src)&&/lq=lq\.gt\('updated_at',ss\.links\.wm\)/.test(src),'reviews/links incremental filter');
assert(/q=q\.gte\('created_at',since\)/.test(src),'xp delta pull by server created_at');
assert((src.match(/from\('write_xp_events'\)\.select/g)||[]).length===1,'xp select defined once (xpPull)');
assert(src.includes("from('write_daily_logs').select('day,words').eq('user_id',user.id)"),'logs filtered by user');
assert(src.includes("filter(([day,words])=>ss.logs.pushed[day]!==words)"),'only changed log days uploaded');
assert(src.includes("window.nvResetSyncState?.();db.topics=[...map.values()]"),'import forces a full pull');
assert(src.includes("window.nvResetSyncState?.();render()"),'logout forces a full pull');
assert(/stale write\/i\.test\(upError\.message\|\|''\)\)window\.nvResetSyncState\(\)/.test(src),'stale write resets watermarks');
assert(src.includes("Date.now()-nvT(s.fullAt)>12*3600e3"),'periodic full pull safety net');
assert(src.includes("setInterval(()=>{if(navigator.onLine&&window.nvHasPending())sync()},30000)"),'interval skips when nothing pending');
assert(src.includes("navigator.locks.request('nv-write-sync',{ifAvailable:true}"),'one tab syncs at a time');
// multi-tab aux merge
for(const k of ['links','reviews','xp'])assert(src.includes(`window.nvMergeAux?.('${k}')`),'merge before save: '+k);
assert(src.includes("new BroadcastChannel('nv-write-aux')"));
// (b) UI
assert(src.includes('==== nv-v613-css ====')&&/body\.writing-mode \.nv-xp\{display:none(!important)?\}/.test(src)&&/body\.writing-mode #wordCount\{display:none(!important)?\}/.test(src));
assert(src.includes(':focus-visible{outline:3px solid #2f6fdb!important'));
assert(src.includes('</span> Chuỗi ngày</small>')&&src.includes('điểm XP</small>')&&src.includes('aria-label="Sao chép bài"')&&src.includes('<small>Tô sáng</small>')&&src.includes('aria-label="Xóa định dạng" title="Xóa định dạng"'));
assert(!/>Streak</.test(src)&&!/Copy bài/.test(src)&&!/aria-label="Highlight/.test(src));
assert(src.includes('class="format-button nv-color-toggle" aria-expanded="false"'));
// (c) IME
assert(!/compositionstart[^\n]{0,200}(addRange|removeAllRanges|innerHTML\s*=)/.test(src),'no selection/DOM writes in compositionstart handlers');
console.log('PASS: v6.13.0 version/SW v43, incremental sync wiring, multi-tab aux merge, UI labels/CSS, IME guard');
