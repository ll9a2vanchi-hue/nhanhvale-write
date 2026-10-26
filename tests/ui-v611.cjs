// v6.11.0 UI/UX regressions (no dependencies): node tests/ui-v611.cjs
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
// 4. one version constant drives title, badge text, aria-label and tooltip
const versions=[...src.matchAll(/NV_VERSION\s*=\s*'([^']+)'/g)].map(m=>m[1]);
assert.deepEqual(versions,['6.13.0'],'exactly one NV_VERSION constant');
assert(!/v6\.\d+(\.\d+)?<\/span>|Phiên bản 4\.3|<title>[^<]*v\d/.test(src),'no hard-coded version strings in markup');
assert(/e\.textContent='v'\+v;e\.setAttribute\('aria-label','Phiên bản '\+v\);e\.title='Phiên bản '\+v/.test(src));
assert(/nv-write-v41/.test(sw),'service worker cache bumped');
// 4. signed-out first run is neutral, not a warning
assert(src.includes("'Đang lưu trên máy · Đăng nhập để đồng bộ'"));
assert(/nvNoSession=\/Cần đăng nhập qua email trước\|Auth session missing\/i/.test(src));
assert(src.includes('id="nvFirstWrite"')&&src.includes('nv-welcome'));
// 5. no native confirm for delete; soft delete + restore through put() so sync sees a newer updated_at
assert(!src.includes("confirm('Chuyển bài vào trạng thái đã xóa?')"));
assert(src.includes("on('#delete','click',()=>window.nvDeleteTopic(t))"));
assert(src.includes("put(t,{deleted:true})")&&src.includes("put(t,{deleted:false})"));
const danger=src.indexOf('nv-danger-zone"'),grades=src.indexOf('nv-review-grade-row'),del=src.indexOf('id="delete"');
assert(del>danger&&danger>grades,'Xóa bài lives in its own danger zone below the review buttons');
// 2. celebration routing: writing mode -> compact toast (no confetti); ceremony off -> nothing
const start=src.indexOf('window.nvCelebrate=(type,label)=>');const end=src.indexOf('\n',start);
const calls=[];const mk=writing=>{const ctx={fx:{ceremony:true},vibrate(){},confetti(){calls.push('confetti')},popup:{innerHTML:'',querySelector:()=>({textContent:''}),classList:{add:()=>calls.push('popup'),remove(){}}},clearTimeout(){},setTimeout(){},close:0,document:{body:{classList:{contains:k=>k==='writing-mode'&&writing}}},window:{nvWritingToast:(t,l)=>calls.push('toast:'+t+'|'+l)}};vm.createContext(ctx);vm.runInContext(src.slice(start,end).replace('window.nvCelebrate=','this.nvCelebrate='),ctx);return ctx};
let c=mk(true);c.nvCelebrate('streak','Đã đạt mục tiêu viết hôm nay!');assert.deepEqual(calls,['toast:Đã đạt mục tiêu hôm nay!|']);
calls.length=0;c=mk(false);c.nvCelebrate('award','10 bài');assert.deepEqual(calls,['popup','confetti']);
calls.length=0;c=mk(true);c.fx.ceremony=false;c.nvCelebrate('streak');assert.deepEqual(calls,[]);
// 3. paper colour pick closes the panel
assert(src.includes("x.classList.toggle('selected',x===b));paperPanel.hidden=true})"));
// 1. dark editor: dark paper + light ink, no rule forcing dark ink
assert(!src.includes('html[data-theme=dark] .rich-editor{color:#1e293b}'));
assert(src.includes('html[data-theme=dark] .write-document[style]{--paper:var(--paper-d)!important}'));
for(const c of ['#b84545','#2870a5','#278060','#8456a9','#293447'])assert(src.includes(`font[color="${c}" i]`),'dark ink mapping for '+c);
console.log('PASS: v6.11.0 version constant, neutral signed-out label, welcome, delete confirm/undo/trash wiring, celebration routing, paper panel close, dark editor rules');
